const Bull = require('bull');
const { Pool } = require('pg');
const EmailService = require('../services/emailService');

class EmailWorker {
	constructor() {
		// データベース接続
		this.db = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		// メールサービス初期化
		this.emailService = new EmailService();

		// Redis設定
		this.redisConfig = {
			redis: {
				port: process.env.REDIS_PORT || 6379,
				host: process.env.REDIS_HOST || 'redis',
				password: process.env.REDIS_PASSWORD || null,
				db: 0,
			}
		};

		// メールキュー初期化
		this.emailQueue = new Bull('email sending', this.redisConfig);
		this.setupWorkers();

		console.log('Email Worker initialized');
	}

	/**
	 * ワーカーのセットアップ
	 */
	setupWorkers() {
		// メール送信ワーカー
		this.emailQueue.process('send-email', 5, async (job) => {
			return await this.processEmailSending(job);
		});

		// ワーカーイベント処理
		this.emailQueue.on('completed', (job, result) => {
			console.log(`メール送信完了: ${job.id}`, result);
		});

		this.emailQueue.on('failed', (job, err) => {
			console.error(`メール送信失敗: ${job.id}`, err);
		});

		this.emailQueue.on('progress', (job, progress) => {
			console.log(`メール送信進捗: ${job.id} - ${progress}%`);
		});
	}

