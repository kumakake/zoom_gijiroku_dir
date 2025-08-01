const crypto = require('crypto');

/**
 * セキュリティミドルウェア集
 */

/**
 * リクエストIDの生成・追加
 * ログ追跡とセキュリティ監査用
 */
const requestId = (req, res, next) => {
	req.id = crypto.randomUUID();
	res.setHeader('X-Request-ID', req.id);
	next();
};

/**
 * セキュリティヘッダーの追加
 * Helmetで対応できない細かい設定
 */
const securityHeaders = (req, res, next) => {
	// サーバー情報の隠蔽
	res.removeHeader('X-Powered-By');
	res.removeHeader('Server');
	
	// カスタムセキュリティヘッダー
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	
	// キャッシュ制御（機密情報用）
	if (req.path.includes('/api/auth') || req.path.includes('/api/agent')) {
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Expires', '0');
	}
	
	// CSRF対策ヘッダー
	if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
		res.setHeader('X-Content-Type-Options', 'nosniff');
	}
	
	next();
};

/**
 * リクエスト検証・サニタイゼーション
 * 危険なパターンの検出と防御
 */
const requestValidation = (req, res, next) => {
	const userAgent = req.get('User-Agent') || '';
	const ip = req.ip || req.connection.remoteAddress;
	
	// 危険なUser-Agentパターン
	const dangerousPatterns = [
		/sqlmap/i,
		/nikto/i,
		/nmap/i,
		/masscan/i,
		/zap/i,
		/burp/i,
		/<script/i,
		/javascript:/i,
		/vbscript:/i
	];
	
	// 危険なパターンの検出
	const isDangerous = dangerousPatterns.some(pattern => pattern.test(userAgent));
	
	if (isDangerous) {
		console.warn(`Suspicious request detected - IP: ${ip}, User-Agent: ${userAgent}, Path: ${req.path}`);
		return res.status(403).json({
			error: 'リクエストが拒否されました'
		});
	}
	
	// SQLインジェクション検出（基本的なパターン）
	const sqlPatterns = [
		/('|(\\')|(;)|(\s+(or|and)\s+))/i,
		/(union\s+select|insert\s+into|delete\s+from|update\s+set|drop\s+table)/i,
		/(\||&|\$|`|<|>|\{|\}|\[|\])/
	];
	
	// リクエストボディとクエリパラメータをチェック
	const checkForSQLInjection = (obj) => {
		if (typeof obj === 'string') {
			return sqlPatterns.some(pattern => pattern.test(obj));
		}
		if (typeof obj === 'object' && obj !== null) {
			return Object.values(obj).some(value => checkForSQLInjection(value));
		}
		return false;
	};
	
	if (checkForSQLInjection(req.query) || checkForSQLInjection(req.body)) {
		console.warn(`SQL injection attempt detected - IP: ${ip}, Path: ${req.path}`);
		return res.status(403).json({
			error: '不正なリクエストが検出されました'
		});
	}
	
	next();
};

/**
 * APIキー検証（オプション）
 * 内部API呼び出し用
 */
const apiKeyValidation = (req, res, next) => {
	// 内部API呼び出しの場合のみチェック
	if (req.headers['x-internal-api-key']) {
		const providedKey = req.headers['x-internal-api-key'];
		const validKey = process.env.INTERNAL_API_KEY;
		
		if (!validKey || providedKey !== validKey) {
			console.warn(`Invalid internal API key - IP: ${req.ip}`);
			return res.status(401).json({
				error: '無効なAPIキーです'
			});
		}
	}
	
	next();
};

/**
 * レスポンス時間の監視
 * パフォーマンス監視とDDoS検出用
 */
const responseTimeMonitoring = (req, res, next) => {
	const startTime = Date.now();
	
	// レスポンス完了時の処理
	res.on('finish', () => {
		const responseTime = Date.now() - startTime;
		
		// 異常に遅いレスポンスを記録
		if (responseTime > 5000) { // 5秒以上
			console.warn(`Slow response detected - ${responseTime}ms, Path: ${req.path}, IP: ${req.ip}`);
		}
		
		// レスポンス時間をログに記録（ヘッダー設定は削除）
		console.log(`Response time: ${responseTime}ms for ${req.method} ${req.path}`);
	});
	
	next();
};

/**
 * 機密情報のログマスキング
 * ログに機密情報が含まれないようにする
 */
const logSanitization = (req, res, next) => {
	// リクエストボディの機密情報をマスク
	if (req.body) {
		const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
		const sanitizedBody = { ...req.body };
		
		sensitiveFields.forEach(field => {
			if (sanitizedBody[field]) {
				sanitizedBody[field] = '***masked***';
			}
		});
		
		req.sanitizedBody = sanitizedBody;
	}
	
	next();
};

/**
 * IP ホワイトリスト/ブラックリスト
 * 本番環境での特定IP制限用
 */
const ipFiltering = (req, res, next) => {
	const ip = req.ip || req.connection.remoteAddress;
	
	// ブラックリストのIP（環境変数で設定可能）
	const blacklistedIPs = (process.env.BLACKLISTED_IPS || '').split(',').filter(Boolean);
	
	if (blacklistedIPs.includes(ip)) {
		console.warn(`Blacklisted IP access attempt: ${ip}`);
		return res.status(403).json({
			error: 'アクセスが拒否されました'
		});
	}
	
	// ホワイトリストが設定されている場合（管理機能用）
	const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean);
	const requireWhitelist = process.env.REQUIRE_IP_WHITELIST === 'true';
	
	if (requireWhitelist && whitelistedIPs.length > 0 && !whitelistedIPs.includes(ip)) {
		console.warn(`Non-whitelisted IP access attempt: ${ip}`);
		return res.status(403).json({
			error: 'アクセスが許可されていません'
		});
	}
	
	next();
};

/**
 * セキュリティイベントの記録
 * 監査ログとして重要なセキュリティイベントを記録
 */
const securityEventLogger = (eventType, details) => {
	const event = {
		timestamp: new Date().toISOString(),
		type: eventType,
		details: details,
		severity: 'security'
	};
	
	// セキュリティログファイルに記録（本番環境）
	if (process.env.NODE_ENV === 'production') {
		console.warn(`SECURITY EVENT: ${JSON.stringify(event)}`);
	} else {
		console.log(`Security Event: ${eventType}`, details);
	}
};

module.exports = {
	requestId,
	securityHeaders,
	requestValidation,
	apiKeyValidation,
	responseTimeMonitoring,
	logSanitization,
	ipFiltering,
	securityEventLogger
};