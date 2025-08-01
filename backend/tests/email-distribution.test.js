const EmailWorker = require('../workers/emailWorker');

// nodemailerをモック
jest.mock('nodemailer');

describe('メール配布品質テスト - デグレード防止', () => {
	let emailWorker;
	let mockTransporter;

	beforeEach(() => {
		// nodemailerのモック設定
		const nodemailer = require('nodemailer');
		mockTransporter = {
			sendMail: jest.fn().mockResolvedValue({
				messageId: 'test-message-id',
				accepted: ['test@example.com'],
				rejected: []
			})
		};
		nodemailer.createTransporter = jest.fn().mockReturnValue(mockTransporter);
		
		// データベースクライアントのモック
		const mockDbClient = {
			query: jest.fn(),
			release: jest.fn()
		};
		
		emailWorker = new EmailWorker();
		emailWorker.pool = {
			connect: jest.fn().mockResolvedValue(mockDbClient)
		};
		
		// コンソールログを抑制
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('HOSTとBCC受信者両方の配布履歴が記録されること', async () => {
		const jobData = {
			transcript_id: 1,
			recipients: ['host@example.com'],
			bccRecipients: ['participant1@example.com', 'participant2@example.com']
		};
		
		const mockJob = { 
			data: jobData,
			progress: jest.fn()
		};
		
		// createDistributionLogメソッドをモック
		emailWorker.createDistributionLog = jest.fn()
			.mockResolvedValueOnce(1) // host用
			.mockResolvedValueOnce(2) // participant1用
			.mockResolvedValueOnce(3); // participant2用
		
		// updateDistributionLogメソッドをモック
		emailWorker.updateDistributionLog = jest.fn();
		
		// emailServiceのモック
		emailWorker.emailService = {
			sendTranscriptEmail: jest.fn().mockResolvedValue({
				success: true,
				messageId: 'test-message-id'
			})
		};
		
		await emailWorker.processEmailSending(mockJob);
		
		// 重要: HOST用の配布ログが作成されること
		expect(emailWorker.createDistributionLog).toHaveBeenCalledWith(
			jobData.transcript_id, 'email', 'host@example.com', 'pending'
		);
		
		// 重要: BCC受信者用の配布ログが作成されること
		expect(emailWorker.createDistributionLog).toHaveBeenCalledWith(
			jobData.transcript_id, 'email', 'participant1@example.com', 'pending'
		);
		expect(emailWorker.createDistributionLog).toHaveBeenCalledWith(
			jobData.transcript_id, 'email', 'participant2@example.com', 'pending'
		);
		
		// デグレード防止: 配布ログが欠けていないこと
		expect(emailWorker.createDistributionLog).toHaveBeenCalledTimes(3);
	});

	test('メール送信成功時に配布ログが正しく更新されること', async () => {
		const jobData = {
			transcript_id: 1,
			recipients: ['host@example.com'],
			bccRecipients: []
		};
		
		const mockJob = { 
			data: jobData,
			progress: jest.fn()
		};
		
		emailWorker.createDistributionLog = jest.fn().mockResolvedValue(1);
		emailWorker.updateDistributionLog = jest.fn();
		emailWorker.emailService = {
			sendTranscriptEmail: jest.fn().mockResolvedValue({
				success: true,
				messageId: 'test-message-id'
			})
		};
		
		await emailWorker.processEmailSending(mockJob);
		
		// 重要: 成功時に配布ログが'sent'ステータスで更新されること
		expect(emailWorker.updateDistributionLog).toHaveBeenCalledWith(1, 'sent', null, 'test-message-id');
	});

	test('メール送信失敗時に配布ログがエラーステータスで更新されること', async () => {
		const jobData = {
			transcript_id: 1,
			recipients: ['host@example.com'],
			bccRecipients: []
		};
		
		const mockJob = { 
			data: jobData,
			progress: jest.fn()
		};
		
		emailWorker.createDistributionLog = jest.fn().mockResolvedValue(1);
		emailWorker.updateDistributionLog = jest.fn();
		emailWorker.getDistributionLogsByTranscriptId = jest.fn().mockResolvedValue([
			{ id: 1, status: 'pending' }
		]);
		emailWorker.emailService = {
			sendTranscriptEmail: jest.fn().mockRejectedValue(new Error('SMTP Error'))
		};
		
		await expect(emailWorker.processEmailSending(mockJob))
			.rejects.toThrow();
		
		// 重要: 失敗時に配布ログが'failed'ステータスで更新されること
		expect(emailWorker.updateDistributionLog).toHaveBeenCalledWith(
			1, 'failed', 'SMTP Error'
		);
	});

	test('配布履歴でBCC受信者が正しく識別されること', async () => {
		const jobData = {
			transcript_id: 1,
			recipients: ['host@example.com'],
			bccRecipients: ['participant@example.com']
		};
		
		const mockJob = { 
			data: jobData,
			progress: jest.fn()
		};
		
		// 配布ログIDを追跡できるようにモック
		let logCallCount = 0;
		emailWorker.createDistributionLog = jest.fn().mockImplementation(() => {
			logCallCount++;
			return Promise.resolve(logCallCount);
		});
		emailWorker.updateDistributionLog = jest.fn();
		emailWorker.emailService = {
			sendTranscriptEmail: jest.fn().mockResolvedValue({
				success: true,
				messageId: 'test-message-id'
			})
		};
		
		await emailWorker.processEmailSending(mockJob);
		
		// デグレード防止: HOST（TO）とBCC受信者が区別されて記録されること
		expect(emailWorker.createDistributionLog).toHaveBeenCalledTimes(2);
		expect(emailWorker.updateDistributionLog).toHaveBeenCalledTimes(2);
	});
});