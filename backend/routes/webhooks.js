const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const zoomUtils = require('../utils/zoom');
const QueueService = require('../services/queueService');
const tenantZoomService = require('../services/tenantZoomService');

const router = express.Router();

// データベース接続とサービス初期化
const db = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const queueService = new QueueService();

// テナント対応Zoom Webhook署名検証ミドルウェア
const verifyZoomWebhook = async (req, res, next) => {
	console.log("/webhook/verifyZoomWebhook--->", "start");

	try {
		const tenantId = req.tenantId;
		
		if (!tenantId) {
			console.error('テナントIDが見つかりません');
			return res.status(400).json({
				error: 'テナントIDが必要です',
				code: 'TENANT_ID_REQUIRED'
			});
		}

		// URL validationイベントは署名検証を行う（Zoom公式仕様）
		if (req.body.event === 'endpoint.url_validation') {
			console.log('URL validation用署名検証を実行');
		}

		// テナント別Webhook署名検証
		const payload = JSON.stringify(req.body);
		const signature = req.headers['x-zm-signature'];
		const timestamp = req.headers['x-zm-request-timestamp'];

		const isValidSignature = await tenantZoomService.verifyWebhookSignature(
			tenantId,
			payload,
			signature,
			timestamp
		);

		if (!isValidSignature) {
			console.warn(`Zoom Webhook署名検証失敗 (テナント: ${tenantId})`);
			console.warn('署名不一致:', {
				tenantId,
				received_signature: signature,
				timestamp
			});
			return res.status(401).json({
				error: 'Webhook署名が無効です',
				code: 'INVALID_WEBHOOK_SIGNATURE'
			});
		}

		console.log(`署名検証成功 (テナント: ${tenantId})`);
		next();

	} catch (error) {
		console.error('Zoom Webhook署名検証エラー:', error);
		res.status(400).json({
			error: 'Webhook署名検証中にエラーが発生しました',
			code: 'WEBHOOK_VERIFICATION_ERROR'
		});
	}
};


// Zoom Webhook受信エンドポイント
//router.post('/zoom', (req, res) => {
// 従来形式: /api/webhooks/zoom
router.post('/zoom', verifyZoomWebhook, async (req, res) => {
	console.log( "/webhook/zoom(post) --->", "start" );

	try {
		const event = req.body.event;
		console.log('署名検証ミドルウェア開始:', {
			event: req.body?.event,
			hasSignature: !!req.headers['x-zm-signature'],
			hasTimestamp: !!req.headers['x-zm-request-timestamp']
		});

//		if (event === 'endpoint.url_validation') {
		switch (event) {
			case 'endpoint.url_validation':
				// URL検証（テナント対応）
				const { plainToken } = req.body.payload;
				const tenantId = req.tenantId;
				
				try {
					// テナント別Zoom設定から署名シークレット取得
					const credentials = await tenantZoomService.getZoomCredentials(tenantId);
					const encryptedToken = crypto
						.createHmac('sha256', credentials.zoom_webhook_secret)
						.update(plainToken)
						.digest('hex');
		
					return res.status(200).json({
						plainToken,
						encryptedToken
					});
				} catch (error) {
					console.error(`URL validation失敗 (テナント: ${tenantId}):`, error);
					return res.status(400).json({
						error: 'URL validation失敗',
						code: 'URL_VALIDATION_FAILED'
					});
				}
				break;
			case 'recording.completed':
				console.log('📹 録画完了イベント受信');
				await handleRecordingCompleted(req.body.payload, req.tenantId);
				// 成功レスポンスを返す
				res.status(200).json({
					message: 'Webhook処理が完了しました',
					event: event,
					tenantId: req.tenantId
				});
				break;
			case 'recording.transcript_completed':
				console.log('📝 文字起こし完了イベント受信 - VTT優先処理開始');
				await handleTranscriptCompleted(req.body.payload, req.tenantId);
				res.status(200).json({
					message: 'Transcript完了イベント処理が完了しました',
					event: event,
					tenantId: req.tenantId
				});
				break;
			case 'meeting.ended':
				await handleMeetingEnded(req.body.payload, req.tenantId);
				res.status(200).json({
					message: 'Webhook処理が完了しました',
					event: event,
					tenantId: req.tenantId
				});
				break;
			default:
				console.log(`未サポートのイベントタイプ: ${event}`);
		}
		
		// 成功レスポンスを返す
//		res.status(200).json({
//			message: 'Webhook処理が完了しました',
//			event: event
//		});
		
	} catch (error) {
		console.error('Zoom Webhook処理エラー:', error);
		res.status(500).json({
			error: 'Webhook処理中にエラーが発生しました'
		});
	}
});


