/**
 * テナント管理者アクセス制御テスト
 * 
 * このテストファイルは、テナント管理者のアクセス制御機能をテストします。
 * - 自テナントのみアクセス可能
 * - 他テナントへのアクセス拒否
 * - 権限レベル別アクセス制御
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/testApp');
const { createTestUser, createTestTenant, cleanupTestData } = require('./helpers/testHelpers');

describe('テナント管理者アクセス制御テスト', () => {
	let app;
	let tenant1Id = 'a7b2c9f1';
	let tenant2Id = 'b8c3d0e2';
	let tenantAdmin1, tenantAdmin2, systemAdmin;

	beforeAll(async () => {
		app = await createTestApp();
		
		// テストテナント作成
		await createTestTenant({ tenant_id: tenant1Id, name: 'テナント1' });
		await createTestTenant({ tenant_id: tenant2Id, name: 'テナント2' });
		
		// テストユーザー作成
		systemAdmin = await createTestUser({
			email: 'system.admin@test.com',
			role: 'admin',
			tenant_id: 'system'
		});
		
		tenantAdmin1 = await createTestUser({
			email: 'tenant1.admin@test.com',
			role: 'tenant_admin',
			tenant_id: tenant1Id
		});
		
		tenantAdmin2 = await createTestUser({
			email: 'tenant2.admin@test.com',
			role: 'tenant_admin',
			tenant_id: tenant2Id
		});
	});

	afterAll(async () => {
		await cleanupTestData();
	});

	test('テナント管理者が自テナントの基本情報にアクセス可能', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant1Id}/api/tenant-info`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.tenant.tenant_id).toBe(tenant1Id);
	});

	test('テナント管理者が他テナントの基本情報にアクセス不可', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant2Id}/api/tenant-info`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('TENANT_ACCESS_DENIED');
	});

	test('テナント管理者が自テナントの設定を更新可能', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.put(`/${tenant1Id}/api/tenant-settings`)
			.set('Authorization', `Bearer ${token}`)
			.send({
				name: 'テナント1更新',
				admin_email: 'updated@test.com'
			});

		expect(response.status).toBe(200);
		expect(response.body.tenant.name).toBe('テナント1更新');
	});

	test('テナント管理者が他テナントの設定を更新不可', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.put(`/${tenant2Id}/api/tenant-settings`)
			.set('Authorization', `Bearer ${token}`)
			.send({
				name: 'テナント2更新（不正）'
			});

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('TENANT_ACCESS_DENIED');
	});

	test('システム管理者が全テナントの設定にアクセス可能', async () => {
		const token = jwt.sign({
			userId: systemAdmin.user_uuid,
			tenantId: 'system',
			role: 'admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		// テナント1へのアクセス
		const response1 = await request(app)
			.get(`/${tenant1Id}/api/tenant-info`)
			.set('Authorization', `Bearer ${token}`);

		expect(response1.status).toBe(200);

		// テナント2へのアクセス
		const response2 = await request(app)
			.get(`/${tenant2Id}/api/tenant-info`)
			.set('Authorization', `Bearer ${token}`);

		expect(response2.status).toBe(200);
	});

	test('テナント管理者がシステム管理機能にアクセス不可', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get('/admin/tenants')
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
	});

	test('テナント管理者が自テナントのユーザー一覧を取得可能', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant1Id}/api/users`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.users)).toBe(true);
		// 自テナントのユーザーのみ
		response.body.users.forEach(user => {
			expect(user.tenant_id).toBe(tenant1Id);
		});
	});
});