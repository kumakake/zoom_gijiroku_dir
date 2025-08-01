/**
 * Zoom関連のユーティリティ関数
 */

/**
 * Meeting IDを正規化（APIで使用できる形式に変換）
 * スペース、ハイフン、その他の区切り文字を削除して数字のみにする
 * 
 * @param {string} meetingId - 元のMeeting ID（スペース等を含む可能性がある）
 * @returns {string} 正規化されたMeeting ID（数字のみ）
 * 
 * @example
 * normalizeMeetingId("822 5973 5801") // "82259735801"
 * normalizeMeetingId("822-5973-5801") // "82259735801"
 * normalizeMeetingId("82259735801")   // "82259735801"
 */
function normalizeMeetingId(meetingId) {
	if (!meetingId) {
		throw new Error('Meeting IDが指定されていません');
	}
	
	// 文字列に変換してスペース、ハイフン、その他の区切り文字を削除
	const normalized = String(meetingId).replace(/[\s\-_.]/g, '');
	
	// 数字のみかチェック
	if (!/^\d+$/.test(normalized)) {
		throw new Error(`無効なMeeting ID形式: ${meetingId}`);
	}
	
	// Meeting IDの長さチェック（通常10-11桁）
	if (normalized.length < 9 || normalized.length > 12) {
		console.warn(`Meeting IDの長さが通常と異なります: ${normalized} (${normalized.length}桁)`);
	}
	
	return normalized;
}

/**
 * Meeting IDを表示用にフォーマット（スペース区切り）
 * 
 * @param {string} meetingId - 正規化されたMeeting ID
 * @returns {string} 表示用にフォーマットされたMeeting ID
 * 
 * @example
 * formatMeetingIdForDisplay("82259735801") // "822 5973 5801"
 */
function formatMeetingIdForDisplay(meetingId) {
	if (!meetingId) {
		return '';
	}
	
	const normalized = normalizeMeetingId(meetingId);
	
	// 11桁の場合：XXX XXXX XXXX
	if (normalized.length === 11) {
		return normalized.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
	}
	
	// 10桁の場合：XXX XXX XXXX
	if (normalized.length === 10) {
		return normalized.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
	}
	
	// その他の長さの場合は3桁ずつ区切る
	return normalized.replace(/(\d{3})/g, '$1 ').trim();
}

/**
 * Meeting IDまたはUUIDが有効かチェック
 * 
 * @param {string} meetingIdentifier - Meeting IDまたはUUID
 * @returns {Object} バリデーション結果
 */
function validateMeetingIdentifier(meetingIdentifier) {
	if (!meetingIdentifier) {
		return {
			isValid: false,
			type: null,
			error: 'Meeting IDまたはUUIDが指定されていません'
		};
	}
	
	const str = String(meetingIdentifier).trim();
	
	// UUIDの場合（文字、数字、特殊文字を含む）
	if (str.includes('/') || str.includes('=') || str.includes('+') || str.includes('-')) {
		return {
			isValid: true,
			type: 'uuid',
			normalized: str // UUIDはそのまま
		};
	}
	
	// Meeting IDの場合
	try {
		const normalized = normalizeMeetingId(str);
		return {
			isValid: true,
			type: 'meeting_id',
			normalized: normalized
		};
	} catch (error) {
		return {
			isValid: false,
			type: null,
			error: error.message
		};
	}
}

/**
 * Zoom API用のMeeting ID/UUIDをエンコード
 * UUIDの場合は特殊文字を適切にエンコード
 * 
 * @param {string} meetingIdentifier - Meeting IDまたはUUID
 * @returns {string} API用にエンコードされた識別子
 */
