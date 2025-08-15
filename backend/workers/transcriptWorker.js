const Bull = require('bull');
const { Pool } = require('pg');
const zoomUtils = require('../utils/zoom');
const OpenAIService = require('../services/openaiService');
const AnthropicService = require('../services/anthropicService');
const EmailService = require('../services/emailService');
const QueueService = require('../services/queueService');
const tenantZoomService = require('../services/tenantZoomService');
const axios = require('axios');

class TranscriptWorker {
	constructor() {
		// データベース接続
		this.db = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		// サービス初期化
		this.openaiService = new OpenAIService();
		this.anthropicService = new AnthropicService();
		this.emailService = new EmailService();
		this.queueService = new QueueService();
		this.tenantZoomService = tenantZoomService;

		// Redis設定（開発・本番環境統一）
		let redisConfig;
		if (process.env.REDIS_URL) {
			// REDIS_URLが設定されている場合（本番・開発共通）
			console.log('📡 TranscriptWorker REDIS_URLを使用:', process.env.REDIS_URL.replace(/:([^:@]+)@/, ':***@'));
			redisConfig = process.env.REDIS_URL;
		} else {
			// 個別設定（フォールバック）
			console.log('🔧 TranscriptWorker 個別Redis設定を使用:', `${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
			redisConfig = {
				redis: {
					port: process.env.REDIS_PORT || 6379,
					host: process.env.REDIS_HOST || 'redis',
					password: process.env.REDIS_PASSWORD || null,
					db: 0,
				}
			};
		}
		this.redisConfig = redisConfig;

		// ワーカー初期化
		this.transcriptQueue = new Bull('transcript processing', this.redisConfig);
		this.setupWorkers();

		console.log('Transcript Worker initialized');
	}

	/**
	 * ワーカーのセットアップ
	 */
	setupWorkers() {
		// 議事録生成ワーカー
		this.transcriptQueue.process('generate-transcript', 3, async (job) => {
			return await this.processTranscriptGeneration(job);
		});

		// ワーカーイベント処理
		this.transcriptQueue.on('completed', (job, result) => {
			console.log(`ジョブ完了: ${job.id}`, result);
		});

		this.transcriptQueue.on('failed', (job, err) => {
			console.error(`ジョブ失敗: ${job.id}`, err);
			this.handleJobFailure(job, err);
		});

		this.transcriptQueue.on('progress', (job, progress) => {
			console.log(`ジョブ進捗: ${job.id} - ${progress}%`);
		});
	}

	/**
	 * メイン処理：議事録生成フロー
	 * @param {Object} job - Bull ジョブ
	 * @returns {Promise<Object>} 処理結果
	 */
	async processTranscriptGeneration(job) {
		// データ構造の統一: meetingDataまたはzoomDataを受け入れ
		const { jobId, agentJobId, meetingData, zoomData, tenantId } = job.data;
		const actualJobId = agentJobId || jobId;
		const actualMeetingData = meetingData || zoomData;
		
		try {
			// ジョブ進捗を更新
			await job.progress(10);
			await this.updateAgentJobStatus(actualJobId, 'processing', '議事録生成を開始しました');

			// 1. Zoom APIから録音データを取得
			await job.progress(20);
			const recordingData = await this.getZoomRecordingData(actualMeetingData, tenantId);

			// 2. VTT優先処理で文字起こし
			await job.progress(40);
			recordingData.agentJobId = actualJobId; // エージェントジョブIDを追加
			const rawTranscript = await this.getTranscriptFromZoom(recordingData);

			// 3. 議事録を整形・要約（Anthropic Claude）
			await job.progress(60);
			
			// 録画データから取得した会議情報で元のデータを補完
			const enhancedMeetingData = { ...actualMeetingData };
			if (recordingData.meetingData) {
				// 録画データの会議情報で補完
				enhancedMeetingData.duration = enhancedMeetingData.duration || recordingData.meetingData.duration;
				enhancedMeetingData.topic = enhancedMeetingData.topic || recordingData.meetingData.topic;
				enhancedMeetingData.start_time = enhancedMeetingData.start_time || recordingData.meetingData.start_time;
				enhancedMeetingData.participants = enhancedMeetingData.participants || recordingData.meetingData.participants;
			}
			
			const meetingInfo = this.extractMeetingInfo(enhancedMeetingData);
			
			// VTTファイルから発言者名を取得して参加者リストに追加
			if (recordingData.agentJobId) {
				try {
					const jobDataQuery = `SELECT output_data FROM agent_jobs WHERE id = $1`;
					const jobDataResult = await this.db.query(jobDataQuery, [recordingData.agentJobId]);
					
					if (jobDataResult.rows.length > 0 && jobDataResult.rows[0].output_data) {
						const outputData = jobDataResult.rows[0].output_data;
						if (outputData.vtt_speaker_names && Array.isArray(outputData.vtt_speaker_names)) {
							// VTTから取得した発言者名を参加者として追加
							const vttParticipants = outputData.vtt_speaker_names.map(name => ({
								name: name,
								email: null,
								source: 'vtt'
							}));
							
							if (vttParticipants.length > 0) {
								meetingInfo.participants = vttParticipants;
								console.log('🔍 VTTから参加者情報を補完:', vttParticipants);
							}
						}
					}
				} catch (error) {
					console.error('VTT参加者情報補完エラー:', error);
				}
			}
			
			// 🔍 Anthropic API入力データのログ出力
			console.log('🔍 Anthropic API入力データ（最初の300文字）:', rawTranscript.substring(0, 300));
			
			const transcriptData = await this.anthropicService.generateMeetingMinutes(rawTranscript, meetingInfo);
			
			// 🔍 Anthropic API出力データのログ出力
			console.log('🔍 Anthropic API出力データ（formatted_transcript最初の300文字）:', transcriptData.formatted_transcript?.substring(0, 300));

			// 4. データベースに保存
			await job.progress(80);
			const transcriptId = await this.saveMeetingTranscript(actualJobId, actualMeetingData, rawTranscript, transcriptData, tenantId);

			// 5. 配布処理をキューに追加
			await job.progress(90);
			await this.queueDistribution(transcriptId, transcriptData, meetingInfo, tenantId);

			// 6. ジョブ完了
			await job.progress(100);
			const meetingId = actualMeetingData.meeting_id || actualMeetingData.object?.id;
			await this.updateAgentJobStatus(actualJobId, 'completed', '議事録生成が完了しました', {
				transcript_id: transcriptId,
				meeting_id: meetingId
			});

			return {
				success: true,
				transcript_id: transcriptId,
				meeting_id: meetingId,
				message: '議事録生成が完了しました'
			};

		} catch (error) {
			console.error('[transcriptWorker.js:processTranscriptGeneration] 議事録生成エラー:', {
				file: 'transcriptWorker.js',
				method: 'processTranscriptGeneration',
				agentJobId: actualJobId,
				error: error.message,
				stack: error.stack
			});
			await this.updateAgentJobStatus(actualJobId, 'failed', error.message);
			throw error;
		}
	}

	/**
	 * Zoom APIから録音データを取得
	 * @param {Object} meetingData - 会議データ（webhookまたはZoom API）
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<Object>} 録音データ
	 */
	async getZoomRecordingData(meetingData, tenantId) {
		try {
			// データ構造の判定: webhookのmeetingDataかZoom APIのzoomDataか
			const rawMeetingId = meetingData.meeting_id || meetingData.object?.id;
			if (!rawMeetingId) {
				throw new Error('Meeting IDが見つかりません');
			}
			
			// Meeting IDを正規化（スペース等を削除）
			const meetingId = zoomUtils.normalizeMeetingId(rawMeetingId);
			console.log(`📝 Meeting ID正規化: "${rawMeetingId}" → "${meetingId}"`);
			
			const accessToken = await this.getZoomAccessToken(tenantId);

			// Zoom API: 録音データ取得
			const response = await axios.get(
				`https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json'
					}
				}
			);

