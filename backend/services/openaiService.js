const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

class OpenAIService {
	constructor() {
		this.client = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}

	/**
	 * Zoom録音ファイルをダウンロードしてWhisperで文字起こし
	 * @param {string} downloadUrl - Zoom録音ファイルのダウンロードURL
	 * @param {string} accessToken - Zoom APIアクセストークン
	 * @returns {Promise<string>} 文字起こしテキスト
	 */
	async transcribeZoomRecording(downloadUrl, accessToken) {
		try {
			console.log('音声ファイルをダウンロードしています...', downloadUrl);
			
			// 音声ファイルをダウンロード
			const response = await axios({
				method: 'GET',
				url: downloadUrl,
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				},
				responseType: 'stream'
			});

			// 一時ファイルとして保存
			const tempFilePath = path.join(__dirname, '../temp', `recording_${Date.now()}.m4a`);
			const tempDir = path.dirname(tempFilePath);
			
			// tempディレクトリが存在しない場合は作成
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const writer = fs.createWriteStream(tempFilePath);
			response.data.pipe(writer);

			await new Promise((resolve, reject) => {
				writer.on('finish', resolve);
				writer.on('error', reject);
			});

			console.log('音声ファイルの保存が完了しました:', tempFilePath);

			// Whisper APIで文字起こし
			const transcript = await this.transcribeAudio(tempFilePath);

			// 一時ファイルを削除
			fs.unlinkSync(tempFilePath);
			console.log('一時ファイルを削除しました');

			return transcript;

		} catch (error) {
			console.error('音声文字起こしエラー:', error);
			throw new Error(`音声文字起こしに失敗しました: ${error.message}`);
		}
	}

	/**
	 * URLから音声ファイルをダウンロードして文字起こし
	 * @param {string} audioUrl - 音声ファイルのURL
	 * @returns {Promise<string>} 文字起こしテキスト
	 */
	async transcribeAudioFromUrl(audioUrl) {
		try {
			console.log('音声ファイルをダウンロードしています...', audioUrl);
			
			// URLから音声ファイルをダウンロード
			const response = await axios({
				method: 'GET',
				url: audioUrl,
				responseType: 'stream'
			});

			// 一時ファイルとして保存
			const tempFilePath = path.join(__dirname, '../temp', `audio_${Date.now()}.mp3`);
			const tempDir = path.dirname(tempFilePath);
			
			// tempディレクトリが存在しない場合は作成
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const writer = fs.createWriteStream(tempFilePath);
			response.data.pipe(writer);

			await new Promise((resolve, reject) => {
				writer.on('finish', resolve);
				writer.on('error', reject);
			});

			console.log('音声ファイルの保存が完了しました:', tempFilePath);

			// Whisper APIで文字起こし
			const transcript = await this.transcribeAudio(tempFilePath);

			// 一時ファイルを削除
			fs.unlinkSync(tempFilePath);
			console.log('一時ファイルを削除しました');

			return transcript;

		} catch (error) {
			console.error('URL音声文字起こしエラー:', error);
			throw new Error(`URL音声文字起こしに失敗しました: ${error.message}`);
		}
	}

	/**
	 * Zoom認証付きURLから音声ファイルをダウンロード・文字起こし
	 * @param {string} audioUrl - 音声ファイルのURL
	 * @param {string} accessToken - Zoom APIアクセストークン
	 * @returns {Promise<string>} 文字起こしテキスト
	 */
	async transcribeZoomRecording(audioUrl, accessToken) {
		try {
			console.log('Zoom録画音声の文字起こしを開始します:', audioUrl.substring(0, 50) + '...');

			// Zoom認証ヘッダー付きでダウンロード
			const response = await axios({
				method: 'GET',
				url: audioUrl,
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'User-Agent': 'AI-Agent-Service/1.0'
				},
				responseType: 'stream'
			});

			// 一時ファイルとして保存
			const tempFilePath = path.join(__dirname, '../temp', `zoom_audio_${Date.now()}.mp3`);
			const tempDir = path.dirname(tempFilePath);
			
			// tempディレクトリが存在しない場合は作成
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const writer = fs.createWriteStream(tempFilePath);
			response.data.pipe(writer);

			await new Promise((resolve, reject) => {
				writer.on('finish', resolve);
				writer.on('error', reject);
			});

			console.log('Zoom音声ファイルの保存が完了しました:', tempFilePath);

			// Whisper APIで文字起こし
			const transcript = await this.transcribeAudio(tempFilePath);

			// 一時ファイルを削除
			fs.unlinkSync(tempFilePath);
			console.log('一時ファイルを削除しました');

			return transcript;

		} catch (error) {
			console.error('Zoom録画音声文字起こしエラー:', error);
			throw new Error(`Zoom録画音声文字起こしに失敗しました: ${error.message}`);
		}
	}

	/**
	 * ローカルファイルを文字起こし
	 * @param {string} filePath - 音声ファイルのパス
	 * @returns {Promise<string>} 文字起こしテキスト
	 */
	async transcribeAudioFromFile(filePath) {
		try {
			console.log('ローカル音声ファイルの文字起こしを開始します:', filePath);
			
			// ファイルの存在確認
			if (!fs.existsSync(filePath)) {
				throw new Error(`音声ファイルが見つかりません: ${filePath}`);
			}

			// Whisper APIで文字起こし
			const transcript = await this.transcribeAudio(filePath);
			
			return transcript;

		} catch (error) {
			console.error('ローカルファイル文字起こしエラー:', error);
			throw new Error(`ローカルファイル文字起こしに失敗しました: ${error.message}`);
		}
	}

	/**
	 * 音声ファイルをWhisper APIで文字起こし
	 * @param {string} filePath - 音声ファイルのパス
	 * @returns {Promise<string>} 文字起こしテキスト
	 */
	async transcribeAudio(filePath) {
		try {
			console.log('Whisper APIで文字起こしを開始します...');

			// ファイルサイズをチェック
			const fileStats = fs.statSync(filePath);
			const fileSizeInBytes = fileStats.size;
			const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

			console.log(`音声ファイルサイズ: ${Math.round(fileSizeInBytes / 1024 / 1024 * 100) / 100}MB`);

			// 25MB以下の場合は既存処理
			if (fileSizeInBytes <= MAX_FILE_SIZE) {
				console.log('ファイルサイズが25MB以下のため、通常処理を実行します');
				return await this.processNormalTranscription(filePath);
			} else {
				console.log('ファイルサイズが25MBを超過しているため、分割処理を実行します');
				return await this.processLargeFileTranscription(filePath);
			}

		} catch (error) {
			console.error('Whisper API呼び出しエラー:', error);
			throw new Error(`Whisper APIエラー: ${error.message}`);
		}
	}

	/**
	 * 通常サイズファイルの文字起こし処理（既存処理）
	 * @param {string} filePath - 音声ファイルのパス
	 * @returns {Promise<Object>} 処理された文字起こしデータ
	 */
	async processNormalTranscription(filePath) {
		const transcription = await this.client.audio.transcriptions.create({
			file: fs.createReadStream(filePath),
			model: 'whisper-1',
			language: 'ja', // 日本語指定
			response_format: 'verbose_json', // 詳細情報とタイムスタンプを取得
			temperature: 0.2, // 精度重視
			timestamp_granularities: ['segment'], // セグメント単位のタイムスタンプ
		});

		console.log('文字起こしが完了しました');
		
		// タイムスタンプ付きセグメントデータを処理
		const processedTranscript = this.processWhisperSegments(transcription);
		
		return processedTranscript;
	}

	/**
	 * 大容量ファイルの分割文字起こし処理
	 * @param {string} filePath - 音声ファイルのパス
	 * @returns {Promise<Object>} 統合された文字起こしデータ
	 */
	async processLargeFileTranscription(filePath) {
		const path = require('path');
		const { exec } = require('child_process');
		const { promisify } = require('util');
		const execAsync = promisify(exec);

		const tempDir = path.dirname(filePath);
		const baseName = path.basename(filePath, path.extname(filePath));
		const splitFiles = [];
		
		try {
			console.log('音声ファイルの分割を開始します...');
			
			// ファイル情報を取得（時長）
			const duration = await this.getAudioDuration(filePath);
			console.log(`音声ファイル時長: ${Math.round(duration / 60)}分${Math.round(duration % 60)}秒`);
			
			// 10MB相当の時間を計算（安全マージンを含む）
			const fileStats = fs.statSync(filePath);
			const fileSizeInBytes = fileStats.size;
			let segmentDuration = Math.floor((duration * 10 * 1024 * 1024) / fileSizeInBytes); // 10MBに対応する時間
			
			console.log(`計算された分割時間: ${segmentDuration}秒 (ファイルサイズ: ${fileSizeInBytes}バイト, 時長: ${duration}秒)`);
			
			// 最小分割時間を300秒（5分）、最大を600秒（10分）に制限
			const originalSegmentDuration = segmentDuration;
			segmentDuration = Math.max(300, Math.min(segmentDuration, 600));
			
			console.log(`制限適用後: ${originalSegmentDuration}秒 → ${segmentDuration}秒`);
			
			console.log(`分割セグメント長: ${segmentDuration}秒`);
			
			// ffmpegで分割実行（元の形式を保持）
			const originalExt = path.extname(filePath);
			const outputPattern = path.join(tempDir, `${baseName}_part_%03d${originalExt}`);
			const ffmpegCommand = `ffmpeg -i "${filePath}" -f segment -segment_time ${segmentDuration} -c copy "${outputPattern}"`;
			
			console.log('ffmpegコマンド実行:', ffmpegCommand);
			const ffmpegResult = await execAsync(ffmpegCommand);
			console.log('ffmpeg stdout:', ffmpegResult.stdout);
			console.log('ffmpeg stderr:', ffmpegResult.stderr);
			
			// ディレクトリ内の全ファイルを確認
			console.log('分割後のディレクトリ内容:', fs.readdirSync(tempDir));
			
			// 分割されたファイルを検索（元の拡張子で）
			const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
			const splitPattern = new RegExp(`^${escapedBaseName}_part_\\d{3}\\${originalExt.replace('.', '\\.')}$`);
			const files = fs.readdirSync(tempDir);
			
			console.log(`検索パターン: ${splitPattern}`);
			console.log(`ベース名: ${baseName}`);
			console.log(`拡張子: ${originalExt}`);
			console.log(`エスケープ後ベース名: ${escapedBaseName}`);
			
			// テスト用: 期待されるファイル名を手動生成してテスト
			const expectedFileName = `${baseName}_part_000${originalExt}`;
			console.log(`期待ファイル名: ${expectedFileName}`);
			console.log(`期待ファイル名でのテスト: ${splitPattern.test(expectedFileName)}`);
			
			for (const file of files) {
				console.log(`ファイル確認: ${file}, マッチ: ${splitPattern.test(file)}`);
				// より確実な方法: 文字列マッチング
				if (file.startsWith(`${baseName}_part_`) && file.endsWith(originalExt)) {
					console.log(`文字列マッチング成功: ${file}`);
					splitFiles.push(path.join(tempDir, file));
				}
			}
			
			splitFiles.sort(); // ファイル名順にソート
			console.log(`分割完了: ${splitFiles.length}個のファイルに分割されました`);
			
			// 各分割ファイルを順次処理
			const allSegments = [];
			let totalDuration = 0;
			let totalSpeakerCount = 1;
			
			for (let i = 0; i < splitFiles.length; i++) {
				console.log(`分割ファイル ${i + 1}/${splitFiles.length} を処理中...`);
				
				const segmentResult = await this.processNormalTranscription(splitFiles[i]);
				console.log(`分割ファイル ${i + 1} 処理結果:`, {
					hasSegments: !!segmentResult.segments,
					segmentCount: segmentResult.segments ? segmentResult.segments.length : 0,
					hasRawText: !!segmentResult.raw_text,
					rawTextLength: segmentResult.raw_text ? segmentResult.raw_text.length : 0,
					duration: segmentResult.duration
				});
				
				// タイムスタンプを調整（前のセグメントの終了時間を加算）
				const adjustedSegments = segmentResult.segments.map(segment => ({
					...segment,
					start: segment.start + totalDuration,
					end: segment.end + totalDuration
				}));
				
				allSegments.push(...adjustedSegments);
				totalDuration += segmentResult.duration;
				totalSpeakerCount = Math.max(totalSpeakerCount, segmentResult.speaker_count);
			}
			
			// 分割ファイルを削除
			for (const splitFile of splitFiles) {
				if (fs.existsSync(splitFile)) {
					fs.unlinkSync(splitFile);
				}
			}
			
			// 統合結果を生成
			const combinedRawText = allSegments.map(seg => seg.text).join(' ');
			const combinedFormattedText = allSegments
				.map(seg => `[${this.formatTimestamp(seg.start)}] ${seg.speaker}: ${seg.text}`)
				.join('\n');
			
			console.log('大容量ファイルの文字起こしが完了しました');
			console.log(`統合結果: セグメント数=${allSegments.length}, raw_text長=${combinedRawText.length}`);
			
			return {
				raw_text: combinedRawText,
				formatted_text: combinedFormattedText,
				segments: allSegments,
				duration: totalDuration,
				language: 'ja',
				speaker_count: totalSpeakerCount
			};
			
		} catch (error) {
			console.error('大容量ファイル処理エラー:', error);
			
			// エラー時に分割ファイルをクリーンアップ
			for (const splitFile of splitFiles) {
				try {
					if (fs.existsSync(splitFile)) {
						fs.unlinkSync(splitFile);
					}
				} catch (cleanupError) {
					console.error('分割ファイル削除エラー:', cleanupError);
				}
			}
			
			throw new Error(`大容量ファイル処理に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 音声ファイルの時長を取得
	 * @param {string} filePath - 音声ファイルのパス
	 * @returns {Promise<number>} 時長（秒）
	 */
	async getAudioDuration(filePath) {
		const { exec } = require('child_process');
		const { promisify } = require('util');
		const execAsync = promisify(exec);
		
		try {
			const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`;
			const { stdout } = await execAsync(command);
			return parseFloat(stdout.trim());
		} catch (error) {
			console.error('音声ファイル時長取得エラー:', error);
			// デフォルト値として推定値を返す（ファイルサイズから）
			const fileStats = fs.statSync(filePath);
			const estimatedDuration = fileStats.size / (128 * 1024 / 8); // 128kbps想定
			return estimatedDuration;
		}
	}

	/**
	 * Whisperのセグメントデータを処理して話者推定を行う
	 * @param {Object} transcription - Whisper APIからの詳細レスポンス
	 * @returns {Object} 処理された文字起こしデータ
	 */
	processWhisperSegments(transcription) {
		try {
			const segments = transcription.segments || [];
			let processedSegments = [];
			let currentSpeaker = 'Speaker 1';
			let speakerCount = 1;
			
			// 音声の間隔や音響特徴の変化を基に話者を推定
			for (let i = 0; i < segments.length; i++) {
				const segment = segments[i];
				const prevSegment = segments[i - 1];
				
				// 話者変更の判定ロジック
				let speakerChanged = false;
				
				if (prevSegment) {
					// 発言間隔が3秒以上空いた場合は話者変更の可能性
					const gap = segment.start - prevSegment.end;
					if (gap > 3.0) {
						speakerChanged = true;
					}
					
					// セグメントの平均音量や話速の変化を検出（簡易版）
					// 実際のWhisper APIでは音響特徴は提供されないため、
					// テキストの特徴から推定
					if (this.detectSpeakerChangeByText(segment.text, prevSegment.text)) {
						speakerChanged = true;
					}
				}
				
				if (speakerChanged) {
					speakerCount++;
					currentSpeaker = `Speaker ${speakerCount}`;
				}
				
				processedSegments.push({
					id: segment.id,
					start: segment.start,
					end: segment.end,
					text: segment.text,
					speaker: currentSpeaker,
					confidence: segment.avg_logprob || 0
				});
			}
			
			// フォーマットされたテキストを生成
			const formattedText = processedSegments
				.map(seg => `[${this.formatTimestamp(seg.start)}] ${seg.speaker}: ${seg.text}`)
				.join('\n');
			
			return {
				raw_text: transcription.text,
				formatted_text: formattedText,
				segments: processedSegments,
				duration: transcription.duration,
				language: transcription.language,
				speaker_count: speakerCount
			};
			
		} catch (error) {
			console.error('セグメント処理エラー:', error);
			// エラー時は元のテキストを返す
			return {
				raw_text: transcription.text || transcription,
				formatted_text: transcription.text || transcription,
				segments: [],
				duration: 0,
				language: 'ja',
				speaker_count: 1
			};
		}
	}

	/**
	 * テキスト特徴から話者変更を検出（簡易版）
	 * @param {string} currentText - 現在のセグメントテキスト
	 * @param {string} previousText - 前のセグメントテキスト
	 * @returns {boolean} 話者変更の可能性
	 */
	detectSpeakerChangeByText(currentText, previousText) {
		// 敬語や文体の変化を検出
		const politePatterns = /です|ます|ございます|いらっしゃる|でしょう/;
		const casualPatterns = /だ|である|だよ|だね|じゃん/;
		
		const currentPolite = politePatterns.test(currentText);
		const previousPolite = politePatterns.test(previousText);
		const currentCasual = casualPatterns.test(currentText);
		const previousCasual = casualPatterns.test(previousText);
		
		// 敬語⇔カジュアルの変化は話者変更の可能性
		if ((currentPolite && previousCasual) || (currentCasual && previousPolite)) {
			return true;
		}
		
		// 質問⇔回答の変化
		const currentQuestion = /\?|ですか|でしょうか|ますか/.test(currentText);
		const previousQuestion = /\?|ですか|でしょうか|ますか/.test(previousText);
		
		if (currentQuestion !== previousQuestion) {
			return true;
		}
		
		return false;
	}

	/**
	 * タイムスタンプを読みやすい形式にフォーマット
	 * @param {number} seconds - 秒数
	 * @returns {string} フォーマットされた時間
	 */
	formatTimestamp(seconds) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
	}

	/**
	 * 文字起こしテキストを議事録形式に整形（OpenAI GPT使用）
	 * @param {string} rawTranscript - 生の文字起こしテキスト
	 * @param {Object} meetingInfo - 会議情報
	 * @returns {Promise<Object>} 整形された議事録データ
	 */
	async formatTranscriptWithGPT(rawTranscript, meetingInfo) {
		try {
			console.log('GPT-4で議事録を整形しています...');

			const prompt = `
以下のZoom会議の音声文字起こしを、読みやすい議事録に整形してください。

## 会議情報
- 会議名: ${meetingInfo.topic || '未設定'}
- 開始時間: ${meetingInfo.start_time || '未設定'}
- 参加者: ${meetingInfo.participants ? meetingInfo.participants.map(p => p.name).join(', ') : '未設定'}

## 音声文字起こし
${rawTranscript}

## 出力形式
以下のJSON形式で出力してください：
{
	"formatted_transcript": "整形された議事録本文（マークダウン形式）",
	"summary": "会議の要約（3-5行程度）",
	"action_items": [
		{
			"item": "アクションアイテムの内容",
			"assignee": "担当者名（判明している場合）",
			"due_date": "期限（言及されている場合）"
		}
	],
	"key_decisions": [
		"重要な決定事項1",
		"重要な決定事項2"
	],
	"next_meeting": "次回会議の予定（言及されている場合）"
}

## 注意事項
- 発言者が特定できる場合は「○○さん:」の形で記載
- 重要な内容は太字で強調
- 時系列順に整理
- 不明瞭な部分は[不明瞭]と記載
- 日本語で出力
`;

			const completion = await this.client.chat.completions.create({
				model: 'gpt-4',
				messages: [
					{
						role: 'system',
						content: 'あなたは優秀な議事録作成アシスタントです。音声文字起こしを元に、読みやすく整理された議事録を作成してください。'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				temperature: 0.3,
				max_tokens: 2000,
			});

			const result = completion.choices[0].message.content;
			console.log('GPT-4による議事録整形が完了しました');

			// JSONパース
			try {
				return JSON.parse(result);
			} catch (parseError) {
				console.error('GPT-4レスポンスのJSONパースエラー:', parseError);
				// パースエラーの場合はフォールバック
				return {
					formatted_transcript: result,
					summary: '議事録の自動要約に失敗しました',
					action_items: [],
					key_decisions: [],
					next_meeting: null
				};
			}

		} catch (error) {
			console.error('GPT-4議事録整形エラー:', error);
			throw new Error(`議事録整形に失敗しました: ${error.message}`);
		}
	}
}

module.exports = OpenAIService;