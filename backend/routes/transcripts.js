const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 議事録統計取得
router.get('/stats', authenticateToken, async (req, res) => {
	try {
		let baseQuery = `
			FROM meeting_transcripts mt
			JOIN agent_jobs aj ON mt.job_uuid = aj.job_uuid
		`;
		
		const params = [];
		let whereClause = '';
		
		// ユーザーロールに基づくフィルタリング
		if (req.user.role !== 'admin') {
			whereClause = ' WHERE mt.tenant_id = $1';
			params.push(req.user.tenant_id);
		}
		
		// 総議事録数
		const totalResult = await query(`SELECT COUNT(*) as total ${baseQuery} ${whereClause}`, params);
		const total = parseInt(totalResult.rows[0].total);
		
		// 今月の議事録数
		const thisMonthResult = await query(`
			SELECT COUNT(*) as this_month 
			${baseQuery} 
			${whereClause ? whereClause + ' AND' : ' WHERE'} 
			mt.start_time >= date_trunc('month', CURRENT_DATE)
		`, params);
		const thisMonth = parseInt(thisMonthResult.rows[0].this_month);
		
		// 平均会議時間
		const avgDurationResult = await query(`
			SELECT AVG(duration) as avg_duration 
			${baseQuery} 
			${whereClause}
		`, params);
		const avgDuration = Math.round(avgDurationResult.rows[0].avg_duration || 0);
		
		res.json({
			total,
			thisMonth,
			avgDuration
		});
		
	} catch (error) {
		console.error('議事録統計取得エラー:', error);
		res.status(500).json({
			error: '議事録統計取得中にエラーが発生しました'
		});
	}
});

