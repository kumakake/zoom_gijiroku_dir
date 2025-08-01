/**
 * PostgreSQL bytea暗号化をテストするスクリプト
 */

const tenantZoomService = require('./services/tenantZoomService');

async function testPostgreSQLEncryption() {
    try {
        console.log('=== PostgreSQL bytea暗号化テスト ===');
        
        const tenantId = '1315a13d';
        console.log(`テナントID: ${tenantId}`);
        
        // 新しい設定で暗号化テスト
        console.log('\n1. 新しい設定を保存...');
        await tenantZoomService.upsertZoomSettings(tenantId, {
            zoom_client_id: 'test_client_id_123',
            zoom_client_secret: 'test_client_secret_456',
            zoom_webhook_secret: 'test_webhook_secret_789',
            zoom_account_id: 'test_account_id_abc'
        });
        
        console.log('✓ 設定を保存しました');
        
        // 復号化して取得
        console.log('\n2. 設定を取得して復号化...');
        const credentials = await tenantZoomService.getZoomCredentials(tenantId);
        
        console.log('\n復号化された値:');
        console.log('Client ID:', credentials.zoom_client_id);
        console.log('Client Secret:', credentials.zoom_client_secret);
        console.log('Webhook Secret:', credentials.zoom_webhook_secret);
        console.log('Account ID:', credentials.zoom_account_id);
        
    } catch (error) {
        console.error('テストエラー:', error);
    }
}

testPostgreSQLEncryption();