			const recordings = response.data.recording_files;
			
			// 録画ファイル詳細をログ出力（デバッグ用）
			console.log('📁 取得された録画ファイル一覧:', recordings.map(file => ({
				id: file.id,
				file_type: file.file_type,
				file_extension: file.file_extension,
				recording_type: file.recording_type,
				status: file.status,
				file_size: file.file_size,
				recording_start: file.recording_start,
				recording_end: file.recording_end,
				download_url: file.download_url ? 'あり' : 'なし'
			})));
			
			// VTTファイル（字幕ファイル）を優先的に探す
			// ZoomのTRANSCRIPTファイルもVTT形式の可能性が高い
			const vttRecording = recordings.find(file => 
				file.file_type === 'VTT' || 
				file.file_type === 'TRANSCRIPT' || 
				file.recording_type === 'transcript' ||
				file.recording_type === 'audio_transcript'
			);
			
			// 音声ファイルも取得（VTTが利用できない場合のフォールバック）
			const audioRecording = recordings.find(file => 
				file.file_type === 'M4A' || file.file_type === 'MP3'
			);
			
			console.log('🎯 VTTファイル検索結果:', {
				vttFound: !!vttRecording,
				audioFound: !!audioRecording,
				vttDetails: vttRecording ? {
					file_type: vttRecording.file_type,
					recording_type: vttRecording.recording_type,
					status: vttRecording.status
				} : null
			});

