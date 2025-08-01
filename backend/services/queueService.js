const Bull = require('bull');
const redis = require('redis');

class QueueService {
	constructor() {
		// Redis接続設定（環境別）
		let redisConfig;
		
		if (process.env.REDIS_URL) {
			// 本番環境（PM2）: REDIS_URL使用
			redisConfig = process.env.REDIS_URL;
			console.log('QueueService: 本番環境Redis設定を使用 (REDIS_URL)');
		} else {
			// 開発環境（Docker）: 個別設定使用
			redisConfig = {
				redis: {
					port: process.env.REDIS_PORT || 6379,
					host: process.env.REDIS_HOST || 'redis',
					password: process.env.REDIS_PASSWORD || null,
					db: 0,
					maxRetriesPerRequest: 3,
					retryDelayOnFailover: 1000,
					enableReadyCheck: true,
					connectTimeout: 15000,
					commandTimeout: 8000,
					lazyConnect: false,
					enableOfflineQueue: true,
					keepAlive: 30000,
					family: 4
				}
			};
			console.log('QueueService: 開発環境Redis設定を使用 (個別設定)');
		}
		
		this.redisConfig = redisConfig;

		// キューを初期化
		this.transcriptQueue = new Bull('transcript processing', this.redisConfig);
		this.emailQueue = new Bull('email sending', this.redisConfig);
		this.distributionQueue = new Bull('distribution processing', this.redisConfig);

		console.log('Queue Service initialized');
	}

	/**
	 * 議事録生成ジョブをキューに追加
	 * @param {Object} jobData - ジョブデータ
	 * @returns {Promise<Object>} ジョブ情報
	 */
	async addTranscriptJob(jobData) {
		try {
			const job = await this.transcriptQueue.add('generate-transcript', jobData, {
				attempts: 3, // 最大3回再試行
				backoff: {
					type: 'exponential',
					delay: 5000, // 5秒から指数関数的に増加
				},
				removeOnComplete: 50, // 完了したジョブを50件まで保持
				removeOnFail: 100, // 失敗したジョブを100件まで保持
			});

			console.log(`議事録生成ジョブを追加しました: ${job.id}`);
			return job;

		} catch (error) {
			console.error('議事録生成ジョブ追加エラー:', error);
			throw new Error(`ジョブ追加に失敗しました: ${error.message}`);
		}
	}

