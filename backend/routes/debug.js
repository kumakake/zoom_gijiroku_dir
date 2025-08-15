const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const queueService = require('../services/queueService');
const zoomUtils = require('../utils/zoom');
const OpenAIService = require('../services/openaiService');
const AnthropicService = require('../services/anthropicService');
const EmailService = require('../services/emailService');
const Bull = require('bull');
const { authenticateToken } = require('../middleware/auth');
const tenantZoomService = require('../services/tenantZoomService');

// サービスインスタンスを作成
const openaiService = new OpenAIService();
const anthropicService = new AnthropicService();
const emailService = new EmailService();
const TranscriptWorker = require('../workers/transcriptWorker');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// データベース接続プール
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis設定（REDIS_URL優先、PM2 ecosystem.config.js対応）
let redisConfig;

if (process.env.REDIS_URL) {
	// REDIS_URLが設定されている場合（本番環境 - PM2）
	console.log('📡 REDIS_URLを使用:', process.env.REDIS_URL.replace(/:([^:@]+)@/, ':***@'));
	redisConfig = process.env.REDIS_URL;
} else {
	// 個別設定（開発環境 - Docker）
	console.log('🔧 個別Redis設定を使用:', `${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
	redisConfig = {
		redis: {
			port: process.env.REDIS_PORT || 6379,
			host: process.env.REDIS_HOST || 'redis',
			password: process.env.REDIS_PASSWORD || null,
			db: 0,
			maxRetriesPerRequest: 3,
			retryDelayOnFailover: 1000,
			enableReadyCheck: true,
			maxLoadingTimeout: 5000,
			connectTimeout: 15000,
			commandTimeout: 8000,
			lazyConnect: false,
			enableOfflineQueue: true,
			keepAlive: 30000,
			family: 4
		}
	};
}

// キュー接続キャッシュ
let queueCache = new Map();

// デバッグ用ファイルアップロード設定
const debugStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = path.join(__dirname, '../uploads/debug');
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
		cb(null, `debug_${timestamp}_${safeName}`);
	}
});

// 最大100MBまでアップロード可能（25MB超ファイルテスト用）
const debugUpload = multer({ 
	storage: debugStorage,
	limits: { 
		fileSize: 100 * 1024 * 1024 // 100MB
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = /\.(mp3|m4a|wav|mp4|avi|mov)$/i;
		if (allowedTypes.test(file.originalname)) {
			cb(null, true);
		} else {
			cb(new Error('音声/動画ファイルのみアップロード可能です'), false);
		}
	}
});

// キュー作成ヘルパー関数（キャッシュなし）
function createQueue(queueName) {
	// キュー名の決定
	let queueDisplayName;
	if (queueName === 'transcript') {
		queueDisplayName = 'transcript processing';
	} else if (queueName === 'email') {
		queueDisplayName = 'email sending';
	} else {
		throw new Error(`無効なキュー名: ${queueName}`);
	}
	
	// REDIS_URLの場合は文字列、個別設定の場合はオブジェクト
	let queue;
	if (typeof redisConfig === 'string') {
		// REDIS_URL使用（本番環境）
		queue = new Bull(queueDisplayName, redisConfig, {
			redis: {
				maxRetriesPerRequest: 3,
				retryDelayOnFailover: 1000,
				enableReadyCheck: true,
				maxLoadingTimeout: 5000,
				connectTimeout: 15000,
				commandTimeout: 8000,
				lazyConnect: false,
				enableOfflineQueue: true,
				keepAlive: 30000,
				family: 4
			}
		});
	} else {
		// 個別設定使用（開発環境）
		queue = new Bull(queueDisplayName, redisConfig);
	}
	
	return queue;
}

// プロセス終了時のクリーンアップ
process.on('SIGTERM', async () => {
	console.log('プロセス終了、キュー接続をクリーンアップしています...');
	for (const [key, queue] of queueCache) {
		try {
			await queue.close();
		} catch (error) {
			console.error(`キュー ${key} のクローズエラー:`, error);
		}
	}
	queueCache.clear();
});

// Redis接続テスト関数
async function testRedisConnection() {
	try {
		const Redis = require('ioredis');
		
		// 環境変数の詳細ログ
		console.log('🔍 Redis接続設定確認:');
		console.log('  REDIS_URL:', process.env.REDIS_URL ? 'あり（マスク済み）' : 'なし');
		console.log('  REDIS_HOST:', process.env.REDIS_HOST || 'redis (デフォルト)');
		console.log('  REDIS_PORT:', process.env.REDIS_PORT || '6379 (デフォルト)');
		console.log('  NODE_ENV:', process.env.NODE_ENV || 'なし');
		
		let testRedis;
		
		if (process.env.REDIS_URL) {
			// REDIS_URL使用（本番環境）
			console.log('📡 REDIS_URLで接続テスト中...');
			testRedis = new Redis(process.env.REDIS_URL, {
				connectTimeout: 5000,
				commandTimeout: 3000,
				maxRetriesPerRequest: 3,
				retryDelayOnFailover: 1000,
				lazyConnect: false,
				enableOfflineQueue: true
			});
		} else {
			// 個別設定使用（開発環境）
			console.log('🔧 個別設定で接続テスト中...');
			testRedis = new Redis({
				port: process.env.REDIS_PORT || 6379,
				host: process.env.REDIS_HOST || 'redis',
				password: process.env.REDIS_PASSWORD || null,
				db: 0,
				connectTimeout: 5000,
				commandTimeout: 3000,
				maxRetriesPerRequest: 3,
				retryDelayOnFailover: 1000,
				lazyConnect: false,
				enableOfflineQueue: true
			});
		}
		
		await testRedis.ping();
		await testRedis.disconnect();
		console.log('✅ Redis接続テスト成功');
		return true;
	} catch (error) {
		console.error('❌ Redis接続テスト失敗:', error.message);
		console.error('   エラーコード:', error.code);
		return false;
	}
}

// デバッグ用のサンプルデータ（動的に account_id を設定）
function createSampleZoomWebhook(accountId) {
	return {
		event: 'recording.completed',
		event_ts: Date.now(),
		payload: {
			account_id: accountId,
			object: {
				uuid: 'test-meeting-uuid-' + Date.now(),
				meeting_id: 123456789,
				host_id: 'test-host-id',
				topic: 'テスト会議 - Zoom議事録自動配布システム',
				type: 2,
				start_time: new Date().toISOString(),
				duration: 3600,
				recording_files: [
					{
						id: 'test-recording-id-audio',
						meeting_id: 123456789,
						recording_start: new Date().toISOString(),
						recording_end: new Date(Date.now() + 3600000).toISOString(),
						file_type: 'M4A',
						file_size: 15728640,
						play_url: 'https://example.com/test-audio.m4a',
						download_url: 'https://example.com/test-audio.m4a',
						status: 'completed'
					}
				]
			}
		}
	};
}

// 認証ミドルウェアとテナント管理者アクセス制御
router.use(authenticateToken);

// テナント管理者権限チェック
const requireTenantAdmin = (req, res, next) => {
	if (req.user.role !== 'tenant_admin' && req.user.role !== 'admin') {
		return res.status(403).json({
			error: 'テナント管理者または管理者権限が必要です',
			code: 'INSUFFICIENT_PERMISSIONS'
		});
	}
	next();
};

router.use(requireTenantAdmin);

// テナント固有のZoom設定を取得する関数
async function getTenantZoomCredentials(req) {
	// システム管理者の場合は環境変数を使用
	if (req.user.role === 'admin') {
		return {
			account_id: process.env.ZOOM_ACCOUNT_ID,
			client_id: process.env.ZOOM_CLIENT_ID,
			client_secret: process.env.ZOOM_CLIENT_SECRET,
			webhook_secret: process.env.ZOOM_WEBHOOK_SECRET
		};
	}
	
	// テナント管理者の場合はテナント固有の設定を使用
	const tenantId = req.user.tenant_id;
	if (!tenantId) {
		throw new Error('テナントIDが見つかりません');
	}
	
	const zoomCredentials = await tenantZoomService.getZoomCredentials(tenantId);
	if (!zoomCredentials) {
		throw new Error('Zoom設定が見つかりません。テナント設定でZoom認証情報を設定してください。');
	}
	
	return {
		account_id: zoomCredentials.zoom_account_id,
		client_id: zoomCredentials.zoom_client_id,
		client_secret: zoomCredentials.zoom_client_secret,
		webhook_secret: zoomCredentials.zoom_webhook_secret
	};
}

// 1. Zoom Webhook受信テスト
router.post('/test-webhook', async (req, res) => {
	try {
		console.log('=== Zoom Webhook受信テスト開始 ===');
		
		// テナント固有のZoom設定を取得
		const zoomCredentials = await getTenantZoomCredentials(req);
		
		// リクエストデータの確認（空の場合はサンプルデータを使用）
		const testData = (req.body && Object.keys(req.body).length > 0) ? req.body : createSampleZoomWebhook(zoomCredentials.account_id);
		console.log('受信データ:', JSON.stringify(testData, null, 2));
		
		// Webhook処理のシミュレーション
		if (testData.event === 'recording.completed') {
			// agent_jobsテーブルに記録（現在のスキーマに合わせて調整）
			const insertResult = await pool.query(
				`INSERT INTO agent_jobs (tenant_id, type, status, meeting_id, data) 
				VALUES ($1, $2, $3, $4, $5) RETURNING *`,
				[
					req.user?.tenant_id || 'system', // テナントID
					'transcript_generation',
					'pending',
					testData.payload.object.meeting_id.toString(), // meeting_id（文字列）
					JSON.stringify({
						webhook_data: testData, // Webhook全体をdataに保存
						meeting_uuid: testData.payload.object.uuid,
						meeting_topic: testData.payload.object.topic,
						recording_files: testData.payload.object.recording_files
					}) // 必要な情報をdataカラムに整理して保存
				]
			);
			
			console.log('✅ ジョブ登録成功:', insertResult.rows[0]);
			
			res.json({
				success: true,
				message: 'Webhook受信テスト成功',
				jobId: insertResult.rows[0].id,
				data: testData
			});
		} else {
			res.json({
				success: false,
				message: 'サポートされていないWebhookイベント',
				event: testData.event
			});
		}
	} catch (error) {
		console.error('❌ Webhook受信テストエラー:', error);
		res.status(500).json({
			success: false,
			message: 'Webhook受信テストに失敗しました',
			error: error.message
		});
	}
});

// 2. Zoom API認証テスト
router.post('/test-auth', async (req, res) => {
	try {
		console.log('=== Zoom API認証テスト開始 ===');
		
		// テナント固有のZoom設定を取得
		const zoomCredentials = await getTenantZoomCredentials(req);
		
		// 認証情報の確認
		const requiredFields = ['account_id', 'client_id', 'client_secret'];
		const missingFields = requiredFields.filter(field => !zoomCredentials[field]);
		
		if (missingFields.length > 0) {
			return res.status(400).json({
				success: false,
				message: '必要なZoom設定が不足しています',
				missingFields,
				userRole: req.user.role,
				tenantId: req.user.tenant_id
			});
		}
		
		// アクセストークン取得のテスト
		const credentials = Buffer.from(`${zoomCredentials.client_id}:${zoomCredentials.client_secret}`).toString('base64');
		
		console.log('認証情報:', {
			accountId: zoomCredentials.account_id,
			clientId: zoomCredentials.client_id,
			clientSecret: zoomCredentials.client_secret.substring(0, 8) + '...',
			userRole: req.user.role,
			tenantId: req.user.tenant_id
		});
		
		const response = await axios.post(
			'https://zoom.us/oauth/token',
			`grant_type=account_credentials&account_id=${zoomCredentials.account_id}`,
			{
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}
		);
		
		console.log('✅ 認証成功:', {
			access_token: response.data.access_token.substring(0, 20) + '...',
			token_type: response.data.token_type,
			expires_in: response.data.expires_in
		});
		
		res.json({
			success: true,
			message: 'Zoom API認証テスト成功',
			tokenInfo: {
				token_type: response.data.token_type,
				expires_in: response.data.expires_in,
				access_token: response.data.access_token.substring(0, 20) + '...'
			}
		});
		
	} catch (error) {
		console.error('❌ Zoom API認証テストエラー:', error.response?.data || error.message);
		res.status(500).json({
			success: false,
			message: 'Zoom API認証テストに失敗しました',
			error: error.response?.data || error.message
		});
	}
});

// 3.5. Zoom APIスコープテスト
router.post('/test-scopes', async (req, res) => {
	console.log('🔍 Zoom APIスコープテスト開始');
	
	try {
		const tenantId = req.user.tenant_id || req.body.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
		console.log(`🔍 APIスコープテスト: テナント ${tenantId} でテスト実行`);
		
		// 1. 認証テスト
		const authResult = await testZoomAuth(tenantId);
		if (!authResult.success) {
			return res.json({
				success: false,
				error: 'Zoom認証に失敗しました',
				details: authResult
			});
		}
		
		const accessToken = authResult.accessToken;
		const scopeTests = [];
		
		// 2. 必須スコープの権限テスト（システム動作に不可欠な2つのみ）
		console.log(`🔍 必須スコープテスト開始: アクセストークン取得済み`);
		
		// 1. cloud_recording:read:list_recording_files:admin テスト（最重要：録画ファイル取得）
		console.log(`🔍 cloud_recording:read:list_recording_files:admin テスト開始`);
		const rawMeetingId = req.body.testMeetingId;
		const testMeetingId = rawMeetingId ? rawMeetingId.replace(/\s+/g, '') : rawMeetingId; // 空白を自動除去
		console.log(`🔍 テスト会議ID: ${rawMeetingId} → ${testMeetingId}`);
		
		try {
			const recordingResponse = await axios.get(
				`https://api.zoom.us/v2/meetings/${testMeetingId}/recordings`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json'
					}
				}
			);
			
			scopeTests.push({
				scope: 'cloud_recording:read:list_recording_files:admin',
				endpoint: `/v2/meetings/{id}/recordings`,
				status: 'success',
				description: '録画ファイル一覧取得権限（必須）',
				data: `録画ファイル数: ${recordingResponse.data.recording_files?.length || 0}`,
				priority: 'critical'
			});
		} catch (error) {
			console.log(`❌ cloud_recording:read:list_recording_files:admin テストエラー:`, error.response?.status, error.message);
			
			let errorMessage = error.message;
			let errorStatus = 'error';
			
			if (error.response?.status === 404) {
				errorMessage = `会議 ${testMeetingId} が見つかりません（会議IDを確認してください）`;
				errorStatus = 'warning';
			} else if (error.response?.status === 403) {
				errorMessage = 'スコープ権限が不足しています。Zoom App設定を確認してください';
			}
			
			scopeTests.push({
				scope: 'cloud_recording:read:list_recording_files:admin',
				endpoint: `/v2/meetings/{id}/recordings`,
				status: errorStatus,
				description: '録画ファイル一覧取得権限（必須）',
				error: errorMessage,
				priority: 'critical'
			});
		}
		
		// 2. report:read:list_meeting_participants:admin テスト（重要：参加者情報取得）
		console.log(`🔍 report:read:list_meeting_participants:admin テスト開始`);
		try {
			const participantResponse = await axios.get(
				`https://api.zoom.us/v2/report/meetings/${testMeetingId}/participants`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json'
					},
					params: {
						page_size: 10
					}
				}
			);
			
			scopeTests.push({
				scope: 'report:read:list_meeting_participants:admin',
				endpoint: `/v2/report/meetings/{id}/participants`,
				status: 'success',
				description: '参加者情報取得権限（必須）',
				data: `参加者数: ${participantResponse.data.participants?.length || 0}`,
				priority: 'critical'
			});
		} catch (error) {
			console.log(`❌ report:read:list_meeting_participants:admin テストエラー:`, {
				status: error.response?.status,
				message: error.message,
				data: error.response?.data
			});
			
			let errorMessage = error.message;
			let errorStatus = 'error';
			
			if (error.response?.status === 404) {
				errorMessage = `会議 ${testMeetingId} が見つかりません（会議IDを確認してください）`;
				errorStatus = 'warning';
			} else if (error.response?.status === 403) {
				errorMessage = 'スコープ権限が不足しています。Zoom App設定を確認してください';
			}
			
			scopeTests.push({
				scope: 'report:read:list_meeting_participants:admin',
				endpoint: `/v2/report/meetings/{id}/participants`,
				status: errorStatus,
				description: '参加者情報取得権限（必須）',
				error: errorMessage,
				priority: 'critical'
			});
		}
		
		// 結果サマリー
		console.log(`🔍 全スコープテスト完了、結果サマリー作成中`);
		console.log(`📊 スコープテスト結果:`, scopeTests.map(t => `${t.scope}: ${t.status}`));
		const successCount = scopeTests.filter(test => test.status === 'success').length;
		const totalCount = scopeTests.length;
		
		res.json({
			success: true,
			message: `Zoom APIスコープテスト完了 (${successCount}/${totalCount} 成功)`,
			tenant_id: tenantId,
			access_token_status: 'valid',
			scope_tests: scopeTests,
			summary: {
				total: totalCount,
				success: successCount,
				failed: totalCount - successCount
			},
			recommendations: generateScopeRecommendations(scopeTests)
		});
		
	} catch (error) {
		console.error('❌ Zoom APIスコープテストエラー:', error);
		res.json({
			success: false,
			error: error.message,
			details: error.response?.data || {}
		});
	}
});