// 録画完了イベントの処理（テナント対応）
const handleRecordingCompleted = async (payload, tenantId) => {
	console.log("/webhook/handleRecordingCompleted-->", "start", { tenantId });

	try {
		console.log('録画完了イベントを処理中...', {
			tenantId,
			meeting_id: payload.object.id,
			topic: payload.object.topic,
			recording_files: payload.object.recording_files?.length || 0
		});
		
		// 録画ファイルの確認
		if (!payload.object.recording_files || payload.object.recording_files.length === 0) {
			console.warn(`録画ファイルが見つかりません (テナント: ${tenantId})`);
			return;
		}
		
		// 議事録生成ジョブを作成（テナント付き）
		const agentJobId = await createAgentJob('recording_completed', payload, null, tenantId);
		
		// キューに議事録生成ジョブを追加
		await queueService.addTranscriptJob({
			jobId: agentJobId,
			tenantId: tenantId,
			type: 'recording_completed',
			meetingData: {
				meeting_id: payload.object.id,
				topic: payload.object.topic,
				start_time: payload.object.start_time,
				duration: payload.object.duration,
				host_email: payload.object.host_email,
				recording_files: payload.object.recording_files
			}
		});
		
		console.log(`録画完了イベント処理完了 (テナント: ${tenantId}): ジョブID ${agentJobId}`);
		
	} catch (error) {
		console.error(`録画完了イベント処理エラー (テナント: ${tenantId}):`, error);
		throw error;
	}
};

// 会議終了イベントの処理（テナント対応）
const handleMeetingEnded = async (payload, tenantId) => {
	console.log("/webhook/handleMeetingEnded-->", "start", { tenantId });

	try {
		console.log('会議終了イベントを処理中...', {
			tenantId,
			meeting_id: payload.object.id,
			topic: payload.object.topic
		});
		
		// 会議情報を記録（録画完了待機）
		const agentJobId = await createAgentJob('meeting_ended', payload, null, tenantId);
		
		console.log(`会議終了イベント処理完了 (テナント: ${tenantId}): ジョブID ${agentJobId}`);
		
	} catch (error) {
		console.error(`会議終了イベント処理エラー (テナント: ${tenantId}):`, error);
		throw error;
	}
};

/**
 * Transcript完了イベント処理（VTT優先戦略）
 * @param {Object} payload - Zoom webhook ペイロード
 * @param {string} tenantId - テナントID
 */
