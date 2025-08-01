/**
 * テナント別Zoom設定サービス
 * 
 * テナントごとのZoom API認証情報の管理と取得を行う
 */

const { query } = require('../utils/database');
const crypto = require('crypto');

class TenantZoomService {
	constructor() {
		// 設定キャッシュ（パフォーマンス向上）
		this.cache = new Map();
		this.CACHE_TTL = 10 * 60 * 1000; // 10分
	}

	/**
	 * テナント別Zoom認証情報取得
	 * @param {string} tenantId - テナントID
	 * @returns {Object} Zoom認証情報
	 */
	async getZoomCredentials(tenantId) {
		console.log(`🔍 TenantZoomService.getZoomCredentials 呼び出し開始 - テナント: ${tenantId}`);
		try {
			// キャッシュから確認
			const cached = this.cache.get(tenantId);
			if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
				console.log(`📝 キャッシュからデータ取得 - テナント: ${tenantId}`);
				return cached.data;
			}

			// データベースから取得
			const encryptionKey = this.getEncryptionKey();
			console.log(`🔑 暗号化キー取得: ${encryptionKey ? encryptionKey.substring(0,10) + '...' : 'なし'}`);
			const queryText = `
				SELECT 
					zoom_client_id,
					CASE 
						WHEN zoom_client_secret_encrypted IS NOT NULL THEN 
							pgp_sym_decrypt(zoom_client_secret_encrypted, $2::text)
						ELSE zoom_client_secret
					END as zoom_client_secret,
					CASE 
						WHEN zoom_webhook_secret_encrypted IS NOT NULL THEN 
							pgp_sym_decrypt(zoom_webhook_secret_encrypted, $2::text)
						ELSE zoom_webhook_secret
					END as zoom_webhook_secret,
					zoom_account_id,
					is_active
				FROM zoom_tenant_settings 
				WHERE tenant_id = $1 AND is_active = true
			`;
			
			console.log(`Zoom認証情報取得開始 (テナント: ${tenantId})`);
			console.log(`暗号化キー: ${encryptionKey ? 'あり' : 'なし'}`);
			console.log(`実行するSQL:`, queryText);
			console.log(`パラメータ:`, [tenantId, encryptionKey]);
			
			const result = await query(queryText, [tenantId, encryptionKey]);
			
			if (result.rows.length === 0) {
				throw new Error(`テナント ${tenantId} のZoom設定が見つかりません`);
			}

			const settings = result.rows[0];
			console.log(`復号化後の設定:`, {
				zoom_client_id: settings.zoom_client_id,
				zoom_client_secret_length: settings.zoom_client_secret ? settings.zoom_client_secret.length : 0,
				zoom_webhook_secret_length: settings.zoom_webhook_secret ? settings.zoom_webhook_secret.length : 0,
				zoom_account_id: settings.zoom_account_id
			});

			// キャッシュに保存（暗号化された状態で）
			this.cache.set(tenantId, {
				data: settings,
				timestamp: Date.now()
			});

			return settings;
			
		} catch (error) {
			console.error(`Zoom認証情報取得エラー (テナント: ${tenantId}):`, error);
			throw error;
		}
	}

	/**
	 * テナント別Zoom APIクライアント生成
	 * @param {string} tenantId - テナントID
	 * @returns {Object} Zoom APIクライアント設定
	 */
	async createZoomClient(tenantId) {
		const credentials = await this.getZoomCredentials(tenantId);
		
		return {
			clientId: credentials.zoom_client_id,
			clientSecret: credentials.zoom_client_secret,
			accountId: credentials.zoom_account_id,
			tenantId: tenantId
		};
	}

	/**
	 * Webhook署名検証（テナント別）
	 * @param {string} tenantId - テナントID
	 * @param {string} payload - Webhookペイロード
	 * @param {string} signature - 署名
	 * @param {string} timestamp - タイムスタンプ
	 * @returns {boolean} 検証結果
	 */
	async verifyWebhookSignature(tenantId, payload, signature, timestamp) {
		try {
			const credentials = await this.getZoomCredentials(tenantId);
			
			return this.verifyZoomWebhookSignature(
				payload,
				signature,
				timestamp,
				credentials.zoom_webhook_secret
			);
		} catch (error) {
			console.error(`Webhook署名検証エラー (テナント: ${tenantId}):`, error);
			return false;
		}
	}

	/**
	 * Zoom設定の保存・更新
	 * @param {string} tenantId - テナントID
	 * @param {Object} settings - Zoom設定
	 * @returns {Object} 保存結果
	 */
	async saveZoomSettings(tenantId, settings) {
		return this.upsertZoomSettings(tenantId, settings);
	}

	/**
	 * Zoom設定のUpsert（挿入または更新）
	 * @param {string} tenantId - テナントID
	 * @param {Object} settings - Zoom設定
	 * @returns {Object} 保存結果
	 */
	async upsertZoomSettings(tenantId, settings) {
		const {
			zoom_client_id,
			zoom_client_secret,
			zoom_webhook_secret,
			zoom_account_id
		} = settings;

		try {
			// 既存設定確認
			const existingQueryText = `
				SELECT id FROM zoom_tenant_settings 
				WHERE tenant_id = $1
			`;
			const existingResult = await query(existingQueryText, [tenantId]);

			let queryText, values;
			
			if (existingResult.rows.length > 0) {
				// 更新（空の値は既存値を保持、PostgreSQL bytea暗号化対応）
				const updateFields = [];
				const updateValues = [tenantId];
				let paramIndex = 2;
				const encryptionKey = this.getEncryptionKey();

				if (zoom_client_id !== undefined && zoom_client_id !== '') {
					updateFields.push(`zoom_client_id = $${paramIndex++}`);
					updateValues.push(zoom_client_id);
				}

				if (zoom_client_secret !== undefined && zoom_client_secret !== '') {
					updateFields.push(`zoom_client_secret_encrypted = pgp_sym_encrypt($${paramIndex}, $${paramIndex + 1})`);
					updateFields.push(`zoom_client_secret = NULL`);
					updateValues.push(zoom_client_secret);
					updateValues.push(encryptionKey);
					paramIndex += 2;
				}

				if (zoom_webhook_secret !== undefined && zoom_webhook_secret !== '') {
					updateFields.push(`zoom_webhook_secret_encrypted = pgp_sym_encrypt($${paramIndex}, $${paramIndex + 1})`);
					updateFields.push(`zoom_webhook_secret = NULL`);
					updateValues.push(zoom_webhook_secret);
					updateValues.push(encryptionKey);
					paramIndex += 2;
				}

				if (zoom_account_id !== undefined && zoom_account_id !== '') {
					updateFields.push(`zoom_account_id = $${paramIndex++}`);
					updateValues.push(zoom_account_id);
				}

				// 更新するフィールドがない場合はエラー
				if (updateFields.length === 0) {
					throw new Error('更新する項目がありません');
				}

				updateFields.push('updated_at = CURRENT_TIMESTAMP');

				queryText = `
					UPDATE zoom_tenant_settings 
					SET ${updateFields.join(', ')}
					WHERE tenant_id = $1
					RETURNING *
				`;
				values = updateValues;
			} else {
				// 新規作成（PostgreSQL bytea暗号化対応）
				const encryptionKey = this.getEncryptionKey();
				queryText = `
					INSERT INTO zoom_tenant_settings (
						tenant_id,
						zoom_client_id,
						zoom_client_secret_encrypted,
						zoom_webhook_secret_encrypted,
						zoom_account_id,
						is_active,
						created_at,
						updated_at
					) VALUES (
						$1, 
						$2, 
						pgp_sym_encrypt($3::text, $6::text),
						pgp_sym_encrypt($4::text, $6::text),
						$5, 
						true, 
						CURRENT_TIMESTAMP, 
						CURRENT_TIMESTAMP
					)
					RETURNING *
				`;
				values = [
					tenantId,
					zoom_client_id,
					zoom_client_secret,
					zoom_webhook_secret,
					zoom_account_id,
					encryptionKey
				];
			}

			const result = await query(queryText, values);

			// キャッシュクリア
			this.cache.delete(tenantId);

			return result.rows[0];

		} catch (error) {
			console.error(`Zoom設定保存エラー (テナント: ${tenantId}):`, error);
			throw error;
		}
	}

	/**
	 * Zoom設定の削除
	 * @param {string} tenantId - テナントID
	 */
	async deleteZoomSettings(tenantId) {
		try {
			const queryText = `
				UPDATE zoom_tenant_settings 
				SET is_active = false, updated_at = CURRENT_TIMESTAMP
				WHERE tenant_id = $1
			`;
			
			await query(queryText, [tenantId]);

			// キャッシュクリア
			this.cache.delete(tenantId);

		} catch (error) {
			console.error(`Zoom設定削除エラー (テナント: ${tenantId}):`, error);
			throw error;
		}
	}

	/**
	 * 接続テスト
	 * @param {string} tenantId - テナントID
	 * @returns {Object} テスト結果
	 */
	async testConnection(tenantId) {
		try {
			const credentials = await this.getZoomCredentials(tenantId);
			
			// 簡単なAPI呼び出しでテスト（ユーザー情報取得）
			const testResult = await this.makeTestApiCall(credentials);
			
			return {
				success: true,
				message: 'Zoom API接続成功',
				details: testResult
			};

		} catch (error) {
			return {
				success: false,
				message: 'Zoom API接続失敗',
				error: error.message
			};
		}
	}

	/**
	 * 暗号化関数
	 * @param {string} value - 暗号化する値
	 * @returns {string} 暗号化された値
	 */
	encryptValue(value) {
		if (!value) return value;
		
		const algorithm = 'aes-256-cbc';
		const key = crypto.createHash('sha256').update(this.getEncryptionKey()).digest();
		const iv = crypto.randomBytes(16);
		
		const cipher = crypto.createCipheriv(algorithm, key, iv);
		
		let encrypted = cipher.update(value, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		
		return `${iv.toString('hex')}:${encrypted}`;
	}

	/**
	 * 復号化関数
	 * @param {string} encryptedValue - 暗号化された値
	 * @returns {string} 復号化された値
	 */
	decryptValue(encryptedValue) {
		if (!encryptedValue || !encryptedValue.includes(':')) {
			return encryptedValue; // 暗号化されていない値
		}
		
		try {
			const algorithm = 'aes-256-cbc';
			const key = crypto.createHash('sha256').update(this.getEncryptionKey()).digest();
			const [ivHex, encrypted] = encryptedValue.split(':');
			const iv = Buffer.from(ivHex, 'hex');
			
			const decipher = crypto.createDecipheriv(algorithm, key, iv);
			
			let decrypted = decipher.update(encrypted, 'hex', 'utf8');
			decrypted += decipher.final('utf8');
			
			return decrypted;
		} catch (error) {
			console.error('復号化エラー:', error);
			return encryptedValue; // エラー時は元の値を返す
		}
	}

	/**
	 * 認証情報の復号化
	 * @param {Object} credentials - 暗号化された認証情報
	 * @returns {Object} 復号化された認証情報
	 */
	decryptCredentials(credentials) {
		// PostgreSQL bytea暗号化では、SQLクエリ内で復号化済みのため、そのまま返す
		return {
			zoom_client_id: credentials.zoom_client_id,
			zoom_client_secret: credentials.zoom_client_secret,
			zoom_webhook_secret: credentials.zoom_webhook_secret,
			zoom_account_id: credentials.zoom_account_id
		};
	}

	/**
	 * 暗号化キー取得
	 * @returns {string} 暗号化キー
	 */
	getEncryptionKey() {
		// 環境変数から取得、なければJWT_SECRETを使用
		return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key';
	}

	/**
	 * Zoom Webhook署名検証の実装
	 * @param {string} payload - ペイロード
	 * @param {string} signature - 署名
	 * @param {string} timestamp - タイムスタンプ
	 * @param {string} secret - Webhookシークレット
	 * @returns {boolean} 検証結果
	 */
	verifyZoomWebhookSignature(payload, signature, timestamp, secret) {
		try {
			const message = `v0:${timestamp}:${payload}`;
			const hash = crypto
				.createHmac('sha256', secret)
				.update(message, 'utf8')
				.digest('hex');
			
			const expectedSignature = `v0=${hash}`;
			
			return crypto.timingSafeEqual(
				Buffer.from(signature),
				Buffer.from(expectedSignature)
			);
		} catch (error) {
			console.error('Webhook署名検証エラー:', error);
			return false;
		}
	}

	/**
	 * テスト用API呼び出し
	 * @param {Object} credentials - 認証情報
	 * @returns {Object} API呼び出し結果
	 */
	async makeTestApiCall(credentials) {
		// 実際の実装では、Zoom APIを呼び出してテストする
		// ここではダミーの実装
		return {
			client_id: credentials.zoom_client_id ? 'configured' : 'missing',
			client_secret: credentials.zoom_client_secret ? 'configured' : 'missing',
			webhook_secret: credentials.zoom_webhook_secret ? 'configured' : 'missing',
			account_id: credentials.zoom_account_id || 'not_set'
		};
	}

	/**
	 * キャッシュクリア
	 * @param {string} tenantId - クリアするテナントID（指定なしで全削除）
	 */
	clearCache(tenantId = null) {
		if (tenantId) {
			this.cache.delete(tenantId);
		} else {
			this.cache.clear();
		}
	}
}

// シングルトンインスタンス
const tenantZoomService = new TenantZoomService();

module.exports = tenantZoomService;