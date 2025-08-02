import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { toast } from 'react-hot-toast';

// 型定義
interface DebugStatus {
  environment: {
    zoom: {
      accountId: boolean;
      clientId: boolean;
      clientSecret: boolean;
      webhookSecret: boolean;
    };
    ai: {
      openai: boolean;
      anthropic: boolean;
    };
    email: {
      smtpHost: boolean;
      smtpUser: boolean;
      smtpPass: boolean;
    };
    database: boolean;
    redis: boolean;
  };
  database: {
    connected: boolean;
    recentJobs: any[];
  };
  endpoints: {
    [key: string]: string;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  transcript?: {
    summary?: string;
    action_items?: any[];
    key_decisions?: any[];
    formatted_transcript?: string;
  };
  results?: {
    steps?: any[];
    progress?: any;
    summary?: any;
    currentStep?: number;
    totalSteps?: number;
    errors?: string[];
  };
  summary?: any;
  scope_tests?: any[];
  recommendations?: any[];
}

interface QueueStatus {
  success: boolean;
  message: string;
  queues: {
    transcript: QueueInfo;
    email: QueueInfo;
  };
}

interface QueueInfo {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  jobs: {
    waiting: JobInfo[];
    active: JobInfo[];
    completed: JobInfo[];
    failed: JobInfo[];
  };
}

interface JobInfo {
  id: number;
  data: any;
  progress: number;
  created_at: string;
  processed_on?: string;
  completed_on?: string;
  failed_reason?: string;
}

interface VTTStats {
  totalTranscripts: number;
  vttUsage: number;
  whisperUsage: number;
  vttUsageRate: number;
  whisperUsageRate: number;
  costSavings: number;
  totalProcessed: number;
  processingTimes: {
    averageVtt: number;
    averageWhisper: number;
  };
  recentJobs: Array<{
    id: string;
    type: string;
    status: string;
    meetingTopic: string;
    processingMethod: string;
    createdAt: string;
    completedAt: string;
    processingDuration: number;
  }>;
}

const DebugPage = () => {
  const { user, logout } = useAuth();
  const [debugStatus, setDebugStatus] = useState<DebugStatus | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [vttStats, setVttStats] = useState<VTTStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [integratedTestRunning, setIntegratedTestRunning] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [meetingId, setMeetingId] = useState<string>('');
  const [recordingData, setRecordingData] = useState<any>(null);
  const [showIntegratedTestDialog, setShowIntegratedTestDialog] = useState(false);
  const [integratedTestParams, setIntegratedTestParams] = useState({
    meetingId: '',
    recipient: 'admin@example.com'
  });

  // テスト結果をクリアする関数
  const clearTestResult = (testName: string) => {
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[testName];
      return newResults;
    });
  };

  // 全テスト結果をクリアする関数
  const clearAllTestResults = () => {
    setTestResults({});
  };

  // 管理者・テナント管理者権限チェック
  if (!user || (user.role !== 'admin' && user.role !== 'tenant_admin')) {
    return (
      <div className="debug">
        <div className="debug-header">
          <div className="debug-header-content">
            <h1 className="debug-title">アクセス拒否</h1>
          </div>
        </div>
        <div className="debug-main">
          <div className="debug-section">
            <div className="debug-section-content">
              <p>このページにアクセスするには管理者権限またはテナント管理者権限が必要です。</p>
              <Link to="/dashboard" className="debug-link">
                ダッシュボードに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // デバッグ状態を取得
  const fetchDebugStatus = async () => {
    try {
      const response = await authApi.get('/api/debug/status');
      setDebugStatus(response.data);
    } catch (error) {
      console.error('デバッグ状態の取得に失敗:', error);
      toast.error('デバッグ状態の取得に失敗しました');
    }
  };

  // キュー状態を取得
  const fetchQueueStatus = async () => {
    try {
      // キュー状態取得は時間がかかる可能性があるため、45秒のタイムアウトを設定
      const response = await authApi.get('/api/debug/queue-status', {
        timeout: 45000
      });
      setQueueStatus(response.data);
      
      if (response.data.fallback) {
        toast.error('Redis接続エラー：フォールバックモードで表示中');
      } else {
        toast.success('キュー状態を更新しました');
      }
    } catch (error: any) {
      console.error('キュー状態の取得に失敗:', error);
      const errorMessage = error.response?.data?.error || error.message || 'キュー状態の取得に失敗しました';
      toast.error(`キュー状態の取得に失敗: ${errorMessage}`);
      
      // フォールバック：空のキュー状態を設定
      setQueueStatus({
        success: false,
        message: 'キュー状態の取得に失敗しました',
        queues: {
          transcript: {
            name: 'transcript',
            counts: { waiting: 0, active: 0, completed: 0, failed: 0 },
            jobs: { waiting: [], active: [], completed: [], failed: [] }
          },
          email: {
            name: 'email',
            counts: { waiting: 0, active: 0, completed: 0, failed: 0 },
            jobs: { waiting: [], active: [], completed: [], failed: [] }
          }
        }
      });
    }
  };

  // VTT統計を取得
  const fetchVTTStats = async () => {
    try {
      const response = await authApi.get('/api/debug/vtt-stats');
      setVttStats(response.data.stats);
    } catch (error) {
      console.error('VTT統計の取得に失敗:', error);
      toast.error('VTT統計の取得に失敗しました');
    }
  };

  // テスト実行
  const runTest = async (testName: string, endpoint: string, params?: any) => {
    setIsLoading(true);
    try {
      const response = await authApi.post(endpoint, params);
      setTestResults(prev => ({
        ...prev,
        [testName]: response.data
      }));
      
      if (response.data.success) {
        toast.success(`${testName}が成功しました`);
      } else {
        toast.error(`${testName}が失敗しました: ${response.data.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          message: errorMessage,
          error: errorMessage
        }
      }));
      toast.error(`${testName}でエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 音声ファイル文字起こしテスト（ファイルアップロード対応）
  const runTranscriptionTest = async () => {
    if (!selectedAudioFile) {
      toast.error('音声ファイルを選択してください');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('audioFile', selectedAudioFile);
      formData.append('title', `デバッグテスト: ${selectedAudioFile.name}`);
      formData.append('description', 'デバッグダッシュボードからの文字起こしテスト');
      
      // authApiを使用してアップロード
      const response = await authApi.post('/api/upload/audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.jobId) {
        // アップロード成功
        toast.success(`音声ファイルのアップロードが完了しました。ジョブID: ${response.data.jobId}`);
        
        setTestResults(prev => ({
          ...prev,
          '文字起こしテスト': {
            success: true,
            message: `音声ファイルのアップロードが完了しました。議事録の生成を開始します。`,
            data: {
              jobId: response.data.jobId,
              fileName: response.data.fileName,
              fileSize: response.data.fileSize,
              processingMethod: response.data.processingMethod
            }
          }
        }));
      } else {
        toast.error('音声ファイルのアップロードに失敗しました');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      setTestResults(prev => ({
        ...prev,
        '文字起こしテスト': {
          success: false,
          message: errorMessage,
          error: errorMessage
        }
      }));
      toast.error(`音声ファイルアップロードエラー: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 録画データ取得テスト
  const runRecordingTest = async () => {
    if (!meetingId.trim()) {
      toast.error('会議IDを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.post(`/api/debug/test-recording/${meetingId}`, {
        meetingId: meetingId
      });
      
      setTestResults(prev => ({
        ...prev,
        '録画データ取得テスト': response.data
      }));
      
      if (response.data.success && response.data.data && response.data.data.recording_files) {
        // 録画データを保存
        setRecordingData(response.data.data);
        toast.success('録画データの取得が成功しました');
      } else {
        toast.error(`録画データ取得テストが失敗しました: ${response.data.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      setTestResults(prev => ({
        ...prev,
        '録画データ取得テスト': {
          success: false,
          message: errorMessage,
          error: errorMessage
        }
      }));
      toast.error(`録画データ取得テストでエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Zoom APIスコープテスト
  const runScopeTest = async () => {
    setIsLoading(true);
    try {
      const cleanMeetingId = meetingId.trim().replace(/\s+/g, '');
      console.log(`🔍 会議ID: "${meetingId}" → "${cleanMeetingId}"`);
      
      const response = await authApi.post('/api/debug/test-scopes', {
        testMeetingId: cleanMeetingId
      });
      
      
      setTestResults(prev => ({
        ...prev,
        'スコープテスト': response.data
      }));
      
      if (response.data.success) {
        // 個別スコープの結果を表示
        const scopeResults = response.data.scope_tests || [];
        const successScopes = scopeResults.filter((test: any) => test.status === 'success').map((test: any) => test.scope);
        const warningScopes = scopeResults.filter((test: any) => test.status === 'warning').map((test: any) => test.scope);
        const failedScopes = scopeResults.filter((test: any) => test.status === 'error').map((test: any) => test.scope);
        
        let message = `スコープテスト完了 (${response.data.summary.success}/${response.data.summary.total} 成功)\n`;
        if (successScopes.length > 0) {
          message += `✅ 成功: ${successScopes.join(', ')}\n`;
        }
        if (warningScopes.length > 0) {
          message += `⚠️ 警告: ${warningScopes.join(', ')}\n`;
        }
        if (failedScopes.length > 0) {
          message += `❌ 失敗: ${failedScopes.join(', ')}`;
        }
        
        toast.success(message, { duration: 6000 });
      } else {
        toast.error(`スコープテストが失敗しました: ${response.data.error}`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      setTestResults(prev => ({
        ...prev,
        'スコープテスト': {
          success: false,
          message: errorMessage,
          error: errorMessage
        }
      }));
      toast.error(`スコープテストでエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 録画データから文字起こしテスト
  const runTranscriptionFromRecording = async () => {
    if (!recordingData || !recordingData.recording_files || recordingData.recording_files.length === 0) {
      toast.error('まず録画データを取得してください');
      return;
    }

    // 音声ファイルを探す（MP4またはM4A）
    const audioFile = recordingData.recording_files.find((file: any) => 
      file.file_type === 'MP4' || file.file_type === 'M4A' || 
      file.recording_type === 'audio_only'
    );

    if (!audioFile) {
      toast.error('録画データに音声ファイルが見つかりません');
      return;
    }

    await runTest('文字起こしテスト（録画データ）', '/api/debug/test-transcription', {
      audioUrl: audioFile.download_url,
      meetingId: meetingId,
      meetingTopic: recordingData.topic || '会議',
      meetingDuration: recordingData.duration || 60
    });
  };

  // ファイル選択ハンドラー
  const handleAudioFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 音声ファイルの形式チェック
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'video/mp4'];
      if (allowedTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|mp4)$/i)) {
        setSelectedAudioFile(file);
        toast.success(`音声ファイルを選択しました: ${file.name}`);
      } else {
        toast.error('サポートされていないファイル形式です。MP3、WAV、M4A、MP4ファイルを選択してください。');
        event.target.value = '';
      }
    }
  };

  // 統合テストダイアログを表示
  const showIntegratedTestDialogHandler = () => {
    setShowIntegratedTestDialog(true);
  };

  // 統合テスト実行
  const runIntegratedTest = async () => {
    if (!integratedTestParams.meetingId.trim()) {
      toast.error('会議IDを入力してください');
      return;
    }
    if (!integratedTestParams.recipient.trim()) {
      toast.error('受信者メールアドレスを入力してください');
      return;
    }

    setIntegratedTestRunning(true);
    setShowIntegratedTestDialog(false);
    
    try {
      const response = await authApi.post('/api/debug/test-full-flow', {
        meetingId: integratedTestParams.meetingId,
        recipient: integratedTestParams.recipient
      }, {
        timeout: 300000 // 5分に延長
      });
      
      console.log('統合テスト結果:', response.data);
      setTestResults(prev => ({
        ...prev,
        '統合テスト': response.data
      }));
      
      if (response.data.success) {
        toast.success('統合テストが成功しました');
      } else {
        toast.error('統合テストが失敗しました');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      setTestResults(prev => ({
        ...prev,
        '統合テスト': {
          success: false,
          message: errorMessage,
          error: errorMessage
        }
      }));
      toast.error(`統合テストでエラーが発生しました: ${errorMessage}`);
    } finally {
      setIntegratedTestRunning(false);
    }
  };

  // キューをクリア
  const clearQueue = async (queueName: string) => {
    if (!confirm(`${queueName}キューの全てのジョブを削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await authApi.post(`/api/debug/clear-queue`, { 
        queueName,
        jobStatus: 'all'
      });
      toast.success(`${queueName}キューをクリアしました`);
      fetchQueueStatus();
    } catch (error) {
      console.error('Queue clear error:', error);
      toast.error(`${queueName}キューのクリアに失敗しました`);
    }
  };

  // Redis診断実行
  const runRedisDiagnosis = async () => {
    try {
      const response = await authApi.get('/api/debug/redis-diagnosis');
      console.log('Redis診断結果:', response.data);
      
      const diagnosis = response.data.diagnosis;
      const results = [
        `接続テスト: ${diagnosis.tests.basic_connection ? '✅ 成功' : '❌ 失敗'}`,
        `応答時間: ${diagnosis.tests.ping_latency || 'N/A'}`,
        `読み書きテスト: ${diagnosis.tests.read_write ? '✅ 成功' : '❌ 失敗'}`,
        `環境: ${diagnosis.environment}`,
        `Redis Host: ${diagnosis.redis_config.host}:${diagnosis.redis_config.port}`
      ];
      
      if (diagnosis.tests.detailed_error) {
        results.push(`エラー: ${diagnosis.tests.detailed_error}`);
      }
      
      alert('Redis診断結果:\n\n' + results.join('\n'));
      
    } catch (error) {
      console.error('Redis診断エラー:', error);
      toast.error('Redis診断に失敗しました');
    }
  };

  // 初期データ取得
  useEffect(() => {
    fetchDebugStatus();
    fetchQueueStatus();
    fetchVTTStats();
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="debug">
      {/* Header */}
      <header className="debug-header">
        <div className="debug-header-content">
          <div className="debug-logo">
            <div className="debug-logo-icon">🐛</div>
            <div>
              <h1 className="debug-title">
                デバッグダッシュボード
                {user.role === 'tenant_admin' && <span className="debug-user-role"> (テナント管理者)</span>}
              </h1>
              <p className="debug-subtitle">
                {user.role === 'admin' 
                  ? 'システム監視・テスト・管理' 
                  : 'テナント用システムテスト・診断'
                }
              </p>
            </div>
          </div>
          <div className="debug-nav">
            <Link to="/dashboard" className="debug-nav-link">
              ダッシュボード
            </Link>
            {user.role === 'tenant_admin' && (
              <Link to="/tenant-admin" className="debug-nav-link">
                テナント管理
              </Link>
            )}
            <button onClick={handleLogout} className="debug-logout-btn">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="debug-main">
        
        {/* システム状態 */}
        <div className="debug-section">
          <div className="debug-section-header">
            <h2 className="debug-section-title">システム状態</h2>
            <button 
              onClick={fetchDebugStatus}
              className="debug-refresh-btn"
            >
              🔄 更新
            </button>
          </div>
          <div className="debug-section-content">
            {debugStatus && (
              <div className="debug-status-grid">
                <div className="debug-status-card">
                  <h3>Zoom設定</h3>
                  <div className="debug-status-items">
                    <div className={`debug-status-item ${debugStatus.environment.zoom.accountId ? 'ok' : 'error'}`}>
                      Account ID: {debugStatus.environment.zoom.accountId ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.zoom.clientId ? 'ok' : 'error'}`}>
                      Client ID: {debugStatus.environment.zoom.clientId ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.zoom.clientSecret ? 'ok' : 'error'}`}>
                      Client Secret: {debugStatus.environment.zoom.clientSecret ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.zoom.webhookSecret ? 'ok' : 'error'}`}>
                      Webhook Secret: {debugStatus.environment.zoom.webhookSecret ? '✓' : '✗'}
                    </div>
                  </div>
                </div>

                <div className="debug-status-card">
                  <h3>AI設定</h3>
                  <div className="debug-status-items">
                    <div className={`debug-status-item ${debugStatus.environment.ai.openai ? 'ok' : 'error'}`}>
                      OpenAI: {debugStatus.environment.ai.openai ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.ai.anthropic ? 'ok' : 'error'}`}>
                      Anthropic: {debugStatus.environment.ai.anthropic ? '✓' : '✗'}
                    </div>
                  </div>
                </div>

                <div className="debug-status-card">
                  <h3>データベース</h3>
                  <div className="debug-status-items">
                    <div className={`debug-status-item ${debugStatus.environment.database ? 'ok' : 'error'}`}>
                      Database: {debugStatus.environment.database ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.redis ? 'ok' : 'error'}`}>
                      Redis: {debugStatus.environment.redis ? '✓' : '✗'}
                    </div>
                  </div>
                </div>

                <div className="debug-status-card">
                  <h3>メール設定</h3>
                  <div className="debug-status-items">
                    <div className={`debug-status-item ${debugStatus.environment.email.smtpHost ? 'ok' : 'error'}`}>
                      SMTP Host: {debugStatus.environment.email.smtpHost ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.email.smtpUser ? 'ok' : 'error'}`}>
                      SMTP User: {debugStatus.environment.email.smtpUser ? '✓' : '✗'}
                    </div>
                    <div className={`debug-status-item ${debugStatus.environment.email.smtpPass ? 'ok' : 'error'}`}>
                      SMTP Pass: {debugStatus.environment.email.smtpPass ? '✓' : '✗'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* テスト機能 */}
        <div className="debug-section">
          <div className="debug-section-header">
            <h2 className="debug-section-title">テスト機能</h2>
          </div>
          <div className="debug-section-content">
            <div className="debug-test-grid">
              <button
                onClick={() => runTest('Webhook受信テスト', '/api/debug/test-webhook')}
                className="debug-test-btn"
                disabled={isLoading}
              >
                📨 Webhook受信テスト
              </button>
              <button
                onClick={() => runTest('Zoom認証テスト', '/api/debug/test-auth')}
                className="debug-test-btn"
                disabled={isLoading}
              >
                🔐 Zoom認証テスト
              </button>
              <div className="debug-test-audio-section">
                <div className="debug-audio-file-selector">
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.mp4"
                    onChange={handleAudioFileSelect}
                    style={{ display: 'none' }}
                    id="audio-file-input"
                  />
                  <label htmlFor="audio-file-input" className="debug-file-select-btn">
                    📁 音声ファイル選択
                  </label>
                  {selectedAudioFile && (
                    <span className="debug-selected-file">
                      選択済み: {selectedAudioFile.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={runTranscriptionTest}
                  className="debug-test-btn"
                  disabled={isLoading || !selectedAudioFile}
                >
                  📝 文字起こしテスト
                </button>
              </div>
              <button
                onClick={() => runTest('議事録生成テスト', '/api/debug/test-transcript-generation', { transcription: 'テスト用の文字起こしテキストです。これはデバッグテスト用のサンプルデータです。', meetingTopic: 'デバッグテスト会議', meetingDuration: 60 })}
                className="debug-test-btn"
                disabled={isLoading}
              >
                📋 議事録生成テスト
              </button>
              <button
                onClick={() => runTest('メール送信テスト', '/api/debug/test-email', { recipient: 'admin@example.com' })}
                className="debug-test-btn"
                disabled={isLoading}
              >
                ✉️ メール送信テスト
              </button>
            </div>

            {/* スコープテスト・録画テスト（会議ID入力付き） */}
            <div className="debug-test-horizontal-section">
              <div className="debug-test-with-input">
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="スコープテスト用会議ID（必須）"
                  className="debug-input-inline"
                />
                <button
                  onClick={runScopeTest}
                  className="debug-test-btn-inline"
                  disabled={isLoading || !meetingId.trim()}
                >
                  🔍 APIスコープテスト
                </button>
              </div>
              <div className="debug-test-with-input">
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="会議IDを入力（例: 123456789）"
                  className="debug-input-inline"
                />
                <button
                  onClick={runRecordingTest}
                  className="debug-test-btn-inline"
                  disabled={isLoading || !meetingId.trim()}
                >
                  🎥 録画データ取得テスト
                </button>
                {recordingData && (
                  <button
                    onClick={runTranscriptionFromRecording}
                    className="debug-test-btn-inline"
                    disabled={isLoading}
                  >
                    📝 録画から文字起こし
                  </button>
                )}
              </div>
            </div>
            
            <div className="debug-integrated-test">
              <button
                onClick={showIntegratedTestDialogHandler}
                className="debug-integrated-btn"
                disabled={integratedTestRunning}
              >
                {integratedTestRunning ? '実行中...' : '🔄 統合テスト実行'}
              </button>
            </div>

            {/* 統合テストダイアログ */}
            {showIntegratedTestDialog && (
              <div className="debug-dialog-overlay">
                <div className="debug-dialog">
                  <div className="debug-dialog-header">
                    <h3>🔄 統合テスト実行</h3>
                    <button
                      onClick={() => setShowIntegratedTestDialog(false)}
                      className="debug-dialog-close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="debug-dialog-content">
                    <p>統合テストでは、Zoom認証からメール送信までの全フローをテストします。</p>
                    
                    <div className="debug-dialog-field">
                      <label htmlFor="meetingId">会議ID:</label>
                      <input
                        type="text"
                        id="meetingId"
                        value={integratedTestParams.meetingId}
                        onChange={(e) => setIntegratedTestParams(prev => ({
                          ...prev,
                          meetingId: e.target.value
                        }))}
                        placeholder="例: 123456789"
                        className="debug-input"
                      />
                    </div>
                    
                    <div className="debug-dialog-field">
                      <label htmlFor="recipient">受信者メール:</label>
                      <input
                        type="email"
                        id="recipient"
                        value={integratedTestParams.recipient}
                        onChange={(e) => setIntegratedTestParams(prev => ({
                          ...prev,
                          recipient: e.target.value
                        }))}
                        placeholder="例: admin@example.com"
                        className="debug-input"
                      />
                    </div>
                  </div>
                  <div className="debug-dialog-footer">
                    <button
                      onClick={() => setShowIntegratedTestDialog(false)}
                      className="debug-dialog-btn debug-dialog-btn-cancel"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={runIntegratedTest}
                      className="debug-dialog-btn debug-dialog-btn-confirm"
                      disabled={!integratedTestParams.meetingId.trim() || !integratedTestParams.recipient.trim()}
                    >
                      統合テスト実行
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* テスト結果 */}
        {Object.keys(testResults).length > 0 && (
          <div className="debug-section">
            <div className="debug-section-header">
              <h2 className="debug-section-title">テスト結果</h2>
              <button
                onClick={clearAllTestResults}
                className="debug-refresh-btn"
                style={{ backgroundColor: '#dc2626' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                🗑️ 全クリア
              </button>
            </div>
            <div className="debug-section-content">
              <div className="debug-results">
                {Object.entries(testResults).map(([testName, result]) => (
                  <div key={testName} className={`debug-result-card ${result.success ? 'success' : 'error'}`}>
                    <div className="debug-result-header">
                      <h3>{testName}</h3>
                      <button
                        onClick={() => clearTestResult(testName)}
                        className="debug-result-clear"
                        title="テスト結果をクリア"
                      >
                        ×
                      </button>
                    </div>
                    <div className="debug-result-status">
                      {result.success ? '✅ 成功' : '❌ 失敗'}
                    </div>
                    <div className="debug-result-message">
                      {result.message}
                    </div>
                    {result.error && (
                      <div className="debug-result-error">
                        エラー: {result.error}
                      </div>
                    )}
                    {(result.data || result.transcript || result.results) && (
                      <div className="debug-result-details">
                        {/* 統合テストの特別表示 */}
                        {testName === '統合テスト' && result.results && result.results.steps ? (
                          <div className="debug-integrated-result">
                            <div className="debug-integrated-summary">
                              <div className="debug-integrated-progress">
                                <span className="debug-integrated-step">
                                  ステップ {result.results.currentStep || 0} / {result.results.totalSteps || 5}
                                </span>
                                {result.results.progress && (
                                  <div className="debug-integrated-status">
                                    <div className="debug-progress-message">{result.results.progress.message}</div>
                                    {result.results.progress.details && (
                                      <div className="debug-progress-details">{result.results.progress.details}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="debug-steps-list">
                              {result.results.steps.map((step: any, index: number) => (
                                <div key={index} className={`debug-step-item ${step.status}`}>
                                  <div className="debug-step-header">
                                    <span className="debug-step-number">ステップ {step.step}</span>
                                    <span className="debug-step-name">{step.name}</span>
                                    <span className={`debug-step-status ${step.status}`}>
                                      {step.status === 'success' ? '✅ 成功' : 
                                       step.status === 'failed' ? '❌ 失敗' : '🔄 実行中'}
                                    </span>
                                  </div>
                                  {step.duration && (
                                    <div className="debug-step-duration">処理時間: {step.duration}ms</div>
                                  )}
                                  {step.details && (
                                    <div className="debug-step-details">
                                      <div className="debug-step-message">{step.details.message}</div>
                                      {step.details.endpoint && (
                                        <div className="debug-step-endpoint">エンドポイント: {step.details.endpoint}</div>
                                      )}
                                    </div>
                                  )}
                                  {step.error && (
                                    <div className="debug-step-error">エラー: {step.error}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {result.results.errors && result.results.errors.length > 0 && (
                              <div className="debug-integrated-errors">
                                <h4>⚠️ エラー一覧</h4>
                                {result.results.errors.map((error: string, index: number) => (
                                  <div key={index} className="debug-error-item">{error}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : testName === 'スコープテスト' ? (
                          <div className="debug-scope-result">
                            <div className="debug-scope-summary">
                              <h4>📊 テスト結果サマリー</h4>
                              <div className="debug-scope-stats">
                                <span className="debug-scope-stat success">
                                  ✅ 成功: {result.summary?.success || 0}
                                </span>
                                <span className="debug-scope-stat failed">
                                  ❌ 失敗: {result.summary?.failed || 0}
                                </span>
                                <span className="debug-scope-stat total">
                                  📊 合計: {result.summary?.total || 0}
                                </span>
                              </div>
                              {/* 成功・失敗したスコープの簡易表示 */}
                              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
                                {result.scope_tests && (
                                  <>
                                    {result.scope_tests.filter((test: any) => test.status === 'success').length > 0 && (
                                      <div style={{ color: '#059669', marginBottom: '0.25rem' }}>
                                        <strong>✅ 成功:</strong> {result.scope_tests.filter((test: any) => test.status === 'success').map((test: any) => 
                                          test.scope === 'cloud_recording:read:list_recording_files:admin' ? '録画ファイル一覧' :
                                          test.scope === 'report:read:list_meeting_participants:admin' ? '参加者一覧' : test.scope
                                        ).join(', ')}
                                      </div>
                                    )}
                                    {result.scope_tests.filter((test: any) => test.status === 'info').length > 0 && (
                                      <div style={{ color: '#3b82f6', marginBottom: '0.25rem' }}>
                                        <strong>ℹ️ 権限確認済み:</strong> {result.scope_tests.filter((test: any) => test.status === 'info').map((test: any) => 
                                          test.scope === 'cloud_recording:read:list_recording_files:admin' ? '録画ファイル一覧' :
                                          test.scope === 'report:read:list_meeting_participants:admin' ? '参加者一覧' : test.scope
                                        ).join(', ')}
                                      </div>
                                    )}
                                    {result.scope_tests.filter((test: any) => test.status === 'error').length > 0 && (
                                      <div style={{ color: '#f59e0b', marginBottom: '0.25rem' }}>
                                        <strong>⚠️ テストデータ不足:</strong> {result.scope_tests.filter((test: any) => test.status === 'error' && test.error?.includes('見つかりません')).map((test: any) => 
                                          test.scope === 'cloud_recording:read:list_recording_files:admin' ? '録画ファイル一覧' :
                                          test.scope === 'report:read:list_meeting_participants:admin' ? '参加者一覧' : test.scope
                                        ).join(', ')}
                                      </div>
                                    )}
                                    {result.scope_tests.filter((test: any) => test.status === 'error' && !test.error?.includes('見つかりません')).length > 0 && (
                                      <div style={{ color: '#dc2626' }}>
                                        <strong>❌ 実際のエラー:</strong> {result.scope_tests.filter((test: any) => test.status === 'error' && !test.error?.includes('見つかりません')).map((test: any) => 
                                          test.scope === 'cloud_recording:read:list_recording_files:admin' ? '録画ファイル一覧' :
                                          test.scope === 'report:read:list_meeting_participants:admin' ? '参加者一覧' : test.scope
                                        ).join(', ')}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="debug-scope-tests">
                              <h4>🔍 スコープ別テスト結果</h4>
                              {result.scope_tests && Array.isArray(result.scope_tests) ? result.scope_tests.map((test: any, index: number) => (
                                <div key={index} className={`debug-scope-test ${test.status === 'success' ? 'success' : (test.status === 'info' ? 'info' : (test.error?.includes('見つかりません') ? 'warning' : 'error'))}`}>
                                  <div className="debug-scope-test-header">
                                    <span className="debug-scope-name" title={test.scope}>
                                      {test.scope === 'cloud_recording:read:list_recording_files:admin' 
                                        ? 'cloud_recording:read (録画ファイル一覧)' 
                                        : test.scope === 'report:read:list_meeting_participants:admin'
                                        ? 'report:read (参加者一覧)'
                                        : test.scope}
                                    </span>
                                    <span className={`debug-scope-status ${test.status === 'success' ? 'success' : (test.status === 'info' ? 'info' : (test.error?.includes('見つかりません') ? 'warning' : 'error'))}`}>
                                      {test.status === 'success' ? '✅' : (test.status === 'info' ? 'ℹ️' : (test.error?.includes('見つかりません') ? '⚠️' : '❌'))}
                                    </span>
                                  </div>
                                  <div className="debug-scope-description">
                                    {test.description}
                                    {test.priority === 'critical' && (
                                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', backgroundColor: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                                        必須
                                      </span>
                                    )}
                                  </div>
                                  <div className="debug-scope-endpoint">
                                    <code>{test.endpoint}</code>
                                  </div>
                                  {test.data && (
                                    <div className="debug-scope-data">📊 {test.data}</div>
                                  )}
                                  {test.error && (
                                    <div className="debug-scope-error">⚠️ {test.error}</div>
                                  )}
                                </div>
                              )) : (
                                <div style={{ color: '#666', fontStyle: 'italic' }}>
                                  スコープテストデータが見つかりません
                                </div>
                              )}
                            </div>
                            
                            {result.recommendations && result.recommendations.length > 0 && (
                              <div className="debug-scope-recommendations">
                                <h4>💡 設定状況</h4>
                                {result.recommendations.map((rec: any, index: number) => (
                                  <div key={index} className={`debug-recommendation ${rec.priority}`}>
                                    <div className="debug-recommendation-header">
                                      <span className="debug-recommendation-scope">
                                        {rec.scope === 'system' ? 'システム全体' : rec.scope}
                                      </span>
                                      <span className={`debug-recommendation-priority ${rec.priority}`}>
                                        {rec.priority === 'critical' ? '🔴 必須' : 
                                         rec.priority === 'success' ? '✅ 正常' : 
                                         rec.priority === 'high' ? '🟡 高' : '🔵 低'}
                                      </span>
                                    </div>
                                    <div className="debug-recommendation-message">{rec.message}</div>
                                    <div className="debug-recommendation-action">
                                      <strong>対応方法:</strong> {rec.action}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : testName === '議事録生成テスト' && result.transcript ? (
                          <div className="debug-transcript-result">
                            <div className="debug-transcript-section">
                              <h4>📋 議事録要約</h4>
                              <div className="debug-transcript-content">
                                {result.transcript.summary}
                              </div>
                            </div>
                            
                            {result.transcript.action_items && result.transcript.action_items.length > 0 && (
                              <div className="debug-transcript-section">
                                <h4>✅ アクションアイテム</h4>
                                <div className="debug-action-items">
                                  {result.transcript.action_items.map((item: any, index: number) => (
                                    <div key={index} className="debug-action-item">
                                      <div className="debug-action-content">{item.item || item}</div>
                                      {item.assignee && (
                                        <div className="debug-action-meta">
                                          <span>担当: {item.assignee}</span>
                                          {item.due_date && <span>期限: {item.due_date}</span>}
                                          {item.priority && <span>優先度: {item.priority}</span>}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {result.transcript.key_decisions && result.transcript.key_decisions.length > 0 && (
                              <div className="debug-transcript-section">
                                <h4>📝 主要な決定事項</h4>
                                <div className="debug-decisions">
                                  {result.transcript.key_decisions.map((decision: any, index: number) => (
                                    <div key={index} className="debug-decision-item">
                                      {decision.decision || decision}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {result.transcript.formatted_transcript && (
                              <details className="debug-full-transcript">
                                <summary>📜 全文議事録を表示</summary>
                                <div className="debug-transcript-full">
                                  <pre>{result.transcript.formatted_transcript}</pre>
                                </div>
                              </details>
                            )}
                          </div>
                        ) : (
                          /* 他のテスト結果のデフォルト表示 */
                          <details>
                            <summary>詳細データ</summary>
                            <pre>{JSON.stringify(result.data, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* キュー状態 */}
        <div className="debug-section">
          <div className="debug-section-header">
            <h2 className="debug-section-title">キュー状態</h2>
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                onClick={runRedisDiagnosis}
                className="debug-refresh-btn"
                style={{backgroundColor: '#ff6b6b'}}
              >
                🩺 Redis診断
              </button>
              <button 
                onClick={fetchQueueStatus}
                className="debug-refresh-btn"
              >
                🔄 更新
              </button>
            </div>
          </div>
          <div className="debug-section-content">
            {queueStatus && (
              <div className="debug-queue-grid">
                <div className="debug-queue-card">
                  <h3>議事録処理キュー</h3>
                  <div className="debug-queue-stats">
                    <div className="debug-queue-stat">
                      <span>待機中:</span> <span className="debug-queue-count">{queueStatus.queues.transcript.counts.waiting}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>実行中:</span> <span className="debug-queue-count">{queueStatus.queues.transcript.counts.active}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>完了:</span> <span className="debug-queue-count">{queueStatus.queues.transcript.counts.completed}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>失敗:</span> <span className="debug-queue-count error">{queueStatus.queues.transcript.counts.failed}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => clearQueue('transcript')}
                    className="debug-clear-btn"
                  >
                    🗑️ キュークリア
                  </button>
                </div>

                <div className="debug-queue-card">
                  <h3>メール送信キュー</h3>
                  <div className="debug-queue-stats">
                    <div className="debug-queue-stat">
                      <span>待機中:</span> <span className="debug-queue-count">{queueStatus.queues.email.counts.waiting}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>実行中:</span> <span className="debug-queue-count">{queueStatus.queues.email.counts.active}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>完了:</span> <span className="debug-queue-count">{queueStatus.queues.email.counts.completed}</span>
                    </div>
                    <div className="debug-queue-stat">
                      <span>失敗:</span> <span className="debug-queue-count error">{queueStatus.queues.email.counts.failed}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => clearQueue('email')}
                    className="debug-clear-btn"
                  >
                    🗑️ キュークリア
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VTT統計 */}
        <div className="debug-section">
          <div className="debug-section-header">
            <h2 className="debug-section-title">VTT/Whisper 使用統計</h2>
            <button 
              onClick={fetchVTTStats}
              className="debug-refresh-btn"
            >
              🔄 更新
            </button>
          </div>
          <div className="debug-section-content">
            {vttStats && (
              <div className="debug-vtt-stats">
                <div className="debug-vtt-summary">
                  <div className="debug-vtt-stat">
                    <span>総処理数:</span> <span>{vttStats.totalTranscripts}</span>
                  </div>
                  <div className="debug-vtt-stat">
                    <span>VTT使用:</span> <span>{vttStats.vttUsage} ({vttStats.vttUsageRate.toFixed(1)}%)</span>
                  </div>
                  <div className="debug-vtt-stat">
                    <span>Whisper使用:</span> <span>{vttStats.whisperUsage} ({vttStats.whisperUsageRate.toFixed(1)}%)</span>
                  </div>
                  <div className="debug-vtt-stat">
                    <span>コスト節約:</span> <span className="debug-cost-savings">${vttStats.costSavings.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="debug-processing-times">
                  <div className="debug-processing-stat">
                    <span>VTT平均処理時間:</span> <span>{vttStats.processingTimes.averageVtt.toFixed(2)}秒</span>
                  </div>
                  <div className="debug-processing-stat">
                    <span>Whisper平均処理時間:</span> <span>{vttStats.processingTimes.averageWhisper.toFixed(2)}秒</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default DebugPage;