const redis = require('redis');

// Redis接続設定
const client = redis.createClient({
	url: process.env.REDIS_URL || 'redis://localhost:6379',
	retry_strategy: (options) => {
		if (options.error && options.error.code === 'ECONNREFUSED') {
			console.error('Redis接続が拒否されました');
			return new Error('Redis server connection refused');
		}
		if (options.total_retry_time > 1000 * 60 * 60) {
			console.error('Redis再接続のタイムアウト');
			return new Error('Redis retry time exhausted');
		}
		if (options.attempt > 10) {
			console.error('Redis再接続の試行回数が上限に達しました');
			return new Error('Redis retry attempts exhausted');
		}
		// 再接続間隔を徐々に長くする
		return Math.min(options.attempt * 100, 3000);
	}
});

// Redis接続エラーハンドリング
client.on('error', (err) => {
	console.error('Redis接続エラー:', err);
});

client.on('connect', () => {
	console.log('Redis接続成功');
});

client.on('reconnecting', () => {
	console.log('Redis再接続中...');
});

client.on('ready', () => {
	console.log('Redis接続準備完了');
});

// Redis接続テスト
const testRedisConnection = async () => {
	try {
		await client.connect();
		await client.ping();
		console.log('Redis接続テスト成功');
		return true;
	} catch (error) {
		console.error('Redis接続テストエラー:', error);
		throw error;
	}
};

// キャッシュ操作ヘルパー
const cacheHelpers = {
	// 値を設定（有効期限付き）
	set: async (key, value, expireInSeconds = 3600) => {
		try {
			const serializedValue = JSON.stringify(value);
			await client.setEx(key, expireInSeconds, serializedValue);
			console.log(`キャッシュ設定: ${key} (${expireInSeconds}秒)`);
		} catch (error) {
			console.error('キャッシュ設定エラー:', error);
			throw error;
		}
	},
	
	// 値を取得
	get: async (key) => {
		try {
			const value = await client.get(key);
			if (value === null) {
				return null;
			}
			return JSON.parse(value);
		} catch (error) {
			console.error('キャッシュ取得エラー:', error);
			return null;
		}
	},
	
	// 値を削除
	del: async (key) => {
		try {
			const result = await client.del(key);
			console.log(`キャッシュ削除: ${key}`);
			return result;
		} catch (error) {
			console.error('キャッシュ削除エラー:', error);
			throw error;
		}
	},
	
	// キーの存在チェック
	exists: async (key) => {
		try {
			const result = await client.exists(key);
			return result === 1;
		} catch (error) {
			console.error('キャッシュ存在チェックエラー:', error);
			return false;
		}
	},
	
	// 有効期限を設定
	expire: async (key, seconds) => {
		try {
			const result = await client.expire(key, seconds);
			return result === 1;
		} catch (error) {
			console.error('キャッシュ有効期限設定エラー:', error);
			return false;
		}
	},
	
	// パターンマッチでキーを検索
	keys: async (pattern) => {
		try {
			const keys = await client.keys(pattern);
			return keys;
		} catch (error) {
			console.error('キャッシュキー検索エラー:', error);
			return [];
		}
	}
};

// セッション管理ヘルパー
const sessionHelpers = {
	// セッション設定
	setSession: async (sessionId, data, expireInSeconds = 86400) => {
		const key = `session:${sessionId}`;
		await cacheHelpers.set(key, data, expireInSeconds);
	},
	
	// セッション取得
	getSession: async (sessionId) => {
		const key = `session:${sessionId}`;
		return await cacheHelpers.get(key);
	},
	
	// セッション削除
	deleteSession: async (sessionId) => {
		const key = `session:${sessionId}`;
		await cacheHelpers.del(key);
	}
};

// Redis接続を閉じる
const closeConnection = async () => {
	try {
		await client.quit();
		console.log('Redis接続を終了しました');
	} catch (error) {
		console.error('Redis接続終了エラー:', error);
	}
};

module.exports = {
	client,
	testRedisConnection,
	cacheHelpers,
	sessionHelpers,
	closeConnection
};