// 必須スコープテスト結果に基づく推奨事項生成（簡素化版）
function generateScopeRecommendations(scopeTests) {
	const recommendations = [];
	const failedCriticalScopes = [];
	
	scopeTests.forEach(test => {
		// 404エラー以外の実際のエラーをチェック
		if (test.status === 'error' && !test.error?.includes('見つかりません')) {
			switch (test.scope) {
				case 'cloud_recording:read:list_recording_files:admin':
					failedCriticalScopes.push(test.scope);
					recommendations.push({
						scope: test.scope,
						message: 'システム動作に必須です。録画ファイル取得ができません。',
						priority: 'critical',
						action: 'Zoom App Marketplace > Scopes > cloud_recording:read:list_recording_files:admin を有効化'
					});
					break;
				case 'report:read:list_meeting_participants:admin':
					failedCriticalScopes.push(test.scope);
					recommendations.push({
						scope: test.scope,
						message: 'システム動作に必須です。参加者への自動配布ができません。',
						priority: 'critical',
						action: 'Zoom App Marketplace > Scopes > report:read:list_meeting_participants:admin を有効化'
					});
					break;
			}
		}
	});
	
	// 結果に応じたメッセージ
	if (failedCriticalScopes.length === 0) {
		recommendations.push({
			scope: 'system',
			message: '必須スコープは全て正常です。システムは正常に動作します。',
			priority: 'success',
			action: '追加の設定は不要です'
		});
	} else {
		recommendations.unshift({
			scope: 'system',
			message: `${failedCriticalScopes.length}/2 の必須スコープでエラーが発生しています。システムが正常に動作しない可能性があります。`,
			priority: 'critical',
			action: '上記のスコープエラーを至急修正してください'
		});
	}
	
	return recommendations;
}