function encodeMeetingIdentifierForAPI(meetingIdentifier) {
	const validation = validateMeetingIdentifier(meetingIdentifier);
	
	if (!validation.isValid) {
		throw new Error(validation.error);
	}
	
	if (validation.type === 'uuid') {
		// UUIDの場合は特殊文字をエンコード（必要に応じて二重エンコード）
		if (meetingIdentifier.startsWith('/') || meetingIdentifier.includes('//')) {
			return encodeURIComponent(encodeURIComponent(meetingIdentifier));
		}
		return encodeURIComponent(meetingIdentifier);
	}
	
	// Meeting IDの場合は正規化済みの数字をそのまま返す
	return validation.normalized;
}

/**
 * VTTファイル（字幕ファイル）を解析して発言者情報付きの文字起こしを生成
 * @param {string} vttContent - VTTファイルの内容
 * @returns {Object} 解析結果
 */
function parseVTTContent(vttContent) {
	const parseErrors = [];
	const parseWarnings = [];
	
	try {
		// VTTファイルの基本構造チェック
		if (!vttContent || typeof vttContent !== 'string') {
			return {
				success: false,
				error: 'VTTファイルの内容が無効です',
				details: 'ファイルが空または文字列ではありません'
			};
		}
		
		if (!vttContent.includes('WEBVTT')) {
			parseWarnings.push('VTTヘッダー (WEBVTT) が見つかりません');
		}
		
		const lines = vttContent.split('\n');
		const transcripts = [];
		let currentTime = '';
		let currentSpeaker = '';
		let currentText = '';
		let timeStampCount = 0;
		let speakerCount = 0;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// タイムスタンプ行を検出 (例: 00:00:17.000 --> 00:00:19.000)
			if (line.includes('-->')) {
				currentTime = line;
				timeStampCount++;
				
				// タイムスタンプ形式の基本チェック
				if (!/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) {
					parseWarnings.push(`行 ${i+1}: タイムスタンプ形式が不正 - ${line}`);
				}
				continue;
			}
			
			// 発言者と内容の行を検出 (例: 61246  上辻としゆき: はい。こんばんは。)
			if (line && !line.startsWith('WEBVTT') && !line.includes('-->') && line.includes(':')) {
				// 発言者名を抽出 (数字ID + 名前: の部分)
				const speakerMatch = line.match(/^\d+\s+([^:]+):\s*(.*)$/);
				if (speakerMatch) {
					currentSpeaker = speakerMatch[1].trim();
					currentText = speakerMatch[2].trim();
					speakerCount++;
					
					if (currentTime && currentSpeaker && currentText) {
						transcripts.push({
							time: currentTime,
							speaker: currentSpeaker,
							text: currentText
						});
					} else {
						if (!currentTime) {
							parseWarnings.push(`行 ${i+1}: タイムスタンプなしの発言 - ${line}`);
						}
						if (!currentText) {
							parseWarnings.push(`行 ${i+1}: 発言内容が空 - ${line}`);
						}
					}
				} else if (line.includes(':')) {
					// 発言者形式にマッチしない場合の詳細チェック
					parseWarnings.push(`行 ${i+1}: 発言者形式が不正 - ${line}`);
				}
			}
		}
		
		// 発言者別に文字起こしを整理
		const speakerTranscripts = {};
		const chronologicalTranscript = [];
		
		transcripts.forEach(item => {
			if (!speakerTranscripts[item.speaker]) {
				speakerTranscripts[item.speaker] = [];
			}
			speakerTranscripts[item.speaker].push(item.text);
			chronologicalTranscript.push(`${item.speaker}: ${item.text}`);
		});
		
		// 連続するテキストを結合
		const combinedTranscript = chronologicalTranscript.join('\n');
		
		// データ品質チェック
		if (transcripts.length === 0) {
			parseErrors.push('発言データが見つかりません');
		}
		
		if (Object.keys(speakerTranscripts).length === 0) {
			parseErrors.push('発言者が特定できません');
		}
		
		if (timeStampCount === 0) {
			parseErrors.push('タイムスタンプが見つかりません');
		}
		
		// 品質メトリクスの計算
		const qualityMetrics = {
			lineCount: lines.length,
			timeStampCount: timeStampCount,
			speakerCount: speakerCount,
			transcriptCount: transcripts.length,
			averageTextLength: transcripts.reduce((sum, t) => sum + t.text.length, 0) / transcripts.length || 0,
			totalTextLength: transcripts.reduce((sum, t) => sum + t.text.length, 0),
			uniqueSpeakers: Object.keys(speakerTranscripts).length,
			emptyTextEntries: transcripts.filter(t => !t.text.trim()).length,
			shortTextEntries: transcripts.filter(t => t.text.trim().length < 10).length,
			longTextEntries: transcripts.filter(t => t.text.trim().length > 200).length,
			timestampGaps: calculateTimestampGaps(transcripts),
			speakerDistribution: calculateSpeakerDistribution(speakerTranscripts)
		};
		
		// 品質警告の追加チェック
		if (qualityMetrics.emptyTextEntries > 0) {
			parseWarnings.push(`${qualityMetrics.emptyTextEntries}個の空の発言エントリがあります`);
		}
		
		if (qualityMetrics.shortTextEntries > qualityMetrics.transcriptCount * 0.3) {
			parseWarnings.push(`短い発言（10文字未満）が全体の30%以上を占めています（${qualityMetrics.shortTextEntries}/${qualityMetrics.transcriptCount}）`);
		}
		
		if (qualityMetrics.uniqueSpeakers === 1) {
			parseWarnings.push('発言者が1人のみです。マルチスピーカーの場合は発言者情報が不足している可能性があります');
		}
		
		if (qualityMetrics.averageTextLength < 20) {
			parseWarnings.push(`平均発言長が短すぎます（${qualityMetrics.averageTextLength.toFixed(1)}文字）。音声認識の精度が低い可能性があります`);
		}
		
		if (qualityMetrics.timestampGaps.largeGaps > 0) {
			parseWarnings.push(`${qualityMetrics.timestampGaps.largeGaps}個の大きなタイムスタンプの間隔があります（5分以上）`);
		}
		
		// 品質スコアの計算（0-100点）
		const qualityScore = calculateVTTQualityScore(qualityMetrics, parseWarnings.length, parseErrors.length);
		
		// 改善提案の生成
		const improvementSuggestions = generateImprovementSuggestions(qualityMetrics, parseWarnings, parseErrors);
		
		// 重要なエラーがある場合は失敗とする
		if (parseErrors.length > 0) {
			return {
				success: false,
				error: `VTT解析エラー: ${parseErrors.join(', ')}`,
				details: {
					errors: parseErrors,
					warnings: parseWarnings,
					lineCount: lines.length,
					timeStampCount: timeStampCount,
					speakerCount: speakerCount,
					transcriptCount: transcripts.length
				},
				speakers: Object.keys(speakerTranscripts),
				speakerTranscripts: speakerTranscripts,
				chronologicalTranscript: combinedTranscript,
				rawTranscripts: transcripts
			};
		}
		
		return {
			success: true,
			speakers: Object.keys(speakerTranscripts),
			speakerTranscripts: speakerTranscripts,
			chronologicalTranscript: combinedTranscript,
			rawTranscripts: transcripts,
			quality: {
				warnings: parseWarnings,
				metrics: qualityMetrics,
				qualityScore: qualityScore,
				improvementSuggestions: improvementSuggestions,
				processingInfo: {
					parseTime: Date.now(),
					version: '1.0.0',
					parser: 'zoom-vtt-parser'
				}
			}
		};
		
	} catch (error) {
		console.error('VTTファイル解析エラー:', error);
		return {
			success: false,
			error: error.message,
			speakers: [],
			speakerTranscripts: {},
			chronologicalTranscript: '',
			rawTranscripts: [],
			quality: {
				warnings: [`VTT解析中に予期しないエラーが発生しました: ${error.message}`],
				metrics: null,
				qualityScore: 0,
				improvementSuggestions: ['VTTファイルの形式を確認してください', 'ファイルが破損していないか確認してください'],
				processingInfo: {
					parseTime: Date.now(),
					version: '1.0.0',
					parser: 'zoom-vtt-parser',
					error: true
				}
			}
		};
	}
}

