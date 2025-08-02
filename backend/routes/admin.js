/**
 * システム管理者用APIルート
 * テナント管理、システム設定などの管理機能
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { 
	createTenant, 
	generateTenantId,
	getTenant 
} = require('../middleware/tenantMiddleware');
const tenantZoomService = require('../services/tenantZoomService');
const BaseModel = require('../models/baseModel');

// 全ルートで認証とシステム管理者権限が必要
router.use(authenticateToken);
router.use(requireAdmin);

// テナント一覧取得
router.get('/tenants', async (req, res) => {
	try {
		const { page = 1, limit = 20, search = '' } = req.query;
		const offset = (page - 1) * limit;

		let queryText = `
			SELECT 
				t.tenant_id,
				t.name,
				t.admin_email,
				t.is_active,
				t.created_at,
				t.updated_at,
				COUNT(u.id) as user_count
			FROM tenants t
			LEFT JOIN users u ON t.tenant_id = u.tenant_id
		`;

		const values = [];
		let whereClause = '';

		if (search) {
			whereClause = 'WHERE t.is_active = true AND (t.name ILIKE $1 OR t.admin_email ILIKE $1)';
			values.push(`%${search}%`);
		} else {
			whereClause = 'WHERE t.is_active = true';
		}

		queryText += `
			${whereClause}
			GROUP BY t.tenant_id, t.name, t.admin_email, t.is_active, t.created_at, t.updated_at
			ORDER BY t.created_at DESC
			LIMIT $${values.length + 1} OFFSET $${values.length + 2}
		`;

		values.push(limit, offset);

		const { query } = require('../utils/database');
		const result = await query(queryText, values);

		// 総数取得
		const countQueryText = search 
			? 'SELECT COUNT(*) FROM tenants WHERE is_active = true AND (name ILIKE $1 OR admin_email ILIKE $1)'
			: 'SELECT COUNT(*) FROM tenants WHERE is_active = true';
		const countValues = search ? [`%${search}%`] : [];
		const countResult = await query(countQueryText, countValues);
		const totalCount = parseInt(countResult.rows[0].count);

		res.json({
			tenants: result.rows,
			pagination: {
				currentPage: parseInt(page),
				totalPages: Math.ceil(totalCount / limit),
				totalCount,
				limit: parseInt(limit)
			}
		});

	} catch (error) {
		console.error('テナント一覧取得エラー:', error);
		res.status(500).json({
			error: 'テナント一覧の取得に失敗しました',
			code: 'TENANT_LIST_FAILED'
		});
	}
});

// テナント詳細取得
router.get('/tenants/:tenantId', async (req, res) => {
	try {
		const { tenantId } = req.params;
		const tenant = await getTenant(tenantId);

		if (!tenant) {
			return res.status(404).json({
				error: 'テナントが見つかりません',
				code: 'TENANT_NOT_FOUND'
			});
		}

		// テナント統計情報取得
		const { query } = require('../utils/database');
		
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
		console.error('テナント詳細取得エラー:', error);
		res.status(500).json({
			error: 'テナント詳細の取得に失敗しました',
			code: 'TENANT_DETAIL_FAILED'
		});
	}
});

// テナント作成
router.post('/tenants', async (req, res) => {
	try {
		const { name, admin_email } = req.body;

		if (!name || !admin_email) {
			return res.status(400).json({
				error: 'テナント名と管理者メールアドレスは必須です',
				code: 'MISSING_REQUIRED_FIELDS'
			});
		}


		// テナントID生成（重複チェック付き）
		let tenantId;
		let attempts = 0;
		const maxAttempts = 10;

		do {
			tenantId = generateTenantId();
			attempts++;
			
			const existing = await getTenant(tenantId);
			if (!existing) {
				break;
			}
		} while (attempts < maxAttempts);

		if (attempts >= maxAttempts) {
			throw new Error('テナントID生成に失敗しました');
		}

		// テナント作成
		const tenant = await createTenant({
			tenant_id: tenantId,
			name,
			admin_email
		});

		// データベースクエリ関数を取得
		const { query } = require('../utils/database');

		// Zoom設定テーブルにデフォルトレコード作成
		await query(`
			INSERT INTO zoom_tenant_settings (tenant_id, zoom_client_id, is_active, created_at, updated_at)
			VALUES ($1, '', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, [tenantId]);

		console.log(`Zoom設定レコード作成成功: テナント ${tenantId}`);

		// テナント管理者ユーザーを自動作成（既存ユーザーがいる場合は新しいテナントの管理者として追加）
		const defaultPassword = 'TenantAdmin123!';
		const hashedPassword = await bcrypt.hash(defaultPassword, 12);
		try {
			// 既存ユーザーが存在するかチェック
			const existingUser = await query('SELECT id, name FROM users WHERE email = $1', [admin_email]);
			
			if (existingUser.rows.length > 0) {
				// 既存ユーザーの場合、新しいテナントの管理者として追加
				await query(`
					INSERT INTO users (email, password_hash, name, role, tenant_id, is_active, created_at, updated_at)
					VALUES ($1, $2, $3, 'tenant_admin', $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, [admin_email, hashedPassword, existingUser.rows[0].name, tenantId]);
				
				console.log(`既存管理者を新テナントに追加: ${admin_email} (テナント: ${tenantId})`);
			} else {
				// 新規ユーザーの場合
				await query(`
					INSERT INTO users (email, password_hash, name, role, tenant_id, is_active, created_at, updated_at)
					VALUES ($1, $2, $3, 'tenant_admin', $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, [admin_email, hashedPassword, `${name}管理者`, tenantId]);
				
				console.log(`新規テナント管理者作成成功: ${admin_email} (テナント: ${tenantId})`);
			}
		} catch (userError) {
			console.error('テナント管理者作成エラー:', userError);
			// テナント管理者作成に失敗してもテナント作成は成功とする
		}

		res.status(201).json({
			message: 'テナントが正常に作成されました',
			tenant,
			admin_info: {
				email: admin_email,
				default_password: defaultPassword,
				note: '初回ログイン後にパスワードを変更してください'
			}
		});

	} catch (error) {
		console.error('テナント作成エラー:', error);
		
		if (error.message.includes('既に存在します')) {
			return res.status(409).json({
				error: error.message,
				code: 'TENANT_ALREADY_EXISTS'
			});
		}

		res.status(500).json({
			error: 'テナントの作成に失敗しました',
			code: 'TENANT_CREATE_FAILED'
		});
	}
});

// テナント更新
router.put('/tenants/:tenantId', async (req, res) => {
	try {
		const { tenantId } = req.params;
		const { name, admin_email, is_active } = req.body;

		const { query } = require('../utils/database');
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

		if (is_active !== undefined) {
			updateFields.push(`is_active = $${paramIndex++}`);
			values.push(is_active);
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
			message: 'テナントが正常に更新されました',
			tenant: result.rows[0]
		});

	} catch (error) {
		console.error('テナント更新エラー:', error);
		res.status(500).json({
			error: 'テナントの更新に失敗しました',
			code: 'TENANT_UPDATE_FAILED'
		});
	}
});

// テナント削除（論理削除）
router.delete('/tenants/:tenantId', async (req, res) => {
	try {
		const { tenantId } = req.params;

		if (tenantId === 'default0') {
			return res.status(400).json({
				error: 'デフォルトテナントは削除できません',
				code: 'CANNOT_DELETE_DEFAULT_TENANT'
			});
		}

		const { query } = require('../utils/database');
		const result = await query(`
			UPDATE tenants 
			SET is_active = false, updated_at = CURRENT_TIMESTAMP
			WHERE tenant_id = $1
			RETURNING *
		`, [tenantId]);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'テナントが見つかりません',
				code: 'TENANT_NOT_FOUND'
			});
		}

		res.json({
			message: 'テナントが正常に無効化されました',
			tenant: result.rows[0]
		});

	} catch (error) {
		console.error('テナント削除エラー:', error);
		res.status(500).json({
			error: 'テナントの削除に失敗しました',
			code: 'TENANT_DELETE_FAILED'
		});
	}
});

// テナント別Zoom設定管理
router.get('/tenants/:tenantId/zoom-settings', async (req, res) => {
	try {
		const { tenantId } = req.params;
		
		// 設定の存在確認（暗号化されていない形で）
		const { query } = require('../utils/database');
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

// システム統計情報
router.get('/stats', async (req, res) => {
	try {
		const { query } = require('../utils/database');
		
		const queries = [
			db.query('SELECT COUNT(*) as total_tenants FROM tenants WHERE is_active = true'),
			db.query('SELECT COUNT(*) as total_users FROM users WHERE is_active = true'),
			db.query('SELECT COUNT(*) as total_jobs FROM agent_jobs'),
			db.query('SELECT COUNT(*) as total_transcripts FROM meeting_transcripts'),
		];

		const [tenantsResult, usersResult, jobsResult, transcriptsResult] = await Promise.all(queries);

		const stats = {
			total_tenants: parseInt(tenantsResult.rows[0].total_tenants),
			total_users: parseInt(usersResult.rows[0].total_users),
			total_jobs: parseInt(jobsResult.rows[0].total_jobs),
			total_transcripts: parseInt(transcriptsResult.rows[0].total_transcripts)
		};

		res.json({ stats });

	} catch (error) {
		console.error('システム統計取得エラー:', error);
		res.status(500).json({
			error: 'システム統計の取得に失敗しました',
			code: 'SYSTEM_STATS_FAILED'
		});
	}
});

module.exports = router;