// 3. 録画データ取得テスト
router.post('/test-recording/:meetingId', async (req, res) => {
	try {
		console.log('=== 録画データ取得テスト開始 ===');
		
		// Meeting IDを正規化
		const rawMeetingId = req.params.meetingId;
		const meetingId = zoomUtils.normalizeMeetingId(rawMeetingId);
		console.log(`📝 Meeting ID正規化: "${rawMeetingId}" → "${meetingId}"`);
		
		// テナント固有のZoom設定を取得
		const zoomCredentials = await getTenantZoomCredentials(req);
		
		// アクセストークン取得
		const credentials = Buffer.from(`${zoomCredentials.client_id}:${zoomCredentials.client_secret}`).toString('base64');
		const tokenResponse = await axios.post(
			'https://zoom.us/oauth/token',
			`grant_type=account_credentials&account_id=${zoomCredentials.account_id}`,
			{
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}
		);
		
		const accessToken = tokenResponse.data.access_token;
		console.log('✅ アクセストークン取得成功');
		
		// 録画データ取得
		const recordingResponse = await axios.get(
			`https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			}
		);
		
		// 参加者情報も取得を試行（利用可能な場合）
		let participants = [];
		try {
			const participantsResponse = await axios.get(
				`https://api.zoom.us/v2/report/meetings/${meetingId}/participants`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json'
					},
					params: {
						page_size: 30 // 最大30名まで取得
					}
				}
			);
			
			participants = participantsResponse.data.participants?.map(p => ({
				name: p.name || p.user_name || 'Unknown',
				email: p.user_email || '',
				join_time: p.join_time,
				leave_time: p.leave_time,
				duration: p.duration
			})) || [];
			
			console.log('✅ 参加者情報取得成功:', {
				participantCount: participants.length,
				participants: participants.map(p => p.name)
			});
		} catch (participantError) {
			console.log('⚠️ 参加者情報取得失敗（録画データは取得済み）:', participantError.response?.data?.message || participantError.message);
			// 参加者情報が取得できない場合でも、録画データは有効なので処理を続行
		}
		
		console.log('✅ 録画データ取得成功:', {
			meetingId: recordingResponse.data.id,
			topic: recordingResponse.data.topic,
			recordingCount: recordingResponse.data.recording_files?.length || 0,
			participantCount: participants.length
		});
		
		res.json({
			success: true,
			message: '録画データ取得テスト成功',
			recordingData: {
				id: recordingResponse.data.id,
				topic: recordingResponse.data.topic,
				start_time: recordingResponse.data.start_time,
				duration: recordingResponse.data.duration,
				host_email: recordingResponse.data.host_email,
				participants: participants,
				recording_files: recordingResponse.data.recording_files?.map(file => ({
					id: file.id,
					file_type: file.file_type,
					file_size: file.file_size,
					recording_start: file.recording_start,
					recording_end: file.recording_end,
					download_url: file.download_url, // 実際のURLをそのまま返す
					download_url_status: file.download_url ? '利用可能' : '未設定' // 表示用ステータス
				})) || [],
				// VTTファイル（字幕ファイル）を特別に抽出
				vtt_file: recordingResponse.data.recording_files?.find(file => 
					file.file_type === 'VTT' || 
					file.file_type === 'TRANSCRIPT' || 
					file.recording_type === 'transcript' ||
					file.recording_type === 'audio_transcript'
				) || null
			}
		});
		
	} catch (error) {
		console.error('❌ 録画データ取得テストエラー:', error.response?.data || error.message);
		res.status(500).json({
			success: false,
			message: '録画データ取得テストに失敗しました',
			error: error.response?.data || error.message
		});
	}
});

// 4. 音声ファイル文字起こしテスト
router.post('/test-transcription', async (req, res) => {
	try {
		console.log('=== 音声ファイル文字起こしテスト開始 ===');
		
		// テスト用音声ファイルのパスまたはURL
		const { audioUrl, audioPath } = req.body;
		
		if (!audioUrl && !audioPath) {
			return res.status(400).json({
				success: false,
				message: 'audioUrlまたはaudioPathが必要です'
			});
		}
		
		// OpenAI Whisper APIテスト
		let transcriptionResult;
		
		if (audioUrl) {
			// URLかローカルパスかを判定
			if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
				// URLからファイルをダウンロードしてテスト
				console.log('音声ファイルのダウンロード開始:', audioUrl);
				transcriptionResult = await openaiService.transcribeAudioFromUrl(audioUrl);
			} else {
				// ローカルファイルパスとして処理
				console.log('ローカル音声ファイルの文字起こし開始:', audioUrl);
				// 相対パスを絶対パスに変換
				const absolutePath = audioUrl.startsWith('./') ? 
					path.join(process.cwd(), audioUrl.substring(2)) : 
					audioUrl.startsWith('/') ? audioUrl : path.join(process.cwd(), audioUrl);
				console.log('絶対パス:', absolutePath);
				transcriptionResult = await openaiService.transcribeAudioFromFile(absolutePath);
			}
		} else {
			// audioPathの場合（後方互換性）
			console.log('ローカル音声ファイルの文字起こし開始:', audioPath);
			const absolutePath = audioPath.startsWith('./') ? 
				path.join(process.cwd(), audioPath.substring(2)) : 
				audioPath.startsWith('/') ? audioPath : path.join(process.cwd(), audioPath);
			transcriptionResult = await openaiService.transcribeAudioFromFile(absolutePath);
		}
		
		console.log('✅ 文字起こし成功:', {
			textLength: transcriptionResult.length,
			preview: transcriptionResult.substring(0, 100) + '...'
		});
		
		res.json({
			success: true,
			message: '音声ファイル文字起こしテスト成功',
			transcription: {
				text: transcriptionResult,
				length: transcriptionResult.length,
				preview: transcriptionResult.substring(0, 200) + '...'
			}
		});
		
	} catch (error) {
		console.error('❌ 音声ファイル文字起こしテストエラー:', error);
		res.status(500).json({
			success: false,
			message: '音声ファイル文字起こしテストに失敗しました',
			error: error.message
		});
	}
});

