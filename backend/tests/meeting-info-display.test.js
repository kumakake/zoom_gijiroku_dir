/**
 * 議事録メール表示用会議情報テスト
 * 所要時間と参加者情報の表示問題修正に対するテスト
 */

const TranscriptWorker = require('../workers/transcriptWorker');
const EmailService = require('../services/emailService');

describe('会議情報表示テスト', () => {
	let transcriptWorker;
	let emailService;

	beforeEach(() => {
		transcriptWorker = new TranscriptWorker();
		emailService = new EmailService();
		
		// コンソールログをモック化
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('extractMeetingInfo関数テスト', () => {
		test('録画データから所要時間を正しく計算する', () => {
			const meetingData = {
				meeting_id: '123456789',
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 45, // 45分
				host_email: 'host@example.com'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.duration).toBe(45);
			expect(result.zoom_meeting_id).toBe('123456789');
			expect(result.topic).toBe('テスト会議');
		});

		test('開始・終了時刻から所要時間を計算する', () => {
			const meetingData = {
				meeting_id: '123456789',
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				end_time: '2025-07-21T10:30:00Z', // 30分後
				host_email: 'host@example.com'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.duration).toBe(30); // 30分
		});

		test('participants配列を正しく処理する', () => {
			const meetingData = {
				meeting_id: '123456789',
				participants: [
					{ user_name: '田中太郎', email: 'tanaka@example.com' },
					{ user_name: '佐藤花子', email: 'sato@example.com' }
				],
				host_email: 'host@example.com'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.participants).toHaveLength(2);
			expect(result.participants[0].name).toBe('田中太郎');
			expect(result.participants[0].email).toBe('tanaka@example.com');
			expect(result.participants[1].name).toBe('佐藤花子');
		});

		test('単一participant（Webhook形式）を正しく処理する', () => {
			const meetingData = {
				meeting_id: '123456789',
				participant: {
					user_name: '上辻としゆき',
					email: 'kamitsuji@example.com'
				},
				host_email: 'host@example.com'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.participants).toHaveLength(1);
			expect(result.participants[0].name).toBe('上辻としゆき');
			expect(result.participants[0].email).toBe('kamitsuji@example.com');
		});

		test('参加者情報がない場合は空配列を返す', () => {
			const meetingData = {
				meeting_id: '123456789',
				topic: 'テスト会議',
				host_email: 'host@example.com'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.participants).toEqual([]);
		});

		test('object形式のデータ構造を正しく処理する', () => {
			const meetingData = {
				object: {
					id: '987654321',
					topic: 'Zoom API会議',
					start_time: '2025-07-21T14:00:00Z',
					duration: 60,
					host_email: 'api@example.com'
				}
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);

			expect(result.zoom_meeting_id).toBe('987654321');
			expect(result.topic).toBe('Zoom API会議');
			expect(result.duration).toBe(60);
		});
	});

	describe('EmailService表示テスト', () => {
		test('所要時間が正しく表示される', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容',
				summary: 'テスト要約'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 45, // 45分
				participants: [
					{ name: '田中太郎', email: 'tanaka@example.com' }
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// HTML内容をチェック
			expect(result.html).toContain('所要時間:</strong> 45分');
			// テキスト内容をチェック
			expect(result.text).toContain('所要時間: 45分');
		});

		test('所要時間が不明の場合は「不明」と表示される', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: null, // 不明
				participants: []
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			expect(result.html).toContain('所要時間:</strong> 不明');
			expect(result.text).toContain('所要時間: 不明');
		});

		test('参加者名が正しく表示される', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' },
					{ name: '田中太郎', email: 'tanaka@example.com' }
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// HTML内容をチェック
			expect(result.html).toContain('参加者:</strong> 上辻としゆき, 田中太郎');
			// テキスト内容をチェック
			expect(result.text).toContain('参加者: 上辻としゆき, 田中太郎');
		});

		test('参加者情報が空の場合は「不明」と表示される', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: []
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			expect(result.html).toContain('参加者:</strong> 不明');
			expect(result.text).toContain('参加者: 不明');
		});

		test('参加者にUnknownが含まれている場合はフィルタリングされる', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: [
					{ name: '上辻としゆき', email: null },
					{ name: 'Unknown', email: null },
					{ name: '田中太郎', email: 'tanaka@example.com' }
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// Unknownはフィルタリングされる
			expect(result.html).toContain('参加者:</strong> 上辻としゆき, 田中太郎');
			expect(result.html).not.toContain('Unknown');
		});

		test('emailフォールバック処理が動作する', () => {
			const transcript = {
				formatted_transcript: 'テスト議事録内容'
			};

			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: [
					{ name: null, email: 'test@example.com' }, // nameがnullでemailのみ
					{ name: '', email: 'test2@example.com' } // nameが空文字列
				]
			};

			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// emailがフォールバックで使用される
			expect(result.html).toContain('参加者:</strong> test@example.com, test2@example.com');
		});
	});

	describe('デグレード防止テスト', () => {
		test('以前の問題：参加者が「不明」になる問題が修正されている', () => {
			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 30,
				participants: [
					{ name: '上辻としゆき', email: null, source: 'vtt' }
				]
			};

			const transcript = { formatted_transcript: 'テスト内容' };
			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 「不明」ではなく実際の名前が表示される
			expect(result.html).toContain('上辻としゆき');
			expect(result.html).not.toContain('参加者:</strong> 不明');
		});

		test('以前の問題：所要時間が「不明」になる問題が修正されている', () => {
			const meetingInfo = {
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 2, // 録画データから取得された時間
				participants: []
			};

			const transcript = { formatted_transcript: 'テスト内容' };
			const result = emailService.generateTranscriptEmailContent(transcript, meetingInfo);

			// 「不明」ではなく実際の時間が表示される
			expect(result.html).toContain('所要時間:</strong> 2分');
			expect(result.html).not.toContain('所要時間:</strong> 不明');
		});

		test('参加者配列の構造が正しく処理される（以前のバグ）', () => {
			// 以前は participant: [meeting.participant] という構造でバグがあった
			const oldBuggyData = {
				meeting_id: '123456789',
				participant: { user_name: '上辻としゆき' } // 単一オブジェクト
			};

			const result = transcriptWorker.extractMeetingInfo(oldBuggyData);

			// 正しく配列として処理される
			expect(Array.isArray(result.participants)).toBe(true);
			expect(result.participants).toHaveLength(1);
			expect(result.participants[0].name).toBe('上辻としゆき');
		});
	});

	describe('エッジケーステスト', () => {
		test('空のmeetingDataでもエラーにならない', () => {
			const meetingData = {};

			expect(() => {
				transcriptWorker.extractMeetingInfo(meetingData);
			}).not.toThrow();
		});

		test('不正な日時形式でもエラーにならない', () => {
			const meetingData = {
				meeting_id: '123456789',
				start_time: 'invalid-date',
				end_time: 'another-invalid-date'
			};

			expect(() => {
				transcriptWorker.extractMeetingInfo(meetingData);
			}).not.toThrow();
		});

		test('participantsが文字列の場合も処理される', () => {
			const meetingData = {
				meeting_id: '123456789',
				participants: 'invalid-participants-data'
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);
			expect(result.participants).toEqual([]);
		});

		test('非常に大きな所要時間も正しく処理される', () => {
			const meetingData = {
				meeting_id: '123456789',
				duration: 9999 // 非常に長い会議
			};

			const result = transcriptWorker.extractMeetingInfo(meetingData);
			expect(result.duration).toBe(9999);

			const transcript = { formatted_transcript: 'テスト' };
			const emailResult = emailService.generateTranscriptEmailContent(transcript, result);
			expect(emailResult.html).toContain('所要時間:</strong> 9999分');
		});
	});
});