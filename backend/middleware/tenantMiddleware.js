/**
 * テナント識別ミドルウェア
 * 
 * URLからテナントIDを抽出し、テナント情報を検証する
 * 
 * 対応URL形式:
 * - /:tenantId/api/*
 * - /:tenantId/dashboard
 * - /admin/* (システム管理者用)
 */

const { query } = require('../utils/database');

// テナント情報キャッシュ（パフォーマンス向上）
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分

/**
 * メインのテナント識別ミドルウェア
 */
const tenantMiddleware = async (req, res, next) => {
	try {
		// システム管理者パスはスキップ
		if (req.path.startsWith('/admin/')) {
			req.isSystemAdmin = true;
			return next();
		}

		// URLからテナントID抽出
		const tenantId = extractTenantFromPath(req.path) || req.params.tenantId;
		
		if (!tenantId) {
			return res.status(400).json({
				error: 'テナントIDが指定されていません',
				code: 'TENANT_ID_REQUIRED',
				message: 'URLにテナントIDを含めてください (例: /a7b2c9f1/api/...)'
			});
		}

		// テナントID形式検証（8桁英数字）
		if (!isValidTenantId(tenantId)) {
			return res.status(400).json({
				error: '無効なテナントID形式です',
				code: 'INVALID_TENANT_ID_FORMAT',
				message: 'テナントIDは8桁の英数字である必要があります'
			});
		}

		// テナント存在確認・情報取得
		const tenant = await getTenantWithCache(tenantId);
		
		if (!tenant) {
			return res.status(404).json({
				error: '指定されたテナントが見つかりません',
				code: 'TENANT_NOT_FOUND',
				tenantId
			});
		}

		if (!tenant.is_active) {
			return res.status(403).json({
				error: 'このテナントは無効化されています',
				code: 'TENANT_INACTIVE',
				tenantId
			});
		}

		// リクエストオブジェクトにテナント情報を追加
		req.tenant = tenant;
		req.tenantId = tenantId;
		
		next();
		
	} catch (error) {
		console.error('テナント識別エラー:', error);
		return res.status(500).json({
			error: 'テナント識別に失敗しました',
			code: 'TENANT_IDENTIFICATION_FAILED'
		});
	}
};

/**
 * パスからテナントID抽出
 * @param {string} path - リクエストパス
 * @returns {string|null} - テナントID
 */
function extractTenantFromPath(path) {
	// パターン: /a7b2c9f1/api/... や /a7b2c9f1/dashboard
	const match = path.match(/^\/([a-f0-9]{8})(?:\/|$)/);
	return match ? match[1] : null;
}

/**
 * テナントID形式検証
 * @param {string} tenantId - テナントID
 * @returns {boolean} - 有効かどうか
 */
function isValidTenantId(tenantId) {
	return /^[a-f0-9]{8}$/.test(tenantId);
}

/**
 * キャッシュ付きテナント情報取得
 * @param {string} tenantId - テナントID
 * @returns {Object|null} - テナント情報
 */
async function getTenantWithCache(tenantId) {
	// キャッシュから確認
	const cached = tenantCache.get(tenantId);
	if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
		return cached.data;
	}

	// データベースから取得
	const tenant = await getTenant(tenantId);
	
	// キャッシュに保存
	if (tenant) {
		tenantCache.set(tenantId, {
			data: tenant,
			timestamp: Date.now()
		});
	}

	return tenant;
}

/**
 * データベースからテナント情報取得
 * @param {string} tenantId - テナントID
 * @returns {Object|null} - テナント情報
 */
async function getTenant(tenantId) {
	try {
		const queryText = `
			SELECT 
				tenant_id,
				name,
				admin_email,
				is_active,
				created_at,
				updated_at
			FROM tenants 
			WHERE tenant_id = $1
		`;
		
		const result = await query(queryText, [tenantId]);
		return result.rows.length > 0 ? result.rows[0] : null;
		
	} catch (error) {
		console.error('テナント情報取得エラー:', error);
		throw error;
	}
}

/**
 * テナントキャッシュクリア
 * @param {string} tenantId - クリアするテナントID（指定なしで全削除）
 */
function clearTenantCache(tenantId = null) {
	if (tenantId) {
		tenantCache.delete(tenantId);
	} else {
		tenantCache.clear();
	}
}

/**
 * テナント作成時のヘルパー関数
 */
async function createTenant(tenantData) {
	const { tenant_id, name, admin_email } = tenantData;
	
	try {
		const queryText = `
			INSERT INTO tenants (tenant_id, name, admin_email, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING *
		`;
		
		const result = await query(queryText, [tenant_id, name, admin_email]);
		
		// キャッシュをクリア（新しいテナントを反映）
		clearTenantCache();
		
		return result.rows[0];
		
	} catch (error) {
		if (error.code === '23505') { // 重複エラー
			throw new Error(`テナントID "${tenant_id}" は既に存在します`);
		}
		throw error;
	}
}

/**
 * テナントID生成関数
 */
function generateTenantId() {
	const crypto = require('crypto');
	return crypto.randomBytes(4).toString('hex');
}

/**
 * 管理者権限チェックミドルウェア
 */
const requireSystemAdmin = (req, res, next) => {
	if (!req.user || req.user.role !== 'admin') {
		return res.status(403).json({
			error: 'システム管理者権限が必要です',
			code: 'SYSTEM_ADMIN_REQUIRED'
		});
	}
	next();
};

/**
 * テナント管理者権限チェック
 */
const requireTenantAdmin = (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({
			error: '認証が必要です',
			code: 'AUTHENTICATION_REQUIRED'
		});
	}

	const { role, tenantId: userTenantId } = req.user;
	const targetTenantId = req.tenantId;

	// システム管理者は全テナントアクセス可能
	if (role === 'admin') {
		return next();
	}

	// テナント管理者は自分のテナントのみ
	if (role === 'tenant_admin' && userTenantId === targetTenantId) {
		return next();
	}

	return res.status(403).json({
		error: 'テナント管理権限がありません',
		code: 'TENANT_ADMIN_ACCESS_DENIED'
	});
};

module.exports = {
	tenantMiddleware,
	extractTenantFromPath,
	isValidTenantId,
	getTenant,
	getTenantWithCache,
	clearTenantCache,
	createTenant,
	generateTenantId,
	requireSystemAdmin,
	requireTenantAdmin
};