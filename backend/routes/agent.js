const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, paginatedQuery } = require('../utils/database');

const router = express.Router();

// エージェントジョブ一覧取得
router.get('/jobs', authenticateToken, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const status = req.query.status;
		const type = req.query.type;
		
		let baseQuery = `
			SELECT 
				aj.agent_job_uuid,
				aj.agent_job_uuid as id,
				aj.type,
				aj.status,
				aj.created_by_uuid,
				u.name as created_by_name,
				aj.trigger_data,
				aj.error_message,
				aj.created_at,
				aj.updated_at,
				aj.completed_at
			FROM agent_jobs aj
			LEFT JOIN users u ON aj.created_by_uuid = u.user_uuid
		`;
		
		const params = [];
		const conditions = [];
		
		// フィルタリング条件の追加
		if (status) {
			conditions.push(`aj.status = $${params.length + 1}`);
			params.push(status);
		}
		
		if (type) {
			conditions.push(`aj.type = $${params.length + 1}`);
			params.push(type);
		}
		
		// 管理者以外は自分が作成したジョブのみ表示
		if (req.user.role !== 'admin') {
			conditions.push(`aj.created_by_uuid = $${params.length + 1}`);
			params.push(req.user.user_uuid);
		}
		
		if (conditions.length > 0) {
			baseQuery += ' WHERE ' + conditions.join(' AND ');
		}
		
		baseQuery += ' ORDER BY aj.created_at DESC';
		
		const result = await paginatedQuery(baseQuery, params, page, limit);
		
		res.json({
			jobs: result.data,
			pagination: result.pagination
		});
		
	} catch (error) {
		console.error('エージェントジョブ一覧取得エラー:', error);
		res.status(500).json({
			error: 'エージェントジョブ一覧取得中にエラーが発生しました'
		});
	}
});

// エージェントジョブ詳細取得
router.get('/jobs/:jobId', authenticateToken, async (req, res) => {
	try {
		const jobUuid = req.params.jobId;
		
		const result = await query(`
			SELECT 
				aj.*,
				u.name as created_by_name,
				u.email as created_by_email
			FROM agent_jobs aj
			LEFT JOIN users u ON aj.created_by_uuid = u.user_uuid
			WHERE aj.agent_job_uuid = $1
		`, [jobUuid]);
		
		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'エージェントジョブが見つかりません'
			});
		}
		
		const job = result.rows[0];
		
		// 管理者以外は自分が作成したジョブのみ表示
		if (req.user.role !== 'admin' && job.created_by_uuid !== req.user.user_uuid) {
			return res.status(403).json({
				error: 'このエージェントジョブにアクセスする権限がありません'
			});
		}
		
		res.json({
			job
		});
		
	} catch (error) {
		console.error('エージェントジョブ詳細取得エラー:', error);
		res.status(500).json({
			error: 'エージェントジョブ詳細取得中にエラーが発生しました'
		});
	}
});

// エージェント設定取得（管理者のみ）
router.get('/settings', [authenticateToken, requireAdmin], async (req, res) => {
	try {
		const result = await query(`
			SELECT setting_key, setting_value, description, updated_at
			FROM agent_settings
			ORDER BY setting_key
		`);
		
		const settings = {};
		result.rows.forEach(row => {
			settings[row.setting_key] = {
				value: row.setting_value,
				description: row.description,
				updatedAt: row.updated_at
			};
		});
		
		res.json({
			settings
		});
		
	} catch (error) {
		console.error('エージェント設定取得エラー:', error);
		res.status(500).json({
			error: 'エージェント設定取得中にエラーが発生しました'
		});
	}
});

// エージェント設定更新（管理者のみ）
router.put('/settings', [authenticateToken, requireAdmin], async (req, res) => {
	try {
		const { settings } = req.body;
		
		if (!settings || typeof settings !== 'object') {
			return res.status(400).json({
				error: '設定データが無効です'
			});
		}
		
		// 設定を一つずつ更新
		for (const [key, value] of Object.entries(settings)) {
			await query(`
				INSERT INTO agent_settings (setting_key, setting_value, updated_at)
				VALUES ($1, $2, CURRENT_TIMESTAMP)
				ON CONFLICT (setting_key) DO UPDATE SET
					setting_value = EXCLUDED.setting_value,
					updated_at = EXCLUDED.updated_at
			`, [key, JSON.stringify(value)]);
		}
		
		console.log(`エージェント設定更新: ${Object.keys(settings).join(', ')} (管理者: ${req.user.email})`);
		
		res.json({
			message: 'エージェント設定を更新しました'
		});
		
	} catch (error) {
		console.error('エージェント設定更新エラー:', error);
		res.status(500).json({
			error: 'エージェント設定更新中にエラーが発生しました'
		});
	}
});

// エージェントジョブ統計取得
router.get('/stats', authenticateToken, async (req, res) => {
	try {
		const statsQuery = `
			SELECT 
				COUNT(*) as total_jobs,
				COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
				COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_jobs,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
				COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
				COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_jobs
			FROM agent_jobs
		`;
		
		const params = [];
		let whereClause = '';
		
		// 管理者以外は自分が作成したジョブのみ
		if (req.user.role !== 'admin') {
			whereClause = ' WHERE created_by_uuid = $1';
			params.push(req.user.user_uuid);
		}
		
		const result = await query(statsQuery + whereClause, params);
		const stats = result.rows[0];
		
		// 数値型に変換
		Object.keys(stats).forEach(key => {
			stats[key] = parseInt(stats[key]);
		});
		
		res.json({
			stats
		});
		
	} catch (error) {
		console.error('エージェントジョブ統計取得エラー:', error);
		res.status(500).json({
			error: 'エージェントジョブ統計取得中にエラーが発生しました'
		});
	}
});

module.exports = router;