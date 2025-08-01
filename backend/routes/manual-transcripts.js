const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const QueueService = require('../services/queueService');

const router = express.Router();
const queueService = new QueueService();

/**
 * ミーティングIDを手動入力して議事録を生成
 */
router.post('/create-from-meeting-id', [
	authenticateToken,
	body('meeting_id').notEmpty().withMessage('ミーティングIDは必須です'),
	body('meeting_topic').optional().isString(),
	body('host_email').optional().isEmail(),
	body('start_time').optional().isISO8601(),
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}

		const { meeting_id, meeting_topic, host_email, start_time } = req.body;
		
		console.log(`📝 手動議事録生成開始: ミーティングID ${meeting_id} by ${req.user.email}`);

		// 会議データを構築
		const meetingData = {
			meeting_id: meeting_id,
			topic: meeting_topic || 'ミーティング',
			start_time: start_time || new Date().toISOString(),
			host_email: host_email || req.user.email,
			host_id: req.user.user_uuid,
			// 手動処理であることを示すフラグ
			manual_processing: true
		};

		// エージェントジョブを作成
		const { Pool } = require('pg');
		const db = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		const jobInsertQuery = `
			INSERT INTO agent_jobs (
				agent_job_uuid, type, status, created_by_uuid, data
			) VALUES (
				gen_random_uuid(), 'manual_transcript', 'pending', $1, $2
			) RETURNING id, agent_job_uuid
		`;

		const jobResult = await db.query(jobInsertQuery, [
			req.user.user_uuid,
			JSON.stringify(meetingData)
		]);

		const agentJobId = jobResult.rows[0].id;
		const agentJobUuid = jobResult.rows[0].agent_job_uuid;

		console.log(`エージェントジョブを作成しました: manual_transcript (ID: ${agentJobId}) - 作成者: ${req.user.user_uuid}`);

		// 議事録生成ジョブをキューに追加
		const job = await queueService.addTranscriptJob({
			agentJobId: agentJobId,
			meetingData: meetingData
		});

		console.log(`手動議事録生成ジョブを追加しました: ${job.id}`);

		await db.end();

		res.json({
			success: true,
			message: '議事録生成を開始しました',
			agent_job_id: agentJobId,
			agent_job_uuid: agentJobUuid,
			queue_job_id: job.id,
			meeting_id: meeting_id
		});

	} catch (error) {
		console.error('手動議事録生成エラー:', error);
		res.status(500).json({
			error: '議事録生成の開始に失敗しました',
			details: error.message
		});
	}
});

/**
 * 手動議事録生成ジョブのステータス確認
 */
router.get('/job-status/:job_id', authenticateToken, async (req, res) => {
	try {
		const jobId = req.params.job_id;

		const { Pool } = require('pg');
		const db = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		const jobQuery = `
			SELECT 
				aj.id,
				aj.agent_job_uuid,
				aj.type,
				aj.status,
				aj.error_message,
				aj.result,
				aj.created_at,
				aj.updated_at,
				aj.completed_at,
				mt.transcript_uuid,
				mt.meeting_topic,
				mt.start_time
			FROM agent_jobs aj
			LEFT JOIN meeting_transcripts mt ON aj.agent_job_uuid = mt.agent_job_uuid
			WHERE aj.id = $1 AND aj.created_by_uuid = $2
		`;

		const result = await db.query(jobQuery, [jobId, req.user.user_uuid]);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'ジョブが見つかりません'
			});
		}

		const job = result.rows[0];
		await db.end();

		res.json({
			success: true,
			job: {
				id: job.id,
				uuid: job.agent_job_uuid,
				type: job.type,
				status: job.status,
				error_message: job.error_message,
				result: job.result,
				created_at: job.created_at,
				updated_at: job.updated_at,
				completed_at: job.completed_at,
				transcript: job.transcript_uuid ? {
					uuid: job.transcript_uuid,
					topic: job.meeting_topic,
					start_time: job.start_time
				} : null
			}
		});

	} catch (error) {
		console.error('ジョブステータス確認エラー:', error);
		res.status(500).json({
			error: 'ジョブステータス確認に失敗しました',
			details: error.message
		});
	}
});

module.exports = router;