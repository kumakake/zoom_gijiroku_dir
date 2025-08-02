/**
 * テストヘルパー関数
 * テナント管理者機能のテストで使用する共通関数
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query: dbQuery } = require('../../utils/database');

/**
 * テストユーザーを作成
 */
async function createTestUser(userInfo) {
	const {
		email,
		password = 'testpassword',
		name = 'テストユーザー',
		role = 'user',
		tenant_id
	} = userInfo;

	const hashedPassword = await bcrypt.hash(password, 12);
	const userUuid = uuidv4();

	const query = `
		INSERT INTO users (user_uuid, email, password_hash, name, role, tenant_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING *
	`;

	const result = await dbQuery(query, [
		userUuid,
		email,
		hashedPassword,
		name,
		role,
		tenant_id
	]);

	return result.rows[0];
}

/**
 * テストテナントを作成
 */
async function createTestTenant(tenantInfo) {
	const {
		tenant_id,
		name,
		admin_email = 'admin@test.com',
		is_active = true
	} = tenantInfo;

	const query = `
		INSERT INTO tenants (tenant_id, name, admin_email, is_active, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		RETURNING *
	`;

	const result = await dbQuery(query, [
		tenant_id,
		name,
		admin_email,
		is_active
	]);

	return result.rows[0];
}

/**
 * テスト議事録を作成
 */
async function createTestTranscript(transcriptInfo) {
	const {
		tenant_id,
		created_by_uuid,
		title = 'テスト議事録',
		content = 'テスト議事録の内容',
		meeting_id = `test_meeting_${Date.now()}`
	} = transcriptInfo;

	const query = `
		INSERT INTO meeting_transcripts (
			tenant_id, 
			created_by_uuid, 
			title, 
			content, 
			meeting_id, 
			created_at
		)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING *
	`;

	const result = await dbQuery(query, [
		tenant_id,
		created_by_uuid,
		title,
		content,
		meeting_id
	]);

	return result.rows[0];
}

/**
 * テストジョブを作成
 */
async function createTestJob(jobInfo) {
	const {
		tenant_id,
		created_by_uuid,
		type = 'transcript_generation',
		status = 'completed',
		meeting_id = `test_meeting_${Date.now()}`
	} = jobInfo;

	const query = `
		INSERT INTO agent_jobs (
			tenant_id,
			created_by_uuid,
			type,
			status,
			meeting_id,
			created_at
		)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING *
	`;

	const result = await dbQuery(query, [
		tenant_id,
		created_by_uuid,
		type,
		status,
		meeting_id
	]);

	return result.rows[0];
}

/**
 * テストデータのクリーンアップ
 */
async function cleanupTestData() {
	try {
		// 外部キー制約のため、順序を考慮して削除
		// 安全な方法：テスト専用プレフィックスと明確に特定できるテストIDのみ削除
		const testTenantIds = "('test_tenant_1', 'test_tenant_2', 'a7b2c9f1', 'b8c3d0e2')";
		
		console.log('テストデータクリーンアップ開始...');
		
		// より包括的なクリーンアップ
		await dbQuery(`DELETE FROM distribution_logs WHERE tenant_id LIKE 'test_%' OR tenant_id IN ${testTenantIds}`);
		await dbQuery(`DELETE FROM meeting_transcripts WHERE tenant_id LIKE 'test_%' OR tenant_id IN ${testTenantIds}`);
		await dbQuery(`DELETE FROM agent_jobs WHERE tenant_id LIKE 'test_%' OR tenant_id IN ${testTenantIds}`);
		
		// テスト用ユーザーの削除（より広範囲）
		await dbQuery(`
			DELETE FROM users 
			WHERE email LIKE '%test.com' 
			OR tenant_id IN ${testTenantIds}
			OR email IN ('tenant1.admin@test.com', 'tenant2.admin@test.com', 'user1@test.com', 'user2@test.com')
		`);
		
		await dbQuery(`DELETE FROM zoom_tenant_settings WHERE tenant_id LIKE 'test_%' OR tenant_id IN ${testTenantIds}`);
		await dbQuery(`DELETE FROM tenants WHERE tenant_id LIKE 'test_%' OR tenant_id IN ${testTenantIds}`);
		
		console.log('テストデータクリーンアップ完了');
	} catch (error) {
		console.error('テストデータクリーンアップエラー:', error);
	}
}

/**
 * テスト用のZoom設定を作成
 */
async function createTestZoomSettings(settingsInfo) {
	const {
		tenant_id,
		zoom_api_key = 'test_api_key',
		zoom_api_secret = 'test_api_secret',
		zoom_webhook_secret = 'test_webhook_secret',
		zoom_account_id = 'test_account_id'
	} = settingsInfo;

	const query = `
		INSERT INTO zoom_tenant_settings (
			tenant_id,
			zoom_api_key,
			zoom_api_secret,
			zoom_webhook_secret,
			zoom_account_id,
			created_at
		)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING *
	`;

	const result = await dbQuery(query, [
		tenant_id,
		zoom_api_key,
		zoom_api_secret,
		zoom_webhook_secret,
		zoom_account_id
	]);

	return result.rows[0];
}

/**
 * ランダムなテナントIDを生成
 */
function generateTestTenantId() {
	return require('crypto').randomBytes(4).toString('hex');
}

module.exports = {
	createTestUser,
	createTestTenant,
	createTestTranscript,
	createTestJob,
	createTestZoomSettings,
	cleanupTestData,
	generateTestTenantId
};