			// 録画データから会議の詳細情報を抽出
			const recordingMeetingData = response.data;
			
			// 所要時間を計算（録画開始・終了時刻から）
			let recordingDuration = null;
			if (recordings && recordings.length > 0) {
				const firstRecording = recordings[0];
				if (firstRecording.recording_start && firstRecording.recording_end) {
					const startTime = new Date(firstRecording.recording_start);
					const endTime = new Date(firstRecording.recording_end);
					recordingDuration = Math.round((endTime - startTime) / (1000 * 60)); // 分単位
				}
			}
			
			// 録画データから会議情報を補完
			if (recordingMeetingData) {
				if (recordingDuration && !recordingMeetingData.duration) {
					recordingMeetingData.duration = recordingDuration;
				}
				
				// 基本的なホスト情報を参加者として設定
				if (recordingMeetingData.host_email) {
					recordingMeetingData.participants = [{
						user_name: recordingMeetingData.host_name || 'Host',
						email: recordingMeetingData.host_email,
						role: 'host'
					}];
					console.log('🔍 ホスト情報を参加者として設定:', recordingMeetingData.host_email);
				}
			}
			
			console.log('🔍 録画データから抽出した会議情報:', {
				duration: recordingMeetingData.duration,
				recordingDuration: recordingDuration,
				topic: recordingMeetingData.topic,
				start_time: recordingMeetingData.start_time,
				participants: recordingMeetingData.participants ? recordingMeetingData.participants.length + '名' : 'なし'
			});

