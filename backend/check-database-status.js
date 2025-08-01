/**
 * データベースの現在の状態を確認するスクリプト
 */

const { query } = require('./utils/database');

async function checkDatabaseStatus() {
    try {
        console.log('=== データベース状態確認 ===');
        
        const tenantId = '1315a13d';
        console.log(`テナントID: ${tenantId}`);
        
        // 現在のデータベースの状態を確認
        const result = await query(`
            SELECT 
                tenant_id,
                zoom_account_id,
                zoom_client_id,
                zoom_client_secret,
                zoom_webhook_secret,
                CASE WHEN zoom_client_secret_encrypted IS NOT NULL THEN 'ENCRYPTED_EXISTS' ELSE 'NULL' END as client_secret_encrypted_status,
                CASE WHEN zoom_webhook_secret_encrypted IS NOT NULL THEN 'ENCRYPTED_EXISTS' ELSE 'NULL' END as webhook_secret_encrypted_status,
                updated_at
            FROM zoom_tenant_settings 
            WHERE tenant_id = $1
        `, [tenantId]);
        
        if (result.rows.length > 0) {
            console.log('\nデータベースの現在の状態:');
            console.log(result.rows[0]);
        } else {
            console.log('データが見つかりません');
        }
        
    } catch (error) {
        console.error('データベース確認エラー:', error);
    }
}

checkDatabaseStatus();