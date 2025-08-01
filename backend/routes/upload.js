const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const { query } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const OpenAIService = require('../services/openaiService');
const AnthropicService = require('../services/anthropicService');
const EmailService = require('../services/emailService');
const { parseVTTContent } = require('../utils/zoom');

const router = express.Router();

// サービスのインスタンス化
const openaiService = new OpenAIService();
const anthropicService = new AnthropicService();
const emailService = new EmailService();

// ファイルアップロード設定
const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		const fileExtension = path.extname(file.originalname).toLowerCase();
		const uploadDir = fileExtension === '.vtt' 
			? path.join(__dirname, '../uploads/vtt')
			: path.join(__dirname, '../uploads/audio');
		try {
			await fs.mkdir(uploadDir, { recursive: true });
			cb(null, uploadDir);
		} catch (error) {
			cb(error);
		}
	},
	filename: (req, file, cb) => {
		// ファイル名: timestamp_userid_originalname
		const timestamp = Date.now();
		const userId = req.user?.id || 'anonymous';
		const extension = path.extname(file.originalname);
		const baseName = path.basename(file.originalname, extension);
		const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
		cb(null, `${timestamp}_${userId}_${sanitizedBaseName}${extension}`);
	}
});

// ファイルフィルター（音声ファイルとVTTファイルを許可）
const fileFilter = (req, file, cb) => {
	const allowedMimes = [
		'audio/mpeg',
		'audio/mp3', 
		'audio/wav',
		'audio/wave',
		'audio/x-wav',
		'audio/mp4',
		'audio/m4a',
		'audio/aac',
		'audio/ogg',
		'audio/webm',
		'video/mp4',
		'video/mpeg',
		'video/quicktime',
		'video/x-msvideo',
		'video/webm',
		'text/vtt',
		'text/plain'
	];
	
	const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4', '.mov', '.avi', '.webm', '.vtt'];
	const fileExtension = path.extname(file.originalname).toLowerCase();
	
	if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
		cb(null, true);
	} else {
		cb(new Error('許可されていないファイル形式です。音声・動画・VTTファイルのみアップロード可能です。'), false);
	}
};

// multer設定
const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: 100 * 1024 * 1024, // 100MB制限
	}
});