// 5. 議事録生成テスト
router.post('/test-transcript-generation', async (req, res) => {
	try {
		console.log('=== 議事録生成テスト開始 ===');
		
		const { transcription, meetingTopic, meetingDuration, audioUrl, audioPath, meetingInfo } = req.body;
		
		let actualTranscription = transcription;
		
		// transcriptionが提供されていない場合、音声ファイルから文字起こしを実行
		if (!actualTranscription && (audioUrl || audioPath)) {
			console.log('文字起こしが提供されていないため、音声ファイルから生成します...');
			
			if (audioUrl) {
				if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
					actualTranscription = await openaiService.transcribeAudioFromUrl(audioUrl);
				} else {
					const absolutePath = audioUrl.startsWith('./') ? 
						path.join(process.cwd(), audioUrl.substring(2)) : 
						audioUrl.startsWith('/') ? audioUrl : path.join(process.cwd(), audioUrl);
					actualTranscription = await openaiService.transcribeAudioFromFile(absolutePath);
				}
			} else if (audioPath) {
				const absolutePath = audioPath.startsWith('./') ? 
					path.join(process.cwd(), audioPath.substring(2)) : 
					audioPath.startsWith('/') ? audioPath : path.join(process.cwd(), audioPath);
				actualTranscription = await openaiService.transcribeAudioFromFile(absolutePath);
			}
			
			console.log('音声ファイルからの文字起こし完了:', {
				length: actualTranscription.length,
				preview: actualTranscription.substring(0, 100) + '...'
			});
		}
		
		if (!actualTranscription) {
			return res.status(400).json({
				success: false,
				message: 'transcription（文字起こしテキスト）またはaudioUrl/audioPathが必要です'
			});
		}
		
		// Claude APIを使用して議事録生成
		let meetingData;
		if (meetingInfo) {
			// 統合フローから実際の会議情報が渡された場合
			meetingData = {
				topic: meetingInfo.topic || meetingTopic || 'テスト会議',
				start_time: meetingInfo.startTime || new Date().toISOString(),
				duration: meetingInfo.duration || meetingDuration || 60,
				participants: meetingInfo.participants || [{ name: 'ホスト' }]
			};
		} else {
			// 単体テストの場合
			meetingData = {
				topic: meetingTopic || 'テスト会議',
				start_time: new Date().toISOString(),
				duration: meetingDuration || 60,
				participants: [
					{ name: 'テストユーザー1' },
					{ name: 'テストユーザー2' }
				]
			};
		}
		
		console.log('議事録生成開始:', {
			topic: meetingData.topic,
			duration: meetingData.duration,
			transcriptionLength: actualTranscription.length,
			transcriptionPreview: actualTranscription.substring(0, 200) + '...',
			hasMeetingInfo: !!meetingInfo,
			dataSource: meetingInfo ? '統合フロー' : '単体テスト'
		});
		
		const transcript = await anthropicService.generateMeetingMinutes(actualTranscription, meetingData);
		
		console.log('✅ 議事録生成成功:', {
			summaryLength: transcript.summary?.length || 0,
			actionItemsCount: transcript.action_items?.length || 0,
			formattedTranscriptLength: transcript.formatted_transcript?.length || 0,
			hasFormattedTranscript: !!transcript.formatted_transcript,
			formattedTranscriptPreview: transcript.formatted_transcript ? 
				transcript.formatted_transcript.substring(0, 200) + '...' : 'なし'
		});
		
		res.json({
			success: true,
			message: '議事録生成テスト成功',
			transcript: transcript,
			originalTranscription: actualTranscription,
			meetingData: meetingData
		});
		
	} catch (error) {
		console.error('❌ 議事録生成テストエラー:', error);
		res.status(500).json({
			success: false,
			message: '議事録生成テストに失敗しました',
			error: error.message
		});
	}
});

// 6. メール配信テスト
router.post('/test-email', async (req, res) => {
	try {
		console.log('=== メール配信テスト開始 ===');
		
		const { recipient, transcript, meetingInfo } = req.body;
		
		if (!recipient) {
			return res.status(400).json({
				success: false,
				message: 'recipient（受信者メールアドレス）が必要です'
			});
		}
		
		// テスト用議事録データ
		const testTranscript = transcript || {
			summary: 'これはテスト議事録の要約です。会議の主要な内容がここに記載されます。',
			action_items: [
				{
					item: 'テストアクション1: 来週までに資料を準備する',
					assignee: '田中',
					due_date: '来週末',
					priority: '高'
				},
				{
					item: 'テストアクション2: 関係者に進捗を報告する',
					assignee: '佐藤',
					due_date: '今週中',
					priority: '中'
				}
			],
			formatted_transcript: `# テスト会議 - 議事録詳細

## 開会
田中さん: 本日はお忙しい中お集まりいただき、ありがとうございます。それでは定刻になりましたので、テスト会議を開始いたします。

## 議事項目1: プロジェクトの進捗確認
佐藤さん: 前回会議以降の進捗についてご報告します。現在、全体の約60%が完了しており、予定通り進んでいます。

田中さん: 順調に進んでいるようですね。何か課題や懸念事項はありますか？

佐藤さん: 一部のタスクで外部連携が必要な箇所があり、来週までに調整が必要です。

## 議事項目2: 今後のスケジュール
田中さん: 来月のマイルストーンに向けて、スケジュールの確認をしたいと思います。

テストユーザー: リソースの配分について検討が必要かと思います。特に開発チームの負荷を考慮する必要があります。

佐藤さん: 承知いたしました。来週中に関係者と調整し、進捗を報告いたします。

## 総括
田中さん: 本日の会議では、プロジェクトの方向性について合意し、今後のアクションアイテムを明確にすることができました。次回会議は来週の同時刻に設定いたします。

## 閉会
田中さん: 以上で本日の会議を終了いたします。お疲れ様でした。`,
			key_decisions: [
				'プロジェクトの方向性について合意した',
				'次回会議の日程を決定した'
			]
		};
		
		// 実際の会議情報を使用（統合フローから渡される場合）
		const actualMeetingInfo = meetingInfo || {
			topic: 'テスト会議 - メール配信確認',
			start_time: new Date().toISOString(),
			duration: 60,
			participants: [
				{ name: '田中' },
				{ name: '佐藤' },
				{ name: 'テストユーザー' }
			]
		};
		
		const emailData = {
			recipients: recipient,
			transcript: transcript || testTranscript, // 実際の議事録を優先使用
			meetingInfo: actualMeetingInfo
		};
		
		console.log('メール配信開始:', {
			recipient: recipient,
			meetingTopic: actualMeetingInfo.topic,
			hasActualTranscript: !!transcript,
			actualMeetingDuration: actualMeetingInfo.duration,
			transcriptSummaryLength: (transcript || testTranscript).summary?.length || 0,
			transcriptFormattedLength: (transcript || testTranscript).formatted_transcript?.length || 0,
			transcriptFormattedPreview: (transcript || testTranscript).formatted_transcript ? 
				(transcript || testTranscript).formatted_transcript.substring(0, 200) + '...' : 'なし'
		});
		
		await emailService.sendTranscriptEmail(emailData);
		
		console.log('✅ メール配信成功');
		
		res.json({
			success: true,
			message: 'メール配信テスト成功',
			emailData: {
				recipient: recipient,
				meetingTopic: actualMeetingInfo.topic,
				meetingDate: actualMeetingInfo.start_time,
				meetingDuration: actualMeetingInfo.duration,
				participantCount: actualMeetingInfo.participants?.length || 0,
				summaryLength: (transcript || testTranscript).summary?.length || 0,
				actionItemsCount: (transcript || testTranscript).action_items?.length || 0
			}
		});
		
	} catch (error) {
		console.error('❌ メール配信テストエラー:', error);
		res.status(500).json({
			success: false,
			message: 'メール配信テストに失敗しました',
			error: error.message
		});
	}
});

