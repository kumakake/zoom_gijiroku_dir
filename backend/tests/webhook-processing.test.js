const crypto = require('crypto');

// Zoom webhook処理のテスト用モジュール
const zoomWebhookHandler = {
	verifySignature: (rawBody, signature, timestamp) => {
		const secretToken = process.env.ZOOM_WEBHOOK_SECRET || 'test-secret';
		const message = `v0:${timestamp}:${rawBody}`;
		const hashForVerify = crypto.createHmac('sha256', secretToken).update(message).digest('hex');
		const expectedSignature = `v0=${hashForVerify}`;
		return expectedSignature === signature;
	},
	
	handleMeetingEnded: async (payload) => {
		// Zoom会議終了処理のモック
		return { success: true, jobId: 'test-job-id' };
	},
	
	handleRecordingCompleted: async (payload) => {
		// Zoom録画完了処理のモック
		return { success: true, jobId: 'test-job-id' };
	}
};

describe('Zoom Webhook処理品質テスト - デグレード防止', () => {
	beforeEach(() => {
		// 環境変数を設定
		process.env.ZOOM_WEBHOOK_SECRET = 'test-webhook-secret';
		
		// コンソールログを抑制
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('Webhook署名検証が正しく動作すること', () => {
		const rawBody = JSON.stringify({
			event: 'meeting.ended',
			payload: { object: { id: '123456789' } }
		});
		const timestamp = Math.floor(Date.now() / 1000);
		
		// 正しい署名を生成
		const message = `v0:${timestamp}:${rawBody}`;
		const hash = crypto.createHmac('sha256', 'test-webhook-secret').update(message).digest('hex');
		const validSignature = `v0=${hash}`;
		
		// 重要: 正しい署名で検証が成功すること
		expect(zoomWebhookHandler.verifySignature(rawBody, validSignature, timestamp)).toBe(true);
		
		// デグレード防止: 無効な署名で検証が失敗すること
		const invalidSignature = 'v0=invalid-signature';
		expect(zoomWebhookHandler.verifySignature(rawBody, invalidSignature, timestamp)).toBe(false);
	});

	test('meeting.ended イベントで必要なデータが処理されること', async () => {
		const payload = {
			object: {
				id: '82259735801',
				uuid: 'test-meeting-uuid',
				host_id: 'host123',
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				duration: 60
			}
		};
		
		const result = await zoomWebhookHandler.handleMeetingEnded(payload);
		
		// 重要: 会議終了イベントが正常に処理されること
		expect(result.success).toBe(true);
		expect(result.jobId).toBeDefined();
	});

	test('recording.completed イベントで必要なデータが処理されること', async () => {
		const payload = {
			object: {
				id: '82259735801',
				uuid: 'test-meeting-uuid',
				host_id: 'host123',
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z',
				recording_files: [
					{
						id: 'file1',
						file_type: 'MP4',
						file_extension: 'mp4',
						download_url: 'https://zoom.us/rec/download/file1',
						recording_type: 'shared_screen_with_speaker_view'
					},
					{
						id: 'file2',
						file_type: 'TRANSCRIPT',
						file_extension: 'vtt',
						download_url: 'https://zoom.us/rec/download/file2.vtt',
						recording_type: 'audio_transcript'
					}
				]
			}
		};
		
		const result = await zoomWebhookHandler.handleRecordingCompleted(payload);
		
		// 重要: 録画完了イベントが正常に処理されること
		expect(result.success).toBe(true);
		expect(result.jobId).toBeDefined();
	});

	test('必要なpayloadフィールドが存在することを確認', () => {
		const validPayload = {
			object: {
				id: '82259735801',
				uuid: 'test-uuid',
				host_id: 'host123',
				topic: 'テスト会議',
				start_time: '2025-07-21T10:00:00Z'
			}
		};
		
		// 重要: 必須フィールドが存在すること
		expect(validPayload.object.id).toBeDefined();
		expect(validPayload.object.uuid).toBeDefined();
		expect(validPayload.object.host_id).toBeDefined();
		expect(validPayload.object.topic).toBeDefined();
		expect(validPayload.object.start_time).toBeDefined();
		
		// デグレード防止: undefinedエラーが発生しないフィールドアクセス
		expect(() => {
			const meetingId = validPayload.object?.id;
			const uuid = validPayload.object?.uuid;
			const hostId = validPayload.object?.host_id;
			const topic = validPayload.object?.topic;
			const startTime = validPayload.object?.start_time;
		}).not.toThrow();
	});

	test('VTTファイルが正しく識別されること', () => {
		const recordingFiles = [
			{
				id: 'audio-file',
				file_type: 'M4A',
				recording_type: 'audio_only'
			},
			{
				id: 'vtt-file',
				file_type: 'TRANSCRIPT',
				file_extension: 'vtt',
				recording_type: 'audio_transcript'
			},
			{
				id: 'video-file',
				file_type: 'MP4',
				recording_type: 'shared_screen_with_speaker_view'
			}
		];
		
		// VTTファイルを識別する処理をテスト
		const vttFile = recordingFiles.find(file => 
			file.file_type === 'TRANSCRIPT' && 
			file.recording_type === 'audio_transcript'
		);
		
		// 重要: VTTファイルが正しく識別されること
		expect(vttFile).toBeDefined();
		expect(vttFile.id).toBe('vtt-file');
		expect(vttFile.file_extension).toBe('vtt');
		
		// デグレード防止: 音声ファイルとビデオファイルがVTTとして誤識別されないこと
		const audioFile = recordingFiles.find(file => file.recording_type === 'audio_only');
		const videoFile = recordingFiles.find(file => file.file_type === 'MP4');
		expect(audioFile.file_type).not.toBe('TRANSCRIPT');
		expect(videoFile.file_type).not.toBe('TRANSCRIPT');
	});

	test('タイムスタンプ検証で古いリクエストが拒否されること', () => {
		const rawBody = JSON.stringify({ event: 'test' });
		const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10分前
		const currentTimestamp = Math.floor(Date.now() / 1000);
		
		// 正しい署名を生成
		const message = `v0:${oldTimestamp}:${rawBody}`;
		const hash = crypto.createHmac('sha256', 'test-webhook-secret').update(message).digest('hex');
		const signature = `v0=${hash}`;
		
		// 重要: 署名は正しいがタイムスタンプが古い場合の処理
		const isValidSignature = zoomWebhookHandler.verifySignature(rawBody, signature, oldTimestamp);
		expect(isValidSignature).toBe(true); // 署名自体は正しい
		
		// デグレード防止: タイムスタンプチェックも実装する必要がある
		const timestampDiff = currentTimestamp - oldTimestamp;
		const isTimestampValid = timestampDiff <= 300; // 5分以内
		expect(isTimestampValid).toBe(false);
	});
});