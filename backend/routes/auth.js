const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../utils/database');
const { 
	generateToken, 
	generateRefreshToken, 
	verifyRefreshToken, 
	authenticateToken 
} = require('../middleware/auth');

const router = express.Router();

// ユーザー登録
router.post('/register', [
	body('email')
		.isEmail()
		.normalizeEmail()
		.withMessage('有効なメールアドレスを入力してください'),
	body('name')
		.trim()
		.isLength({ min: 1, max: 255 })
		.withMessage('名前は1文字以上255文字以下で入力してください'),
	body('password')
		.isLength({ min: 8 })
		.withMessage('パスワードは8文字以上で入力してください')
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
		.withMessage('パスワードは大文字、小文字、数字を含む必要があります'),
], async (req, res) => {
	try {
		// バリデーションエラーのチェック
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const { email, name, password } = req.body;

		// メールアドレスの重複チェック
		const existingUser = await query(
			'SELECT user_uuid FROM users WHERE email = $1',
			[email]
		);
		
		if (existingUser.rows.length > 0) {
			return res.status(409).json({
				error: '既に登録済みのメールアドレスです'
			});
		}
		
		// パスワードのハッシュ化
		const saltRounds = 12;
		const passwordHash = await bcrypt.hash(password, saltRounds);
		
		// ユーザー登録
		const result = await query(
			`INSERT INTO users (email, name, password_hash, role) 
			 VALUES ($1, $2, $3, $4) 
			 RETURNING user_uuid, email, name, role, created_at`,
			[email, name, passwordHash, 'user']
		);
		
		const newUser = result.rows[0];
		
		// JWTトークン生成
		const accessToken = generateToken(newUser.user_uuid, null, newUser.role);
		const refreshToken = generateRefreshToken(newUser.user_uuid, null);
		
		console.log(`新規ユーザー登録: ${newUser.email} (UUID: ${newUser.user_uuid})`);
		
		res.status(201).json({
			message: 'ユーザー登録が完了しました',
			user: {
				user_uuid: newUser.user_uuid,
				email: newUser.email,
				name: newUser.name,
				role: newUser.role,
				createdAt: newUser.created_at
			},
			accessToken,
			refreshToken
		});
		
	} catch (error) {
		console.error('ユーザー登録エラー:', error);
		res.status(500).json({
			error: 'ユーザー登録中にエラーが発生しました'
		});
	}
});

// ログイン
router.post('/login', [
	body('email')
		.isEmail()
		.withMessage('有効なメールアドレスを入力してください'),
	body('password')
		.notEmpty()
		.withMessage('パスワードを入力してください'),
], async (req, res) => {
	try {
		// バリデーションエラーのチェック
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const { email, password } = req.body;
		
		// デバッグログ
		console.log('ログイン試行:', { email, emailLength: email.length, emailType: typeof email });
		
		// ユーザー情報の取得
		const userResult = await query(
			'SELECT user_uuid, email, name, password_hash, role, is_active, created_at FROM users WHERE email = $1',
			[email]
		);
		
		console.log('データベース検索結果:', { 
			rowCount: userResult.rows.length, 
			searchEmail: email,
			foundEmails: userResult.rows.map(row => row.email)
		});
		
		if (userResult.rows.length === 0) {
			return res.status(401).json({
				error: 'メールアドレスまたはパスワードが正しくありません0'
			});
		}
		
		const user = userResult.rows[0];
		
		// アクティブユーザーかチェック
		if (!user.is_active) {
			return res.status(401).json({
				error: 'アカウントが無効化されています。管理者にお問い合わせください'
			});
		}
		
		// パスワード検証
		const isValidPassword = await bcrypt.compare(password, user.password_hash);
		if (!isValidPassword) {
			return res.status(401).json({
				error: 'メールアドレスまたはパスワードが正しくありません1'
			});
		}
		
		// JWTトークン生成（管理者の場合はテナントIDなし）
		const accessToken = generateToken(user.user_uuid, user.tenant_id, user.role);
		const refreshToken = generateRefreshToken(user.user_uuid, user.tenant_id);
		
		// 最終ログイン時刻の更新
		await query(
			'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $1',
			[user.user_uuid]
		);
		
		console.log(`ユーザーログイン: ${user.email} (UUID: ${user.user_uuid})`);
		
		res.json({
			message: 'ログインに成功しました',
			user: {
				user_uuid: user.user_uuid,
				email: user.email,
				name: user.name,
				role: user.role,
				createdAt: user.created_at
			},
			accessToken,
			refreshToken
		});
		
	} catch (error) {
		console.error('ログインエラー:', error);
		res.status(500).json({
			error: 'ログイン処理中にエラーが発生しました'
		});
	}
});

