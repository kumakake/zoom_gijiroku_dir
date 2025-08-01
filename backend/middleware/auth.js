const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');

// JWT認証ミドルウェア（テナント対応）
const authenticateToken = async (req, res, next) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
		
		if (!token) {
			return res.status(401).json({
				error: '認証トークンが必要です',
				code: 'AUTH_TOKEN_REQUIRED'
			});
		}
		
		// JWTトークンの検証
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		
		// データベースからユーザー情報を取得（テナント情報含む）
		const userResult = await query(
			'SELECT user_uuid, email, name, role, tenant_id, is_active FROM users WHERE user_uuid = $1',
			[decoded.userId]
		);
		
		if (userResult.rows.length === 0) {
			return res.status(401).json({
				error: 'ユーザーが見つかりません',
				code: 'USER_NOT_FOUND'
			});
		}
		
		const user = userResult.rows[0];
		
		// アクティブユーザーかチェック
		if (!user.is_active) {
			return res.status(401).json({
				error: 'アカウントが無効化されています',
				code: 'ACCOUNT_INACTIVE'
			});
		}
		
		// テナントアクセス制御（システム管理者以外）
		if (user.role !== 'admin' && req.tenantId) {
			// 一般ユーザーの場合のみテナントIDチェック
			const tokenTenantId = decoded.tenantId || user.tenant_id;
			
			if (!tokenTenantId) {
				return res.status(400).json({
					error: 'テナントIDが指定されていません',
					code: 'TENANT_ID_REQUIRED'
				});
			}
			
			if (tokenTenantId !== req.tenantId) {
				return res.status(403).json({
					error: 'テナントアクセス権限がありません',
					code: 'TENANT_ACCESS_DENIED'
				});
			}
		}
		
		// リクエストにユーザー情報を追加
		req.user = {
			...user,
			// JWTのテナントID情報も含める（互換性のため）
			jwtTenantId: decoded.tenantId
		};
		
		next();
		
	} catch (error) {
		console.error('認証エラー:', error);
		
		if (error.name === 'JsonWebTokenError') {
			return res.status(401).json({
				error: '無効な認証トークンです',
				code: 'INVALID_TOKEN'
			});
		}
		
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				error: '認証トークンの有効期限が切れています',
				code: 'TOKEN_EXPIRED'
			});
		}
		
		return res.status(500).json({
			error: '認証処理中にエラーが発生しました',
			code: 'AUTH_PROCESSING_ERROR'
		});
	}
};

// 管理者権限チェックミドルウェア
const requireAdmin = (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({
			error: '認証が必要です'
		});
	}
	
	if (req.user.role !== 'admin') {
		return res.status(403).json({
			error: '管理者権限が必要です'
		});
	}
	
	next();
};

// オプション認証ミドルウェア（認証情報があれば設定、なくても通す）
const optionalAuth = async (req, res, next) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];
		
		if (!token) {
			req.user = null;
			return next();
		}
		
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const userResult = await query(
			'SELECT user_uuid, email, name, role, is_active FROM users WHERE user_uuid = $1',
			[decoded.userId]
		);
		
		if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
			req.user = userResult.rows[0];
		} else {
			req.user = null;
		}
		
		next();
		
	} catch (error) {
		// 認証エラーでも処理を続行（オプション認証なので）
		req.user = null;
		next();
	}
};

// JWTトークン生成ヘルパー（テナント対応）
const generateToken = (userId, tenantId, role = 'user') => {
	return jwt.sign(
		{ 
			userId: userId,
			tenantId: tenantId,
			role: role
		},
		process.env.JWT_SECRET,
		{ 
			expiresIn: '24h',
			issuer: 'ai-agent-service',
			audience: tenantId || 'ai-agent-clients'
		}
	);
};

// リフレッシュトークン生成ヘルパー（テナント対応）
const generateRefreshToken = (userId, tenantId) => {
	return jwt.sign(
		{ 
			userId: userId, 
			tenantId: tenantId,
			type: 'refresh' 
		},
		process.env.JWT_SECRET,
		{ 
			expiresIn: '7d',
			issuer: 'ai-agent-service',
			audience: tenantId || 'ai-agent-clients'
		}
	);
};

// リフレッシュトークン検証
const verifyRefreshToken = (token) => {
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (decoded.type !== 'refresh') {
			throw new Error('無効なリフレッシュトークン');
		}
		return decoded;
	} catch (error) {
		throw error;
	}
};

// テナント管理者権限チェック
const requireTenantAdmin = (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({
			error: '認証が必要です',
			code: 'AUTHENTICATION_REQUIRED'
		});
	}

	const { role, tenant_id } = req.user;
	const targetTenantId = req.tenantId;

	// システム管理者は全テナントアクセス可能
	if (role === 'admin') {
		return next();
	}

	// テナント管理者は自分のテナントのみ
	if (role === 'tenant_admin' && tenant_id === targetTenantId) {
		return next();
	}

	return res.status(403).json({
		error: 'テナント管理権限がありません',
		code: 'TENANT_ADMIN_ACCESS_DENIED'
	});
};

// 役割ベース権限チェック
const requireRole = (allowedRoles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				error: '認証が必要です',
				code: 'AUTHENTICATION_REQUIRED'
			});
		}
		
		if (!allowedRoles.includes(req.user.role)) {
			return res.status(403).json({
				error: 'この操作を実行する権限がありません',
				code: 'INSUFFICIENT_PERMISSIONS'
			});
		}
		
		next();
	};
};

module.exports = {
	authenticateToken,
	requireAdmin,
	requireTenantAdmin,
	requireRole,
	optionalAuth,
	generateToken,
	generateRefreshToken,
	verifyRefreshToken
};