/**
 * VTTファイルのタイムスタンプ間隔を計算
 * @param {Array} transcripts - 文字起こしデータ
 * @returns {Object} タイムスタンプ間隔の統計
 */
function calculateTimestampGaps(transcripts) {
	const gaps = [];
	let largeGaps = 0;
	let totalGapTime = 0;
	
	for (let i = 1; i < transcripts.length; i++) {
		const prev = transcripts[i - 1];
		const curr = transcripts[i];
		
		if (prev.time && curr.time) {
			try {
				// タイムスタンプから時間を抽出（例: "00:01:30.000 --> 00:01:32.000"）
				const prevEnd = parseVTTTimestamp(prev.time.split(' --> ')[1]);
				const currStart = parseVTTTimestamp(curr.time.split(' --> ')[0]);
				
				if (prevEnd && currStart) {
					const gapSeconds = currStart - prevEnd;
					gaps.push(gapSeconds);
					totalGapTime += gapSeconds;
					
					if (gapSeconds > 300) { // 5分以上のギャップ
						largeGaps++;
					}
				}
			} catch (error) {
				// タイムスタンプ解析エラーは無視
			}
		}
	}
	
	return {
		largeGaps,
		averageGap: gaps.length > 0 ? totalGapTime / gaps.length : 0,
		maxGap: gaps.length > 0 ? Math.max(...gaps) : 0,
		minGap: gaps.length > 0 ? Math.min(...gaps) : 0,
		totalGaps: gaps.length
	};
}

