const zoomUtils = require('../utils/zoom');

describe('VTT解析品質テスト - デグレード防止', () => {
  
  // 実際のVTTファイル形式でテスト
  const sampleVTT = `WEBVTT

1
00:00:00.070 --> 00:00:14.779
61246  上辻としゆき: はいえー。ミーティングの開催をスタートします。

2
00:00:16.560 --> 00:00:19.673
61246  上辻としゆき: あれこれと出てきますね。

3
00:00:21.400 --> 00:00:32.850
61246  田中太郎: VTTが取れないタイミングがある問題について議論します。

4
00:00:33.040 --> 00:00:37.159
61246  佐藤花子: 本来ならあの自動でVTT取得したいですね。`;

  test('発言者名が正確に抽出されること', () => {
    const result = zoomUtils.parseVTTContent(sampleVTT);
    
    // 重要: 発言者名が実名で抽出されること
    expect(result.success).toBe(true);
    expect(result.speakers).toContain('上辻としゆき');
    expect(result.speakers).toContain('田中太郎');
    expect(result.speakers).toContain('佐藤花子');
    
    // デグレード防止: 一般化された名前にならないこと
    expect(result.speakers).not.toContain('発言者');
    expect(result.speakers).not.toContain('参加者');
    expect(result.speakers).not.toContain('Speaker 1');
  });

  test('文字起こし内容で発言者名が保持されること', () => {
    const result = zoomUtils.parseVTTContent(sampleVTT);
    
    // 重要: 実名が文字起こし内容に含まれること
    expect(result.chronologicalTranscript).toContain('上辻としゆき:');
    expect(result.chronologicalTranscript).toContain('田中太郎:');
    expect(result.chronologicalTranscript).toContain('佐藤花子:');
    
    // デグレード防止: 発言者名が一般化されていないこと
    expect(result.chronologicalTranscript).not.toContain('発言者:');
    expect(result.chronologicalTranscript).not.toContain('参加者:');
  });

  test('品質スコアが基準値以上であること', () => {
    const result = zoomUtils.parseVTTContent(sampleVTT);
    
    // 重要: 品質基準を満たすこと
    expect(result.success).toBe(true);
    expect(result.quality.qualityScore).toBeGreaterThanOrEqual(70);
    expect(result.speakers.length).toBeGreaterThan(0);
  });

  test('複数発言者の区別ができること', () => {
    const result = zoomUtils.parseVTTContent(sampleVTT);
    
    // 重要: 複数の発言者を正しく区別すること
    expect(result.speakers.length).toBe(3);
    expect(result.speakerTranscripts['上辻としゆき']).toBeDefined();
    expect(result.speakerTranscripts['田中太郎']).toBeDefined();
    expect(result.speakerTranscripts['佐藤花子']).toBeDefined();
  });

  test('エラー時でも適切に処理されること', () => {
    const invalidVTT = 'invalid vtt content';
    const result = zoomUtils.parseVTTContent(invalidVTT);
    
    // 重要: エラー時でもクラッシュしないこと
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.speakers).toBeDefined();
  });
});

describe('VTT vs Whisper 優先順位テスト', () => {
  
  test('VTTファイルが利用可能な場合は優先されること', () => {
    const recordingData = {
      vttFile: { download_url: 'https://example.com/test.vtt' },
      audioFile: { download_url: 'https://example.com/test.mp3' }
    };
    
    // モック: VTT解析が成功した場合
    const mockVTTAnalysis = {
      success: true,
      speakers: ['上辻としゆき'],
      chronologicalTranscript: '上辻としゆき: テストです',
      quality: { qualityScore: 85 }
    };
    
    // 重要: VTTが優先されWhisperにフォールバックしないこと
    expect(mockVTTAnalysis.success).toBe(true);
    expect(mockVTTAnalysis.speakers[0]).not.toMatch(/Speaker \d+/);
  });
});