// 7. 統合フローテスト
router.post('/test-full-flow', async (req, res) => {
	try {
		console.log('=== 統合フローテスト開始 ===');
		
		const { meetingId, recipient } = req.body;
		
		if (!meetingId || !recipient) {
			return res.status(400).json({
				success: false,
				message: 'meetingIdとrecipientが必要です'
			});
		}
		
		const testResults = {
			steps: [],
			success: true,
			errors: [],
			startTime: new Date(),
			currentStep: 0,
			totalSteps: 5,
			progress: {
				current: 0,
				message: '統合フローテスト開始',
				details: `Meeting ID: ${meetingId}, 受信者: ${recipient}`
			}
		};
		
		let recordingData = null;
		let transcriptData = null;
		let accessToken = null;
		
		// 内部API呼び出し用のベースURL（Docker環境対応）
		const baseURL = `http://127.0.0.1:${process.env.PORT || 8000}`;
		
		// テナント固有のZoom設定を取得
		const zoomCredentials = await getTenantZoomCredentials(req);
		
		// ステップ1: Zoom認証テスト（アクセストークン取得）
		const step1Start = Date.now();
		testResults.currentStep = 1;
		testResults.progress = {
			current: 20,
			message: 'ステップ1: Zoom API認証実行中...',
			details: `Server-to-Server OAuth認証でアクセストークンを取得しています (テナント: ${req.user.tenant_id || 'システム'})`
		};
		
		try {
			console.log('ステップ1: Zoom認証テスト');
			
			// 直接認証してアクセストークンを取得
			const credentials = Buffer.from(`${zoomCredentials.client_id}:${zoomCredentials.client_secret}`).toString('base64');
			const tokenResponse = await axios.post(
				'https://zoom.us/oauth/token',
				`grant_type=account_credentials&account_id=${zoomCredentials.account_id}`,
				{
					headers: {
						'Authorization': `Basic ${credentials}`,
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}
			);
			
			accessToken = tokenResponse.data.access_token;
			const step1Duration = Date.now() - step1Start;
			console.log('✅ アクセストークン取得成功');
			
			testResults.steps.push({ 
				step: 1, 
				name: 'Zoom認証', 
				status: 'success',
				duration: step1Duration,
				details: {
					message: 'アクセストークン取得成功',
					tokenType: tokenResponse.data.token_type,
					expiresIn: `${tokenResponse.data.expires_in}秒`,
					accountId: zoomCredentials.account_id,
					userRole: req.user.role,
					tenantId: req.user.tenant_id
				}
			});
		} catch (error) {
			const step1Duration = Date.now() - step1Start;
			console.error('ステップ1エラー:', error.response?.data || error.message);
			
			testResults.steps.push({ 
				step: 1, 
				name: 'Zoom認証', 
				status: 'failed', 
				duration: step1Duration,
				error: error.response?.data?.message || error.message,
				details: {
					message: '認証に失敗しました',
					endpoint: 'https://zoom.us/oauth/token',
					accountId: zoomCredentials.account_id,
					userRole: req.user.role,
					tenantId: req.user.tenant_id
				}
			});
			testResults.success = false;
		}
		
		// ステップ2: 録画データ取得テスト
		const step2Start = Date.now();
		testResults.currentStep = 2;
		testResults.progress = {
			current: 40,
			message: 'ステップ2: 録画データ取得中...',
			details: `Meeting ID ${meetingId} の録画ファイル情報を取得しています`
		};
		
		try {
			console.log('ステップ2: 録画データ取得テスト');
			const recordingResponse = await axios.post(`${baseURL}/api/debug/test-recording/${meetingId}`);
			recordingData = recordingResponse.data.recordingData;
			const step2Duration = Date.now() - step2Start;
			
			testResults.steps.push({ 
				step: 2, 
				name: '録画データ取得', 
				status: 'success',
				duration: step2Duration,
				details: {
					message: '録画データ取得成功',
					meetingId: recordingData.id,
					topic: recordingData.topic,
					duration: `${recordingData.duration}分`,
					recordingCount: recordingData.recording_files?.length || 0,
					startTime: recordingData.start_time
				}
			});
		} catch (error) {
			const step2Duration = Date.now() - step2Start;
			console.error('ステップ2エラー:', error.response?.data || error.message);
			
			testResults.steps.push({ 
				step: 2, 
				name: '録画データ取得', 
				status: 'failed',
				duration: step2Duration,
				error: error.response?.data?.message || error.message,
				details: {
					message: '録画データ取得に失敗',
					meetingId: meetingId,
					endpoint: `/api/debug/test-recording/${meetingId}`
				}
			});
			testResults.success = false;
		}
		
		// ステップ3: 文字起こしテスト（実際の音声ファイル使用）
		const step3Start = Date.now();
		testResults.currentStep = 3;
		testResults.progress = {
			current: 60,
			message: 'ステップ3: 音声ファイル文字起こし実行中...',
			details: '録画から音声ファイルを検索し、OpenAI Whisper APIで文字起こしを実行しています'
		};
		
		let actualTranscription = null;
		let audioFileInfo = null;
		let processingMethod = null;
		let costSavings = false;
		
		try {
			console.log('ステップ3: 文字起こしテスト（VTTファイル優先、音声ファイル代替）');
			
			// 最初にVTTファイル（字幕ファイル）を確認
			if (recordingData && recordingData.vtt_file && recordingData.vtt_file.download_url) {
				console.log('VTTファイルが利用可能です。発言者情報付きの文字起こしを生成します。');
				
				processingMethod = 'vtt';
				costSavings = true;
				
				audioFileInfo = {
					fileType: 'VTT',
					url: recordingData.vtt_file.download_url,
					size: recordingData.vtt_file.file_size
				};
				
				// VTTファイルをダウンロードして解析
				const vttContent = await zoomUtils.downloadVTTFile(recordingData.vtt_file.download_url, accessToken);
				const vttAnalysis = zoomUtils.parseVTTContent(vttContent);
				
				if (vttAnalysis.success) {
					actualTranscription = vttAnalysis.chronologicalTranscript;
					
					console.log('VTT解析結果:', {
						speakers: vttAnalysis.speakers,
						transcriptLength: actualTranscription.length,
						speakerCount: vttAnalysis.speakers.length
					});
					
					// VTTファイルから取得した発言者で参加者情報を更新
					if (vttAnalysis.speakers.length > 0) {
						recordingData.participants = vttAnalysis.speakers.map(speaker => ({
							name: speaker,
							email: '',
							join_time: '',
							leave_time: '',
							duration: 0
						}));
						console.log('参加者情報をVTTファイルから更新:', vttAnalysis.speakers);
					}
					
					const step3Duration = Date.now() - step3Start;
					
					testResults.steps.push({ 
						step: 3, 
						name: '文字起こし', 
						status: 'success',
						duration: step3Duration,
						details: {
							message: 'VTTファイル解析成功（発言者情報付き）',
							fileType: 'VTT字幕ファイル',
							fileSize: `${Math.round(recordingData.vtt_file.file_size / 1024)}KB`,
							speakerCount: vttAnalysis.speakers.length,
							speakers: vttAnalysis.speakers.join(', '),
							transcriptionLength: `${actualTranscription.length}文字`,
							processingTime: `${Math.round(step3Duration / 1000)}秒`,
							processingMethod: 'VTT字幕ファイル解析',
							costSavings: true,
							whisperApiUsed: false,
							preview: actualTranscription.substring(0, 100) + '...'
						}
					});
					console.log('✅ VTTファイルから発言者情報付き文字起こし成功');
				} else {
					throw new Error(`VTTファイル解析に失敗: ${vttAnalysis.error}`);
				}
			}
			// VTTファイルが利用できない場合は音声ファイルを使用
			else if (recordingData && recordingData.recording_files && recordingData.recording_files.length > 0) {
				console.log('VTTファイルが利用できません。音声ファイルから文字起こしを実行します。');
				
				processingMethod = 'whisper';
				costSavings = false;
				console.log('利用可能な録画ファイル:', recordingData.recording_files.map(f => ({
					type: f.file_type,
					size: f.file_size,
					hasUrl: !!f.download_url,
					urlPreview: f.download_url ? f.download_url.substring(0, 50) + '...' : 'なし'
				})));
				
				// 音声ファイルを優先順位で探す
				let audioFile = recordingData.recording_files.find(file => 
					file.file_type === 'M4A' && file.download_url
				);
				
				if (!audioFile) {
					audioFile = recordingData.recording_files.find(file => 
						file.file_type === 'MP3' && file.download_url
					);
				}
				
				if (!audioFile) {
					audioFile = recordingData.recording_files.find(file => 
						file.file_type === 'MP4' && file.download_url
					);
				}
				
				if (audioFile && audioFile.download_url && typeof audioFile.download_url === 'string' && audioFile.download_url.startsWith('http')) {
					audioFileInfo = {
						fileType: audioFile.file_type,
						fileSize: audioFile.file_size,
						recordingStart: audioFile.recording_start,
						recordingEnd: audioFile.recording_end
					};
					
					console.log('音声ファイルが見つかりました:', audioFile.file_type, 'URL:', audioFile.download_url.substring(0, 100) + '...');
					
					// 進捗更新
					testResults.progress.details = `${audioFile.file_type}ファイル (${Math.round(audioFile.file_size / 1024 / 1024)}MB) をダウンロード・文字起こし中...`;
					
					// まずURLアクセス可能性をチェック
					try {
						console.log('Zoom録画ファイルアクセス確認中...');
						const headResponse = await axios.head(audioFile.download_url, {
							headers: {
								'Authorization': `Bearer ${accessToken}`,
								'User-Agent': 'AI-Agent-Service/1.0'
							},
							timeout: 10000
						});
						console.log('ファイルアクセス確認成功:', headResponse.status, headResponse.headers['content-length']);
					} catch (accessError) {
						console.error('ファイルアクセス確認失敗:', accessError.response?.status, accessError.message);
						throw new Error(`録画ファイルにアクセスできません: ${accessError.response?.status || accessError.message}`);
					}
					
					// 実際の文字起こし実行（Zoom認証付き）
					actualTranscription = await openaiService.transcribeZoomRecording(audioFile.download_url, accessToken);
					
					const step3Duration = Date.now() - step3Start;
					
					testResults.steps.push({ 
						step: 3, 
						name: '文字起こし', 
						status: 'success',
						duration: step3Duration,
						details: {
							message: '音声ファイル文字起こし成功',
							fileType: audioFile.file_type,
							fileSize: `${Math.round(audioFile.file_size / 1024 / 1024)}MB`,
							transcriptionLength: `${actualTranscription.length}文字`,
							processingTime: `${Math.round(step3Duration / 1000)}秒`,
							processingMethod: 'OpenAI Whisper API',
							costSavings: false,
							whisperApiUsed: true,
							preview: actualTranscription.substring(0, 100) + '...'
						}
					});
					console.log('✅ 実際の音声ファイルから文字起こし成功');
				} else {
					const availableTypes = recordingData.recording_files.map(f => f.file_type).join(', ');
					const availableUrls = recordingData.recording_files.filter(f => f.download_url).length;
					throw new Error(`適切な音声ファイルが見つかりません。利用可能ファイル: ${availableTypes}, URL有り: ${availableUrls}/${recordingData.recording_files.length}`);
				}
			} else {
				throw new Error('録画データまたは録画ファイルが見つかりません');
			}
		} catch (error) {
			const step3Duration = Date.now() - step3Start;
			console.error('ステップ3エラー:', error.response?.data || error.message);
			
			testResults.steps.push({ 
				step: 3, 
				name: '文字起こし', 
				status: 'failed',
				duration: step3Duration,
				error: error.response?.data?.message || error.message,
				details: {
					message: '文字起こしに失敗（フォールバック使用）',
					availableFiles: recordingData?.recording_files?.map(f => `${f.file_type}(${f.download_url ? 'URL有' : 'URL無'})`).join(', ') || 'なし',
					errorType: error.message.includes('アクセスできません') ? 'URLアクセスエラー' : 
					          error.message.includes('ファイルが見つからない') ? 'ファイル不在' : 'API処理エラー',
					urlStatus: audioFileInfo ? `${audioFileInfo.fileType}選択済み` : '選択失敗',
					accessToken: accessToken ? 'あり' : 'なし'
				}
			});
			
			// フォールバック: サンプルテキストを使用
			console.log('フォールバック: サンプルテキストを使用');
			actualTranscription = `【${recordingData?.topic || 'テスト会議'}の録画内容】\n実際の音声ファイルが利用できないため、サンプルテキストを使用しています。実際の会議では重要な議題について議論し、いくつかのアクションアイテムが決定されました。`;
		}
		
		// ステップ4: 議事録生成テスト（実際の文字起こしまたはフォールバックテキスト使用）
		const step4Start = Date.now();
		testResults.currentStep = 4;
		testResults.progress = {
			current: 80,
			message: 'ステップ4: AI議事録生成実行中...',
			details: 'Anthropic Claude APIで議事録を整形・要約・アクションアイテム抽出を実行しています'
		};
		
		try {
			console.log('ステップ4: 議事録生成テスト');
			
			// 実際のZoom会議データを使用
			const meetingInfo = {
				topic: recordingData?.topic || `統合テスト会議 (ID: ${meetingId})`,
				startTime: recordingData?.start_time,
				duration: recordingData?.duration,
				meetingId: recordingData?.id || meetingId,
				// 実際の参加者情報を使用
				participants: recordingData?.participants?.length > 0 
					? recordingData.participants.map(p => p.name) 
					: ['ホスト', '参加者']
			};
			
			// meetingTopicとmeetingInfoの両方を渡す（後方互換性のため）
			const transcriptResponse = await axios.post(`${baseURL}/api/debug/test-transcript-generation`, {
				transcription: actualTranscription,
				meetingTopic: meetingInfo.topic,
				meetingDuration: meetingInfo.duration,
				meetingInfo: meetingInfo
			});
			transcriptData = transcriptResponse.data.transcript;
			const step4Duration = Date.now() - step4Start;
			
			testResults.steps.push({ 
				step: 4, 
				name: '議事録生成', 
				status: 'success',
				duration: step4Duration,
				details: {
					message: 'AI議事録生成成功',
					inputLength: `${actualTranscription?.length || 0}文字`,
					outputSummary: `${transcriptData?.summary?.length || 0}文字`,
					actionItems: transcriptData?.action_items?.length || 0,
					processingTime: `${Math.round(step4Duration / 1000)}秒`,
					meetingTopic: meetingInfo.topic,
					aiModel: 'Claude-3-Haiku'
				}
			});
		} catch (error) {
			const step4Duration = Date.now() - step4Start;
			console.error('ステップ4エラー:', error.response?.data || error.message);
			
			testResults.steps.push({ 
				step: 4, 
				name: '議事録生成', 
				status: 'failed',
				duration: step4Duration,
				error: error.response?.data?.message || error.message,
				details: {
					message: 'AI議事録生成に失敗',
					inputLength: `${actualTranscription?.length || 0}文字`,
					endpoint: '/api/debug/test-transcript-generation',
					aiModel: 'Claude-3-Haiku'
				}
			});
			testResults.success = false;
		}
		
		// ステップ5: メール配信テスト
		const step5Start = Date.now();
		testResults.currentStep = 5;
		testResults.progress = {
			current: 100,
			message: 'ステップ5: メール配信実行中...',
			details: `議事録を ${recipient} に送信しています（MailHog経由）`
		};
		
		try {
			console.log('ステップ5: メール配信テスト');
			await axios.post(`${baseURL}/api/debug/test-email`, {
				recipient: recipient,
				transcript: transcriptData,
				meetingInfo: {
					topic: recordingData?.topic || `統合テスト会議 (ID: ${meetingId})`,
					start_time: recordingData?.start_time, // EmailServiceの形式に合わせる
					duration: recordingData?.duration,
					meetingId: recordingData?.id || meetingId,
					// 実際の参加者情報を使用
					participants: recordingData?.participants?.length > 0 
						? recordingData.participants.map(p => ({ name: p.name }))
						: [{ name: 'ホスト' }]
				}
			});
			const step5Duration = Date.now() - step5Start;
			
			testResults.steps.push({ 
				step: 5, 
				name: 'メール配信', 
				status: 'success',
				duration: step5Duration,
				details: {
					message: 'メール配信成功',
					recipient: recipient,
					subject: `議事録: ${recordingData?.topic || 'テスト会議'}`,
					mailServer: 'MailHog (開発環境)',
					processingTime: `${step5Duration}ms`,
					webUI: 'http://localhost:8025'
				}
			});
		} catch (error) {
			const step5Duration = Date.now() - step5Start;
			console.error('ステップ5エラー:', error.response?.data || error.message);
			
			testResults.steps.push({ 
				step: 5, 
				name: 'メール配信', 
				status: 'failed',
				duration: step5Duration,
				error: error.response?.data?.message || error.message,
				details: {
					message: 'メール配信に失敗',
					recipient: recipient,
					endpoint: '/api/debug/test-email',
					mailServer: 'MailHog (開発環境)'
				}
			});
			testResults.success = false;
		}
		
		console.log('✅ 統合フローテスト完了');
		
		// 最終結果の追加情報
		const endTime = new Date();
		const totalDuration = endTime.getTime() - testResults.startTime.getTime();
		const successSteps = testResults.steps.filter(step => step.status === 'success').length;
		const failedSteps = testResults.steps.filter(step => step.status === 'failed').length;
		
		testResults.summary = {
			endTime: endTime,
			totalDuration: totalDuration,
			totalSteps: testResults.totalSteps,
			successSteps: successSteps,
			failedSteps: failedSteps,
			successRate: `${Math.round((successSteps / testResults.totalSteps) * 100)}%`,
			meetingId: meetingId,
			meetingTopic: recordingData?.topic || 'テスト会議',
			startTime: recordingData?.start_time || '未設定',
			duration: recordingData?.duration || 'unknown',
			participants: recordingData?.participants?.map(p => p.name).join(', ') || '未設定',
			recipient: recipient,
			processingMethod: processingMethod || 'unknown',
			costSavings: costSavings,
			whisperApiUsed: !costSavings
		};
		
		testResults.progress = {
			current: 100,
			message: testResults.success ? '🎉 統合フローテスト完了' : '⚠️ 統合フローテスト完了（一部エラー）',
			details: `全${testResults.totalSteps}ステップ中${successSteps}成功・${failedSteps}失敗 (処理時間: ${Math.round(totalDuration / 1000)}秒)`
		};
		
		res.json({
			success: testResults.success,
			message: testResults.success ? 
				'🎉 統合フローテスト成功 - すべてのステップが正常に完了しました' : 
				'⚠️ 統合フローテストで一部エラーが発生しました',
			results: testResults
		});
		
	} catch (error) {
		console.error('❌ 統合フローテストエラー:', error);
		res.status(500).json({
			success: false,
			message: '統合フローテストに失敗しました',
			error: error.message
		});
	}
});

// 8. デバッグ状態確認
router.get('/status', async (req, res) => {
	try {
		console.log('デバッグステータス確認 - ユーザー情報:', req.user);
		
		// テナント固有のZoom設定を取得
		let zoomCredentials;
		let zoomConfigStatus = {};
		
		try {
			zoomCredentials = await getTenantZoomCredentials(req);
			zoomConfigStatus = {
				accountId: !!zoomCredentials.account_id,
				clientId: !!zoomCredentials.client_id,
				clientSecret: !!zoomCredentials.client_secret,
				webhookSecret: !!zoomCredentials.webhook_secret,
				source: req.user.role === 'admin' ? 'environment_variables' : 'tenant_database'
			};
		} catch (error) {
			zoomConfigStatus = {
				accountId: false,
				clientId: false,
				clientSecret: false,
				webhookSecret: false,
				source: 'configuration_error',
				error: error.message
			};
		}
		
		// 環境変数の確認
		const envStatus = {
			zoom: zoomConfigStatus,
			ai: {
				openai: !!process.env.OPENAI_API_KEY,
				anthropic: !!process.env.ANTHROPIC_API_KEY
			},
			email: {
				smtpHost: !!process.env.SMTP_HOST,
				smtpUser: !!process.env.SMTP_USER,
				smtpPass: !!process.env.SMTP_PASS
			},
			database: !!process.env.DATABASE_URL,
			redis: !!process.env.REDIS_URL,
			user: req.user ? {
				role: req.user.role,
				tenantId: req.user.tenant_id,
				email: req.user.email
			} : null
		};
		
		// データベース接続テスト
		let dbStatus = false;
		try {
			await pool.query('SELECT 1');
			dbStatus = true;
		} catch (dbError) {
			console.error('データベース接続エラー:', dbError);
		}
		
		// 最近のジョブ確認
		let recentJobs = [];
		try {
			const jobsResult = await pool.query(
				`SELECT 
					id, 
					type, 
					status, 
					data->>'meeting_id' as meeting_id,
					data->>'meeting_topic' as meeting_topic,
					created_at 
				FROM agent_jobs 
				ORDER BY created_at DESC 
				LIMIT 5`
			);
			recentJobs = jobsResult.rows;
		} catch (jobError) {
			console.error('ジョブ取得エラー:', jobError);
		}
		
		res.json({
			environment: envStatus,
			database: {
				connected: dbStatus,
				recentJobs: recentJobs
			},
			endpoints: {
				webhook: '/api/debug/test-webhook',
				auth: '/api/debug/test-auth',
				scopes: '/api/debug/test-scopes',
				recording: '/api/debug/test-recording/:meetingId',
				transcription: '/api/debug/test-transcription',
				transcript: '/api/debug/test-transcript-generation',
				email: '/api/debug/test-email',
				fullFlow: '/api/debug/test-full-flow'
			}
		});
		
	} catch (error) {
		console.error('❌ デバッグ状態確認エラー:', error);
		res.status(500).json({
			success: false,
			message: 'デバッグ状態確認に失敗しました',
			error: error.message
		});
	}
});

// VTT/Whisper使用状況統計取得
router.get('/vtt-stats', async (req, res) => {
	try {
		console.log('VTT/Whisper使用状況統計取得開始');
		
		const stats = {
			totalTranscripts: 0,
			vttUsage: 0,
			whisperUsage: 0,
			costSavings: 0,
			processingTimes: {
				averageVtt: 0,
				averageWhisper: 0
			},
			recentJobs: []
		};
		
		// 最近30日間の議事録生成ジョブを取得
		const jobsResult = await pool.query(`
			SELECT 
				aj.id,
				aj.type,
				aj.status,
				aj.data,
				aj.result,
				aj.created_at,
				aj.completed_at,
				mt.summary,
				mt.meeting_topic,
				EXTRACT(EPOCH FROM (aj.completed_at - aj.created_at)) as processing_duration
			FROM agent_jobs aj
			LEFT JOIN meeting_transcripts mt ON aj.job_uuid = mt.job_uuid
			WHERE aj.type IN ('transcript_generation', 'zoom_webhook')
			AND aj.created_at >= NOW() - INTERVAL '30 days'
			ORDER BY aj.created_at DESC
			LIMIT 50
		`);
		
		stats.totalTranscripts = jobsResult.rows.length;
		
		// VTT vs Whisper使用状況を分析
		jobsResult.rows.forEach(job => {
			if (job.status === 'completed' && job.result) {
				const processingMethod = (job.result?.transcription_method) || 
					'unknown';
				
				// VTT使用の判定
				if (processingMethod === 'vtt' || 
					(job.result?.transcription_source === 'vtt') ||
					(job.result?.fileType === 'VTT')) {
					stats.vttUsage++;
					if (job.processing_duration) {
						stats.processingTimes.averageVtt += job.processing_duration;
					}
				}
				// Whisper使用の判定
				else if (processingMethod === 'whisper' || 
					(job.result?.transcription_source === 'whisper') ||
					(job.result?.fileType === 'audio')) {
					stats.whisperUsage++;
					if (job.processing_duration) {
						stats.processingTimes.averageWhisper += job.processing_duration;
					}
				}
			}
		});
		
		// 平均処理時間を計算
		if (stats.vttUsage > 0) {
			stats.processingTimes.averageVtt /= stats.vttUsage;
		}
		if (stats.whisperUsage > 0) {
			stats.processingTimes.averageWhisper /= stats.whisperUsage;
		}
		
		// コスト節約効果を計算（Whisper API使用料を$0.006/分と仮定）
		const estimatedWhisperCostPer10Min = 0.06; // $0.006 * 10分
		stats.costSavings = stats.vttUsage * estimatedWhisperCostPer10Min;
		
		// 最近のジョブ情報を含める
		stats.recentJobs = jobsResult.rows.slice(0, 10).map(job => ({
			id: job.id,
			type: job.type,
			status: job.status,
			meetingTopic: job.meeting_topic || job.data?.meeting_topic || '未設定',
			processingMethod: (job.result?.transcription_method) || 
				(job.result?.transcription_source) || 
				'unknown',
			createdAt: job.created_at,
			completedAt: job.completed_at,
			processingDuration: job.processing_duration
		}));
		
		// 使用率を計算
		const totalProcessed = stats.vttUsage + stats.whisperUsage;
		const vttUsageRate = totalProcessed > 0 ? (stats.vttUsage / totalProcessed * 100).toFixed(1) : 0;
		const whisperUsageRate = totalProcessed > 0 ? (stats.whisperUsage / totalProcessed * 100).toFixed(1) : 0;
		
		console.log('VTT/Whisper使用状況統計:', {
			totalTranscripts: stats.totalTranscripts,
			vttUsage: stats.vttUsage,
			whisperUsage: stats.whisperUsage,
			vttUsageRate: vttUsageRate + '%',
			whisperUsageRate: whisperUsageRate + '%',
			costSavings: '$' + stats.costSavings.toFixed(2)
		});
		
		res.json({
			success: true,
			message: 'VTT/Whisper使用状況統計取得成功',
			stats: {
				...stats,
				vttUsageRate: parseFloat(vttUsageRate),
				whisperUsageRate: parseFloat(whisperUsageRate),
				totalProcessed: totalProcessed
			}
		});
		
	} catch (error) {
		console.error('❌ VTT/Whisper使用状況統計取得エラー:', error);
		res.status(500).json({
			success: false,
			message: 'VTT/Whisper使用状況統計取得に失敗しました',
			error: error.message
		});
	}
});

// キュー管理エンドポイント群

// キュー状況確認
router.get('/queue-status', async (req, res) => {
	let transcriptQueue = null;
	let emailQueue = null;
	
	try {
		// Redis接続テスト
		const redisHealthy = await testRedisConnection();
		
		if (!redisHealthy) {
			console.log('❌ Redis接続不可、フォールバックモードで応答');
			return res.json({
				success: false,
				message: 'Redis接続不可（フォールバックモード）',
				fallback: true,
				queues: {
					transcript: {
						name: 'transcript',
						counts: { waiting: 0, active: 0, completed: 0, failed: 0 },
						jobs: { waiting: [], active: [], completed: [], failed: [] }
					},
					email: {
						name: 'email',
						counts: { waiting: 0, active: 0, completed: 0, failed: 0 },
						jobs: { waiting: [], active: [], completed: [], failed: [] }
					}
				}
			});
		}
		
		// 新しいキューを作成
		transcriptQueue = createQueue('transcript');
		emailQueue = createQueue('email');

		// タイムアウト付きでキュー状況を取得
		const timeout = 8000; // 8秒タイムアウト
		
		const transcriptStatsPromise = Promise.all([
			transcriptQueue.getWaiting(),
			transcriptQueue.getActive(),
			transcriptQueue.getCompleted(),
			transcriptQueue.getFailed()
		]);
		
		const emailStatsPromise = Promise.all([
			emailQueue.getWaiting(),
			emailQueue.getActive(),
			emailQueue.getCompleted(),
			emailQueue.getFailed()
		]);

		// タイムアウト付きで並列実行
		const [transcriptResults, emailResults] = await Promise.all([
			Promise.race([
				transcriptStatsPromise,
				new Promise((_, reject) => setTimeout(() => reject(new Error('Transcript queue timeout')), timeout))
			]),
			Promise.race([
				emailStatsPromise,
				new Promise((_, reject) => setTimeout(() => reject(new Error('Email queue timeout')), timeout))
			])
		]);

		const transcriptStats = {
			waiting: transcriptResults[0],
			active: transcriptResults[1],
			completed: transcriptResults[2],
			failed: transcriptResults[3]
		};

		const emailStats = {
			waiting: emailResults[0],
			active: emailResults[1],
			completed: emailResults[2],
			failed: emailResults[3]
		};

		// 統計情報
		const transcriptCounts = {
			waiting: transcriptStats.waiting.length,
			active: transcriptStats.active.length,
			completed: transcriptStats.completed.length,
			failed: transcriptStats.failed.length
		};

		const emailCounts = {
			waiting: emailStats.waiting.length,
			active: emailStats.active.length,
			completed: emailStats.completed.length,
			failed: emailStats.failed.length
		};

		// 接続をクリーンアップ
		await transcriptQueue.close();
		await emailQueue.close();

		res.json({
			success: true,
			message: 'キュー状況取得成功',
			queues: {
				transcript: {
					name: 'transcript processing',
					counts: transcriptCounts,
					jobs: {
						waiting: transcriptStats.waiting.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							opts: job.opts
						})),
						active: transcriptStats.active.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							progress: job.progress()
						})),
						completed: transcriptStats.completed.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							finished: job.finishedOn,
							result: job.returnvalue
						})),
						failed: transcriptStats.failed.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							failed: job.failedReason,
							error: job.stacktrace
						}))
					}
				},
				email: {
					name: 'email sending',
					counts: emailCounts,
					jobs: {
						waiting: emailStats.waiting.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							opts: job.opts
						})),
						active: emailStats.active.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							progress: job.progress()
						})),
						completed: emailStats.completed.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							finished: job.finishedOn,
							result: job.returnvalue
						})),
						failed: emailStats.failed.slice(0, 5).map(job => ({
							id: job.id,
							data: job.data,
							created: job.timestamp,
							failed: job.failedReason,
							error: job.stacktrace
						}))
					}
				}
			}
		});

	} catch (error) {
		console.error('❌ キュー状況確認エラー:', error);
		res.status(500).json({
			success: false,
			message: 'キュー状況確認に失敗しました',
			error: error.message
		});
	} finally {
		// 接続をクリーンアップ
		try {
			if (transcriptQueue) {
				await transcriptQueue.close();
			}
			if (emailQueue) {
				await emailQueue.close();
			}
		} catch (closeError) {
			console.error('キュー接続クローズエラー:', closeError);
		}
	}
});