/**
 * VTTタイムスタンプを秒に変換
 * @param {string} timestamp - VTTタイムスタンプ（例: "00:01:30.000"）
 * @returns {number} 秒数
 */
function parseVTTTimestamp(timestamp) {
	if (!timestamp) return null;
	
	const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
	if (!match) return null;
	
	const [, hours, minutes, seconds, milliseconds] = match;
	return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
}

/**
 * 発言者の発言分布を計算
 * @param {Object} speakerTranscripts - 発言者別の文字起こし
 * @returns {Object} 発言者分布の統計
 */
function calculateSpeakerDistribution(speakerTranscripts) {
	const speakers = Object.keys(speakerTranscripts);
	const distribution = {};
	let totalStatements = 0;
	
	speakers.forEach(speaker => {
		const statements = speakerTranscripts[speaker];
		const statementCount = statements.length;
		const totalLength = statements.reduce((sum, text) => sum + text.length, 0);
		
		distribution[speaker] = {
			statementCount,
			totalLength,
			averageLength: totalLength / statementCount || 0
		};
		
		totalStatements += statementCount;
	});
	
	// パーセンテージ計算
	speakers.forEach(speaker => {
		distribution[speaker].percentage = (distribution[speaker].statementCount / totalStatements) * 100;
	});
	
	return {
		speakers: distribution,
		totalStatements,
		dominantSpeaker: speakers.reduce((prev, curr) => 
			distribution[curr].statementCount > distribution[prev].statementCount ? curr : prev
		),
		balanceScore: calculateSpeakerBalanceScore(distribution)
	};
}

/**
 * 発言者バランススコアを計算
 * @param {Object} distribution - 発言者分布
 * @returns {number} バランススコア（0-100）
 */
function calculateSpeakerBalanceScore(distribution) {
	const speakers = Object.keys(distribution);
	if (speakers.length <= 1) return 0;
	
	const percentages = speakers.map(speaker => distribution[speaker].percentage);
	const idealPercentage = 100 / speakers.length;
	
	// 標準偏差を計算してバランススコアを決定
	const variance = percentages.reduce((sum, p) => sum + Math.pow(p - idealPercentage, 2), 0) / speakers.length;
	const standardDeviation = Math.sqrt(variance);
	
	// スコアを0-100に正規化（標準偏差が小さいほど高スコア）
	return Math.max(0, Math.min(100, 100 - (standardDeviation * 2)));
}

