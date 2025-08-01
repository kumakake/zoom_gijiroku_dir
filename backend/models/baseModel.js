/**
 * テナント対応ベースモデル
 * 
 * 全てのデータアクセスでテナント制限を自動的に適用する
 */

const { query } = require('../utils/database');

class BaseModel {
	constructor(tableName) {
		this.tableName = tableName;
	}

	/**
	 * テナント制限付きクエリ
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 検索条件
	 * @param {Object} options - オプション（limit, offset, orderBy等）
	 * @returns {Array} 検索結果
	 */
	async findByTenant(tenantId, conditions = {}, options = {}) {
		const {
			limit = null,
			offset = null,
			orderBy = 'created_at DESC',
			select = '*'
		} = options;

		// WHERE句構築
		const whereConditions = ['tenant_id = $1'];
		const values = [tenantId];
		let paramIndex = 2;

		Object.entries(conditions).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					// IN句
					const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
					whereConditions.push(`${key} IN (${placeholders})`);
					values.push(...value);
				} else if (typeof value === 'object' && value.operator) {
					// カスタム演算子（LIKE、>=等）
					whereConditions.push(`${key} ${value.operator} $${paramIndex++}`);
					values.push(value.value);
				} else {
					// 等価条件
					whereConditions.push(`${key} = $${paramIndex++}`);
					values.push(value);
				}
			}
		});

		// クエリ構築
		let queryText = `
			SELECT ${select} FROM ${this.tableName} 
			WHERE ${whereConditions.join(' AND ')}
			ORDER BY ${orderBy}
		`;

		if (limit) {
			queryText += ` LIMIT ${limit}`;
		}
		if (offset) {
			queryText += ` OFFSET ${offset}`;
		}

		try {
			const result = await query(queryText, values);
			return result.rows;
		} catch (error) {
			console.error(`findByTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * テナント制限付き単件取得
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 検索条件
	 * @returns {Object|null} 検索結果
	 */
	async findOneByTenant(tenantId, conditions) {
		const results = await this.findByTenant(tenantId, conditions, { limit: 1 });
		return results.length > 0 ? results[0] : null;
	}

	/**
	 * テナント制限付き作成
	 * @param {string} tenantId - テナントID
	 * @param {Object} data - 作成データ
	 * @returns {Object} 作成結果
	 */
	async createWithTenant(tenantId, data) {
		const fields = Object.keys(data);
		const values = Object.values(data);
		
		// tenant_idを自動追加
		fields.unshift('tenant_id');
		values.unshift(tenantId);

		const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

		const queryText = `
			INSERT INTO ${this.tableName} (${fields.join(', ')})
			VALUES (${placeholders})
			RETURNING *
		`;

		try {
			const result = await query(queryText, values);
			return result.rows[0];
		} catch (error) {
			console.error(`createWithTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * テナント制限付き更新
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 更新条件
	 * @param {Object} data - 更新データ
	 * @returns {Array} 更新結果
	 */
	async updateByTenant(tenantId, conditions, data) {
		const updateFields = Object.keys(data);
		const updateValues = Object.values(data);
		
		// SET句構築
		const setClause = updateFields.map((field, i) => `${field} = $${i + 2}`).join(', ');
		
		// WHERE句構築（tenant_id制限を含む）
		const whereConditions = ['tenant_id = $1'];
		const values = [tenantId, ...updateValues];
		let paramIndex = updateValues.length + 2;

		Object.entries(conditions).forEach(([key, value]) => {
			whereConditions.push(`${key} = $${paramIndex++}`);
			values.push(value);
		});

		// updated_atを自動更新
		const queryText = `
			UPDATE ${this.tableName} 
			SET ${setClause}, updated_at = CURRENT_TIMESTAMP
			WHERE ${whereConditions.join(' AND ')}
			RETURNING *
		`;

		try {
			const result = await query(queryText, values);
			return result.rows;
		} catch (error) {
			console.error(`updateByTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * テナント制限付き削除
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 削除条件
	 * @returns {Array} 削除結果
	 */
	async deleteByTenant(tenantId, conditions) {
		const whereConditions = ['tenant_id = $1'];
		const values = [tenantId];
		let paramIndex = 2;

		Object.entries(conditions).forEach(([key, value]) => {
			whereConditions.push(`${key} = $${paramIndex++}`);
			values.push(value);
		});

		const queryText = `
			DELETE FROM ${this.tableName}
			WHERE ${whereConditions.join(' AND ')}
			RETURNING *
		`;

		try {
			const result = await query(queryText, values);
			return result.rows;
		} catch (error) {
			console.error(`deleteByTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * テナント制限付きカウント
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 検索条件
	 * @returns {number} 件数
	 */
	async countByTenant(tenantId, conditions = {}) {
		const whereConditions = ['tenant_id = $1'];
		const values = [tenantId];
		let paramIndex = 2;

		Object.entries(conditions).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				whereConditions.push(`${key} = $${paramIndex++}`);
				values.push(value);
			}
		});

		const queryText = `
			SELECT COUNT(*) as count FROM ${this.tableName}
			WHERE ${whereConditions.join(' AND ')}
		`;

		try {
			const result = await query(queryText, values);
			return parseInt(result.rows[0].count);
		} catch (error) {
			console.error(`countByTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * テナント制限付き存在確認
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 検索条件
	 * @returns {boolean} 存在するかどうか
	 */
	async existsByTenant(tenantId, conditions) {
		const count = await this.countByTenant(tenantId, conditions);
		return count > 0;
	}

	/**
	 * テナント別統計情報取得
	 * @param {string} tenantId - テナントID
	 * @param {string} groupBy - グループ化フィールド
	 * @param {string} countField - カウント対象フィールド
	 * @returns {Array} 統計結果
	 */
	async getStatsByTenant(tenantId, groupBy = null, countField = '*') {
		let queryText;
		const values = [tenantId];

		if (groupBy) {
			queryText = `
				SELECT ${groupBy}, COUNT(${countField}) as count
				FROM ${this.tableName}
				WHERE tenant_id = $1
				GROUP BY ${groupBy}
				ORDER BY count DESC
			`;
		} else {
			queryText = `
				SELECT COUNT(${countField}) as total_count
				FROM ${this.tableName}
				WHERE tenant_id = $1
			`;
		}

		try {
			const result = await query(queryText, values);
			return result.rows;
		} catch (error) {
			console.error(`getStatsByTenant error in ${this.tableName}:`, error);
			throw error;
		}
	}

	/**
	 * バッチ挿入（テナント制限付き）
	 * @param {string} tenantId - テナントID
	 * @param {Array} dataArray - 挿入データの配列
	 * @returns {Array} 挿入結果
	 */
	async batchCreateWithTenant(tenantId, dataArray) {
		if (!dataArray || dataArray.length === 0) {
			return [];
		}

		const { pool } = require('../utils/database');
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			const results = [];
			for (const data of dataArray) {
				const result = await this.createWithTenant(tenantId, data);
				results.push(result);
			}

			await client.query('COMMIT');
			return results;

		} catch (error) {
			await client.query('ROLLBACK');
			console.error(`batchCreateWithTenant error in ${this.tableName}:`, error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * ページネーション付き検索
	 * @param {string} tenantId - テナントID
	 * @param {Object} conditions - 検索条件
	 * @param {number} page - ページ番号（1から開始）
	 * @param {number} limit - 1ページあたりの件数
	 * @returns {Object} ページネーション結果
	 */
	async findByTenantWithPagination(tenantId, conditions = {}, page = 1, limit = 20) {
		const offset = (page - 1) * limit;
		
		// データ取得
		const data = await this.findByTenant(tenantId, conditions, { 
			limit, 
			offset,
			orderBy: 'created_at DESC'
		});

		// 総件数取得
		const totalCount = await this.countByTenant(tenantId, conditions);
		const totalPages = Math.ceil(totalCount / limit);

		return {
			data,
			pagination: {
				currentPage: page,
				totalPages,
				totalCount,
				limit,
				hasNext: page < totalPages,
				hasPrev: page > 1
			}
		};
	}
}

module.exports = BaseModel;