/**
 * テナント管理者のデータベース情報を確認
 */

const { query } = require('./utils/database');

async function checkTenantAdminData() {
    try {
        console.log('=== テナント管理者データ確認 ===');
        
        // テナント管理者のユーザー情報確認
        const userResult = await query(`
            SELECT 
                user_uuid, 
                email, 
                name, 
                role, 
                tenant_id, 
                is_active, 
                created_at 
            FROM users 
            WHERE email = $1
        `, ['t.kumanote@gmail.com']);
        
        if (userResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません');
            return;
        }
        
        const user = userResult.rows[0];
        console.log('ユーザー情報:', user);
        
        if (user.tenant_id) {
            // テナント情報確認
            const tenantResult = await query(`
                SELECT tenant_id, name, admin_email, is_active, created_at 
                FROM tenants 
                WHERE tenant_id = $1
            `, [user.tenant_id]);
            
            if (tenantResult.rows.length > 0) {
                console.log('テナント情報:', tenantResult.rows[0]);
            } else {
                console.log('❌ テナントが見つかりません:', user.tenant_id);
            }
            
            // Zoom設定確認
            const zoomResult = await query(`
                SELECT 
                    tenant_id,
                    zoom_account_id,
                    zoom_client_id,
                    CASE WHEN zoom_client_secret_encrypted IS NOT NULL THEN 'ENCRYPTED_EXISTS' 
                         WHEN zoom_client_secret IS NOT NULL THEN 'PLAIN_EXISTS' 
                         ELSE 'NULL' END as client_secret_status,
                    CASE WHEN zoom_webhook_secret_encrypted IS NOT NULL THEN 'ENCRYPTED_EXISTS' 
                         WHEN zoom_webhook_secret IS NOT NULL THEN 'PLAIN_EXISTS' 
                         ELSE 'NULL' END as webhook_secret_status,
                    is_active,
                    created_at
                FROM zoom_tenant_settings 
                WHERE tenant_id = $1
            `, [user.tenant_id]);
            
            if (zoomResult.rows.length > 0) {
                console.log('Zoom設定:', zoomResult.rows[0]);
            } else {
                console.log('❌ Zoom設定が見つかりません');
            }
        } else {
            console.log('⚠️ テナントIDがnullです');
        }
        
    } catch (error) {
        console.error('❌ データ確認エラー:', error);
    }
}

checkTenantAdminData();