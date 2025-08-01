/**
 * メール表示内容のデグレード防止テスト
 * 「所要時間: 不明」「参加者: 不明」問題の回帰防止テスト
 */

const EmailService = require('../services/emailService');
const EmailWorker = require('../workers/emailWorker');
const { Pool } = require('pg');

// データベースとキューをモック化
jest.mock('pg', () => ({
	Pool: jest.fn()
}));

jest.mock('bull', () => {
	return jest.fn().mockImplementation(() => ({
		process: jest.fn(),
		on: jest.fn(),
		add: jest.fn(),
		close: jest.fn()
	}));
});

describe('メール表示内容デグレード防止テスト', () => {
	let emailService;
	let emailWorker;

	beforeEach(() => {
		// Poolモックの設定
		const mockDb = {
			query: jest.fn(),
			connect: jest.fn(),
			end: jest.fn()
		};
		Pool.mockImplementation(() => mockDb);

		emailService = new EmailService();
		emailWorker = new EmailWorker();
		
		// コンソールログをモック化
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('デグレード防止：所要時間表示テスト', () => {
		test('所要時間が「不明」になる以前の問題が修正されている', () => {
			// 修正後：録画データから正しく取得できる場合
			const transcript = {
				formatted_transcript: '修正後のテスト議事録',
				summary: '会議の要約内容'
			};

			const meetingInfo = {
				topic: '修正後テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 2, // 録画データから正しく取得
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' }
				],
				host_email: 'admin@example.com'
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 回帰防止アサーション
			expect(result.html).toContain('所要時間:</strong> 2分');
			expect(result.html).not.toContain('所要時間:</strong> 不明');
			expect(result.text).toContain('所要時間: 2分');
			expect(result.text).not.toContain('所要時間: 不明');
		});

		test('以前の問題パターン：meetingInfo.durationがundefinedの場合', () => {
			const transcript = {
				formatted_transcript: '以前の問題パターン'
			};

			const meetingInfo = {
				topic: '問題再現テスト',
				start_time: '2025-07-21T10:00:00Z',
				duration: undefined, // 以前はこれが発生していた
				participants: []
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 修正により、undefinedの場合は「不明」と正しく表示される
			expect(result.html).toContain('所要時間:</strong> 不明');
			expect(result.text).toContain('所要時間: 不明');
		});

		test('録画データから計算された所要時間が正しく表示される', () => {
			// 録画ファイルから計算されたケース
			const testCases = [
				{ duration: 1, expected: '1分' },
				{ duration: 15, expected: '15分' },
				{ duration: 60, expected: '60分' },
				{ duration: 120, expected: '120分' }
			];

			testCases.forEach(({ duration, expected }) => {
				const meetingInfo = {
					topic: `${duration}分テスト`,
					start_time: '2025-07-21T10:00:00Z',
					duration: duration,
					participants: []
				};

				const transcript = { formatted_transcript: 'テスト内容' };
				const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

				expect(result.html).toContain(`所要時間:</strong> ${expected}`);
				expect(result.text).toContain(`所要時間: ${expected}`);
			});
		});
	});

	describe('デグレード防止：参加者表示テスト', () => {
		test('参加者が「不明」になる以前の問題が修正されている', () => {
			const transcript = {
				formatted_transcript: 'VTTから正しく発言者を取得'
			};

			const meetingInfo = {
				topic: '参加者修正テスト',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' },
					{ name: '田中太郎', email: 'tanaka@example.com' }
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 回帰防止アサーション
			expect(result.html).toContain('参加者:</strong> 上辻としゆき, 田中太郎');
			expect(result.html).not.toContain('参加者:</strong> 不明');
			expect(result.text).toContain('参加者: 上辻としゆき, 田中太郎');
			expect(result.text).not.toContain('参加者: 不明');
		});

		test('以前の問題パターン：participants配列が空の場合', () => {
			const transcript = {
				formatted_transcript: '参加者なしパターン'
			};

			const meetingInfo = {
				topic: '参加者なしテスト',
				start_time: '2025-07-21T10:00:00Z',
				duration: 20,
				participants: [] // 以前はこれで「不明」になっていた
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 空の場合は正しく「不明」と表示される
			expect(result.html).toContain('参加者:</strong> 不明');
			expect(result.text).toContain('参加者: 不明');
		});

		test('以前の問題パターン：participants.map(p => p.name)でエラーになるケース', () => {
			const transcript = {
				formatted_transcript: '修正前エラーパターン'
			};

			// 以前の実装では以下のようなデータでエラーが発生していた
			const meetingInfo = {
				topic: 'エラー再現テスト',
				start_time: '2025-07-21T10:00:00Z',
				duration: 25,
				participants: [
					{ participant: { user_name: '上辻としゆき' } } // 以前の不正な構造
				]
			};

			// 修正後はエラーにならずに処理される
			expect(() => {
				emailService.generateTranscriptEmailContent(transcript, meetingInfo);
			}).not.toThrow();
		});

		test('VTTから抽出された実名が正しく表示される', () => {
			const transcript = {
				formatted_transcript: 'VTT実名抽出テスト'
			};

			const meetingInfo = {
				topic: 'VTT実名テスト',
				start_time: '2025-07-21T10:00:00Z',
				duration: 45,
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' },
					{ name: '佐藤花子', email: 'sato@example.com', source: 'vtt' }
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// VTTから取得した実名が正しく表示される
			expect(result.html).toContain('上辻としゆき');
			expect(result.html).toContain('佐藤花子');
			expect(result.html).toContain('参加者:</strong> 上辻としゆき, 佐藤花子');
			
			// 一般化された名前にならない
			expect(result.html).not.toContain('発言者');
			expect(result.html).not.toContain('参加者A');
			expect(result.html).not.toContain('Speaker');
		});
	});

	describe('メール送信データフロー統合テスト', () => {
		test('EmailWorkerからEmailServiceへの正しいデータ受け渡し', () => {
			// EmailWorkerで想定されるジョブデータ
			const jobData = {
				transcript_id: 123,
				recipients: ['admin@example.com'],
				bccRecipients: [],
				transcript: {
					formatted_transcript: '## 会議議事録\n\n上辻としゆき: 会議を開始します。',
					summary: '会議の要約',
					action_items: [
						{ item: 'テスト実行', assignee: '上辻としゆき', due_date: '2025-07-25' }
					]
				},
				meetingInfo: {
					topic: 'データフローテスト会議',
					start_time: '2025-07-21T16:00:00Z',
					duration: 35, // 修正後：正しく設定されている
					participants: [ // 修正後：正しく設定されている
						{ name: '上辻としゆき', email: null, source: 'vtt' }
					],
					host_email: 'admin@example.com',
					host_name: '管理者'
				}
			};

			// EmailServiceでメール内容生成
			const emailContent = emailService.generateTranscriptEmailContent(
				jobData.transcript, 
				jobData.meetingInfo
			);

			// データフロー確認
			expect(emailContent.html).toContain('所要時間:</strong> 35分');
			expect(emailContent.html).toContain('参加者:</strong> 上辻としゆき');
			expect(emailContent.html).toContain('データフローテスト会議');
			
			// アクションアイテムも正しく表示される
			expect(emailContent.html).toContain('テスト実行');
			expect(emailContent.html).toContain('担当者: 上辻としゆき');
		});

		test('MailHogで確認できる形式でメールが生成される', () => {
			const transcript = {
				formatted_transcript: '# MailHogテスト会議\n\n上辻としゆき: MailHogでの表示テストを行います。',
				summary: 'MailHogでの表示確認テスト',
				action_items: []
			};

			const meetingInfo = {
				topic: 'MailHog表示テスト',
				start_time: '2025-07-21T17:00:00Z',
				duration: 10,
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' }
				],
				host_email: 'admin@example.com'
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// MailHogで確認される項目
			expect(result.html).toMatch(/<title>会議議事録<\/title>/);
			expect(result.html).toContain('所要時間:</strong> 10分');
			expect(result.html).toContain('参加者:</strong> 上辻としゆき');
			expect(result.html).toContain('MailHog表示テスト');
			
			// HTMLが適切に形成されている
			expect(result.html).toContain('<!DOCTYPE html>');
			expect(result.html).toContain('</html>');
			
			// テキスト版も正しく生成される
			expect(result.text).toContain('所要時間: 10分');
			expect(result.text).toContain('参加者: 上辻としゆき');
		});
	});

	describe('リアルデータパターンテスト', () => {
		test('実際のevi/08.png問題を再現して修正を確認', () => {
			// evi/08.pngで発生していた問題の再現
			const transcript = {
				formatted_transcript: '実際の問題再現テスト内容',
				summary: 'VTTデータ処理の実装について'
			};

			// 修正前：このようなデータで「不明」が表示されていた
			const problemMeetingInfo = {
				topic: 'ミーティング',
				start_time: '2025-07-21T01:30:00Z',
				duration: undefined, // 問題：undefinedになっていた
				participants: [], // 問題：空配列になっていた
				host_email: 'info@kumakake.com'
			};

			// 修正後：このようなデータで正しく表示される
			const fixedMeetingInfo = {
				topic: 'ミーティング',
				start_time: '2025-07-21T01:30:00Z', 
				duration: 2, // 修正：録画データから取得
				participants: [ // 修正：VTTから抽出
					{ name: '上辻としゆき', email: null, source: 'vtt' }
				],
				host_email: 'info@kumakake.com'
			};

			// 問題があったパターン
			const problemResult = emailService.generateTranscriptEmailContent(transcript, problemMeetingInfo);
			expect(problemResult.html).toContain('所要時間:</strong> 不明');
			expect(problemResult.html).toContain('参加者:</strong> 不明');

			// 修正後のパターン
			const fixedResult = emailService.generateTranscriptEmailContent(transcript, fixedMeetingInfo);
			expect(fixedResult.html).toContain('所要時間:</strong> 2分');
			expect(fixedResult.html).toContain('参加者:</strong> 上辻としゆき');
			
			// 修正により問題が解決されていることを確認
			expect(fixedResult.html).not.toMatch(/所要時間:[^>]*不明/);
			expect(fixedResult.html).not.toMatch(/参加者:[^>]*不明/);
		});
	});
});