/**
 * テナント管理者用APIルート
 * 自分のテナント情報の管理機能
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getTenant } = require('../middleware/tenantMiddleware');
const tenantZoomService = require('../services/tenantZoomService');
const { query } = require('../utils/database');

// 全ルートで認証が必要
router.use(authenticateToken);

// テナント管理者権限チェック
const requireTenantAdmin = (req, res, next) => {
	if (req.user.role !== 'tenant_admin') {
		return res.status(403).json({
			error: 'テナント管理者権限が必要です',
			code: 'INSUFFICIENT_PERMISSIONS'
		});
	}
	next();
};

router.use(requireTenantAdmin);

// 自分のテナント情報取得
router.get('/tenant', async (req, res) => {
	try {
		const tenantId = req.user.tenant_id;
		
		if (!tenantId) {
			return res.status(400).json({
				error: 'テナントIDが見つかりません',
				code: 'TENANT_ID_NOT_FOUND'
			});
		}

		const tenant = await getTenant(tenantId);
		
		if (!tenant) {
			return res.status(404).json({
				error: 'テナントが見つかりません',
				code: 'TENANT_NOT_FOUND'
			});
		}

		// テナント統計情報取得
		const statsQueries = [
			query('SELECT COUNT(*) as user_count FROM users WHERE tenant_id = $1', [tenantId]),
			query('SELECT COUNT(*) as job_count FROM agent_jobs WHERE tenant_id = $1', [tenantId]),
			query('SELECT COUNT(*) as transcript_count FROM meeting_transcripts WHERE tenant_id = $1', [tenantId])
		];

		const [usersResult, jobsResult, transcriptsResult] = await Promise.all(statsQueries);

		const stats = {
			user_count: parseInt(usersResult.rows[0].user_count),
			job_count: parseInt(jobsResult.rows[0].job_count),
			transcript_count: parseInt(transcriptsResult.rows[0].transcript_count)
		};

		res.json({
			tenant: {
				...tenant,
				stats
			}
		});

	} catch (error) {
		console.error('テナント情報取得エラー:', error);
		res.status(500).json({
			error: 'テナント情報の取得に失敗しました',
			code: 'TENANT_GET_FAILED'
		});
	}
});

// 自分のテナント情報更新
router.put('/tenant', async (req, res) => {
	try {
		const tenantId = req.user.tenant_id;
		const { name, admin_email } = req.body;

		if (!tenantId) {
			return res.status(400).json({
				error: 'テナントIDが見つかりません',
				code: 'TENANT_ID_NOT_FOUND'
			});
		}

		const updateFields = [];
		const values = [tenantId];
		let paramIndex = 2;

		if (name !== undefined) {
			updateFields.push(`name = $${paramIndex++}`);
			values.push(name);
		}

		if (admin_email !== undefined) {
			updateFields.push(`admin_email = $${paramIndex++}`);
			values.push(admin_email);
		}

		if (updateFields.length === 0) {
			return res.status(400).json({
				error: '更新する項目がありません',
				code: 'NO_UPDATE_FIELDS'
			});
		}

		updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

		const queryText = `
			UPDATE tenants 
			SET ${updateFields.join(', ')}
			WHERE tenant_id = $1
			RETURNING *
		`;

		const result = await query(queryText, values);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'テナントが見つかりません',
				code: 'TENANT_NOT_FOUND'
			});
		}

		res.json({
			message: 'テナント情報が正常に更新されました',
			tenant: result.rows[0]
		});

	} catch (error) {
		console.error('テナント更新エラー:', error);
		res.status(500).json({
			error: 'テナント情報の更新に失敗しました',
			code: 'TENANT_UPDATE_FAILED'
		});
	}
});

// Zoom設定取得
router.get('/zoom-settings', async (req, res) => {
	try {
		const tenantId = req.user.tenant_id;
		
		if (!tenantId) {
			return res.status(400).json({
				error: 'テナントIDが見つかりません',
				code: 'TENANT_ID_NOT_FOUND'
			});
		}

		const result = await query(`
			SELECT 
				tenant_id,
				zoom_account_id,
				zoom_client_id,
				is_active,
				created_at,
				updated_at,
				CASE WHEN zoom_client_id IS NOT NULL THEN 'configured' ELSE 'not_configured' END as client_id_status,
				CASE WHEN zoom_client_secret_encrypted IS NOT NULL OR zoom_client_secret IS NOT NULL THEN 'configured' ELSE 'not_configured' END as client_secret_status,
				CASE WHEN zoom_webhook_secret_encrypted IS NOT NULL OR zoom_webhook_secret IS NOT NULL THEN 'configured' ELSE 'not_configured' END as webhook_secret_status
			FROM zoom_tenant_settings 
			WHERE tenant_id = $1
		`, [tenantId]);

		const settings = result.rows.length > 0 ? result.rows[0] : null;

		res.json({
			settings
		});

	} catch (error) {
		console.error('Zoom設定取得エラー:', error);
		res.status(500).json({
			error: 'Zoom設定の取得に失敗しました',
			code: 'ZOOM_SETTINGS_GET_FAILED'
		});
	}
});

// Zoom設定更新
router.put('/zoom-settings', async (req, res) => {
	try {
		const tenantId = req.user.tenant_id;
		const { zoom_account_id, zoom_client_id, zoom_client_secret, zoom_webhook_secret } = req.body;

		console.log('Zoom設定更新リクエスト:', {
			tenantId,
			zoom_account_id,
			zoom_client_id: zoom_client_id ? 'PROVIDED' : 'EMPTY',
			zoom_client_secret: zoom_client_secret ? 'PROVIDED' : 'EMPTY',
			zoom_webhook_secret: zoom_webhook_secret ? 'PROVIDED' : 'EMPTY'
		});

		if (!tenantId) {
			return res.status(400).json({
				error: 'テナントIDが見つかりません',
				code: 'TENANT_ID_NOT_FOUND'
			});
		}

		const result = await tenantZoomService.upsertZoomSettings(tenantId, {
			zoom_account_id,
			zoom_client_id,
			zoom_client_secret,
			zoom_webhook_secret
		});

		res.json({
			message: 'Zoom設定が正常に更新されました',
			settings: result
		});

	} catch (error) {
		console.error('Zoom設定更新エラー:', error);
		res.status(500).json({
			error: 'Zoom設定の更新に失敗しました',
			code: 'ZOOM_SETTINGS_UPDATE_FAILED'
		});
	}
});

module.exports = router;