// Redis診断エンドポイント
router.get('/redis-diagnosis', async (req, res) => {
	try {
		const diagnosis = {
			timestamp: new Date().toISOString(),
			environment: process.env.NODE_ENV || 'unknown',
			redis_config: {
				host: process.env.REDIS_HOST || 'redis',
				port: process.env.REDIS_PORT || 6379,
				password_set: !!process.env.REDIS_PASSWORD,
				url: process.env.REDIS_URL || 'not_set'
			},
			tests: {}
		};

		// 基本接続テスト
		console.log('🔍 Redis診断開始...');
		diagnosis.tests.basic_connection = await testRedisConnection();

		// 詳細接続テスト
		try {
			const Redis = require('ioredis');
			let redis;
			
			if (typeof redisConfig === 'string') {
				// REDIS_URL使用
				redis = new Redis(redisConfig);
			} else {
				// 個別設定使用
				redis = new Redis(redisConfig.redis);
			}
			
			const start = Date.now();
			await redis.ping();
			diagnosis.tests.ping_latency = `${Date.now() - start}ms`;
			
			await redis.set('test_key', 'test_value', 'EX', 10);
			const value = await redis.get('test_key');
			diagnosis.tests.read_write = value === 'test_value';
			
			await redis.disconnect();
			diagnosis.tests.disconnect_clean = true;
		} catch (error) {
			diagnosis.tests.detailed_error = error.message;
			diagnosis.tests.error_code = error.code;
		}

		res.json({
			success: true,
			diagnosis
		});
		
	} catch (error) {
		console.error('Redis診断エラー:', error);
		res.status(500).json({
			success: false,
			error: error.message,
			diagnosis: {
				basic_connection: false,
				error_details: error.toString()
			}
		});
	}
});

