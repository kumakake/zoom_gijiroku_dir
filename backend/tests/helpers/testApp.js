/**
 * テスト用Expressアプリケーション
 * テナント管理者機能のテスト用に設定されたアプリケーション
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

/**
 * テスト用アプリケーションを作成
 */
async function createTestApp() {
	const app = express();

	// 基本的なミドルウェア
	app.use(helmet());
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	// テナント識別ミドルウェア（簡易版）
	app.use('/:tenantId', (req, res, next) => {
		const tenantId = req.params.tenantId;
		if (tenantId && tenantId.match(/^[a-f0-9]{8}$/)) {
			req.tenantId = tenantId;
		}
		next();
	});

	// 認証ミドルウェア（テスト用簡易版）
	app.use((req, res, next) => {
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7);
			try {
				const jwt = require('jsonwebtoken');
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				req.user = decoded;
			} catch (error) {
				return res.status(401).json({ error: 'Invalid token' });
			}
		}
		next();
	});

	// テナント認証チェック
	app.use('/:tenantId', (req, res, next) => {
		if (req.user && req.tenantId) {
			// システム管理者は全テナントアクセス可能
			if (req.user.role === 'admin') {
				return next();
			}
			// その他のユーザーはテナントIDが一致する必要がある
			if (req.user.tenantId !== req.tenantId) {
				return res.status(403).json({
					error: 'テナントアクセス権限がありません',
					code: 'TENANT_ACCESS_DENIED'
				});
			}
		}
		next();
	});

	// 権限チェックミドルウェア
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

	// テナント管理者アクセス制御
	const requireTenantAdminAccess = (req, res, next) => {
		const { role, tenantId: userTenantId } = req.user;
		const targetTenantId = req.params.tenantId || req.tenantId;
		
		// システム管理者は全テナントにアクセス可能
		if (role === 'admin') {
			return next();
		}
		
		// テナント管理者は自分のテナントのみアクセス可能
		if (role === 'tenant_admin' && userTenantId === targetTenantId) {
			return next();
		}
		
		return res.status(403).json({
			error: 'テナント管理権限がありません',
			code: 'TENANT_ADMIN_ACCESS_DENIED'
		});
	};

	// テスト用ルート定義
	
	// 認証関連
	app.post('/:tenantId/api/auth/login', (req, res) => {
		// テスト用ログイン（実際の実装ではデータベース確認が必要）
		const { email, password } = req.body;
		
		// テスト用ユーザーデータ
		const testUsers = {
			'tenant.admin@test.com': { 
				user_uuid: 'test-tenant-admin-uuid', 
				role: 'tenant_admin',
				tenant_id: req.tenantId
			},
			'admin@test.com': { 
				user_uuid: 'test-admin-uuid', 
				role: 'admin',
				tenant_id: 'system'
			}
		};
		
		const user = testUsers[email];
		if (user && password === 'testpassword') {
			const jwt = require('jsonwebtoken');
			const token = jwt.sign({
				userId: user.user_uuid,
				tenantId: user.tenant_id,
				role: user.role
			}, process.env.JWT_SECRET, { expiresIn: '1h' });
			
			res.json({ token, user });
		} else {
			res.status(401).json({ error: 'Invalid credentials' });
		}
	});

	app.get('/:tenantId/api/auth/profile', (req, res) => {
		if (!req.user) {
			return res.status(401).json({ error: 'Not authenticated' });
		}
		res.json({ user: req.user });
	});

	// テナント情報
	app.get('/:tenantId/api/tenant-info', requireTenantAdminAccess, (req, res) => {
		res.json({
			tenant: {
				tenant_id: req.tenantId,
				name: `テナント${req.tenantId}`,
				admin_email: 'admin@test.com'
			}
		});
	});

	// テナント設定
	app.get('/:tenantId/api/tenant-settings', requireRole(['tenant_admin', 'admin']), (req, res) => {
		res.json({
			settings: {
				tenant_id: req.tenantId,
				name: `テナント${req.tenantId}設定`
			}
		});
	});

	app.put('/:tenantId/api/tenant-settings', requireTenantAdminAccess, (req, res) => {
		const { name, admin_email } = req.body;
		res.json({
			tenant: {
				tenant_id: req.tenantId,
				name: name || `テナント${req.tenantId}`,
				admin_email: admin_email || 'admin@test.com'
			}
		});
	});

	// システム管理機能
	app.get('/admin/tenants', requireRole(['admin']), (req, res) => {
		res.json({
			tenants: [
				{ tenant_id: 'a7b2c9f1', name: 'テナント1' },
				{ tenant_id: 'b8c3d0e2', name: 'テナント2' }
			]
		});
	});

	app.get(`/:tenantId/api/admin/tenant-info`, requireRole(['admin']), (req, res) => {
		res.json({
			tenant: {
				tenant_id: req.tenantId,
				name: `管理者用テナント${req.tenantId}`
			}
		});
	});

	// 議事録関連
	app.get('/:tenantId/api/transcripts', (req, res) => {
		// テナント別にフィルタされた議事録を返す
		const transcripts = [
			{
				id: 1,
				tenant_id: req.tenantId,
				title: `テナント${req.tenantId}の議事録1`,
				created_at: new Date()
			}
		];
		res.json({ transcripts });
	});

	app.get('/:tenantId/api/transcripts/:id', (req, res) => {
		const transcriptId = req.params.id;
		// テナント制限チェック（他テナントのデータは404）
		if (req.tenantId === 'a7b2c9f1' && transcriptId === '2') {
			return res.status(404).json({ error: '議事録が見つかりません' });
		}
		res.json({
			transcript: {
				id: transcriptId,
				tenant_id: req.tenantId,
				title: `議事録${transcriptId}`
			}
		});
	});

	// ジョブ関連
	app.get('/:tenantId/api/agent/jobs', (req, res) => {
		const jobs = [
			{
				id: 1,
				tenant_id: req.tenantId,
				type: 'transcript_generation',
				status: 'completed'
			}
		];
		res.json({ jobs });
	});

	app.get('/:tenantId/api/agent/stats', (req, res) => {
		res.json({
			stats: {
				tenant_id: req.tenantId,
				total_jobs: Math.floor(Math.random() * 100),
				completed_jobs: Math.floor(Math.random() * 80)
			}
		});
	});

	// ユーザー関連
	app.get('/:tenantId/api/users', requireTenantAdminAccess, (req, res) => {
		const users = [
			{
				user_uuid: 'user1',
				email: 'user1@test.com',
				tenant_id: req.tenantId,
				role: 'user'
			}
		];
		res.json({ users });
	});

	// エラーハンドリング
	app.use((error, req, res, next) => {
		console.error('Test app error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: error.message
		});
	});

	return app;
}

module.exports = {
	createTestApp
};