	/**
	 * メール送信ジョブをキューに追加
	 * @param {Object} emailData - メールデータ
	 * @returns {Promise<Object>} ジョブ情報
	 */
	async addEmailJob(emailData) {
		try {
			const job = await this.emailQueue.add('send-email', emailData, {
				attempts: 5, // メール送信は最大5回再試行
				backoff: {
					type: 'exponential',
					delay: 3000,
				},
				removeOnComplete: 100,
				removeOnFail: 200,
			});

			console.log(`メール送信ジョブを追加しました: ${job.id}`);
			return job;

		} catch (error) {
			console.error('メール送信ジョブ追加エラー:', error);
			throw new Error(`メールジョブ追加に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 配布処理ジョブをキューに追加
	 * @param {Object} distributionData - 配布データ
	 * @returns {Promise<Object>} ジョブ情報
	 */
	async addDistributionJob(distributionData) {
		try {
			const job = await this.distributionQueue.add('distribute-transcript', distributionData, {
				attempts: 3,
				backoff: {
					type: 'fixed',
					delay: 10000, // 10秒固定
				},
				removeOnComplete: 50,
				removeOnFail: 100,
			});

			console.log(`配布処理ジョブを追加しました: ${job.id}`);
			return job;

		} catch (error) {
			console.error('配布処理ジョブ追加エラー:', error);
			throw new Error(`配布ジョブ追加に失敗しました: ${error.message}`);
		}
	}

	/**
	 * キューの統計情報を取得
	 * @returns {Promise<Object>} 統計情報
	 */
	async getQueueStats() {
		try {
			const transcriptStats = await this.getQueueStatistics(this.transcriptQueue);
			const emailStats = await this.getQueueStatistics(this.emailQueue);
			const distributionStats = await this.getQueueStatistics(this.distributionQueue);

			return {
				transcript: transcriptStats,
				email: emailStats,
				distribution: distributionStats,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error('キュー統計取得エラー:', error);
			throw new Error(`統計情報取得に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 個別キューの統計を取得
	 * @param {Bull.Queue} queue - Bullキューインスタンス
	 * @returns {Promise<Object>} キュー統計
	 */
	async getQueueStatistics(queue) {
		const waiting = await queue.getWaiting();
		const active = await queue.getActive();
		const completed = await queue.getCompleted();
		const failed = await queue.getFailed();
		const delayed = await queue.getDelayed();

		return {
			waiting: waiting.length,
			active: active.length,
			completed: completed.length,
			failed: failed.length,
			delayed: delayed.length,
			total: waiting.length + active.length + completed.length + failed.length + delayed.length
		};
	}

	/**
	 * 失敗したジョブを再実行
	 * @param {string} queueName - キュー名 ('transcript', 'email', 'distribution')
	 * @param {string} jobId - ジョブID
	 * @returns {Promise<Object>} 再実行結果
	 */
	async retryFailedJob(queueName, jobId) {
		try {
			let queue;
			switch (queueName) {
				case 'transcript':
					queue = this.transcriptQueue;
					break;
				case 'email':
					queue = this.emailQueue;
					break;
				case 'distribution':
					queue = this.distributionQueue;
					break;
				default:
					throw new Error(`不明なキュー名: ${queueName}`);
			}

			const job = await queue.getJob(jobId);
			if (!job) {
				throw new Error(`ジョブが見つかりません: ${jobId}`);
			}

			await job.retry();
			console.log(`ジョブを再実行しました: ${queueName}/${jobId}`);

			return {
				success: true,
				message: `ジョブ ${jobId} を再実行しました`,
				queue: queueName
			};

		} catch (error) {
			console.error('ジョブ再実行エラー:', error);
			throw new Error(`ジョブ再実行に失敗しました: ${error.message}`);
		}
	}

	/**
	 * キューをクリア（開発・テスト用）
	 * @param {string} queueName - キュー名
	 * @returns {Promise<void>}
	 */
	async clearQueue(queueName) {
		try {
			let queue;
			switch (queueName) {
				case 'transcript':
					queue = this.transcriptQueue;
					break;
				case 'email':
					queue = this.emailQueue;
					break;
				case 'distribution':
					queue = this.distributionQueue;
					break;
				case 'all':
					await this.transcriptQueue.clean(0, 'completed');
					await this.transcriptQueue.clean(0, 'failed');
					await this.emailQueue.clean(0, 'completed');
					await this.emailQueue.clean(0, 'failed');
					await this.distributionQueue.clean(0, 'completed');
					await this.distributionQueue.clean(0, 'failed');
					console.log('全キューをクリアしました');
					return;
				default:
					throw new Error(`不明なキュー名: ${queueName}`);
			}

			await queue.clean(0, 'completed');
			await queue.clean(0, 'failed');
			console.log(`キューをクリアしました: ${queueName}`);

		} catch (error) {
			console.error('キュークリアエラー:', error);
			throw new Error(`キュークリアに失敗しました: ${error.message}`);
		}
	}

	/**
	 * ジョブの詳細情報を取得
	 * @param {string} queueName - キュー名
	 * @param {string} jobId - ジョブID
	 * @returns {Promise<Object>} ジョブ詳細
	 */
	async getJobDetails(queueName, jobId) {
		try {
			let queue;
			switch (queueName) {
				case 'transcript':
					queue = this.transcriptQueue;
					break;
				case 'email':
					queue = this.emailQueue;
					break;
				case 'distribution':
					queue = this.distributionQueue;
					break;
				default:
					throw new Error(`不明なキュー名: ${queueName}`);
			}

			const job = await queue.getJob(jobId);
			if (!job) {
				throw new Error(`ジョブが見つかりません: ${jobId}`);
			}

			return {
				id: job.id,
				name: job.name,
				data: job.data,
				opts: job.opts,
				progress: job.progress(),
				delay: job.opts.delay,
				timestamp: job.timestamp,
				processedOn: job.processedOn,
				finishedOn: job.finishedOn,
				failedReason: job.failedReason,
				stacktrace: job.stacktrace,
				returnvalue: job.returnvalue,
				attemptsMade: job.attemptsMade,
				attemptsRemaining: job.opts.attempts - job.attemptsMade
			};

		} catch (error) {
			console.error('ジョブ詳細取得エラー:', error);
			throw new Error(`ジョブ詳細取得に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 全キューを停止
	 * @returns {Promise<void>}
	 */
	async shutdown() {
		try {
			await this.transcriptQueue.close();
			await this.emailQueue.close();
			await this.distributionQueue.close();
			console.log('全キューを停止しました');

		} catch (error) {
			console.error('キュー停止エラー:', error);
			throw new Error(`キュー停止に失敗しました: ${error.message}`);
		}
	}
}

module.exports = QueueService;