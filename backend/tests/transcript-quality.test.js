const AnthropicService = require('../services/anthropicService');

// Anthropic APIをモック
jest.mock('@anthropic-ai/sdk');

describe('議事録生成品質テスト - デグレード防止', () => {
  let anthropicService;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      messages: {
        create: jest.fn()
      }
    };
    
    // AnthropicServiceのコンストラクタをモック
    jest.spyOn(console, 'log').mockImplementation(() => {});
    anthropicService = new AnthropicService();
    anthropicService.client = mockClient;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('発言者名が議事録で保持されること', async () => {
    const inputTranscript = '上辻としゆき: VTTの取得について検討します。\n田中太郎: 技術的な課題があります。';
    const meetingInfo = { topic: 'テスト会議', start_time: '2025-07-21T10:00:00Z' };

    // モックレスポンス: 発言者名が保持された議事録
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          "formatted_transcript": "# テスト会議 議事録\n\n## 開始\n上辻としゆき: VTTの取得について検討します。\n\n## 技術的課題\n田中太郎: 技術的な課題があります。",
          "summary": "VTT取得に関する技術検討会議",
          "action_items": [],
          "key_decisions": [],
          "discussion_points": []
        })
      }]
    };

    mockClient.messages.create.mockResolvedValue(mockResponse);

    const result = await anthropicService.generateMeetingMinutes(inputTranscript, meetingInfo);

    // 重要: 発言者名が実名で保持されること
    expect(result.formatted_transcript).toContain('上辻としゆき:');
    expect(result.formatted_transcript).toContain('田中太郎:');
    
    // デグレード防止: 一般化された名前にならないこと
    expect(result.formatted_transcript).not.toContain('発言者:');
    expect(result.formatted_transcript).not.toContain('参加者:');
    expect(result.formatted_transcript).not.toContain('Speaker 1:');
  });

  test('専門用語・固有名詞が保持されること', async () => {
    const inputTranscript = '上辻としゆき: Zoom APIとWhisper APIを使用してVTTファイルを処理します。予算は50万円です。';
    const meetingInfo = { topic: 'API検討会議' };

    const mockResponse = {
      content: [{
        text: JSON.stringify({
          "formatted_transcript": "# API検討会議 議事録\n\n上辻としゆき: Zoom APIとWhisper APIを使用してVTTファイルを処理します。予算は50万円です。",
          "summary": "API利用に関する技術検討",
          "action_items": []
        })
      }]
    };

    mockClient.messages.create.mockResolvedValue(mockResponse);

    const result = await anthropicService.generateMeetingMinutes(inputTranscript, meetingInfo);

    // 重要: 専門用語が正確に保持されること
    expect(result.formatted_transcript).toContain('Zoom API');
    expect(result.formatted_transcript).toContain('Whisper API');
    expect(result.formatted_transcript).toContain('VTTファイル');
    expect(result.formatted_transcript).toContain('50万円');
    
    // デグレード防止: 一般化されていないこと
    expect(result.formatted_transcript).not.toContain('一般的なAPI');  // 具体名が一般的な表現にならない
    expect(result.formatted_transcript).not.toContain('約50万円'); // 「約」が追加されない
  });

  test('日時・数値が正確に保持されること', async () => {
    const inputTranscript = '田中太郎: 2025年8月15日までに完了予定です。成功率は95.5%でした。';
    const meetingInfo = { topic: '進捗報告' };

    const mockResponse = {
      content: [{
        text: JSON.stringify({
          "formatted_transcript": "# 進捗報告 議事録\n\n田中太郎: 2025年8月15日までに完了予定です。成功率は95.5%でした。",
          "summary": "進捗と成果の報告",
          "action_items": []
        })
      }]
    };

    mockClient.messages.create.mockResolvedValue(mockResponse);

    const result = await anthropicService.generateMeetingMinutes(inputTranscript, meetingInfo);

    // 重要: 具体的な日時・数値が保持されること
    expect(result.formatted_transcript).toContain('2025年8月15日');
    expect(result.formatted_transcript).toContain('95.5%');
    
    // デグレード防止: 曖昧な表現にならないこと
    expect(result.formatted_transcript).not.toContain('来月'); // 具体的日付が曖昧にならない
    expect(result.formatted_transcript).not.toContain('約95%'); // 正確な数値が丸められない
  });

  test('JSON形式が正しく出力されること', async () => {
    const inputTranscript = '上辻としゆき: テストです。';
    const meetingInfo = { topic: 'テスト' };

    const validJSON = {
      "formatted_transcript": "# テスト 議事録\n\n上辻としゆき: テストです。",
      "summary": "テスト会議の議事録",
      "action_items": [],
      "key_decisions": [],
      "discussion_points": []
    };

    const mockResponse = {
      content: [{ text: JSON.stringify(validJSON) }]
    };

    mockClient.messages.create.mockResolvedValue(mockResponse);

    const result = await anthropicService.generateMeetingMinutes(inputTranscript, meetingInfo);

    // 重要: 必須フィールドが含まれること
    expect(result).toHaveProperty('formatted_transcript');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('action_items');
    
    // デグレード防止: データ型が正しいこと
    expect(typeof result.formatted_transcript).toBe('string');
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.action_items)).toBe(true);
  });

  test('エラー時の適切な処理', async () => {
    const inputTranscript = '上辻としゆき: テストです。';
    const meetingInfo = { topic: 'テスト' };

    // API呼び出しエラーをモック
    mockClient.messages.create.mockRejectedValue(new Error('API Error'));

    // 重要: エラー時でもクラッシュしないこと
    await expect(anthropicService.generateMeetingMinutes(inputTranscript, meetingInfo))
      .rejects.toThrow('API Error');
  });
});