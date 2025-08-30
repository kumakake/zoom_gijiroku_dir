const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// セキュリティミドルウェアのインポート
const {
	requestId,
	securityHeaders,
	requestValidation,
	apiKeyValidation,
	responseTimeMonitoring,
	logSanitization,
	ipFiltering
} = require('./middleware/security');

// テナントミドルウェアのインポート
const { tenantMiddleware } = require('./middleware/tenantMiddleware');

const app = express();
const PORT = process.env.PORT || 8000;

// プロキシ設定（ngrok、ロードバランサー等への対応）
app.set('trust proxy', 1);

// セキュリティミドルウェアの設定（Helmet強化版）
app.use(helmet({
	// Content Security Policy（本番環境では厳格に設定）
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: [
				"'self'", 
				"'unsafe-inline'", // フロントエンドフレームワークのため
				"https://fonts.googleapis.com"
			],
			scriptSrc: [
				"'self'",
				...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])
			],
			imgSrc: [
				"'self'", 
				"data:", 
				"https:",
				"https://zm01.ast-tools.online"
			],
			fontSrc: [
				"'self'",
				"https://fonts.gstatic.com"
			],
			connectSrc: [
				"'self'",
				process.env.NODE_ENV === 'production' 
					? "https://zm01.ast-tools.online"
					: "http://localhost:*"
			],
			mediaSrc: ["'self'"],
			objectSrc: ["'none'"],
			frameSrc: ["'none'"],
			baseUri: ["'self'"],
			formAction: ["'self'"],
			frameAncestors: ["'none'"],
			upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
		},
		reportOnly: process.env.NODE_ENV === 'development', // 開発時はレポートのみ
	},
	
	// Strict Transport Security（本番環境でHTTPS強制）
	hsts: {
		maxAge: 31536000, // 1年
		includeSubDomains: true,
		preload: true
	},
	
	// X-Frame-Options（クリックジャッキング対策）
	frameguard: {
		action: 'deny'
	},
	
	// X-Content-Type-Options（MIMEタイプスニッフィング防止）
	noSniff: true,
	
	// Referrer Policy
	referrerPolicy: {
		policy: "strict-origin-when-cross-origin"
	},
	
	// X-XSS-Protection
	xssFilter: true,
	
	// DNSプリフェッチ制御
	dnsPrefetchControl: {
		allow: false
	},
	
	// Permissions Policy（旧Feature Policy）
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		magnetometer: [],
		gyroscope: [],
		accelerometer: [],
		ambient: [],
		autoplay: ['self'],
		fullscreen: ['self'],
	},
	
	// Cross-Origin設定
	crossOriginEmbedderPolicy: false, // Next.jsとの互換性のため
	crossOriginOpenerPolicy: { policy: "same-origin" },
	crossOriginResourcePolicy: { policy: "cross-origin" },
	
	// 開発環境では一部制限を緩和
	...(process.env.NODE_ENV === 'development' && {
		contentSecurityPolicy: false, // 開発時はCSPを無効化
	})
}));