/**
 * VTT品質スコアを計算
 * @param {Object} metrics - 品質メトリクス
 * @param {number} warningCount - 警告数
 * @param {number} errorCount - エラー数
 * @returns {number} 品質スコア（0-100）
 */
function calculateVTTQualityScore(metrics, warningCount, errorCount) {
	let score = 100;
	
	// エラーによる減点
	score -= errorCount * 30;
	
	// 警告による減点
	score -= warningCount * 5;
	
	// 品質メトリクスによる調整
	if (metrics.emptyTextEntries > 0) {
		score -= metrics.emptyTextEntries * 2;
	}
	
	if (metrics.averageTextLength < 20) {
		score -= 10;
	}
	
	if (metrics.uniqueSpeakers === 1 && metrics.speakerCount > 1) {
		score -= 15; // 複数の発言があるのに発言者が1人の場合
	}
	
	if (metrics.timestampGaps.largeGaps > 0) {
		score -= metrics.timestampGaps.largeGaps * 5;
	}
	
	// 発言者バランスボーナス
	if (metrics.speakerDistribution.balanceScore > 70) {
		score += 5;
	}
	
	return Math.max(0, Math.min(100, score));
}

/**
 * VTT品質改善提案を生成
 * @param {Object} metrics - 品質メトリクス
 * @param {Array} warnings - 警告一覧
 * @param {Array} errors - エラー一覧
 * @returns {Array} 改善提案一覧
 */
function generateImprovementSuggestions(metrics, warnings, errors) {
	const suggestions = [];
	
	if (errors.length > 0) {
		suggestions.push('VTTファイルの基本構造を確認し、エラーを修正してください');
	}
	
	if (metrics.emptyTextEntries > 0) {
		suggestions.push('空の発言エントリを削除または内容を追加してください');
	}
	
	if (metrics.averageTextLength < 20) {
		suggestions.push('音声認識精度を向上させるため、より高品質な録音を使用してください');
	}
	
	if (metrics.uniqueSpeakers === 1 && metrics.speakerCount > 1) {
		suggestions.push('発言者の識別精度を向上させるため、各発言者を明確に区別してください');
	}
	
	if (metrics.timestampGaps.largeGaps > 0) {
		suggestions.push('大きなタイムスタンプの間隔がある部分を確認し、必要に応じて分割してください');
	}
	
	if (metrics.speakerDistribution.balanceScore < 50) {
		suggestions.push('発言者間のバランスを改善するため、各参加者の発言機会を調整してください');
	}
	
	if (metrics.shortTextEntries > metrics.transcriptCount * 0.3) {
		suggestions.push('短い発言が多すぎます。関連する発言をまとめることを検討してください');
	}
	
	if (suggestions.length === 0) {
		suggestions.push('VTTファイルの品質は良好です');
	}
	
	return suggestions;
}

/**
 * ZoomアクセストークンでVTTファイルをダウンロード
 * @param {string} vttUrl - VTTファイルのURL
 * @param {string} accessToken - Zoomアクセストークン
 * @returns {Promise<string>} VTTファイルの内容
 */
async function downloadVTTFile(vttUrl, accessToken) {
	const axios = require('axios');
	
	try {
		const response = await axios.get(vttUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'User-Agent': 'AI-Agent-Service/1.0'
			}
		});
		
		return response.data;
	} catch (error) {
		console.error('VTTファイルダウンロードエラー:', error);
		throw new Error(`VTTファイルのダウンロードに失敗しました: ${error.message}`);
	}
}

