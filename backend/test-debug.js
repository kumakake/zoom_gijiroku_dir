// デバッグ用の簡単なAPIテスト
const jwt = require('jsonwebtoken');
const { query } = require('./utils/database');

async function testJobsQuery() {
	try {
		console.log('Starting debug test...');
		
		// テストユーザーの確認
		const users = await query('SELECT user_uuid, email, tenant_id, role FROM users WHERE email LIKE \'%test.com\' LIMIT 3');
		console.log('Test users:', users.rows);
		
		if (users.rows.length === 0) {
			console.log('No test users found');
			return;
		}
		
		const testUser = users.rows[0];
		console.log('Using test user:', testUser);
		
		// シンプルなジョブクエリを試す
		const jobs = await query(`
			SELECT 
				aj.agent_job_uuid,
				aj.type,
				aj.status,
				aj.tenant_id,
				aj.created_by_uuid
			FROM agent_jobs aj
			WHERE aj.tenant_id = $1
			LIMIT 5
		`, [testUser.tenant_id]);
		
		console.log('Jobs found:', jobs.rows);
		
		// より複雑なクエリ（実際のAPIと同じ）
		const complexJobs = await query(`
			SELECT 
				aj.agent_job_uuid,
				aj.agent_job_uuid as id,
				aj.type,
				aj.status,
				aj.created_by_uuid,
				u.name as created_by_name,
				aj.created_at
			FROM agent_jobs aj
			LEFT JOIN users u ON aj.created_by_uuid = u.user_uuid
			WHERE aj.tenant_id = $1
		`, [testUser.tenant_id]);
		
		console.log('Complex query result:', complexJobs.rows);
		
	} catch (error) {
		console.error('Debug test error:', error);
	}
}

testJobsQuery().then(() => {
	console.log('Debug test completed');
	process.exit(0);
});