	/**
	 * メール送信処理
	 * @param {Object} job - Bull ジョブ
	 * @returns {Promise<Object>} 送信結果
	 */
	async processEmailSending(job) {
		const { transcript_id, recipients, bccRecipients = [], distributionMode = 'host_only', transcript, meetingInfo, tenantId } = job.data;
		
		try {
			await job.progress(10);
			console.log(`メール送信開始: 議事録ID ${transcript_id}`);

			// 既に送信済みかチェック
			const existingLogs = await this.getDistributionLogsByTranscriptId(transcript_id, 'sent');
			if (existingLogs.length > 0) {
				console.log(`議事録ID ${transcript_id} は既に送信済みです。スキップします。`);
				return {
					success: true,
					transcript_id: transcript_id,
					message: '既に送信済みのためスキップしました'
				};
			}

			// 配布ログを作成（送信前）
			const distributionLogIds = [];
			
			// To受信者（ホスト）の配布ログを作成
			for (const recipient of recipients) {
				const logId = await this.createDistributionLog(transcript_id, recipient, 'pending', tenantId);
				distributionLogIds.push({ recipient, logId, type: 'to' });
			}
			
			// BCC受信者（参加者）の配布ログを作成
			for (const bccRecipient of bccRecipients) {
				const logId = await this.createDistributionLog(transcript_id, bccRecipient, 'pending', tenantId);
				distributionLogIds.push({ recipient: bccRecipient, logId, type: 'bcc' });
			}

			await job.progress(30);

			// メール送信実行
			const emailResult = await this.emailService.sendTranscriptEmail({
				recipients: recipients,
				bccRecipients: bccRecipients,
				distributionMode: distributionMode,
				transcript: transcript,
				meetingInfo: meetingInfo
			});

			await job.progress(80);

			// 配布ログを更新（送信成功）
			for (const { recipient, logId } of distributionLogIds) {
				await this.updateDistributionLog(logId, 'sent', null);
			}

			await job.progress(100);

			const totalRecipients = recipients.length + bccRecipients.length;
			console.log(`メール送信完了: 議事録ID ${transcript_id}, 受信者: ${totalRecipients}名 (To: ${recipients.length}名, Bcc: ${bccRecipients.length}名)`);

			return {
				success: true,
				transcript_id: transcript_id,
				recipients_count: recipients.length,
				bcc_recipients_count: bccRecipients.length,
				total_recipients_count: totalRecipients,
				message_id: emailResult.messageId,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error(`メール送信エラー: 議事録ID ${transcript_id}`, error);

			// 配布ログを更新（送信失敗）
			try {
				const failedLogs = await this.getDistributionLogsByTranscriptId(transcript_id, 'pending');
				for (const log of failedLogs) {
					await this.updateDistributionLog(log.id, 'failed', error.message);
				}
			} catch (logError) {
				console.error('配布ログ更新エラー:', logError);
			}

			throw error;
		}
	}

	/**
	 * 配布ログを作成
	 * @param {number} transcriptId - 議事録ID
	 * @param {string} recipientEmail - 受信者メールアドレス
	 * @param {string} status - ステータス
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<number>} 配布ログID
	 */
	async createDistributionLog(transcriptId, recipientEmail, status, tenantId) {
		try {
			// transcript_idからtranscript_uuidを取得
			const transcriptQuery = `SELECT transcript_uuid FROM meeting_transcripts WHERE id = $1`;
			const transcriptResult = await this.db.query(transcriptQuery, [transcriptId]);
			
			if (transcriptResult.rows.length === 0) {
				throw new Error(`議事録が見つかりません: ID ${transcriptId}`);
			}
			
			const transcriptUuid = transcriptResult.rows[0].transcript_uuid;
			
			const insertQuery = `
				INSERT INTO distribution_logs (transcript_uuid, recipient_email, status, tenant_id)
				VALUES ($1, $2, $3, $4)
				RETURNING id
			`;
			
			const result = await this.db.query(insertQuery, [transcriptUuid, recipientEmail, status, tenantId]);
			return result.rows[0].id;

		} catch (error) {
			console.error('配布ログ作成エラー:', error);
			throw new Error(`配布ログ作成に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 配布ログを更新
	 * @param {number} logId - 配布ログID
	 * @param {string} status - ステータス
	 * @param {string} errorMessage - エラーメッセージ（オプション）
	 * @returns {Promise<void>}
	 */
	async updateDistributionLog(logId, status, errorMessage = null) {
		try {
			const updateQuery = `
				UPDATE distribution_logs 
				SET status = $1, error_message = $2, sent_at = $3
				WHERE id = $4
			`;
			
			const sentAt = status === 'sent' ? new Date() : null;
			const values = [status, errorMessage, sentAt, logId];
			
			await this.db.query(updateQuery, values);

		} catch (error) {
			console.error('配布ログ更新エラー:', error);
			throw new Error(`配布ログ更新に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 議事録IDで配布ログを取得
	 * @param {number} transcriptId - 議事録ID
	 * @param {string} status - ステータス（オプション）
	 * @returns {Promise<Array>} 配布ログ一覧
	 */
	async getDistributionLogsByTranscriptId(transcriptId, status = null) {
		try {
			// transcript_idからtranscript_uuidを取得
			const transcriptQuery = `SELECT transcript_uuid FROM meeting_transcripts WHERE id = $1`;
			const transcriptResult = await this.db.query(transcriptQuery, [transcriptId]);
			
			if (transcriptResult.rows.length === 0) {
				return [];
			}
			
			const transcriptUuid = transcriptResult.rows[0].transcript_uuid;
			
			let query = 'SELECT * FROM distribution_logs WHERE transcript_uuid = $1';
			const values = [transcriptUuid];
			
			if (status) {
				query += ' AND status = $2';
				values.push(status);
			}
			
			const result = await this.db.query(query, values);
			return result.rows;

		} catch (error) {
			console.error('配布ログ取得エラー:', error);
			return [];
		}
	}

	/**
	 * 失敗したメール送信を再試行
	 * @param {number} transcriptId - 議事録ID
	 * @returns {Promise<Object>} 再送信結果
	 */
	async retryFailedEmails(transcriptId) {
		try {
			// 失敗した配布ログを取得
			const failedLogs = await this.getDistributionLogsByTranscriptId(transcriptId, 'failed');
			
			if (failedLogs.length === 0) {
				return {
					success: true,
					message: '再送信対象のメールがありません',
					retry_count: 0
				};
			}

			// 議事録データを取得
			const transcriptQuery = `
				SELECT mt.*, aj.data 
				FROM meeting_transcripts mt
				JOIN agent_jobs aj ON mt.agent_job_id = aj.id
				WHERE mt.id = $1
			`;
			
			const transcriptResult = await this.db.query(transcriptQuery, [transcriptId]);
			if (transcriptResult.rows.length === 0) {
				throw new Error('議事録が見つかりません');
			}

			const transcriptData = transcriptResult.rows[0];
			const meetingInfo = transcriptData.data;

			// 失敗したメールを再送信
			const recipients = failedLogs.map(log => log.recipient_id);
			
			// 再送信ジョブをキューに追加
			await this.emailQueue.add('send-email', {
				transcript_id: transcriptId,
				recipients: recipients,
				transcript: {
					formatted_transcript: transcriptData.formatted_transcript,
					summary: transcriptData.summary,
					action_items: JSON.parse(transcriptData.action_items || '[]')
				},
				meetingInfo: meetingInfo
			});

			return {
				success: true,
				message: `${recipients.length}件のメールを再送信キューに追加しました`,
				retry_count: recipients.length
			};

		} catch (error) {
			console.error('メール再送信エラー:', error);
			throw new Error(`メール再送信に失敗しました: ${error.message}`);
		}
	}

	/**
	 * メール送信統計を取得
	 * @param {Date} startDate - 開始日
	 * @param {Date} endDate - 終了日
	 * @returns {Promise<Object>} 統計情報
	 */
	async getEmailStats(startDate, endDate) {
		try {
			const statsQuery = `
				SELECT 
					status,
					COUNT(*) as count,
					COUNT(DISTINCT transcript_id) as unique_transcripts
				FROM distribution_logs 
				WHERE recipient_type = 'email'
				AND created_at BETWEEN $1 AND $2
				GROUP BY status
			`;
			
			const result = await this.db.query(statsQuery, [startDate, endDate]);
			
			const stats = {
				total: 0,
				sent: 0,
				failed: 0,
				pending: 0,
				unique_transcripts: 0
			};

			result.rows.forEach(row => {
				stats[row.status] = parseInt(row.count);
				stats.total += parseInt(row.count);
				if (row.status === 'sent') {
					stats.unique_transcripts = parseInt(row.unique_transcripts);
				}
			});

			return stats;

		} catch (error) {
			console.error('メール統計取得エラー:', error);
			throw new Error(`統計取得に失敗しました: ${error.message}`);
		}
	}

	/**
	 * ワーカーを停止
	 * @returns {Promise<void>}
	 */
	async shutdown() {
		try {
			await this.emailQueue.close();
			await this.db.end();
			console.log('Email Worker停止しました');

		} catch (error) {
			console.error('Email Worker停止エラー:', error);
		}
	}
}

// ワーカーを開始
const worker = new EmailWorker();

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
	console.log('SIGINTを受信しました。Email Workerを停止します...');
	await worker.shutdown();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('SIGTERMを受信しました。Email Workerを停止します...');
	await worker.shutdown();
	process.exit(0);
});

module.exports = EmailWorker;