/**
 * 会議参加者のメールアドレスを取得
 * @param {string} meetingId - 会議ID
 * @param {string} accessToken - Zoomアクセストークン
 * @returns {Promise<Object>} 参加者情報とメールアドレス
 */
async function getParticipantEmails(meetingId, accessToken) {
	const axios = require('axios');
	
	try {
		console.log(`参加者メールアドレス取得開始: Meeting ID ${meetingId}`);
		
		// Meeting IDを正規化
		const normalizedMeetingId = normalizeMeetingId(meetingId);
		
		// 参加者レポートAPI呼び出し
		const response = await axios.get(
			`https://api.zoom.us/v2/report/meetings/${normalizedMeetingId}/participants`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				params: {
					page_size: 300 // 最大300名まで取得
				}
			}
		);
		
		const participants = response.data.participants || [];
		console.log(`取得した参加者数: ${participants.length}`);
		
		// メールアドレスを持つ参加者のみを抽出
		const emailParticipants = participants
			.filter(p => p.user_email && p.user_email.includes('@'))
			.map(p => ({
				name: p.name || p.user_name || 'Unknown',
				email: p.user_email,
				user_id: p.user_id || '',
				join_time: p.join_time,
				leave_time: p.leave_time,
				duration: p.duration || 0,
				registrant_id: p.registrant_id || ''
			}));
		
		// 全参加者（メールアドレスなしも含む）
		const allParticipants = participants.map(p => ({
			name: p.name || p.user_name || 'Unknown',
			email: p.user_email || '',
			user_id: p.user_id || '',
			join_time: p.join_time,
			leave_time: p.leave_time,
			duration: p.duration || 0,
			registrant_id: p.registrant_id || ''
		}));
		
		console.log(`メールアドレス有り参加者: ${emailParticipants.length}/${participants.length}`);
		
		return {
			success: true,
			totalParticipants: participants.length,
			emailParticipants: emailParticipants.length,
			participants: emailParticipants,
			allParticipants: allParticipants,
			emailAddresses: emailParticipants.map(p => p.email),
			summary: {
				totalCount: participants.length,
				emailCount: emailParticipants.length,
				emailRate: participants.length > 0 ? Math.round((emailParticipants.length / participants.length) * 100) : 0
			}
		};
		
	} catch (error) {
		console.error('参加者メールアドレス取得エラー:', error);
		
		// エラーの詳細を分析
		let errorMessage = '参加者情報の取得に失敗しました';
		let errorDetails = error.message;
		
		if (error.response) {
			const status = error.response.status;
			const data = error.response.data;
			
			switch (status) {
				case 400:
					errorMessage = '無効な会議IDです';
					break;
				case 401:
					errorMessage = 'Zoom API認証に失敗しました';
					break;
				case 403:
					errorMessage = '参加者情報へのアクセス権限がありません';
					break;
				case 404:
					errorMessage = '会議が見つかりません（会議が存在しないか、古すぎる可能性があります）';
					break;
				case 429:
					errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください';
					break;
				default:
					errorMessage = `Zoom API エラー (${status})`;
			}
			
			errorDetails = data?.message || errorDetails;
		}
		
		return {
			success: false,
			error: errorMessage,
			errorDetails: errorDetails,
			totalParticipants: 0,
			emailParticipants: 0,
			participants: [],
			allParticipants: [],
			emailAddresses: [],
			summary: {
				totalCount: 0,
				emailCount: 0,
				emailRate: 0
			}
		};
	}
}

module.exports = {
	normalizeMeetingId,
	formatMeetingIdForDisplay,
	validateMeetingIdentifier,
	encodeMeetingIdentifierForAPI,
	parseVTTContent,
	downloadVTTFile,
	getParticipantEmails,
	// VTT品質チェックヘルパー関数
	calculateTimestampGaps,
	parseVTTTimestamp,
	calculateSpeakerDistribution,
	calculateVTTQualityScore,
	generateImprovementSuggestions
};