// 議事録一覧取得（ユーザーは自分の議事録のみ、管理者は全て）
router.get('/', authenticateToken, async (req, res) => {
	try {
		const { page = 1, limit = 10, search = '', date_range = '' } = req.query;
		const offset = (page - 1) * limit;
		
		let baseQuery = `
			SELECT 
				mt.transcript_uuid,
				mt.transcript_uuid as id,
				mt.zoom_meeting_id,
				mt.meeting_topic,
				mt.start_time,
				mt.duration,
				mt.participants,
				mt.summary,
				mt.created_at,
				CASE 
					WHEN COUNT(*) OVER (PARTITION BY mt.zoom_meeting_id) > 1 
					THEN CONCAT(mt.meeting_topic, ' (', TO_CHAR(mt.start_time, 'YYYY/MM/DD HH24:MI'), ')')
					ELSE mt.meeting_topic
				END as display_title,
				aj.created_by_uuid,
				u.name as created_by_name,
				u.email as created_by_email,
				aj.data->>'host_email' as host_email,
				host_user.name as host_name
			FROM meeting_transcripts mt
			JOIN agent_jobs aj ON mt.job_uuid = aj.job_uuid
			LEFT JOIN users u ON aj.created_by_uuid = u.user_uuid
			LEFT JOIN users host_user ON host_user.email = aj.data->>'host_email'
		`;
		
		const conditions = [];
		const params = [];
		let paramIndex = 1;
		
		// ユーザーロールに基づくフィルタリング
		if (req.user.role !== 'admin') {
			// テナント基準でフィルタリング（同じテナント内の議事録を表示）
			conditions.push(`mt.tenant_id = $${paramIndex}`);
			params.push(req.user.tenant_id);
			paramIndex++;
		}
		
		// 検索条件
		if (search) {
			conditions.push(`(mt.meeting_topic ILIKE $${paramIndex} OR mt.summary ILIKE $${paramIndex})`);
			params.push(`%${search}%`);
			paramIndex++;
		}
		
		// 日付範囲フィルタ
		if (date_range) {
			const [startDate, endDate] = date_range.split(',');
			if (startDate) {
				conditions.push(`mt.start_time >= $${paramIndex}`);
				params.push(startDate);
				paramIndex++;
			}
			if (endDate) {
				conditions.push(`mt.start_time <= $${paramIndex}`);
				params.push(endDate);
				paramIndex++;
			}
		}
		
		// WHERE句の構築
		if (conditions.length > 0) {
			baseQuery += ' WHERE ' + conditions.join(' AND ');
		}
		
		// 件数取得
		const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
		const countResult = await query(countQuery, params);
		const total = parseInt(countResult.rows[0].total);
		
		// データ取得
		const dataQuery = `
			${baseQuery}
			ORDER BY mt.start_time DESC
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;
		params.push(limit, offset);
		
		const result = await query(dataQuery, params);
		
		res.json({
			transcripts: result.rows,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total: total,
				pages: Math.ceil(total / limit)
			}
		});
		
	} catch (error) {
		console.error('議事録一覧取得エラー:', error);
		res.status(500).json({
			error: '議事録一覧取得中にエラーが発生しました'
		});
	}
});

// 議事録詳細取得
router.get('/:id', authenticateToken, async (req, res) => {
	try {
		const transcriptUuid = req.params.id;
		
		const result = await query(`
			SELECT 
				mt.*,
				aj.created_by_uuid,
				aj.tenant_id,
				u.name as created_by_name,
				u.email as created_by_email,
				aj.data->>'host_email' as host_email,
				host_user.name as host_name
			FROM meeting_transcripts mt
			JOIN agent_jobs aj ON mt.job_uuid = aj.job_uuid
			LEFT JOIN users u ON aj.created_by_uuid = u.user_uuid
			LEFT JOIN users host_user ON host_user.email = aj.data->>'host_email'
			WHERE mt.transcript_uuid = $1
		`, [transcriptUuid]);
		
		if (result.rows.length === 0) {
			return res.status(404).json({
				error: '議事録が見つかりません'
			});
		}
		
		const transcript = result.rows[0];
		
		// 権限チェック（管理者以外は同じテナントの議事録のみ）
		if (req.user.role !== 'admin' && transcript.tenant_id !== req.user.tenant_id) {
			return res.status(403).json({
				error: 'この議事録にアクセスする権限がありません'
			});
		}
		
		res.json({
			transcript: transcript
		});
		
	} catch (error) {
		console.error('議事録詳細取得エラー:', error);
		res.status(500).json({
			error: '議事録詳細取得中にエラーが発生しました'
		});
	}
});

// 議事録の配布履歴取得
router.get('/:id/distribution-history', authenticateToken, async (req, res) => {
	try {
		const transcriptUuid = req.params.id;
		
		// 議事録の存在確認と権限チェック
		const transcriptResult = await query(`
			SELECT 
				mt.id,
				mt.transcript_uuid,
				mt.tenant_id
			FROM meeting_transcripts mt
			WHERE mt.transcript_uuid = $1
		`, [transcriptUuid]);
		
		if (transcriptResult.rows.length === 0) {
			return res.status(404).json({
				error: '議事録が見つかりません'
			});
		}
		
		const transcript = transcriptResult.rows[0];
		
		// 権限チェック（管理者以外は同じテナントの議事録のみ）
		if (req.user.role !== 'admin' && transcript.tenant_id !== req.user.tenant_id) {
			return res.status(403).json({
				error: 'この議事録にアクセスする権限がありません'
			});
		}
		
		// 配布履歴を取得
		const distributionResult = await query(`
			SELECT 
				dl.log_uuid,
				'email' as recipient_type,
				dl.recipient_email as recipient_id,
				dl.status,
				dl.sent_at,
				dl.error_message,
				dl.created_at,
				dl.recipient_email as display_recipient
			FROM distribution_logs dl
			WHERE dl.transcript_uuid = $1
			ORDER BY dl.created_at DESC
		`, [transcriptUuid]);
		
		res.json({
			success: true,
			transcript_uuid: transcriptUuid,
			distribution_history: distributionResult.rows.map(row => ({
				log_uuid: row.log_uuid,
				recipient_type: row.recipient_type,
				recipient_id: row.recipient_id,
				display_recipient: row.display_recipient,
				status: row.status,
				sent_at: row.sent_at,
				error_message: row.error_message,
				created_at: row.created_at
			}))
		});
		
	} catch (error) {
		console.error('配布履歴取得エラー:', error);
		res.status(500).json({
			error: '配布履歴取得中にエラーが発生しました'
		});
	}
});

// 議事録編集
router.put('/:id', [
	authenticateToken,
	body('formatted_transcript').optional().isString(),
	body('summary').optional().isString(),
	body('action_items').optional().isArray(),
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const transcriptUuid = req.params.id;
		const { formatted_transcript, summary, action_items } = req.body;
		
		// 権限チェック
		const transcriptResult = await query(`
			SELECT mt.tenant_id 
			FROM meeting_transcripts mt
			WHERE mt.transcript_uuid = $1
		`, [transcriptUuid]);
		
		if (transcriptResult.rows.length === 0) {
			return res.status(404).json({
				error: '議事録が見つかりません'
			});
		}
		
		const transcript = transcriptResult.rows[0];
		
		// 管理者以外は同じテナントの議事録のみ編集可能
		if (req.user.role !== 'admin' && transcript.tenant_id !== req.user.tenant_id) {
			return res.status(403).json({
				error: 'この議事録を編集する権限がありません'
			});
		}
		
		// 更新データの準備
		const updateFields = [];
		const params = [];
		let paramIndex = 1;
		
		if (formatted_transcript !== undefined) {
			updateFields.push(`formatted_transcript = $${paramIndex}`);
			params.push(formatted_transcript);
			paramIndex++;
		}
		
		if (summary !== undefined) {
			updateFields.push(`summary = $${paramIndex}`);
			params.push(summary);
			paramIndex++;
		}
		
		if (action_items !== undefined) {
			updateFields.push(`action_items = $${paramIndex}`);
			params.push(JSON.stringify(action_items));
			paramIndex++;
		}
		
		if (updateFields.length === 0) {
			return res.status(400).json({
				error: '更新するデータがありません'
			});
		}
		
		// 更新実行
		const updateQuery = `
			UPDATE meeting_transcripts 
			SET ${updateFields.join(', ')}
			WHERE transcript_uuid = $${paramIndex}
			RETURNING *
		`;
		params.push(transcriptUuid);
		
		const result = await query(updateQuery, params);
		
		console.log(`議事録更新: UUID ${transcriptUuid} by ${req.user.email}`);
		
		res.json({
			message: '議事録を更新しました',
			transcript: result.rows[0]
		});
		
	} catch (error) {
		console.error('議事録更新エラー:', error);
		res.status(500).json({
			error: '議事録更新中にエラーが発生しました'
		});
	}
});

// 議事録削除
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const transcriptUuid = req.params.id;
		
		// 権限チェック
		const transcriptResult = await query(`
			SELECT mt.tenant_id 
			FROM meeting_transcripts mt
			WHERE mt.transcript_uuid = $1
		`, [transcriptUuid]);
		
		if (transcriptResult.rows.length === 0) {
			return res.status(404).json({
				error: '議事録が見つかりません'
			});
		}
		
		const transcript = transcriptResult.rows[0];
		
		// 管理者以外は同じテナントの議事録のみ削除可能
		if (req.user.role !== 'admin' && transcript.tenant_id !== req.user.tenant_id) {
			return res.status(403).json({
				error: 'この議事録を削除する権限がありません'
			});
		}
		
		// トランザクション内で削除実行
		await transaction(async (client) => {
			// 1. transcript_uuidからtranscript_idを取得
			const transcriptIdResult = await client.query(
				'SELECT id FROM meeting_transcripts WHERE transcript_uuid = $1', 
				[transcriptUuid]
			);
			
			if (transcriptIdResult.rows.length === 0) {
				throw new Error('削除対象の議事録が見つかりません');
			}
			
			const transcriptId = transcriptIdResult.rows[0].id;
			
			// 2. 関連する配布ログを削除（transcript_idで削除）
			await client.query('DELETE FROM distribution_logs WHERE transcript_id = $1', [transcriptId]);
			
			// 3. 議事録を削除
			await client.query('DELETE FROM meeting_transcripts WHERE transcript_uuid = $1', [transcriptUuid]);
		});
		
		console.log(`議事録削除: UUID ${transcriptUuid} by ${req.user.email}`);
		
		res.json({
			message: '議事録を削除しました'
		});
		
	} catch (error) {
		console.error('議事録削除エラー:', error);
		res.status(500).json({
			error: '議事録削除中にエラーが発生しました'
		});
	}
});

module.exports = router;