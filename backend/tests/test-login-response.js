/**
 * ログインレスポンスの詳細確認
 */

const axios = require('axios');

async function testLoginResponse() {
    try {
        console.log('=== ログインレスポンステスト ===');
        
        const baseURL = 'http://localhost:8000';
        
        // ログイン
        console.log('ログイン中...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 't.kumanote@gmail.com',
            password: 'TenantAdmin123!'
        });
        
        console.log('ログインレスポンス全体:', JSON.stringify(loginResponse.data, null, 2));
        
        const token = loginResponse.data.accessToken;
        if (!token) {
            throw new Error('アクセストークンが見つかりません');
        }
        
        // JWTトークンのデコード（簡易）
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        console.log('\nJWTペイロード:', JSON.stringify(payload, null, 2));
        
        // デバッグエンドポイントにアクセス
        console.log('\nデバッグエンドポイントテスト中...');
        const debugResponse = await axios.get(`${baseURL}/api/debug/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('デバッグレスポンス:', JSON.stringify(debugResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ エラー:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
    }
}

testLoginResponse();