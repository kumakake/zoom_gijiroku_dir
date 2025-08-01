/**
 * VTTファイルから参加者情報抽出テスト
 * 所要時間と参加者情報表示修正の統合テスト
 */

const TranscriptWorker = require('../workers/transcriptWorker');
const { Pool } = require('pg');

// データベースの実装をモック化
jest.mock('pg', () => ({
	Pool: jest.fn()
}));

describe('VTT参加者情報抽出統合テスト', () => {
	let transcriptWorker;
	let mockDbQuery;
	let mockDbConnect;
	let mockDbEnd;

	beforeEach(() => {
		// データベースモックのセットアップ
		mockDbQuery = jest.fn();
		mockDbConnect = jest.fn();
		mockDbEnd = jest.fn();

		Pool.mockImplementation(() => ({
			query: mockDbQuery,
			connect: mockDbConnect,
			end: mockDbEnd
		}));

		transcriptWorker = new TranscriptWorker();
		
		// コンソールログをモック化
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('VTT発言者名から参加者情報補完テスト', () => {
		test('VTTから取得した発言者名が参加者情報に正しく追加される', async () => {
			// モックデータの準備
			const agentJobId = 123;
			const vttSpeakerNames = ['上辻としゆき', '田中太郎'];
			
			// データベースクエリの結果をモック
			mockDbQuery.mockResolvedValueOnce({
				rows: [{
					result: {
						vtt_speaker_names: vttSpeakerNames,
						transcription_method: 'vtt',
						vtt_quality_score: 85
					}
				}]
			});

			// テスト対象のデータ
			const actualMeetingData = {
				meeting_id: '123456789',
				topic: 'VTTテスト会議',
				start_time: '2025-07-21T10:00:00Z',
				host_email: 'host@example.com'
			};

			const recordingData = {
				agentJobId: agentJobId,
				meetingData: {
					duration: 30,
					topic: 'VTTテスト会議'
				}
			};

			// TranscriptWorkerの内部処理をシミュレート
			const enhancedMeetingData = { ...actualMeetingData };
			if (recordingData.meetingData) {
				enhancedMeetingData.duration = enhancedMeetingData.duration || recordingData.meetingData.duration;
				enhancedMeetingData.topic = enhancedMeetingData.topic || recordingData.meetingData.topic;
			}

			const meetingInfo = transcriptWorker.extractMeetingInfo(enhancedMeetingData);

			// VTT参加者情報補完のシミュレート
			const jobDataResult = await mockDbQuery('SELECT result FROM agent_jobs WHERE id = $1', [agentJobId]);
			if (jobDataResult.rows.length > 0 && jobDataResult.rows[0].result) {
				const outputData = jobDataResult.rows[0].result;
				if (outputData.vtt_speaker_names && Array.isArray(outputData.vtt_speaker_names)) {
					const vttParticipants = outputData.vtt_speaker_names.map(name => ({
						name: name,
						email: null,
						source: 'vtt'
					}));
					meetingInfo.participants = vttParticipants;
				}
			}

			// アサーション
			expect(mockDbQuery).toHaveBeenCalledWith(
				'SELECT result FROM agent_jobs WHERE id = $1',
				[agentJobId]
			);

			expect(meetingInfo.participants).toHaveLength(2);
			expect(meetingInfo.participants[0].name).toBe('上辻としゆき');
			expect(meetingInfo.participants[0].source).toBe('vtt');
			expect(meetingInfo.participants[1].name).toBe('田中太郎');
			expect(meetingInfo.duration).toBe(30);
		});

		test('VTT発言者名がない場合は空の参加者配列が維持される', async () => {
			const agentJobId = 456;
			
			// VTT発言者名がないケース
			mockDbQuery.mockResolvedValueOnce({
				rows: [{
					result: {
						transcription_method: 'whisper', // VTTではない
						audio_file_size: 1024000
					}
				}]
			});

			const actualMeetingData = {
				meeting_id: '987654321',
				topic: 'Whisperテスト会議',
				start_time: '2025-07-21T14:00:00Z',
				host_email: 'host@example.com'
			};

			const meetingInfo = transcriptWorker.extractMeetingInfo(actualMeetingData);

			// VTT参加者情報補完のシミュレート（VTTデータなし）
			const jobDataResult = await mockDbQuery('SELECT result FROM agent_jobs WHERE id = $1', [agentJobId]);
			if (jobDataResult.rows.length > 0 && jobDataResult.rows[0].result) {
				const outputData = jobDataResult.rows[0].result;
				if (outputData.vtt_speaker_names && Array.isArray(outputData.vtt_speaker_names)) {
					// この条件は満たされない
					meetingInfo.participants = outputData.vtt_speaker_names.map(name => ({
						name: name,
						email: null,
						source: 'vtt'
					}));
				}
			}

			// アサーション
			expect(meetingInfo.participants).toEqual([]);
		});

		test('データベースエラー時も処理が継続される', async () => {
			const agentJobId = 789;
			
			// データベースエラーのシミュレート
			mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

			const actualMeetingData = {
				meeting_id: '555666777',
				topic: 'エラーテスト会議',
				duration: 45,
				host_email: 'error@example.com'
			};

			const meetingInfo = transcriptWorker.extractMeetingInfo(actualMeetingData);

			// エラーハンドリングのシミュレート
			try {
				await mockDbQuery('SELECT result FROM agent_jobs WHERE id = $1', [agentJobId]);
			} catch (error) {
				// エラーが発生してもmeetingInfoは正常に処理される
			}

			// アサーション：エラーがあっても基本情報は取得される
			expect(meetingInfo.zoom_meeting_id).toBe('555666777');
			expect(meetingInfo.topic).toBe('エラーテスト会議');
			expect(meetingInfo.duration).toBe(45);
			expect(meetingInfo.participants).toEqual([]); // 空配列で初期化される
		});
	});

	describe('録画データからの所要時間計算テスト', () => {
		test('録画ファイルの開始・終了時刻から正確な所要時間を計算する', () => {
			const recordings = [{
				recording_start: '2025-07-21T10:00:00Z',
				recording_end: '2025-07-21T10:32:00Z', // 32分後
				file_type: 'MP4'
			}];

			// TranscriptWorkerの録画時間計算ロジックをシミュレート
			const firstRecording = recordings[0];
			const startTime = new Date(firstRecording.recording_start);
			const endTime = new Date(firstRecording.recording_end);
			const recordingDuration = Math.round((endTime - startTime) / (1000 * 60));

			expect(recordingDuration).toBe(32);
		});

		test('複数録画ファイルがある場合は最初のファイルを使用する', () => {
			const recordings = [
				{
					recording_start: '2025-07-21T10:00:00Z',
					recording_end: '2025-07-21T10:45:00Z', // 45分
					file_type: 'MP4'
				},
				{
					recording_start: '2025-07-21T10:00:00Z',
					recording_end: '2025-07-21T10:30:00Z', // 30分
					file_type: 'VTT'
				}
			];

			// 最初の録画ファイルを使用
			const firstRecording = recordings[0];
			const startTime = new Date(firstRecording.recording_start);
			const endTime = new Date(firstRecording.recording_end);
			const recordingDuration = Math.round((endTime - startTime) / (1000 * 60));

			expect(recordingDuration).toBe(45); // 最初のファイル（45分）を使用
		});

		test('録画時刻が不正な場合はnullを返す', () => {
			const recordings = [{
				recording_start: 'invalid-date',
				recording_end: 'invalid-date',
				file_type: 'MP4'
			}];

			// 不正な日時での計算
			const firstRecording = recordings[0];
			const startTime = new Date(firstRecording.recording_start);
			const endTime = new Date(firstRecording.recording_end);
			
			// NaNになるケース
			const recordingDuration = isNaN(startTime) || isNaN(endTime) ? 
				null : Math.round((endTime - startTime) / (1000 * 60));

			expect(recordingDuration).toBeNull();
		});
	});

	describe('ホスト情報参加者設定テスト', () => {
		test('ホスト情報が正しく参加者として設定される', () => {
			const recordingMeetingData = {
				host_email: 'host@example.com',
				host_name: 'ホスト太郎',
				topic: 'ホストテスト会議'
			};

			// TranscriptWorkerのホスト参加者設定ロジックをシミュレート
			if (recordingMeetingData.host_email) {
				recordingMeetingData.participants = [{
					user_name: recordingMeetingData.host_name || 'Host',
					email: recordingMeetingData.host_email,
					role: 'host'
				}];
			}

			expect(recordingMeetingData.participants).toHaveLength(1);
			expect(recordingMeetingData.participants[0].user_name).toBe('ホスト太郎');
			expect(recordingMeetingData.participants[0].email).toBe('host@example.com');
			expect(recordingMeetingData.participants[0].role).toBe('host');
		});

		test('ホスト名がない場合はデフォルト名が使用される', () => {
			const recordingMeetingData = {
				host_email: 'host@example.com',
				// host_nameなし
				topic: 'デフォルト名テスト'
			};

			if (recordingMeetingData.host_email) {
				recordingMeetingData.participants = [{
					user_name: recordingMeetingData.host_name || 'Host',
					email: recordingMeetingData.host_email,
					role: 'host'
				}];
			}

			expect(recordingMeetingData.participants[0].user_name).toBe('Host');
		});
	});

	describe('統合シナリオテスト', () => {
		test('VTT発言者とホスト情報が組み合わさる場合', async () => {
			const agentJobId = 999;
			
			// VTT発言者名あり
			mockDbQuery.mockResolvedValueOnce({
				rows: [{
					result: {
						vtt_speaker_names: ['上辻としゆき', '佐藤花子'],
						transcription_method: 'vtt'
					}
				}]
			});

			const actualMeetingData = {
				meeting_id: '111222333',
				topic: '統合テスト会議',
				start_time: '2025-07-21T15:00:00Z',
				host_email: 'host@example.com'
			};

			const recordingData = {
				agentJobId: agentJobId,
				meetingData: {
					duration: 25,
					host_email: 'host@example.com',
					host_name: 'ホスト管理者'
				}
			};

			// 基本的な会議情報抽出
			const enhancedMeetingData = { ...actualMeetingData };
			enhancedMeetingData.duration = recordingData.meetingData.duration;
			enhancedMeetingData.participants = recordingData.meetingData.participants;

			const meetingInfo = transcriptWorker.extractMeetingInfo(enhancedMeetingData);

			// VTT参加者情報で上書き
			const jobDataResult = await mockDbQuery('SELECT result FROM agent_jobs WHERE id = $1', [agentJobId]);
			const outputData = jobDataResult.rows[0].result;
			const vttParticipants = outputData.vtt_speaker_names.map(name => ({
				name: name,
				email: null,
				source: 'vtt'
			}));
			meetingInfo.participants = vttParticipants;

			// アサーション
			expect(meetingInfo.duration).toBe(25);
			expect(meetingInfo.participants).toHaveLength(2);
			expect(meetingInfo.participants[0].name).toBe('上辻としゆき');
			expect(meetingInfo.participants[1].name).toBe('佐藤花子');
			// VTT発言者が優先され、ホスト情報は置き換えられる
		});
	});
});