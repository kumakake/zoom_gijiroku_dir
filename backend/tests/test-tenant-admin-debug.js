/**
 * テナント管理者のデバッグダッシュボードアクセステスト
 */

const axios = require('axios');

async function testTenantAdminDebugAccess() {
    try {
        console.log('=== テナント管理者デバッグダッシュボードアクセステスト ===');
        
        const baseURL = 'http://localhost:8000';
        
        // 1. テナント管理者でログイン
        console.log('1. テナント管理者でログイン中...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 't.kumanote@gmail.com',
            password: 'TenantAdmin123!'
        });
        
        const token = loginResponse.data.accessToken;
        console.log('✅ ログイン成功:', {
            email: loginResponse.data.user.email,
            role: loginResponse.data.user.role,
            tenantId: loginResponse.data.user.tenant_id
        });
        
        // 2. デバッグステータス確認
        console.log('\n2. デバッグステータス確認中...');
        const statusResponse = await axios.get(`${baseURL}/api/debug/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ デバッグステータス取得成功:', {
            userRole: statusResponse.data.environment.user.role,
            tenantId: statusResponse.data.environment.user.tenantId,
            zoomSource: statusResponse.data.environment.zoom.source,
            zoomConfigured: {
                accountId: statusResponse.data.environment.zoom.accountId,
                clientId: statusResponse.data.environment.zoom.clientId,
                clientSecret: statusResponse.data.environment.zoom.clientSecret
            }
        });
        
        // 3. Zoom認証テスト
        console.log('\n3. Zoom認証テスト実行中...');
        const authTestResponse = await axios.post(`${baseURL}/api/debug/test-auth`, {}, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Zoom認証テスト成功:', {
            success: authTestResponse.data.success,
            message: authTestResponse.data.message
        });
        
        console.log('\n🎉 すべてのテストが成功しました！');
        console.log('テナント管理者はデバッグダッシュボードにアクセスでき、自分のテナントのZoom設定を使用してテストを実行できます。');
        
    } catch (error) {
        console.error('❌ テストエラー:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        
        if (error.response?.status === 400 && error.response?.data?.missingFields) {
            console.log('\n💡 対処法: テナント設定でZoom認証情報を設定してください：');
            console.log('- Account ID');
            console.log('- Client ID'); 
            console.log('- Client Secret');
            console.log('欠けている設定:', error.response.data.missingFields);
        }
    }
}

testTenantAdminDebugAccess();