// キュークリア
router.post('/clear-queue', async (req, res) => {
	try {
		const { queueName, jobStatus } = req.body;

		if (!queueName || !jobStatus) {
			return res.status(400).json({
				success: false,
				message: 'queueNameとjobStatusが必要です'
			});
		}

		// 各キューの接続を作成
		let queue;
		if (queueName === 'transcript') {
			queue = new Bull('transcript processing', redisConfig);
		} else if (queueName === 'email') {
			queue = new Bull('email sending', redisConfig);
		} else {
			return res.status(400).json({
				success: false,
				message: '無効なキュー名です'
			});
		}

		let deletedCount = 0;

		// 指定されたステータスのジョブを削除
		if (jobStatus === 'waiting') {
			const jobs = await queue.getWaiting();
			for (const job of jobs) {
				await job.remove();
				deletedCount++;
			}
		} else if (jobStatus === 'active') {
			const jobs = await queue.getActive();
			for (const job of jobs) {
				await job.remove();
				deletedCount++;
			}
		} else if (jobStatus === 'completed') {
			const jobs = await queue.getCompleted();
			for (const job of jobs) {
				await job.remove();
				deletedCount++;
			}
		} else if (jobStatus === 'failed') {
			const jobs = await queue.getFailed();
			for (const job of jobs) {
				await job.remove();
				deletedCount++;
			}
		} else if (jobStatus === 'all') {
			// 全てのジョブを削除
			try {
				const completedCount = await queue.clean(0, 'completed');
				const failedCount = await queue.clean(0, 'failed');
				
				// waiting と active ジョブは個別に削除
				const waitingJobs = await queue.getWaiting();
				const activeJobs = await queue.getActive();
				
				for (const job of waitingJobs) {
					await job.remove();
				}
				
				for (const job of activeJobs) {
					await job.remove();
				}
				
				deletedCount = `${completedCount + failedCount + waitingJobs.length + activeJobs.length}`;
			} catch (error) {
				console.error('Queue clean error:', error);
				deletedCount = 0;
			}
		} else {
			await queue.close();
			return res.status(400).json({
				success: false,
				message: '無効なジョブステータスです'
			});
		}

		// 接続をクリーンアップ
		await queue.close();

		res.json({
			success: true,
			message: `${queueName}キューの${jobStatus}ジョブをクリアしました`,
			deletedCount: deletedCount,
			queueName: queueName,
			jobStatus: jobStatus
		});

	} catch (error) {
		console.error('❌ キュークリアエラー:', error);
		res.status(500).json({
			success: false,
			message: 'キュークリアに失敗しました',
			error: error.message
		});
	}
});

