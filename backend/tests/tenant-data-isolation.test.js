/**
 * テナントデータ分離テスト
 * 
 * このテストファイルは、テナント間のデータ分離機能をテストします。
 * - データベースクエリレベルでのテナント制限
 * - テナント別データの完全分離
 * - クロステナントアクセスの防止
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/testApp');
const { 
	createTestUser, 
	createTestTenant, 
	createTestTranscript,
	createTestJob,
	cleanupTestData 
} = require('./helpers/testHelpers');

describe('テナントデータ分離テスト', () => {
	let app;
	let tenant1Id = 'a7b2c9f1';
	let tenant2Id = 'b8c3d0e2';
	let tenantAdmin1, tenantAdmin2, user1, user2;
	let transcript1, transcript2, job1, job2;

	beforeAll(async () => {
		app = await createTestApp();
		
		// テストテナント作成
		await createTestTenant({ tenant_id: tenant1Id, name: 'テナント1' });
		await createTestTenant({ tenant_id: tenant2Id, name: 'テナント2' });
		
		// テストユーザー作成
		tenantAdmin1 = await createTestUser({
			email: 'tenant1.admin@test.com',
			role: 'tenant_admin',
			tenant_id: tenant1Id
		});
		
		user1 = await createTestUser({
			email: 'user1@test.com',
			role: 'user',
			tenant_id: tenant1Id
		});
		
		tenantAdmin2 = await createTestUser({
			email: 'tenant2.admin@test.com',
			role: 'tenant_admin',
			tenant_id: tenant2Id
		});
		
		user2 = await createTestUser({
			email: 'user2@test.com',
			role: 'user',
			tenant_id: tenant2Id
		});
		
		// テストデータ作成
		transcript1 = await createTestTranscript({
			tenant_id: tenant1Id,
			created_by_uuid: user1.user_uuid,
			title: 'テナント1の議事録'
		});
		
		transcript2 = await createTestTranscript({
			tenant_id: tenant2Id,
			created_by_uuid: user2.user_uuid,
			title: 'テナント2の議事録'
		});
		
		job1 = await createTestJob({
			tenant_id: tenant1Id,
			created_by_uuid: user1.user_uuid,
			type: 'transcript_generation'
		});
		
		job2 = await createTestJob({
			tenant_id: tenant2Id,
			created_by_uuid: user2.user_uuid,
			type: 'transcript_generation'
		});
	});

	afterAll(async () => {
		await cleanupTestData();
	});

	test('テナント管理者が自テナントの議事録のみ取得可能', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant1Id}/api/transcripts`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.transcripts)).toBe(true);
		
		// 自テナントのデータのみ
		response.body.transcripts.forEach(transcript => {
			expect(transcript.tenant_id).toBe(tenant1Id);
		});
		
		// 他テナントのデータが含まれていない
		const otherTenantData = response.body.transcripts.find(
			t => t.tenant_id === tenant2Id
		);
		expect(otherTenantData).toBeUndefined();
	});

	test('テナント管理者が自テナントのジョブ履歴のみ取得可能', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant1Id}/api/agent/jobs`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.jobs)).toBe(true);
		
		// 自テナントのデータのみ
		response.body.jobs.forEach(job => {
			expect(job.tenant_id).toBe(tenant1Id);
		});
	});

	test('テナント間でのIDによる直接アクセスが防止される', async () => {
		const token = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		// 他テナントの議事録IDで直接アクセス試行
		const response = await request(app)
			.get(`/${tenant1Id}/api/transcripts/${transcript2.id}`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(404);
		expect(response.body.error).toMatch(/議事録が見つかりません|Not found/);
	});

	test('データベースクエリレベルでのテナント制限確認', async () => {
		const token = jwt.sign({
			userId: user1.user_uuid,
			tenantId: tenant1Id,
			role: 'user'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const response = await request(app)
			.get(`/${tenant1Id}/api/transcripts`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		
		// SQLインジェクション的な試行も無効
		const maliciousResponse = await request(app)
			.get(`/${tenant1Id}/api/transcripts?tenant_id=${tenant2Id}`)
			.set('Authorization', `Bearer ${token}`);

		expect(maliciousResponse.status).toBe(200);
		// それでも自テナントのデータのみ
		maliciousResponse.body.transcripts.forEach(transcript => {
			expect(transcript.tenant_id).toBe(tenant1Id);
		});
	});

	test('テナント統計情報の分離確認', async () => {
		const token1 = jwt.sign({
			userId: tenantAdmin1.user_uuid,
			tenantId: tenant1Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		const token2 = jwt.sign({
			userId: tenantAdmin2.user_uuid,
			tenantId: tenant2Id,
			role: 'tenant_admin'
		}, process.env.JWT_SECRET, { expiresIn: '1h' });

		// テナント1の統計
		const stats1 = await request(app)
			.get(`/${tenant1Id}/api/agent/stats`)
			.set('Authorization', `Bearer ${token1}`);

		// テナント2の統計
		const stats2 = await request(app)
			.get(`/${tenant2Id}/api/agent/stats`)
			.set('Authorization', `Bearer ${token2}`);

		expect(stats1.status).toBe(200);
		expect(stats2.status).toBe(200);
		
		// 統計データが異なることを確認
		expect(stats1.body).not.toEqual(stats2.body);
	});
});