/**
 * 暗号化キーを確認するスクリプト
 */

const tenantZoomService = require('./services/tenantZoomService');

function showEncryptionKey() {
    console.log('=== PostgreSQL暗号化キー確認 ===');
    
    const encryptionKey = tenantZoomService.getEncryptionKey();
    console.log('暗号化キー:', encryptionKey);
    
    console.log('\n環境変数の状況:');
    console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY || '未設定');
    console.log('JWT_SECRET:', process.env.JWT_SECRET || '未設定');
}

showEncryptionKey();