// CORS設定（本番環境に対応）
const corsOptions = {
	origin: function (origin, callback) {
		// 本番環境の許可ドメイン
		const allowedOrigins = process.env.NODE_ENV === 'production' 
			? [
				process.env.CORS_ORIGIN || 'https://zm01.ast-tools.online',
				process.env.FRONTEND_URL || 'https://zm01.ast-tools.online',
			] 
			: [
				'http://localhost:3000',
				'http://localhost:3001',
				'http://localhost:' + process.env.PORT,
				'http://127.0.0.1:3000'
			];
		
		// Zoom WebhookやAPIツールからのリクエスト（originなし）を許可
		if (!origin || allowedOrigins.indexOf(origin) !== -1) {
			callback(null, true);
		} else {
			console.warn(`CORS violation: Origin ${origin} not allowed`);
			callback(new Error('CORS policy violation'), false);
		}
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
	allowedHeaders: [
		'Content-Type', 
		'Authorization', 
		'X-Requested-With',
		'Accept',
		'Origin',
		'X-Zm-Request-Timestamp',  // Zoom Webhook用
		'X-Zm-Signature'           // Zoom Webhook用
	],
	exposedHeaders: ['X-Total-Count', 'X-Page-Count'], // ページネーション用
	maxAge: 86400, // プリフライトキャッシュ（24時間）
	optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// レート制限設定（強化版）
const createRateLimiter = (windowMs, max, message) => {
	return rateLimit({
		windowMs,
		max,
		message: { error: message },
		standardHeaders: true, // レート制限情報をヘッダーに含める
		legacyHeaders: false,
		handler: (req, res) => {
			console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
			res.status(429).json({
				error: message,
				retryAfter: Math.round(windowMs / 1000)
			});
		},
		skip: (req) => {
			// ヘルスチェックはレート制限から除外
			return req.path === '/health';
		}
	});
};

// 一般的なAPIエンドポイント用
const generalLimiter = createRateLimiter(
	15 * 60 * 1000, // 15分
	process.env.NODE_ENV === 'production' ? 100 : 1000, // 本番: 100, 開発: 1000
	'リクエスト数が制限を超えました。しばらく待ってから再試行してください。'
);

// 認証エンドポイント用（デバッグ中は無効化）
const authLimiter = process.env.NODE_ENV === 'development' 
	? (req, res, next) => next() // 開発環境では無効化
	: createRateLimiter(
		15 * 60 * 1000, // 15分
		10, // 認証試行は10回まで
		'認証試行回数が制限を超えました。15分後に再試行してください。'
	);

// Webhook用（緩い制限）
const webhookLimiter = createRateLimiter(
	5 * 60 * 1000, // 5分
	50, // Zoom Webhookのバースト対応
	'Webhook受信頻度が制限を超えました。'
);

// 一般的なレート制限を適用
app.use(generalLimiter);

// セキュリティミドルウェアの適用
app.use(requestId);              // リクエストID生成
app.use(responseTimeMonitoring); // レスポンス時間監視
app.use(ipFiltering);            // IP フィルタリング
app.use(securityHeaders);        // セキュリティヘッダー
app.use(requestValidation);      // リクエスト検証
app.use(apiKeyValidation);       // API キー検証
app.use(logSanitization);        // ログサニタイゼーション

// 基本ミドルウェア設定
app.use(compression());
app.use(express.json({ 
	limit: '10mb',
	verify: (req, res, buf) => {
		// JSON パースエラーの詳細ログ
		req.rawBody = buf.toString();
	}
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
	res.json({
		status: 'OK',
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || '1.0.0',
		environment: process.env.NODE_ENV || 'development'
	});
});

// API ルートの設定（レート制限付き）
const authRoutes       = require('./routes/auth');
const webhookRoutes    = require('./routes/webhooks');
const agentRoutes      = require('./routes/agent');
const transcriptRoutes = require('./routes/transcripts');
const transcriptTemplateRoutes = require('./routes/transcript-templates');
const uploadRoutes     = require('./routes/upload');
const debugRoutes      = require('./routes/debug');

// システム管理者用ルート（テナントミドルウェア適用前）
app.use('/admin', authLimiter, require('./routes/admin')); // 後で作成

// テナント管理者用ルート
app.use('/tenant-admin', authLimiter, require('./routes/tenant-admin'));

// レガシーAPIルート（管理者・システム用、テナントIDなし）
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/transcript-templates', transcriptTemplateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/manual-transcripts', require('./routes/manual-transcripts'));
app.use('/api/debug', debugRoutes);

// テナント別Webhook専用ルート（新しい標準形式）
app.use('/api/webhooks/zoom/:tenantId', (req, res, next) => {
	// パラメータからテナントIDを取得してreq.tenantIdに設定
	req.tenantId = req.params.tenantId;
	next();
}, webhookLimiter, require('./routes/webhooks'));

// テナント別ルート（/:tenantId/api/* 形式）
app.use('/:tenantId/api/auth', tenantMiddleware, authLimiter, authRoutes);
app.use('/:tenantId/api/webhooks', tenantMiddleware, webhookLimiter, webhookRoutes);
app.use('/:tenantId/api/agent', tenantMiddleware, agentRoutes);
app.use('/:tenantId/api/transcripts', tenantMiddleware, transcriptRoutes);
app.use('/:tenantId/api/transcript-templates', tenantMiddleware, transcriptTemplateRoutes);
app.use('/:tenantId/api/upload', tenantMiddleware, uploadRoutes);
app.use('/:tenantId/api/manual-transcripts', tenantMiddleware, require('./routes/manual-transcripts'));
app.use('/:tenantId/api/debug', tenantMiddleware, debugRoutes);

// 404エラーハンドリング
app.use('*', (req, res) => {
	res.status(404).json({
		error: 'エンドポイントが見つかりません',
		path: req.originalUrl,
		method: req.method
	});
});

// グローバルエラーハンドリング
app.use((err, req, res, next) => {
	console.error('エラーが発生しました:', err);
	
	// バリデーションエラーの処理
	if (err.name === 'ValidationError') {
		return res.status(400).json({
			error: 'バリデーションエラーが発生しました',
			details: err.details || err.message
		});
	}
	
	// JWT認証エラーの処理
	if (err.name === 'JsonWebTokenError') {
		return res.status(401).json({
			error: '認証トークンが無効です'
		});
	}
	
	// データベースエラーの処理
	if (err.code === '23505') { // PostgreSQL unique constraint violation
		return res.status(409).json({
			error: 'データが既に存在します'
		});
	}
	
	// デフォルトエラーレスポンス
	res.status(err.status || 500).json({
		error: process.env.NODE_ENV === 'production' 
			? 'サーバーエラーが発生しました' 
			: err.message || 'Internal Server Error',
		...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
	});
});

// サーバー起動処理
const startServer = async () => {
	try {
		// データベース接続テスト
		const { testDatabaseConnection } = require('./utils/database');
		await testDatabaseConnection();
		console.log('✅ データベース接続成功');
		
		// Redis接続テスト
		const { testRedisConnection } = require('./utils/redis');
		await testRedisConnection();
		console.log('✅ Redis接続成功');
		
		// ワーカー初期化
		const TranscriptWorker = require('./workers/transcriptWorker');
		const EmailWorker = require('./workers/emailWorker');
		
		global.transcriptWorker = new TranscriptWorker();
		global.emailWorker = new EmailWorker();
		console.log('✅ ワーカー初期化完了');
		
		// サーバー起動
		app.listen(PORT, '0.0.0.0', () => {
			console.log(`🚀 AIエージェントバックエンドサーバーが起動しました`);
			console.log(`📍 ポート: ${PORT}`);
			console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
			console.log(`📊 ヘルスチェック: http://localhost:${PORT}/health`);
		});
		
	} catch (error) {
		console.error('❌ サーバー起動エラー:', error);
		process.exit(1);
	}
};

// graceful shutdown の実装
process.on('SIGTERM', async () => {
	console.log('SIGTERM受信 - サーバーを終了しています...');
	// ここでデータベース接続やRedis接続のクリーンアップを行う
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('SIGINT受信 - サーバーを終了しています...');
	process.exit(0);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
	console.error('未処理の例外:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('未処理のPromise拒否:', reason);
	process.exit(1);
});

startServer();