// 音声ファイルアップロードエンドポイント
router.post('/audio', [
	authenticateToken,
	upload.single('audioFile'),
	body('title')
		.optional()
		.trim()
		.isLength({ max: 255 })
		.withMessage('タイトルは255文字以内で入力してください'),
	body('description')
		.optional()
		.trim()
		.isLength({ max: 1000 })
		.withMessage('説明は1000文字以内で入力してください'),
], async (req, res) => {
	try {
		// バリデーションエラーのチェック
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			// ファイルが既にアップロードされている場合は削除
			if (req.file) {
				try {
					await fs.unlink(req.file.path);
				} catch (unlinkError) {
					console.error('ファイル削除エラー:', unlinkError);
				}
			}
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}

		// ファイルがアップロードされているかチェック
		if (!req.file) {
			return res.status(400).json({
				error: '音声ファイルまたはVTTファイルが必要です'
			});
		}

		const { title, description } = req.body;
		
		// ファイル情報を取得
		const stats = await fs.stat(req.file.path);
		const isVTTFile = path.extname(req.file.originalname).toLowerCase() === '.vtt';
		
		console.log(`${isVTTFile ? 'VTT' : '音声'}ファイルアップロード: ${req.file.originalname} (${req.file.size} bytes) by ${req.user.email}`);

		// agent_jobsテーブルにジョブを作成
		const insertQuery = `
			INSERT INTO agent_jobs (type, status, created_by, data)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`;
		
		const triggerData = {
			source: 'local_upload',
			uploaded_by: req.user.email,
			upload_time: new Date().toISOString(),
			file_type: isVTTFile ? 'vtt' : 'audio'
		};
		
		const inputData = {
			file_path: req.file.path,
			file_name: req.file.originalname,
			file_size: req.file.size,
			mime_type: req.file.mimetype,
			title: title || req.file.originalname,
			description: description || null,
			meeting_id: `local_${Date.now()}`,
			topic: title || `アップロード${isVTTFile ? 'VTT' : '音声'}: ${req.file.originalname}`,
			start_time: new Date().toISOString(),
			host_email: req.user.email,
			is_vtt_file: isVTTFile
		};
		
		const values = [
			isVTTFile ? 'local_vtt_transcript' : 'local_audio_transcript',
			'pending',
			req.user.id,
			JSON.stringify({ ...triggerData, ...inputData })
		];
		
		const result = await query(insertQuery, values);
		const agentJobId = result.rows[0].id;
		
		// ファイルタイプに応じた処理を開始
		if (isVTTFile) {
			// VTTファイル処理を開始
			processLocalVTTFile(agentJobId, req.file.path, inputData);
		} else {
			// 音声ファイル処理を開始（既存のデバッグAPI機能を活用）
			processLocalAudioFile(agentJobId, req.file.path, inputData);
		}
		
		console.log(`ローカル${isVTTFile ? 'VTT' : '音声'}処理ジョブを作成しました: ID ${agentJobId}`);
		
		res.status(201).json({
			message: `${isVTTFile ? 'VTT' : '音声'}ファイルのアップロードが完了しました。議事録の生成を開始します。`,
			jobId: agentJobId,
			fileName: req.file.originalname,
			fileSize: req.file.size,
			fileType: isVTTFile ? 'vtt' : 'audio',
			title: inputData.title,
			costSavings: isVTTFile,
			processingMethod: isVTTFile ? 'VTT解析' : 'Whisper API'
		});
		
	} catch (error) {
		console.error('音声ファイルアップロードエラー:', error);
		
		// ファイルが既にアップロードされている場合は削除
		if (req.file) {
			try {
				await fs.unlink(req.file.path);
			} catch (unlinkError) {
				console.error('ファイル削除エラー:', unlinkError);
			}
		}
		
		// Multerエラーのハンドリング
		if (error.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({
				error: 'ファイルサイズが大きすぎます。100MB以下のファイルをアップロードしてください。'
			});
		}
		
		if (error.message.includes('許可されていないファイル形式')) {
			return res.status(400).json({
				error: error.message
			});
		}
		
		res.status(500).json({
			error: '音声ファイルアップロード中にエラーが発生しました'
		});
	}
});

// アップロード可能なファイル形式情報取得
router.get('/audio/formats', authenticateToken, (req, res) => {
	res.json({
		supportedFormats: {
			audio: [
				{ extension: '.mp3', description: 'MP3音声ファイル', costSavings: false },
				{ extension: '.wav', description: 'WAV音声ファイル', costSavings: false },
				{ extension: '.m4a', description: 'M4A音声ファイル', costSavings: false },
				{ extension: '.aac', description: 'AAC音声ファイル', costSavings: false },
				{ extension: '.ogg', description: 'OGG音声ファイル', costSavings: false }
			],
			video: [
				{ extension: '.mp4', description: 'MP4動画ファイル', costSavings: false },
				{ extension: '.mov', description: 'MOV動画ファイル', costSavings: false },
				{ extension: '.avi', description: 'AVI動画ファイル', costSavings: false },
				{ extension: '.webm', description: 'WebM動画ファイル', costSavings: false }
			],
			vtt: [
				{ extension: '.vtt', description: 'VTT字幕ファイル (コスト削減)', costSavings: true }
			]
		},
		maxFileSize: '100MB',
		notes: [
			'動画ファイルの場合は音声部分のみ抽出して処理されます',
			'VTTファイルはZoom等で生成された字幕ファイルで、Whisper API使用料を削減できます',
			'VTTファイルには発言者情報が含まれており、より正確な議事録が生成されます'
		]
	});
});