// 失敗ジョブ再実行
router.post('/retry-failed-jobs', async (req, res) => {
	try {
		const { queueName, jobIds } = req.body;

		if (!queueName) {
			return res.status(400).json({
				success: false,
				message: 'queueNameが必要です'
			});
		}

		// 各キューの接続を作成
		let queue;
		if (queueName === 'transcript') {
			queue = new Bull('transcript processing', redisConfig);
		} else if (queueName === 'email') {
			queue = new Bull('email sending', redisConfig);
		} else {
			return res.status(400).json({
				success: false,
				message: '無効なキュー名です'
			});
		}

		let retriedCount = 0;
		const failedJobs = await queue.getFailed();

		// 特定のジョブIDが指定されている場合
		if (jobIds && Array.isArray(jobIds)) {
			for (const jobId of jobIds) {
				const job = failedJobs.find(j => j.id === jobId);
				if (job) {
					await job.retry();
					retriedCount++;
				}
			}
		} else {
			// 全ての失敗ジョブを再実行
			for (const job of failedJobs) {
				await job.retry();
				retriedCount++;
			}
		}

		// 接続をクリーンアップ
		await queue.close();

		res.json({
			success: true,
			message: `${queueName}キューの失敗ジョブを再実行しました`,
			retriedCount: retriedCount,
			queueName: queueName
		});

	} catch (error) {
		console.error('❌ 失敗ジョブ再実行エラー:', error);
		res.status(500).json({
			success: false,
			message: '失敗ジョブ再実行に失敗しました',
			error: error.message
		});
	}
});

// ===== ヘルパー関数 =====

/**
 * Zoom認証テストのヘルパー関数
 * @param {string} tenantId - テナントID 
 * @returns {Promise<{success: boolean, accessToken?: string, error?: string}>}
 */
async function testZoomAuth(tenantId) {
	try {
		console.log(`🔐 testZoomAuth: テナント ${tenantId} の認証テスト開始`);
		
		// TenantZoomServiceを使用してテナント別Zoom設定を取得
		const tenantZoomService = require('../services/tenantZoomService');
		console.log(`🔍 tenantZoomService読み込み完了`);
		
		const zoomCredentials = await tenantZoomService.getZoomCredentials(tenantId);
		console.log(`🔍 getZoomCredentials結果:`, {
			tenant_id: tenantId,
			zoom_account_id: zoomCredentials?.zoom_account_id || 'なし',
			zoom_client_id: zoomCredentials?.zoom_client_id || 'なし',
			zoom_client_secret_length: zoomCredentials?.zoom_client_secret?.length || 0,
			全体: Object.keys(zoomCredentials || {})
		});
		
		// 認証情報の確認
		const requiredFields = ['zoom_account_id', 'zoom_client_id', 'zoom_client_secret'];
		const missingFields = requiredFields.filter(field => !zoomCredentials[field]);
		
		if (missingFields.length > 0) {
			return {
				success: false,
				error: `必要なZoom設定が不足しています: ${missingFields.join(', ')}`,
				missingFields
			};
		}
		
		// アクセストークン取得のテスト
		const credentials = Buffer.from(`${zoomCredentials.zoom_client_id}:${zoomCredentials.zoom_client_secret}`).toString('base64');
		
		const response = await axios.post(
			'https://zoom.us/oauth/token',
			`grant_type=account_credentials&account_id=${zoomCredentials.zoom_account_id}`,
			{
				headers: {
					'Authorization': `Basic ${credentials}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}
		);
		
		console.log('✅ testZoomAuth認証成功:', {
			tenant_id: tenantId,
			token_type: response.data.token_type,
			expires_in: response.data.expires_in
		});
		
		return {
			success: true,
			accessToken: response.data.access_token,
			tokenInfo: {
				token_type: response.data.token_type,
				expires_in: response.data.expires_in
			}
		};
		
	} catch (error) {
		console.error(`❌ testZoomAuth認証エラー (テナント: ${tenantId}):`, error.response?.data || error.message);
		return {
			success: false,
			error: error.response?.data?.error_description || error.message,
			details: error.response?.data
		};
	}
}

module.exports = router;