const handleTranscriptCompleted = async (payload, tenantId) => {
	console.log(`📝 Transcript完了イベント処理開始 (テナント: ${tenantId}):`, {
		meeting_id: payload.object.id,
		topic: payload.object.topic,
		transcript_files: payload.object.transcript_files?.length || 0
	});

	try {
		// VTTファイルの確認（recording_files内のTRANSCRIPTタイプ）
		const transcriptFiles = payload.object.recording_files?.filter(file => 
			file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
		) || [];
		
		if (transcriptFiles.length === 0) {
			console.warn(`⚠️ Transcriptファイルが見つかりません (テナント: ${tenantId})`);
			// フォールバック：従来の録画ファイル処理を実行
			if (payload.object.recording_files && payload.object.recording_files.length > 0) {
				console.log(`🔄 フォールバック：録画ファイル処理に切り替え (テナント: ${tenantId})`);
				await handleRecordingCompleted(payload, tenantId);
			}
			return;
		}
		
		console.log(`✅ VTTファイル発見 (${transcriptFiles.length}個) - VTT優先処理開始`);
		console.log('VTTファイル詳細:', transcriptFiles.map(f => ({
			file_type: f.file_type,
			file_extension: f.file_extension,
			recording_type: f.recording_type,
			file_size: f.file_size
		})));
		
		// VTT優先の議事録生成ジョブを作成
		const agentJobId = await createAgentJob('transcript_completed', payload, null, tenantId);
		
		// キューに議事録生成ジョブを追加（VTT優先フラグ付き）
		await queueService.addTranscriptJob({
			jobId: agentJobId,
			tenantId: tenantId,
			type: 'transcript_completed', // VTT優先処理を示すタイプ
			priority: 'vtt_priority', // VTT優先フラグ
			meetingData: {
				meeting_id: payload.object.id,
				topic: payload.object.topic,
				start_time: payload.object.start_time,
				duration: payload.object.duration,
				host_email: payload.object.host_email,
				transcript_files: transcriptFiles, // VTTファイル情報
				recording_files: payload.object.recording_files || [] // フォールバック用
			}
		});
		
		console.log(`✅ VTT優先ジョブ作成完了 (テナント: ${tenantId}): ジョブID ${agentJobId}`);
		
	} catch (error) {
		console.error(`❌ Transcript完了イベント処理エラー (テナント: ${tenantId}):`, error);
		// エラー時のフォールバック：従来処理を試行
		try {
			console.log(`🔄 エラー時フォールバック：録画完了処理に切り替え (テナント: ${tenantId})`);
			await handleRecordingCompleted(payload, tenantId);
		} catch (fallbackError) {
			console.error(`❌ フォールバック処理も失敗 (テナント: ${tenantId}):`, fallbackError);
			throw error; // 元のエラーを投げる
		}
	}
};

// Webhook検証用エンドポイント（Zoom設定時）
router.get('/zoom', (req, res) => {
	console.log( "/webhook/zoom(get) -->", "start" );

	const challenge = req.query.challenge;
	if (challenge) {
		res.status(200).json({
			challenge: challenge
		});
	} else {
		res.status(400).json({
			error: 'チャレンジパラメータが必要です'
		});
	}
});

/**
 * エージェントジョブを作成（テナント対応）
 * @param {string} type - ジョブタイプ
 * @param {Object} payload - Zoom webhook ペイロード
 * @param {string|null} userId - ジョブ作成者ID（オプション）
 * @param {string} tenantId - テナントID
 * @returns {Promise<number>} エージェントジョブID
 */
const createAgentJob = async (type, payload, userId = null, tenantId) => {
	try {
		// Zoom webhookの場合、host_emailからユーザーUUIDを取得を試みる
		let createdByUuid = userId;
		
		if (!createdByUuid && payload.object?.host_email) {
			try {
				const userResult = await db.query(
					'SELECT user_uuid FROM users WHERE email = $1 AND tenant_id = $2 AND is_active = true',
					[payload.object.host_email, tenantId]
				);
				
				if (userResult.rows.length > 0) {
					createdByUuid = userResult.rows[0].user_uuid;
					console.log(`Zoomホストメール ${payload.object.host_email} をユーザーUUID ${createdByUuid} にリンク (テナント: ${tenantId})`);
				} else {
					console.log(`Zoomホストメール ${payload.object.host_email} はテナント ${tenantId} のユーザーとして未登録`);
				}
			} catch (userError) {
				console.warn('ホストメールからユーザー検索エラー:', userError);
			}
		}
		
		const insertQuery = `
			INSERT INTO agent_jobs (tenant_id, type, status, created_by_uuid, data, meeting_id)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`;
		
		const values = [
			tenantId,
			type,
			'pending',
			createdByUuid, // NULL可（システムジョブの場合）
			JSON.stringify({
				trigger_data: payload,
				meeting_id: payload.object.id,
				topic: payload.object.topic,
				start_time: payload.object.start_time,
				host_email: payload.object.host_email
			}),
			payload.object.id
		];
		
		const result = await db.query(insertQuery, values);
		const agentJobId = result.rows[0].id;
		
		console.log(`エージェントジョブを作成しました: ${type} (ID: ${agentJobId}) - テナント: ${tenantId} - 作成者: ${createdByUuid || 'システム'}`);
		return agentJobId;
		
	} catch (error) {
		console.error(`エージェントジョブ作成エラー (テナント: ${tenantId}):`, error);
		throw new Error(`エージェントジョブ作成に失敗しました: ${error.message}`);
	}
};