// ユーザーのアップロード履歴取得
router.get('/audio/history', authenticateToken, async (req, res) => {
	try {
		const { page = 1, limit = 10 } = req.query;
		const offset = (page - 1) * limit;
		
		// ユーザーのローカルアップロードジョブを取得
		let baseQuery = `
			SELECT 
				aj.id,
				aj.type,
				aj.status,
				aj.created_at,
				aj.completed_at,
				aj.error_message,
				aj.data,
				mt.id as transcript_id,
				mt.meeting_topic
			FROM agent_jobs aj
			LEFT JOIN meeting_transcripts mt ON mt.agent_job_id = aj.id
			WHERE aj.type = 'local_audio_transcript'
		`;
		
		const params = [];
		let paramIndex = 1;
		
		// ユーザーロールに基づくフィルタリング
		if (req.user.role !== 'admin') {
			baseQuery += ` AND aj.created_by = $${paramIndex}`;
			params.push(req.user.id);
			paramIndex++;
		}
		
		// 件数取得
		const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
		const countResult = await query(countQuery, params);
		const total = parseInt(countResult.rows[0].total);
		
		// データ取得
		const dataQuery = `
			${baseQuery}
			ORDER BY aj.created_at DESC
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;
		params.push(limit, offset);
		
		const result = await query(dataQuery, params);
		
		// データ整形
		const uploads = result.rows.map(row => ({
			id: row.id,
			status: row.status,
			title: row.data?.title || row.data?.file_name || 'タイトル未設定',
			fileName: row.data?.file_name,
			fileSize: row.data?.file_size,
			createdAt: row.created_at,
			completedAt: row.completed_at,
			errorMessage: row.error_message,
			transcriptId: row.transcript_id,
			hasTranscript: !!row.transcript_id
		}));
		
		res.json({
			uploads,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total: total,
				pages: Math.ceil(total / limit)
			}
		});
		
	} catch (error) {
		console.error('アップロード履歴取得エラー:', error);
		res.status(500).json({
			error: 'アップロード履歴取得中にエラーが発生しました'
		});
	}
});

// 特定のアップロードジョブの詳細取得
router.get('/audio/:jobId', authenticateToken, async (req, res) => {
	try {
		const jobId = req.params.jobId;
		
		const result = await query(`
			SELECT 
				aj.*,
				mt.id as transcript_id,
				mt.meeting_topic,
				mt.summary,
				mt.created_at as transcript_created_at
			FROM agent_jobs aj
			LEFT JOIN meeting_transcripts mt ON mt.agent_job_id = aj.id
			WHERE aj.id = $1 AND aj.type = 'local_audio_transcript'
		`, [jobId]);
		
		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'アップロードジョブが見つかりません'
			});
		}
		
		const job = result.rows[0];
		
		// 権限チェック（管理者以外は自分のジョブのみ）
		if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
			return res.status(403).json({
				error: 'このアップロードジョブにアクセスする権限がありません'
			});
		}
		
		res.json({
			job: {
				id: job.id,
				status: job.status,
				title: job.data?.title || job.data?.file_name || 'タイトル未設定',
				fileName: job.data?.file_name,
				fileSize: job.data?.file_size,
				description: job.data?.description,
				createdAt: job.created_at,
				completedAt: job.completed_at,
				errorMessage: job.error_message,
				transcriptId: job.transcript_id,
				hasTranscript: !!job.transcript_id,
				transcriptTitle: job.meeting_topic,
				transcriptSummary: job.summary,
				transcriptCreatedAt: job.transcript_created_at
			}
		});
		
	} catch (error) {
		console.error('アップロードジョブ詳細取得エラー:', error);
		res.status(500).json({
			error: 'アップロードジョブ詳細取得中にエラーが発生しました'
		});
	}
});

/**
 * ローカルVTTファイルを処理（非同期）
 * @param {number} agentJobId - エージェントジョブID
 * @param {string} vttFilePath - VTTファイルパス
 * @param {Object} inputData - 入力データ
 */
async function processLocalVTTFile(agentJobId, vttFilePath, inputData) {
	try {
		console.log(`ローカルVTTファイル処理開始: ${agentJobId}`);
		
		// 1. ステータスを処理中に更新
		await query(
			'UPDATE agent_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
			['processing', agentJobId]
		);
		
		// 2. VTTファイルを読み込み・解析
		console.log('VTTファイルの解析を開始...');
		const vttContent = await fs.readFile(vttFilePath, 'utf-8');
		const vttAnalysis = parseVTTContent(vttContent);
		
		if (!vttAnalysis.success) {
			throw new Error(`VTTファイル解析エラー: ${vttAnalysis.error}`);
		}
		
		const rawTranscript = vttAnalysis.chronologicalTranscript;
		
		// 3. 参加者情報をVTTファイルから取得
		const participants = vttAnalysis.speakers.map(speaker => ({
			name: speaker,
			email: '',
			role: 'participant'
		}));
		
		// ホストメールが指定されている場合は追加
		if (inputData.host_email) {
			participants.unshift({
				name: inputData.host_email.split('@')[0],
				email: inputData.host_email,
				role: 'host'
			});
		}
		
		// 4. 議事録生成（既存のデバッグAPI機能を活用）
		console.log('議事録の生成を開始...');
		const formattedResult = await anthropicService.generateMeetingMinutes(
			rawTranscript,
			inputData.title,
			participants
		);
		
		// 5. meeting_transcriptsテーブルに保存
		console.log('議事録をデータベースに保存...');
		const transcriptId = await saveMeetingTranscript({
			agentJobId,
			zoomMeetingId: inputData.meeting_id,
			meetingTopic: inputData.title,
			startTime: inputData.start_time,
			duration: estimateDurationFromTranscript(rawTranscript),
			participants,
			rawTranscript,
			formattedTranscript: formattedResult.formatted_transcript,
			summary: formattedResult.summary,
			actionItems: formattedResult.action_items
		});
		
		// 6. メール配信（既存のデバッグAPI機能を活用）
		console.log('議事録をメール配信...');
		await emailService.sendTranscriptEmail({
			recipients: inputData.host_email,
			transcript: {
				id: transcriptId,
				meeting_topic: inputData.title,
				summary: formattedResult.summary,
				formatted_transcript: formattedResult.formatted_transcript,
				action_items: formattedResult.action_items
			},
			meetingInfo: {
				topic: inputData.title,
				start_time: inputData.start_time,
				duration: estimateDurationFromTranscript(rawTranscript),
				participants,
				meeting_id: inputData.meeting_id
			}
		});
		
		// 7. 処理完了
		await query(
			'UPDATE agent_jobs SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, result = $2 WHERE id = $3',
			['completed', JSON.stringify({
				transcription_method: 'vtt',
				transcription_source: 'local_vtt',
				transcript_id: transcriptId,
				processing_time: Date.now(),
				cost_savings: true,
				whisper_api_used: false,
				speaker_count: vttAnalysis.speakers.length,
				speakers: vttAnalysis.speakers
			}), agentJobId]
		);
		
		// 8. 一時ファイルを削除
		try {
			await fs.unlink(vttFilePath);
			console.log('一時VTTファイルを削除しました');
		} catch (unlinkError) {
			console.error('一時VTTファイル削除エラー:', unlinkError);
		}
		
		console.log(`✅ ローカルVTTファイル処理完了: ${agentJobId}`);
		
	} catch (error) {
		console.error(`❌ ローカルVTTファイル処理エラー: ${agentJobId}`, error);
		
		// エラー状態を更新
		await query(
			'UPDATE agent_jobs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
			['failed', error.message, agentJobId]
		);
		
		// 失敗時も一時ファイルを削除
		try {
			await fs.unlink(vttFilePath);
		} catch (unlinkError) {
			console.error('一時VTTファイル削除エラー:', unlinkError);
		}
		
		throw error;
	}
}

/**
 * ローカル音声ファイルを処理（非同期）
 * @param {number} agentJobId - エージェントジョブID
 * @param {string} audioFilePath - 音声ファイルパス
 * @param {Object} inputData - 入力データ
 */
async function processLocalAudioFile(agentJobId, audioFilePath, inputData) {
	try {
		console.log(`ローカル音声ファイル処理開始: ${agentJobId}`);
		
		// 1. ステータスを処理中に更新
		await query(
			'UPDATE agent_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
			['processing', agentJobId]
		);
		
		// 2. 音声ファイルを文字起こし（既存のデバッグAPI機能を活用）
		console.log('音声ファイルの文字起こしを開始...');
		const rawTranscript = await openaiService.transcribeAudioFromFile(audioFilePath);
		
		// 3. 議事録生成（既存のデバッグAPI機能を活用）
		console.log('議事録の生成を開始...');
		const participants = [{
			name: inputData.host_email.split('@')[0],
			email: inputData.host_email,
			role: 'host'
		}];
		
		const formattedResult = await anthropicService.generateMeetingMinutes(
			rawTranscript,
			inputData.title,
			participants
		);
		
		// 4. meeting_transcriptsテーブルに保存
		console.log('議事録をデータベースに保存...');
		const transcriptId = await saveMeetingTranscript({
			agentJobId,
			zoomMeetingId: inputData.meeting_id,
			meetingTopic: inputData.title,
			startTime: inputData.start_time,
			duration: estimateDurationFromTranscript(rawTranscript),
			participants,
			rawTranscript,
			formattedTranscript: formattedResult.formatted_transcript,
			summary: formattedResult.summary,
			actionItems: formattedResult.action_items
		});
		
		// 5. メール配信（既存のデバッグAPI機能を活用）
		console.log('議事録をメール配信...');
		await emailService.sendTranscriptEmail({
			recipients: inputData.host_email,
			transcript: {
				summary: formattedResult.summary,
				action_items: formattedResult.action_items,
				formatted_transcript: formattedResult.formatted_transcript,
				key_decisions: formattedResult.key_decisions || []
			},
			meetingInfo: {
				topic: inputData.title,
				start_time: inputData.start_time,
				duration: estimateDurationFromTranscript(rawTranscript),
				participants: participants
			}
		});
		
		// 6. ジョブ完了をマーク
		await query(
			`UPDATE agent_jobs 
			 SET status = 'completed', 
			     result = $1, 
			     completed_at = CURRENT_TIMESTAMP,
			     updated_at = CURRENT_TIMESTAMP 
			 WHERE id = $2`,
			[JSON.stringify({
				transcription_method: 'whisper',
				transcription_source: 'local_audio',
				transcript_id: transcriptId,
				meeting_topic: inputData.title,
				summary: formattedResult.summary,
				processing_time: Date.now(),
				cost_savings: false,
				whisper_api_used: true
			}), agentJobId]
		);
		
		// 7. アップロードファイルを削除
		try {
			await fs.unlink(audioFilePath);
			console.log('アップロードファイルを削除しました:', audioFilePath);
		} catch (unlinkError) {
			console.warn('ファイル削除エラー:', unlinkError);
		}
		
		console.log(`ローカル音声ファイル処理完了: ${agentJobId} → 議事録ID: ${transcriptId}`);
		
	} catch (error) {
		console.error(`ローカル音声ファイル処理エラー: ${agentJobId}`, error);
		
		// エラー情報をagent_jobsテーブルに記録
		await query(
			`UPDATE agent_jobs 
			 SET status = 'failed', 
			     error_message = $1, 
			     updated_at = CURRENT_TIMESTAMP 
			 WHERE id = $2`,
			[error.message, agentJobId]
		);
		
		// アップロードファイルを削除
		try {
			await fs.unlink(audioFilePath);
			console.log('エラー時にアップロードファイルを削除しました:', audioFilePath);
		} catch (unlinkError) {
			console.warn('ファイル削除エラー:', unlinkError);
		}
	}
}

/**
 * meeting_transcriptsテーブルに議事録を保存
 * @param {Object} transcriptData - 議事録データ
 * @returns {Promise<number>} 議事録ID
 */
async function saveMeetingTranscript(transcriptData) {
	const {
		agentJobId,
		zoomMeetingId,
		meetingTopic,
		startTime,
		duration,
		participants,
		rawTranscript,
		formattedTranscript,
		summary,
		actionItems
	} = transcriptData;

	const insertQuery = `
		INSERT INTO meeting_transcripts (
			agent_job_id,
			zoom_meeting_id,
			meeting_topic,
			start_time,
			duration,
			participants,
			raw_transcript,
			formatted_transcript,
			summary,
			action_items
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`;

	const values = [
		agentJobId,
		zoomMeetingId,
		meetingTopic,
		startTime,
		duration,
		JSON.stringify(participants),
		rawTranscript,
		formattedTranscript,
		summary,
		JSON.stringify(actionItems)
	];

	const result = await query(insertQuery, values);
	return result.rows[0].id;
}

/**
 * 文字起こしから会議時間を推定
 * @param {string} transcript - 文字起こしテキスト
 * @returns {number} 推定時間（分）
 */
function estimateDurationFromTranscript(transcript) {
	// 平均的な話速を1分間に150語として計算
	const words = transcript.split(/\s+/).length;
	const estimatedMinutes = Math.ceil(words / 150);
	return Math.max(estimatedMinutes, 1); // 最低1分
}

module.exports = router;