// トークンリフレッシュ
router.post('/refresh', [
	body('refreshToken')
		.notEmpty()
		.withMessage('リフレッシュトークンが必要です'),
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const { refreshToken } = req.body;
		
		// リフレッシュトークンの検証
		const decoded = verifyRefreshToken(refreshToken);
		
		// ユーザーの存在とアクティブ状態をチェック
		const userResult = await query(
			'SELECT user_uuid, email, name, role, tenant_id, is_active FROM users WHERE user_uuid = $1',
			[decoded.userId]
		);
		
		if (userResult.rows.length === 0) {
			return res.status(401).json({
				error: 'ユーザーが見つかりません'
			});
		}
		
		const user = userResult.rows[0];
		
		if (!user.is_active) {
			return res.status(401).json({
				error: 'アカウントが無効化されています'
			});
		}
		
		// 新しいアクセストークンを生成
		const newAccessToken = generateToken(user.user_uuid, user.tenant_id, user.role);
		const newRefreshToken = generateRefreshToken(user.user_uuid, user.tenant_id);
		
		res.json({
			message: 'トークンを更新しました',
			accessToken: newAccessToken,
			refreshToken: newRefreshToken
		});
		
	} catch (error) {
		console.error('トークンリフレッシュエラー:', error);
		
		if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
			return res.status(401).json({
				error: '無効なリフレッシュトークンです'
			});
		}
		
		res.status(500).json({
			error: 'トークンリフレッシュ処理中にエラーが発生しました'
		});
	}
});

// ユーザー情報取得
router.get('/me', authenticateToken, async (req, res) => {
	try {
		// データベースから最新のユーザー情報を取得
		const userResult = await query(
			'SELECT user_uuid, email, name, role, email_distribution_preference, created_at FROM users WHERE user_uuid = $1',
			[req.user.user_uuid]
		);
		
		if (userResult.rows.length === 0) {
			return res.status(404).json({
				error: 'ユーザーが見つかりません'
			});
		}
		
		const user = userResult.rows[0];
		
		res.json({
			user: {
				user_uuid: user.user_uuid,
				email: user.email,
				name: user.name,
				role: user.role,
				email_distribution_preference: user.email_distribution_preference,
				createdAt: user.created_at
			}
		});
	} catch (error) {
		console.error('ユーザー情報取得エラー:', error);
		res.status(500).json({
			error: 'ユーザー情報取得中にエラーが発生しました'
		});
	}
});

// ユーザー情報更新
router.put('/update-profile', [
	authenticateToken,
	body('name')
		.trim()
		.isLength({ min: 1, max: 255 })
		.withMessage('名前は1文字以上255文字以下で入力してください'),
	body('email_distribution_preference')
		.optional()
		.isIn(['host_only', 'all_participants'])
		.withMessage('メール配信設定は host_only または all_participants である必要があります'),
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const { name, email_distribution_preference } = req.body;
		
		// ユーザー情報を更新
		if (email_distribution_preference !== undefined) {
			await query(
				'UPDATE users SET name = $1, email_distribution_preference = $2, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $3',
				[name, email_distribution_preference, req.user.user_uuid]
			);
		} else {
			await query(
				'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $2',
				[name, req.user.user_uuid]
			);
		}
		
		// 更新されたユーザー情報を取得
		const userResult = await query(
			'SELECT user_uuid, email, name, role, email_distribution_preference, created_at FROM users WHERE user_uuid = $1',
			[req.user.user_uuid]
		);
		
		const updatedUser = userResult.rows[0];
		
		console.log(`ユーザー情報更新: ${updatedUser.email} (UUID: ${updatedUser.user_uuid})`);
		
		res.json({
			message: 'ユーザー情報を更新しました',
			user: {
				user_uuid: updatedUser.user_uuid,
				email: updatedUser.email,
				name: updatedUser.name,
				role: updatedUser.role,
				email_distribution_preference: updatedUser.email_distribution_preference,
				createdAt: updatedUser.created_at
			}
		});
		
	} catch (error) {
		console.error('ユーザー情報更新エラー:', error);
		res.status(500).json({
			error: 'ユーザー情報更新中にエラーが発生しました'
		});
	}
});

// パスワード変更
router.put('/change-password', [
	authenticateToken,
	body('currentPassword')
		.notEmpty()
		.withMessage('現在のパスワードを入力してください'),
	body('newPassword')
		.isLength({ min: 8 })
		.withMessage('新しいパスワードは8文字以上で入力してください')
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
		.withMessage('新しいパスワードは大文字、小文字、数字を含む必要があります'),
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}
		
		const { currentPassword, newPassword } = req.body;
		
		// 現在のパスワードハッシュを取得
		const userResult = await query(
			'SELECT password_hash FROM users WHERE user_uuid = $1',
			[req.user.user_uuid]
		);
		
		if (userResult.rows.length === 0) {
			return res.status(404).json({
				error: 'ユーザーが見つかりません'
			});
		}
		
		const user = userResult.rows[0];
		
		// 現在のパスワード検証
		const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
		if (!isValidPassword) {
			return res.status(401).json({
				error: '現在のパスワードが正しくありません'
			});
		}
		
		// 新しいパスワードのハッシュ化
		const saltRounds = 12;
		const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
		
		// パスワード更新
		await query(
			'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $2',
			[newPasswordHash, req.user.user_uuid]
		);
		
		console.log(`パスワード変更: ${req.user.email} (UUID: ${req.user.user_uuid})`);
		
		res.json({
			message: 'パスワードを変更しました'
		});
		
	} catch (error) {
		console.error('パスワード変更エラー:', error);
		res.status(500).json({
			error: 'パスワード変更中にエラーが発生しました'
		});
	}
});

// ログアウト（実際にはクライアント側でトークンを削除）
router.post('/logout', authenticateToken, (req, res) => {
	console.log(`ユーザーログアウト: ${req.user.email} (UUID: ${req.user.user_uuid})`);
	res.json({
		message: 'ログアウトしました'
	});
});

module.exports = router;
