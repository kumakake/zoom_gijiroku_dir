/**
 * テナント管理者認証テスト
 * 
 * このテストファイルは、テナント管理者（tenant_admin）の認証機能をテストします。
 * - JWT生成と検証
 * - ロール確認機能
 * - アクセストークンの有効性
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/testApp');
const { createTestUser, createTestTenant, cleanupTestData, generateTestTenantId } = require('./helpers/testHelpers');

describe('テナント管理者認証テスト', () => {
	let app;
	let testTenantId = generateTestTenantId();
	let adminUser, tenantAdminUser, regularUser;

	beforeAll(async () => {
		// テスト開始前にクリーンアップ
		await cleanupTestData();
		
		app = await createTestApp();
		
		// テストテナント作成
		await createTestTenant({ tenant_id: testTenantId, name: 'テストテナント' });
		
		// テストユーザー作成
		adminUser = await createTestUser({
			email: 'admin@test.com',
			role: 'admin',
			tenant_id: testTenantId
		});
		
		tenantAdminUser = await createTestUser({
			email: 'tenant.admin@test.com',
			role: 'tenant_admin',
			tenant_id: testTenantId
		});
		
		regularUser = await createTestUser({
			email: 'user@test.com',
			role: 'user',
			tenant_id: testTenantId
		});
	});

	afterAll(async () => {
		await cleanupTestData();
	});

	test('テナント管理者のJWT生成が正常に動作する', async () => {
		const response = await request(app)
			.post(`/${testTenantId}/api/auth/login`)
			.send({
				email: 'tenant.admin@test.com',
				password: 'testpassword'
			});

		expect(response.status).toBe(200);
		expect(response.body.token).toBeDefined();
		
		// JWT内容確認
		const decoded = jwt.decode(response.body.token);
		expect(decoded.role).toBe('tenant_admin');
		expect(decoded.tenantId).toBe(testTenantId);
		expect(decoded.userId).toBe(tenantAdminUser.user_uuid);
	});

	test('テナント管理者のロール確認が正常に動作する', async () => {
		const token = jwt.sign({
			userId: tenantAdminUser.user_uuid,
			tenantId: testTenantId,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/auth/profile`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.user.role).toBe('tenant_admin');
		expect(response.body.user.tenant_id).toBe(testTenantId);
	});

	test('不正なロールでのアクセスが拒否される', async () => {
		const invalidToken = jwt.sign({
			userId: regularUser.user_uuid,
			tenantId: testTenantId,
			role: 'invalid_role'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/admin/tenant-settings`)
			.set('Authorization', `Bearer ${invalidToken}`);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
	});

	test('期限切れトークンが拒否される', async () => {
		const expiredToken = jwt.sign({
			userId: tenantAdminUser.user_uuid,
			tenantId: testTenantId,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '-1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/auth/profile`)
			.set('Authorization', `Bearer ${expiredToken}`);

		expect(response.status).toBe(401);
	});

	test('テナントIDの不一致が検出される', async () => {
		const wrongTenantToken = jwt.sign({
			userId: tenantAdminUser.user_uuid,
			tenantId: 'b8c3d0e2', // 異なるテナントID
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/auth/profile`)
			.set('Authorization', `Bearer ${wrongTenantToken}`);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('TENANT_ACCESS_DENIED');
	});

	test('システム管理者が全テナントにアクセス可能', async () => {
		const adminToken = jwt.sign({
			userId: adminUser.user_uuid,
			tenantId: 'system',
			role: 'admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/admin/tenant-info`)
			.set('Authorization', `Bearer ${adminToken}`);

		expect(response.status).toBe(200);
	});

	test('テナント管理者が自テナントの設定にアクセス可能', async () => {
		const tenantAdminToken = jwt.sign({
			userId: tenantAdminUser.user_uuid,
			tenantId: testTenantId,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/tenant-settings`)
			.set('Authorization', `Bearer ${tenantAdminToken}`);

		expect(response.status).toBe(200);
	});

	test('一般ユーザーがテナント設定にアクセス不可', async () => {
		const userToken = jwt.sign({
			userId: regularUser.user_uuid,
			tenantId: testTenantId,
			role: 'user'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${testTenantId}/api/tenant-settings`)
			.set('Authorization', `Bearer ${userToken}`);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
	});
});