// 新しい標準形式用のルートハンドラー: /api/webhooks/zoom/:tenantId
// テナントIDはserver.jsで既にreq.tenantIdに設定済み

// POST: 新しい標準形式でのWebhook受信
router.post('/', verifyZoomWebhook, async (req, res) => {
	console.log("/webhook/(post) 新しい形式 --->", "start", "テナントID:", req.tenantId);

	try {
		const event = req.body.event;
		console.log('新しい形式でのWebhook受信:', {
			event: req.body?.event,
			tenantId: req.tenantId,
			hasSignature: !!req.headers['x-zm-signature'],
			hasTimestamp: !!req.headers['x-zm-request-timestamp']
		});

		switch (event) {
			case 'endpoint.url_validation':
				// URL検証（テナント対応）
				const { plainToken } = req.body.payload;
				const tenantId = req.tenantId;
				
				try {
					// テナント別Zoom設定から署名シークレット取得
					const credentials = await tenantZoomService.getZoomCredentials(tenantId);
					const encryptedToken = crypto
						.createHmac('sha256', credentials.zoom_webhook_secret)
						.update(plainToken)
						.digest('hex');
		
					return res.status(200).json({
						plainToken,
						encryptedToken
					});
				} catch (error) {
					console.error(`URL validation失敗 (テナント: ${tenantId}):`, error);
					return res.status(500).json({
						error: 'URL validation処理でエラーが発生しました',
						details: error.message
					});
				}

			case 'recording.completed':
				console.log('📹 録画完了イベント受信 (新しい形式)', req.body.payload);
				await handleRecordingCompleted(req.body.payload, req.tenantId);
				res.status(200).json({
					message: '録画完了イベントを正常に処理しました',
					tenantId: req.tenantId
				});
				break;

			case 'recording.transcript_completed':
				console.log('📝 文字起こし完了イベント受信 (新しい形式) - VTT優先処理開始');
				console.log('=== FULL PAYLOAD DEBUG ===');
				console.log(JSON.stringify(req.body.payload, null, 2));
				console.log('=== END PAYLOAD DEBUG ===');
				await handleTranscriptCompleted(req.body.payload, req.tenantId);
				res.status(200).json({
					message: 'Transcript完了イベントを正常に処理しました (VTT優先)',
					tenantId: req.tenantId
				});
				break;

			case 'meeting.ended':
				await handleMeetingEnded(req.body.payload, req.tenantId);
				res.status(200).json({
					message: '会議終了イベントを正常に処理しました',
					tenantId: req.tenantId
				});
				break;

			default:
				console.log(`未対応イベント (新しい形式): ${event}`);
				res.status(200).json({
					message: `イベント ${event} を受信しましたが、処理は実装されていません`,
					tenantId: req.tenantId
				});
		}

	} catch (error) {
		console.error('Webhook処理エラー (新しい形式):', error);
		res.status(500).json({
			error: 'Webhook処理でエラーが発生しました',
			details: error.message,
			tenantId: req.tenantId
		});
	}
});

// GET: 新しい標準形式での検証エンドポイント
router.get('/', (req, res) => {
	console.log("/webhook/(get) 新しい形式 -->", "start", "テナントID:", req.tenantId);

	const challenge = req.query.challenge;
	if (challenge) {
		res.status(200).json({
			challenge: challenge,
			tenantId: req.tenantId
		});
	} else {
		res.status(400).json({
			error: 'チャレンジパラメータが必要です',
			tenantId: req.tenantId
		});
	}
});

module.exports = router;
