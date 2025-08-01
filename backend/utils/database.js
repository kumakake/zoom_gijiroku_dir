const { Pool } = require('pg');

// PostgreSQL接続プールの設定
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 20, // 最大接続数
	idleTimeoutMillis: 30000, // アイドル接続のタイムアウト
	connectionTimeoutMillis: 2000, // 接続タイムアウト
});

// データベース接続テスト
const testDatabaseConnection = async () => {
	try {
		const client = await pool.connect();
		const result = await client.query('SELECT NOW() as current_time');
		console.log('データベース接続テスト成功:', result.rows[0].current_time);
		client.release();
		return true;
	} catch (error) {
		console.error('データベース接続エラー:', error);
		throw error;
	}
};

// クエリ実行ヘルパー
const query = async (text, params) => {
	const start = Date.now();
	try {
		const result = await pool.query(text, params);
		const duration = Date.now() - start;
		console.log(`クエリ実行完了: ${duration}ms`, { text, rowCount: result.rowCount });
		return result;
	} catch (error) {
		console.error('クエリ実行エラー:', error);
		console.error('SQL:', text);
		console.error('パラメータ:', params);
		throw error;
	}
};

// トランザクション実行ヘルパー
const transaction = async (callback) => {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const result = await callback(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
};

// ページネーション用のクエリヘルパー
const paginatedQuery = async (baseQuery, params = [], page = 1, limit = 20) => {
	const offset = (page - 1) * limit;
	
	// 総件数を取得
	const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as count_query`;
	const countResult = await query(countQuery, params);
	const totalCount = parseInt(countResult.rows[0].count);
	
	// ページネーション付きでデータを取得
	const paginatedSql = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
	const result = await query(paginatedSql, [...params, limit, offset]);
	
	return {
		data: result.rows,
		pagination: {
			currentPage: page,
			totalPages: Math.ceil(totalCount / limit),
			totalCount,
			hasNextPage: page * limit < totalCount,
			hasPreviousPage: page > 1
		}
	};
};

// 接続プールの終了
const closePool = async () => {
	await pool.end();
	console.log('データベース接続プールを終了しました');
};

module.exports = {
	pool,
	query,
	transaction,
	paginatedQuery,
	testDatabaseConnection,
	closePool
};