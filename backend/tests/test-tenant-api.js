/**
 * テナント対応APIのテスト用スクリプト
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// 環境変数の読み込み
require('dotenv').config();

const BASE_URL = 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET;

// テスト用のJWTトークン生成
function generateTestToken(userId, tenantId, role = 'admin') {
	return jwt.sign(
		{ 
			userId: userId,
			tenantId: tenantId,
			role: role
		},
		JWT_SECRET,
		{ 
			expiresIn: '1h',
			issuer: 'ai-agent-service',
			audience: tenantId || 'ai-agent-clients'
		}
	);
}

async function testTenantAPI() {
	console.log('🧪 テナント対応API テスト開始\n');

	try {
		// システム管理者トークン（全テナントアクセス可能）
		const adminToken = generateTestToken('75960513-56ef-4785-9de1-887ff4e39e73', 'default0', 'admin');
		console.log('1. システム管理者APIテスト');
		console.log('Token:', adminToken.substring(0, 50) + '...');

		// テナント一覧取得テスト
		const tenantsResponse = await axios.get(`${BASE_URL}/admin/tenants`, {
			headers: {
				'Authorization': `Bearer ${adminToken}`
			}
		});

		console.log('✅ テナント一覧取得成功:', tenantsResponse.data);
		console.log('');

		// 2. デフォルトテナントでのAPIアクセステスト
		console.log('2. デフォルトテナントAPIテスト');
		const tenantAdminToken = generateTestToken('75960513-56ef-4785-9de1-887ff4e39e73', 'default0', 'tenant_admin');
		
		try {
			const transcriptsResponse = await axios.get(`${BASE_URL}/default0/api/transcripts`, {
				headers: {
					'Authorization': `Bearer ${tenantAdminToken}`
				}
			});
			console.log('✅ テナント別API アクセス成功');
		} catch (error) {
			console.log('⚠️  テナント別API 認証エラー (expected):', error.response?.status, error.response?.data?.code);
		}

		// 3. 無効なテナントIDでのアクセステスト
		console.log('\n3. 無効なテナントIDテスト');
		try {
			const invalidResponse = await axios.get(`${BASE_URL}/invalid123/api/transcripts`, {
				headers: {
					'Authorization': `Bearer ${adminToken}`
				}
			});
		} catch (error) {
			console.log('✅ 無効なテナントID 拒否成功:', error.response?.status, error.response?.data?.code);
		}

		// 4. テナント作成テスト
		console.log('\n4. テナント作成テスト');
		const newTenantData = {
			name: 'テストテナント',
			admin_email: 'test-tenant@example.com'
		};

		try {
			const createResponse = await axios.post(`${BASE_URL}/admin/tenants`, newTenantData, {
				headers: {
					'Authorization': `Bearer ${adminToken}`,
					'Content-Type': 'application/json'
				}
			});

			console.log('✅ テナント作成成功:', createResponse.data.tenant.tenant_id);
			
			const newTenantId = createResponse.data.tenant.tenant_id;
			
			// zoom_tenant_settings レコード作成確認
			try {
				const zoomSettingsResponse = await axios.get(`${BASE_URL}/admin/tenants/${newTenantId}/zoom-settings`, {
					headers: {
						'Authorization': `Bearer ${adminToken}`
					}
				});
				console.log('✅ Zoom設定レコード作成確認:', zoomSettingsResponse.data ? '成功' : '失敗');
			} catch (zoomError) {
				console.log('❌ Zoom設定レコード確認失敗:', zoomError.response?.data?.error || zoomError.message);
			}
			
			// 新規テナントでのAPIアクセステスト
			console.log('\n5. 新規テナントAPIアクセステスト');
			const newTenantToken = generateTestToken('75960513-56ef-4785-9de1-887ff4e39e73', newTenantId, 'tenant_admin');
			
			try {
				const newTenantResponse = await axios.get(`${BASE_URL}/${newTenantId}/api/transcripts`, {
					headers: {
						'Authorization': `Bearer ${newTenantToken}`
					}
				});
				console.log('✅ 新規テナントAPI アクセス成功');
			} catch (error) {
				console.log('⚠️  新規テナントAPI 認証エラー (expected):', error.response?.status, error.response?.data?.code);
			}

		} catch (error) {
			console.log('❌ テナント作成エラー:', error.response?.data);
		}

		console.log('\n🎉 テナント対応API テスト完了');

	} catch (error) {
		console.error('❌ テスト実行エラー:', error.message);
		if (error.response) {
			console.error('Response status:', error.response.status);
			console.error('Response data:', error.response.data);
		}
	}
}

// テスト実行
if (require.main === module) {
	testTenantAPI();
}

module.exports = { generateTestToken, testTenantAPI };