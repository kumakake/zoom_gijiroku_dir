/**
 * データベースマイグレーション実行スクリプト
 * 
 * 使用方法:
 * node scripts/run-migration.js [migration_file]
 * 
 * 例:
 * node scripts/run-migration.js 001_create_tenant_tables.sql
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// データベース接続設定
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration(migrationFile) {
	const client = await pool.connect();
	try {
		console.log(`🚀 マイグレーション開始: ${migrationFile}`);
		
		// マイグレーション履歴テーブルを最初に作成
		const logTablePath = path.join(__dirname, '../migrations/migration_log.sql');
		if (fs.existsSync(logTablePath)) {
			const logTableSql = fs.readFileSync(logTablePath, 'utf8');
			await client.query(logTableSql);
		}
		
		// 指定されたマイグレーションファイルのパス
		const migrationPath = path.join(__dirname, '../migrations', migrationFile);
		
		if (!fs.existsSync(migrationPath)) {
			throw new Error(`マイグレーションファイルが見つかりません: ${migrationPath}`);
		}
		
		// マイグレーションが既に実行済みかチェック
		const migrationName = path.basename(migrationFile, '.sql');
		const checkQuery = 'SELECT id FROM migration_log WHERE migration_name = $1';
		const checkResult = await client.query(checkQuery, [migrationName]);
		
		if (checkResult.rows.length > 0) {
			console.log(`⚠️  マイグレーション "${migrationName}" は既に実行済みです`);
			return;
		}
		
		// マイグレーションSQL読み込み
		const sql = fs.readFileSync(migrationPath, 'utf8');
		
		// トランザクション開始
		await client.query('BEGIN');
		
		try {
			// マイグレーション実行
			await client.query(sql);
			
			// 成功をコミット
			await client.query('COMMIT');
			
			console.log(`✅ マイグレーション完了: ${migrationFile}`);
			
			// データベース状態確認
			await verifyMigration(client, migrationName);
			
		} catch (error) {
			// エラー時はロールバック
			await client.query('ROLLBACK');
			throw error;
		}
		
	} catch (error) {
		console.error('❌ マイグレーション失敗:', error.message);
		console.error('詳細:', error);
		process.exit(1);
	} finally {
		client.release();
	}
}

async function verifyMigration(client, migrationName) {
	console.log('🔍 マイグレーション結果の確認...');
	
	try {
		// テーブル存在確認
		const tables = ['tenants', 'zoom_tenant_settings'];
		for (const table of tables) {
			const result = await client.query(`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = 'public' AND table_name = $1
			`, [table]);
			
			if (result.rows.length > 0) {
				console.log(`✅ テーブル "${table}" が正常に作成されました`);
			}
		}
		
		// カラム追加確認
		const columnsToCheck = [
			{ table: 'users', column: 'tenant_id' },
			{ table: 'agent_jobs', column: 'tenant_id' },
			{ table: 'meeting_transcripts', column: 'tenant_id' },
			{ table: 'distribution_logs', column: 'tenant_id' }
		];
		
		for (const { table, column } of columnsToCheck) {
			const result = await client.query(`
				SELECT column_name 
				FROM information_schema.columns 
				WHERE table_name = $1 AND column_name = $2
			`, [table, column]);
			
			if (result.rows.length > 0) {
				console.log(`✅ カラム "${table}.${column}" が正常に追加されました`);
			}
		}
		
		// デフォルトテナント確認
		const tenantResult = await client.query(`
			SELECT tenant_id, name FROM tenants WHERE tenant_id = 'default0'
		`);
		
		if (tenantResult.rows.length > 0) {
			console.log(`✅ デフォルトテナント "${tenantResult.rows[0].name}" が作成されました`);
		}
		
		// データ移行確認
		const userCount = await client.query(`
			SELECT COUNT(*) as count FROM users WHERE tenant_id = 'default0'
		`);
		console.log(`✅ ${userCount.rows[0].count} 件のユーザーデータが移行されました`);
		
	} catch (error) {
		console.warn('⚠️  検証中にエラーが発生しましたが、マイグレーションは完了しています:', error.message);
	}
}

async function runAllMigrations() {
	console.log('🔄 全マイグレーションを順次実行します...');
	
	const migrationsDir = path.join(__dirname, '../migrations');
	const migrationFiles = fs.readdirSync(migrationsDir)
		.filter(file => file.endsWith('.sql') && file !== 'migration_log.sql')
		.sort();
	
	for (const file of migrationFiles) {
		await runMigration(file);
	}
}

// メイン実行部分
async function main() {
	const migrationFile = process.argv[2];
	
	if (!migrationFile) {
		console.log('📝 使用方法:');
		console.log('  特定のマイグレーション: node scripts/run-migration.js [migration_file]');
		console.log('  全マイグレーション: node scripts/run-migration.js --all');
		console.log('');
		console.log('📁 利用可能なマイグレーション:');
		
		const migrationsDir = path.join(__dirname, '../migrations');
		const migrationFiles = fs.readdirSync(migrationsDir)
			.filter(file => file.endsWith('.sql') && file !== 'migration_log.sql')
			.sort();
		
		migrationFiles.forEach(file => console.log(`  - ${file}`));
		return;
	}
	
	if (migrationFile === '--all') {
		await runAllMigrations();
	} else {
		await runMigration(migrationFile);
	}
	
	await pool.end();
	console.log('🎉 マイグレーション処理が完了しました');
}

// スクリプト実行
if (require.main === module) {
	main().catch(error => {
		console.error('❌ 致命的エラー:', error);
		process.exit(1);
	});
}

module.exports = { runMigration };