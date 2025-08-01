const Anthropic = require('@anthropic-ai/sdk');

class AnthropicService {
	constructor() {
		console.log('AnthropicService初期化中...');
		console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'セット済み' : '未設定');
		console.log('Anthropic SDK:', typeof Anthropic);
		
		try {
			this.client = new Anthropic({
				apiKey: process.env.ANTHROPIC_API_KEY,
			});
			console.log('Anthropicクライアント初期化成功');
			console.log('Client type:', typeof this.client);
			console.log('Client properties:', Object.getOwnPropertyNames(this.client));
			console.log('Client prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.client)));
			console.log('Available methods:', Object.keys(this.client));
		} catch (error) {
			console.error('Anthropicクライアント初期化エラー:', error);
			throw error;
		}
	}

	/**
	 * Claude APIで議事録を高品質に整形・要約
	 * @param {string} rawTranscript - 生の文字起こしテキスト
	 * @param {Object} meetingInfo - 会議情報
	 * @returns {Promise<Object>} 整形された議事録データ
	 */
	async generateMeetingMinutes(rawTranscript, meetingInfo) {
		try {
			console.log('Claude APIで議事録を生成しています...');

			const prompt = `
以下のZoom会議の音声文字起こしデータを元に、プロフェッショナルな議事録を作成してください。

## 会議情報
- 会議名: ${meetingInfo.topic || '未設定'}
- 開始時間: ${meetingInfo.start_time || '未設定'}
- 所要時間: ${meetingInfo.duration ? `${meetingInfo.duration}分` : '未設定'}
- 参加者: ${meetingInfo.participants ? meetingInfo.participants.map(p => p.name).join(', ') : '未設定'}

## 音声文字起こしデータ
${rawTranscript}

## 出力要件
**重要: 有効なJSONのみを出力してください。コメントや説明は含めず、以下のJSONオブジェクトのみを返してください：**

{
	"formatted_transcript": "詳細な議事録本文（実際の発言内容を含む、マークダウン形式で構造化）",
	"summary": "会議の要約（目的、主な議論点、結論を含む3-5行）",
	"action_items": [
		{
			"item": "明確で実行可能なアクションアイテム",
			"assignee": "担当者名（特定できる場合）",
			"due_date": "期限（言及されている場合）",
			"priority": "high/medium/low"
		}
	],
	"key_decisions": [
		"重要な決定事項（具体的で明確に）"
	],
	"discussion_points": [
		{
			"topic": "議論されたトピック",
			"summary": "議論の要点",
			"outcome": "結論や次のステップ"
		}
	],
	"participants_summary": [
		{
			"name": "参加者名",
			"role": "会議での役割（判明している場合）",
			"key_contributions": ["主な発言・貢献内容"]
		}
	],
	"next_meeting": "次回会議の予定（日時、議題など、言及されている場合）",
	"attachments_mentioned": ["会議中に言及された資料やファイル"],
	"follow_up_required": ["フォローアップが必要な事項"]
}

## formatted_transcript の詳細要件
**重要**: formatted_transcript には以下を含めてください：
1. **実際の発言内容**: 要約だけでなく、実際に話された内容を含める
2. **会話の流れ**: 発言の時系列と文脈を保持
3. **発言者の特定**: 可能な限り「参加者A」「発言者」などで発言者を区別
4. **詳細な記録**: 重要な発言は省略せずに記載

例：
# 会議議事録

## 開始
参加者: はい、こんばんは。見えてるかな。オーディオ入ってますね。

## 主な議論
参加者: テスト用の会議とか議事録を今作っています。これはレコーディングじゃなくて文字起こしですね。テストがちゃんとできるかどうかを含めて、今回やろうとしています。

参加者: 最終的に議事録を作った上で、もう一回配信する。最終的にはワークフローに乗せた形で配信しようというのを考えています。

## 今後の計画
参加者: そのためにZoomが一体何をできるのかということを...（以下続く）

## 品質要件
1. **詳細性**: 実際の発言を可能な限り詳しく記録
2. **構造化**: 見出し、箇条書きを使って読みやすく構造化
3. **正確性**: 発言内容を正確に反映、推測は避ける
4. **文脈保持**: 会話の流れと文脈を維持
5. **日本語**: 自然な日本語で記述
6. **不明な部分**: 聞き取れない部分は [不明瞭] と明記

**出力形式の注意: 必ず有効なJSONのみを出力し、JSONの外に追加のテキストやコメントは含めないでください。**
`;

			console.log('Anthropicクライアント確認:', {
				clientExists: !!this.client,
				messagesExists: !!this.client?.messages,
				createExists: !!this.client?.messages?.create
			});
			
			const message = await this.client.messages.create({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 4000,
				temperature: 0.2,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			});

			const result = message.content[0].text;
			console.log('Claude APIによる議事録生成が完了しました');
			console.log('レスポンス長:', result.length);
			console.log('レスポンスプレビュー:', result.substring(0, 500) + '...');

			// JSONパース
			try {
				const parsedResult = JSON.parse(result);
				console.log('JSON パース成功:', {
					hasFormattedTranscript: !!parsedResult.formatted_transcript,
					formattedTranscriptLength: parsedResult.formatted_transcript?.length || 0,
					hasSummary: !!parsedResult.summary,
					actionItemsCount: parsedResult.action_items?.length || 0
				});
				return parsedResult;
			} catch (parseError) {
				console.error('Claude APIレスポンスのJSONパースエラー:', parseError);
				console.log('Raw response:', result);
				
				// パースエラーの場合はフォールバック
				return {
					formatted_transcript: result,
					summary: '議事録の自動要約に失敗しました',
					action_items: [],
					key_decisions: [],
					discussion_points: [],
					participants_summary: [],
					next_meeting: null,
					attachments_mentioned: [],
					follow_up_required: []
				};
			}

		} catch (error) {
			console.error('Claude API議事録生成エラー:', error);
			throw new Error(`議事録生成に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 既存の議事録を改善・要約
	 * @param {string} existingTranscript - 既存の議事録
	 * @param {string} improvementRequest - 改善要求
	 * @returns {Promise<Object>} 改善された議事録
	 */
	async improveTranscript(existingTranscript, improvementRequest) {
		try {
			console.log('既存議事録を改善しています...');

			const prompt = `
以下の議事録を改善してください。

## 改善要求
${improvementRequest}

## 既存議事録
${existingTranscript}

## 出力要件
改善された議事録をマークダウン形式で出力してください。
- 読みやすさを向上
- 重要な情報を強調
- 構造を整理
- 不明瞭な部分を明確化

改善のポイントも簡潔に説明してください。
`;

			const message = await this.client.messages.create({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 3000,
				temperature: 0.3,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			});

			console.log('議事録の改善が完了しました');
			return {
				improved_transcript: message.content[0].text,
				improvement_notes: '自動改善により構造と読みやすさを向上しました'
			};

		} catch (error) {
			console.error('Claude API議事録改善エラー:', error);
			throw new Error(`議事録改善に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 会議の要約を生成
	 * @param {string} transcript - 議事録テキスト
	 * @returns {Promise<string>} 会議要約
	 */
	async generateMeetingSummary(transcript) {
		try {
			console.log('会議要約を生成しています...');

			const prompt = `
以下の議事録から、簡潔で分かりやすい会議要約を3-5行で作成してください。

## 議事録
${transcript}

## 要約に含めるべき内容
- 会議の目的・背景
- 主な議論点
- 重要な決定事項
- 次のアクションステップ

簡潔で要点を押さえた日本語で記述してください。
`;

			const message = await this.client.messages.create({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 500,
				temperature: 0.2,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			});

			console.log('会議要約の生成が完了しました');
			return message.content[0].text;

		} catch (error) {
			console.error('Claude API要約生成エラー:', error);
			throw new Error(`要約生成に失敗しました: ${error.message}`);
		}
	}
}

module.exports = AnthropicService;