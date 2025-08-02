/**
 * 実際のAPIを使用するテスト用アプリケーション
 * モックではなく、本物のサーバー設定を使用
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// 実際のミドルウェアとルートをインポート
const { authenticateToken } = require('../../middleware/auth');
const { tenantMiddleware } = require('../../middleware/tenantMiddleware');

/**
 * 実際のAPIを使用するテスト用アプリケーションを作成
 */
async function createRealTestApp() {
	const app = express();

	// 基本的なミドルウェア
	app.use(helmet());
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	// プロキシ設定
	app.set('trust proxy', 1);

	// 実際のルートを使用
	const authRoutes = require('../../routes/auth');
	const tenantAdminRoutes = require('../../routes/tenant-admin');
	const adminRoutes = require('../../routes/admin');
	const transcriptRoutes = require('../../routes/transcripts');
	const agentRoutes = require('../../routes/agent');

	// ルートの設定（実際のserver.jsと同じ）
	app.use('/admin', adminRoutes);
	app.use('/tenant-admin', tenantAdminRoutes);
	app.use('/:tenantId/api/auth', tenantMiddleware, authRoutes);
	app.use('/:tenantId/api/transcripts', tenantMiddleware, transcriptRoutes);
	app.use('/:tenantId/api/agent', tenantMiddleware, agentRoutes);

	// エラーハンドリング
	app.use((error, req, res, next) => {
		console.error('Real test app error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: error.message
		});
	});

	return app;
}

module.exports = {
	createRealTestApp
};