			return {
				vttFile: vttRecording ? {
					download_url: vttRecording.download_url,
					file_size: vttRecording.file_size
				} : null,
				audioFile: audioRecording ? {
					download_url: audioRecording.download_url,
					file_size: audioRecording.file_size
				} : null,
				accessToken: accessToken,
				meetingData: recordingMeetingData
			};

		} catch (error) {
			console.error('[transcriptWorker.js:getZoomRecordingData] Zoom録音データ取得エラー:', {
				file: 'transcriptWorker.js',
				method: 'getZoomRecordingData',
				error: error.message,
				stack: error.stack
			});
			throw new Error(`録音データ取得に失敗しました: ${error.message}`);
		}
	}

	/**
	 * VTT優先処理で文字起こしを取得
	 * @param {Object} recordingData - 録画データ
	 * @returns {Promise<string>} 文字起こし結果
	 */
	async getTranscriptFromZoom(recordingData) {
		try {
			// VTTファイルが利用可能な場合は優先使用
			if (recordingData.vttFile && recordingData.vttFile.download_url) {
				console.log('🎯 VTTファイルが利用可能です。VTT解析を実行します...');
				
				const vttContent = await zoomUtils.downloadVTTFile(
					recordingData.vttFile.download_url, 
					recordingData.accessToken
				);
				
				// 🚨 VTTファイル内容のダンプ（デバッグ用）
				console.log('📋 VTTファイル内容ダンプ開始 ===========================');
				console.log('📏 VTTファイルサイズ:', vttContent ? vttContent.length : 'null');
				console.log('📄 VTTファイル内容:');
				console.log('---START---');
				console.log(vttContent);
				console.log('---END---');
				console.log('📋 VTTファイル内容ダンプ終了 ===========================');
				
				const vttAnalysis = zoomUtils.parseVTTContent(vttContent);
				
				if (vttAnalysis.success) {
					console.log('✅ VTT解析成功:', {
						speakers: vttAnalysis.speakers.length,
						transcriptLength: vttAnalysis.chronologicalTranscript.length,
						qualityScore: vttAnalysis.quality?.qualityScore || 'N/A'
					});
					
					// 🔍 発言者名の詳細ログ出力
					console.log('🔍 発言者一覧:', vttAnalysis.speakers);
					console.log('🔍 文字起こし内容（最初の200文字）:', vttAnalysis.chronologicalTranscript.substring(0, 200));
					
					// 処理方法をresultに記録
					await this.updateJobResultData(recordingData.agentJobId, {
						transcription_method: 'vtt',
						vtt_quality_score: vttAnalysis.quality?.qualityScore,
						vtt_speakers: vttAnalysis.speakers.length,
						vtt_speaker_names: vttAnalysis.speakers,
						cost_savings: true
					});
					
					console.log('🎯 VTT処理成功により文字起こし完了。Whisper APIはスキップします。');
					return vttAnalysis.chronologicalTranscript;
				} else {
					console.warn('⚠️ VTT解析失敗。Whisper APIにフォールバック:', vttAnalysis.error);
				}
			} else {
				console.log('📝 VTTファイルが利用できません。Whisper APIを使用します。');
			}
			
			// VTTが利用できない場合はWhisper APIを使用
			if (!recordingData.audioFile || !recordingData.audioFile.download_url) {
				throw new Error('音声ファイルもVTTファイルも利用できません');
			}
			
			console.log('⚠️ VTT処理が失敗または利用不可のため、Whisper APIで文字起こしを実行します...');
			const whisperResult = await this.openaiService.transcribeZoomRecording(
				recordingData.audioFile.download_url, 
				recordingData.accessToken
			);
			
			// 処理方法をresultに記録
			await this.updateJobResultData(recordingData.agentJobId, {
				transcription_method: 'whisper',
				audio_file_size: recordingData.audioFile.file_size,
				speaker_count: whisperResult.speaker_count || 1,
				cost_savings: false
			});
			
			// 話者付きフォーマットされたテキストを返す
			return whisperResult.formatted_text || whisperResult.raw_text || whisperResult;
			
		} catch (error) {
			console.error('文字起こし処理エラー:', error);
			throw new Error(`文字起こし処理に失敗しました: ${error.message}`);
		}
	}

	/**
	 * ジョブのresultを更新
	 * @param {number} agentJobId - エージェントジョブID
	 * @param {Object} resultData - 結果データ
	 */
	async updateJobResultData(agentJobId, resultData) {
		try {
			await this.db.query(
				`UPDATE agent_jobs 
				 SET output_data = COALESCE(output_data, '{}') || $1::jsonb
				 WHERE id = $2`,
				[JSON.stringify(resultData), agentJobId]
			);
		} catch (error) {
			console.error('ジョブoutput_data更新エラー:', error);
		}
	}

	/**
	 * Zoom API アクセストークンを取得（テナント対応）
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<string>} アクセストークン
	 */
	async getZoomAccessToken(tenantId) {
		try {
			console.log(`🔐 Zoomアクセストークン取得開始 (テナント: ${tenantId})`);
			
			// テナント別Zoom設定を取得
			const credentials = await this.tenantZoomService.getZoomCredentials(tenantId);
			
			console.log(`📋 取得した認証情報:`, {
				zoom_client_id: credentials.zoom_client_id,
				zoom_client_secret_length: credentials.zoom_client_secret ? credentials.zoom_client_secret.length : 0,
				zoom_account_id: credentials.zoom_account_id
			});
			
			if (!credentials.zoom_client_id || !credentials.zoom_client_secret || !credentials.zoom_account_id) {
				throw new Error(`テナント ${tenantId} のZoom設定が不完全です`);
			}

			// Server-to-Server OAuth方式（現在の推奨方式）
			const authCredentials = Buffer.from(`${credentials.zoom_client_id}:${credentials.zoom_client_secret}`).toString('base64');
			
			const response = await axios.post('https://zoom.us/oauth/token', 
				`grant_type=account_credentials&account_id=${credentials.zoom_account_id}`,
				{
					headers: {
						'Authorization': `Basic ${authCredentials}`,
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}
			);

			return response.data.access_token;

		} catch (error) {
			console.error(`Zoomアクセストークン取得エラー (テナント: ${tenantId}):`, error);
			console.error('レスポンス詳細:', error.response?.data);
			throw new Error(`Zoomアクセストークン取得に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 会議情報を抽出
	 * @param {Object} zoomData - Zoom webhook データ
	 * @returns {Object} 会議情報
	 */
	extractMeetingInfo(meetingData) {
		// データ構造の判定: webhookのmeetingDataかZoom APIのzoomDataか
		const meeting = (meetingData && meetingData.meeting_id) ? meetingData : (meetingData && meetingData.object) || {};
		
		// 所要時間の計算（開始時刻と終了時刻から算出、またはdurationフィールドを使用）
		let calculatedDuration = meeting.duration;
		if (!calculatedDuration && meeting.start_time && meeting.end_time) {
			const startTime = new Date(meeting.start_time);
			const endTime = new Date(meeting.end_time);
			calculatedDuration = Math.round((endTime - startTime) / (1000 * 60)); // 分単位
		}
		
		// 参加者情報の処理
		let participantList = [];
		if (meeting.participants && Array.isArray(meeting.participants)) {
			// Zoom API形式の参加者リスト
			participantList = meeting.participants.map(p => ({
				name: p.user_name || p.name || p.email || 'Unknown',
				email: p.email || null
			}));
		} else if (meeting.participant) {
			// Webhook形式の単一参加者
			participantList = [{
				name: meeting.participant.user_name || meeting.participant.name || meeting.participant.email || 'Unknown',
				email: meeting.participant.email || null
			}];
		}
		
		console.log('🔍 会議情報抽出結果:', {
			duration: calculatedDuration,
			participants: participantList,
			originalMeetingData: {
				duration: meeting.duration,
				start_time: meeting.start_time,
				end_time: meeting.end_time,
				participant: meeting.participant,
				participants: meeting.participants
			}
		});
		
		return {
			zoom_meeting_id: meeting.meeting_id || meeting.id,
			topic: meeting.topic,
			start_time: meeting.start_time,
			duration: calculatedDuration,
			participants: participantList,
			host_email: meeting.host_email,
			host_id: meeting.host_id
		};
	}

	/**
	 * 議事録をデータベースに保存
	 * @param {number} agentJobId - エージェントジョブID
	 * @param {Object} meetingData - 会議データ
	 * @param {string} rawTranscript - 生の文字起こし
	 * @param {Object} transcriptData - 整形済み議事録データ
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<number>} 議事録ID
	 */
	async saveMeetingTranscript(agentJobId, meetingData, rawTranscript, transcriptData, tenantId) {
		const client = await this.db.connect();
		
		try {
			await client.query('BEGIN');

			// job_uuidを取得
			const jobUuidQuery = `SELECT job_uuid FROM agent_jobs WHERE id = $1`;
			const jobUuidResult = await client.query(jobUuidQuery, [agentJobId]);
			
			if (jobUuidResult.rows.length === 0) {
				throw new Error(`エージェントジョブが見つかりません: ID ${agentJobId}`);
			}
			
			const agentJobUuid = jobUuidResult.rows[0].job_uuid;
			const meetingInfo = this.extractMeetingInfo(meetingData);

			// 既存の議事録があるかチェック（同じ会議ID + 開始時刻）
			const existingQuery = `SELECT id FROM meeting_transcripts WHERE zoom_meeting_id = $1 AND start_time = $2`;
			const existingResult = await client.query(existingQuery, [meetingInfo.zoom_meeting_id, meetingInfo.start_time]);

			let transcriptId;

			if (existingResult.rows.length > 0) {
				// 既存の議事録を更新
				transcriptId = existingResult.rows[0].id;
				
				const updateQuery = `
					UPDATE meeting_transcripts 
					SET 
						job_uuid = $2,
						tenant_id = $3,
						meeting_topic = $4,
						start_time = $5,
						duration = $6,
						participants = $7,
						content = $8,
						formatted_transcript = $9,
						summary = $10,
						updated_at = CURRENT_TIMESTAMP
					WHERE id = $1
				`;

				const updateValues = [
					transcriptId,
					agentJobUuid,
					tenantId,
					meetingInfo.topic,
					meetingInfo.start_time,
					meetingInfo.duration,
					JSON.stringify(meetingInfo.participants),
					rawTranscript,
					transcriptData.formatted_transcript,
					transcriptData.summary
				];

				await client.query(updateQuery, updateValues);
				console.log(`議事録を更新しました: ID ${transcriptId} (会議ID: ${meetingInfo.zoom_meeting_id}, 開始: ${meetingInfo.start_time})`);

			} else {
				// 新規議事録を作成
				const insertQuery = `
					INSERT INTO meeting_transcripts (
						job_uuid, tenant_id, zoom_meeting_id, meeting_topic, start_time, duration,
						participants, content, formatted_transcript, summary
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
					RETURNING id
				`;

				const insertValues = [
					agentJobUuid,
					tenantId,
					meetingInfo.zoom_meeting_id,
					meetingInfo.topic,
					meetingInfo.start_time,
					meetingInfo.duration,
					JSON.stringify(meetingInfo.participants),
					rawTranscript,
					transcriptData.formatted_transcript,
					transcriptData.summary
				];

				const result = await client.query(insertQuery, insertValues);
				transcriptId = result.rows[0].id;
				console.log(`議事録を新規作成しました: ID ${transcriptId} (会議ID: ${meetingInfo.zoom_meeting_id}, 開始: ${meetingInfo.start_time})`);
			}

			await client.query('COMMIT');
			return transcriptId;

		} catch (error) {
			await client.query('ROLLBACK');
			console.error('議事録保存エラー:', error);
			throw new Error(`議事録保存に失敗しました: ${error.message}`);
		} finally {
			client.release();
		}
	}

	/**
	 * 配布処理をキューに追加
	 * @param {number} transcriptId - 議事録ID
	 * @param {Object} transcriptData - 議事録データ
	 * @param {Object} meetingInfo - 会議情報
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<void>}
	 */
	async queueDistribution(transcriptId, transcriptData, meetingInfo, tenantId) {
		try {
			// ホストメールからユーザー設定を取得
			const hostEmail = meetingInfo.host_email;
			console.log(`配布先決定開始: ホストメール=${hostEmail}`);
			
			// ユーザー情報を取得
			const userQuery = `
				SELECT id, email, name 
				FROM users 
				WHERE email = $1 AND is_active = true
			`;
			const userResult = await this.db.query(userQuery, [hostEmail]);
			
			let distributionMode = 'all_participants'; // デフォルトは全参加者に配信
			let hostName = '';
			
			if (userResult.rows.length > 0) {
				const user = userResult.rows[0];
				hostName = user.name;
				console.log(`ユーザー確認: ${user.name} (${user.email}) → 配信モード: ${distributionMode}`);
			} else {
				console.log(`ユーザーが見つかりません。ホストのみ配信に設定: ${hostEmail}`);
			}

			// 配信先を決定
			const distributionData = await this.getDistributionData(meetingInfo, distributionMode, tenantId);

			// メール配信ジョブを追加
			await this.queueService.addEmailJob({
				transcript_id: transcriptId,
				recipients: distributionData.recipients,
				bccRecipients: distributionData.bccRecipients,
				distributionMode: distributionMode,
				transcript: transcriptData,
				meetingInfo: {
					...meetingInfo,
					host_name: hostName || meetingInfo.host_email
				},
				tenantId: tenantId
			});

			console.log(`配布処理をキューに追加: モード=${distributionMode}, To=${distributionData.recipients}, Bcc=${distributionData.bccRecipients.length}名`);

		} catch (error) {
			console.error('配布キュー追加エラー:', error);
			// 配布エラーは致命的ではないのでログのみ
		}
	}

	/**
	 * 配信データを取得（ユーザー設定とZoom参加者情報に基づく）
	 * @param {Object} meetingInfo - 会議情報
	 * @param {string} distributionMode - 配信モード ('host_only' または 'all_participants')
	 * @param {string} tenantId - テナントID
	 * @returns {Promise<Object>} 配信データ
	 */
	async getDistributionData(meetingInfo, distributionMode, tenantId) {
		try {
			const hostEmail = meetingInfo.host_email;
			let bccRecipients = [];

			// 全参加者配信の場合は参加者メールアドレスを取得
			if (distributionMode === 'all_participants') {
				try {
					console.log(`🔍 全参加者配信モード: 会議ID=${meetingInfo.id || meetingInfo.zoom_meeting_id}でZoom参加者メール取得開始`);
					const accessToken = await this.getZoomAccessToken(tenantId);
					const participantData = await zoomUtils.getParticipantEmails(meetingInfo.id || meetingInfo.zoom_meeting_id, accessToken);
					
					console.log(`🔍 Zoom参加者取得結果:`, {
						success: participantData.success,
						totalParticipants: participantData.totalParticipants || 0,
						emailParticipants: participantData.emailParticipants || 0,
						emailAddresses: participantData.emailAddresses || [],
						error: participantData.error || null
					});
					
					if (participantData.success && participantData.emailAddresses.length > 0) {
						// ホストメールを除外して重複削除
						bccRecipients = participantData.emailAddresses
							.filter(email => email !== hostEmail)
							.filter((email, index, self) => self.indexOf(email) === index);
						
						console.log(`✅ 参加者メール取得成功: ${participantData.emailAddresses.length}名中${bccRecipients.length}名をBccに追加`);
						console.log(`🔍 Bcc送信先一覧:`, bccRecipients);
					} else {
						console.log(`⚠️ 参加者メール取得失敗: ${participantData.error || '不明なエラー'}`);
						console.log(`🔍 失敗詳細:`, participantData);
					}
				} catch (error) {
					console.error('❌ 参加者メール取得エラー:', error);
					console.error('🔍 エラー詳細:', {
						message: error.message,
						status: error.response?.status,
						data: error.response?.data
					});
				}
			}

			return {
				recipients: [hostEmail], // ホストをToに設定（配列として）
				bccRecipients: bccRecipients, // 参加者をBccに設定
				summary: {
					hostEmail: hostEmail,
					participantCount: bccRecipients.length,
					distributionMode: distributionMode,
					totalRecipients: 1 + bccRecipients.length
				}
			};

		} catch (error) {
			console.error('配信データ取得エラー:', error);
			
			// エラー時はホストのみに配信
			return {
				recipients: meetingInfo.host_email,
				bccRecipients: [],
				summary: {
					hostEmail: meetingInfo.host_email,
					participantCount: 0,
					distributionMode: 'host_only',
					totalRecipients: 1,
					error: error.message
				}
			};
		}
	}

	/**
	 * エージェントジョブのステータスを更新
	 * @param {number} agentJobId - エージェントジョブID
	 * @param {string} status - ステータス
	 * @param {string} message - メッセージ
	 * @param {Object} outputData - 出力データ（オプション）
	 * @returns {Promise<void>}
	 */
	async updateAgentJobStatus(agentJobId, status, message, outputData = null) {
		try {
			const updateQuery = `
				UPDATE agent_jobs 
				SET status = $1, error_message = $2, output_data = $3, updated_at = CURRENT_TIMESTAMP
				${status === 'completed' ? ', completed_at = CURRENT_TIMESTAMP' : ''}
				WHERE id = $4
			`;

			const values = [
				status,
				status === 'failed' ? message : null,
				outputData ? JSON.stringify(outputData) : null,
				agentJobId
			];

			await this.db.query(updateQuery, values);
			console.log(`エージェントジョブステータス更新: ${agentJobId} -> ${status}`);

		} catch (error) {
			console.error('[transcriptWorker.js:updateAgentJobStatus] ジョブステータス更新エラー:', {
				file: 'transcriptWorker.js',
				method: 'updateAgentJobStatus',
				agentJobId,
				status,
				error: error.message,
				stack: error.stack
			});
		}
	}

	/**
	 * ジョブ失敗時の処理
	 * @param {Object} job - 失敗したジョブ
	 * @param {Error} error - エラー
	 * @returns {Promise<void>}
	 */
	async handleJobFailure(job, error) {
		try {
			// エラー通知メールを送信
			await this.emailService.sendErrorNotification({
				job_id: job.id,
				job_data: job.data,
				error_message: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString()
			});

		} catch (notificationError) {
			console.error('エラー通知送信失敗:', notificationError);
		}
	}

	/**
	 * ワーカーを停止
	 * @returns {Promise<void>}
	 */
	async shutdown() {
		try {
			await this.transcriptQueue.close();
			await this.db.end();
			console.log('Transcript Worker停止しました');

		} catch (error) {
			console.error('ワーカー停止エラー:', error);
		}
	}
}

// ワーカーを開始
const worker = new TranscriptWorker();

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
	console.log('SIGINTを受信しました。ワーカーを停止します...');
	await worker.shutdown();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('SIGTERMを受信しました。ワーカーを停止します...');
	await worker.shutdown();
	process.exit(0);
});

module.exports = TranscriptWorker;