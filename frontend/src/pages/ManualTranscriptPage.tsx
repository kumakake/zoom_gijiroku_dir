import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface CreateJobResponse {
	success: boolean;
	message: string;
	agent_job_id: number;
	agent_job_uuid: string;
	queue_job_id: string;
	meeting_id: string;
}

interface JobStatusResponse {
	success: boolean;
	job: {
		id: number;
		uuid: string;
		type: string;
		status: string;
		error_message?: string;
		result?: any;
		created_at: string;
		updated_at: string;
		completed_at?: string;
		transcript?: {
			uuid: string;
			topic: string;
			start_time: string;
		};
	};
}

const ManualTranscriptPage = () => {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	
	// Get token from localStorage
	const getToken = () => localStorage.getItem('auth_token');
	
	// Form State
	const [formData, setFormData] = useState({
		meeting_id: '',
		meeting_topic: '',
		host_email: '',
		start_time: ''
	});
	
	// Job State
	const [isCreating, setIsCreating] = useState(false);
	const [jobId, setJobId] = useState<number | null>(null);
	const [jobStatus, setJobStatus] = useState<string>('');
	const [jobError, setJobError] = useState<string>('');
	const [transcriptUuid, setTranscriptUuid] = useState<string>('');
	const [isPolling, setIsPolling] = useState(false);
	
	// Handle form input changes
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({
			...prev,
			[name]: value
		}));
	};
	
	// API call to create manual transcript
	const createManualTranscript = async (data: typeof formData): Promise<CreateJobResponse> => {
		const token = getToken();
		if (!token) {
			throw new Error('認証トークンが見つかりません。再度ログインしてください。');
		}
		
		const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
		const response = await fetch(`${baseURL}/api/manual-transcripts/create-from-meeting-id`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify(data)
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			let errorData;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				throw new Error(`HTTP ${response.status}: ${errorText || '議事録作成に失敗しました'}`);
			}
			throw new Error(errorData.error || '議事録作成に失敗しました');
		}
		
		return await response.json();
	};
	
	// API call to check job status
	const checkJobStatus = async (jobId: number): Promise<JobStatusResponse> => {
		const token = getToken();
		if (!token) {
			throw new Error('認証トークンが見つかりません。再度ログインしてください。');
		}
		
		const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
		const response = await fetch(`${baseURL}/api/manual-transcripts/job-status/${jobId}`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			let errorData;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				throw new Error(`HTTP ${response.status}: ${errorText || 'ジョブステータス確認に失敗しました'}`);
			}
			throw new Error(errorData.error || 'ジョブステータス確認に失敗しました');
		}
		
		return await response.json();
	};
	
	// Poll job status
	const pollJobStatus = async (jobId: number) => {
		setIsPolling(true);
		
		const poll = async () => {
			try {
				const response = await checkJobStatus(jobId);
				const job = response.job;
				
				setJobStatus(job.status);
				setJobError(job.error_message || '');
				
				if (job.status === 'completed') {
					if (job.transcript) {
						setTranscriptUuid(job.transcript.uuid);
						toast.success('議事録が正常に作成されました！');
					}
					setIsPolling(false);
					return;
				} else if (job.status === 'failed') {
					toast.error('議事録作成に失敗しました');
					setIsPolling(false);
					return;
				}
				
				// Continue polling
				setTimeout(poll, 3000);
			} catch (error) {
				console.error('ジョブステータス確認エラー:', error);
				setIsPolling(false);
			}
		};
		
		poll();
	};
	
	// Handle form submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		// Validation
		if (!formData.meeting_id.trim()) {
			toast.error('ミーティングIDを入力してください');
			return;
		}
		
		try {
			setIsCreating(true);
			setJobError('');
			setTranscriptUuid('');
			
			// Fill in default values
			const submitData = {
				meeting_id: formData.meeting_id.trim(),
				meeting_topic: formData.meeting_topic.trim() || 'ミーティング',
				host_email: formData.host_email.trim() || user?.email || '',
				start_time: formData.start_time || new Date().toISOString()
			};
			
			console.log('📝 手動議事録作成開始:', submitData);
			
			const response = await createManualTranscript(submitData);
			
			console.log('✅ 手動議事録作成レスポンス:', response);
			
			setJobId(response.agent_job_id);
			setJobStatus('pending');
			
			toast.success('議事録作成を開始しました');
			
			// Start polling
			pollJobStatus(response.agent_job_id);
			
		} catch (error: any) {
			console.error('議事録作成エラー:', error);
			toast.error(error.message || '議事録作成に失敗しました');
		} finally {
			setIsCreating(false);
		}
	};
	
	// Reset form
	const handleReset = () => {
		setFormData({
			meeting_id: '',
			meeting_topic: '',
			host_email: '',
			start_time: ''
		});
		setJobId(null);
		setJobStatus('');
		setJobError('');
		setTranscriptUuid('');
		setIsPolling(false);
	};
	
	// Get status message
	const getStatusMessage = () => {
		switch (jobStatus) {
			case 'pending':
				return '⏳ 処理開始待ち...';
			case 'processing':
				return '⚙️ 議事録を生成中...';
			case 'completed':
				return '✅ 議事録作成完了';
			case 'failed':
				return '❌ 議事録作成失敗';
			default:
				return '';
		}
	};
	
	return (
		<div className="dashboard">
			{/* Header */}
			<header className="dashboard-header">
				<div className="dashboard-header-content">
					<div className="dashboard-logo">
						<div className="dashboard-logo-icon">
							➕
						</div>
						<div>
							<h1 className="dashboard-title">手動議事録作成</h1>
							<p className="dashboard-subtitle">
								ミーティングIDから議事録を生成します
							</p>
						</div>
					</div>
					<div className="dashboard-nav">
						<Link to="/transcripts" className="dashboard-nav-link">
							← 議事録一覧
						</Link>
						<Link to="/dashboard" className="dashboard-nav-link">
							ダッシュボード
						</Link>
						<button onClick={logout} className="dashboard-logout-btn">
							ログアウト
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="dashboard-main">
				{/* 入力フォームセクション */}
				<div className="dashboard-section">
					<div className="dashboard-section-header">
						<h2 className="dashboard-section-title">会議情報入力</h2>
					</div>
					<div className="dashboard-section-content">
						<form onSubmit={handleSubmit} className="profile-form">
							<div className="profile-form-grid">
								<div className="profile-form-group">
									<label className="profile-form-label">
										ミーティングID <span style={{ color: 'red' }}>*</span>
									</label>
									<input
										type="text"
										name="meeting_id"
										placeholder="例: 838 1307 4567 または 83813074567"
										value={formData.meeting_id}
										onChange={handleInputChange}
										className="profile-form-input"
										required
									/>
									<p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
										スペースありなしどちらでも入力可能です
									</p>
								</div>
								
								<div className="profile-form-group">
									<label className="profile-form-label">会議名</label>
									<input
										type="text"
										name="meeting_topic"
										placeholder="例: VTT取得テスト会議（省略可）"
										value={formData.meeting_topic}
										onChange={handleInputChange}
										className="profile-form-input"
									/>
								</div>
								
								<div className="profile-form-group">
									<label className="profile-form-label">ホストメールアドレス</label>
									<input
										type="email"
										name="host_email"
										placeholder={`例: ${user?.email}（省略時は現在のユーザー）`}
										value={formData.host_email}
										onChange={handleInputChange}
										className="profile-form-input"
									/>
								</div>
								
								<div className="profile-form-group">
									<label className="profile-form-label">開始時刻</label>
									<input
										type="datetime-local"
										name="start_time"
										value={formData.start_time}
										onChange={handleInputChange}
										className="profile-form-input"
									/>
									<p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
										省略時は現在時刻が使用されます
									</p>
								</div>
							</div>
							
							<div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
								<button
									type="submit"
									disabled={isCreating || isPolling}
									className="profile-form-button"
									style={{ flex: 1 }}
								>
									{isCreating ? (
										<>
											<LoadingSpinner />
											<span style={{ marginLeft: '0.5rem' }}>作成中...</span>
										</>
									) : (
										'🚀 議事録作成開始'
									)}
								</button>
								
								<button
									type="button"
									onClick={handleReset}
									disabled={isCreating || isPolling}
									className="profile-logout-btn"
								>
									🔄 リセット
								</button>
							</div>
						</form>
					</div>
				</div>

				{/* 作成状況セクション */}
				{jobId && (
					<div className="dashboard-section">
						<div className="dashboard-section-header">
							<h2 className="dashboard-section-title">作成状況</h2>
						</div>
						<div className="dashboard-section-content">
							<div className="dashboard-feature-card">
								<div className="dashboard-feature-header">
									<div className="dashboard-feature-icon blue">
										⚙️
									</div>
									<div style={{ flex: 1 }}>
										<h3 className="dashboard-feature-title">
											ジョブ #{jobId}
										</h3>
										<p className="dashboard-feature-desc">
											{getStatusMessage()}
										</p>
									</div>
								</div>
								
								{isPolling && (
									<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
										<LoadingSpinner />
										<span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
											処理中... 自動で更新されます
										</span>
									</div>
								)}
								
								{jobError && (
									<div style={{ 
										padding: '1rem', 
										backgroundColor: '#fef2f2', 
										border: '1px solid #fecaca', 
										borderRadius: '0.5rem',
										margin: '1rem 0'
									}}>
										<p style={{ margin: 0, color: '#dc2626', fontSize: '0.875rem' }}>
											{jobError}
										</p>
									</div>
								)}
								
								{transcriptUuid && (
									<div style={{ 
										display: 'flex', 
										gap: '0.5rem', 
										marginTop: '1rem' 
									}}>
										<button
											onClick={() => navigate(`/transcripts/${transcriptUuid}`)}
											className="dashboard-feature-button blue"
											style={{ flex: 1 }}
										>
											📖 議事録を表示
										</button>
										<button
											onClick={() => navigate('/transcripts')}
											className="dashboard-feature-button"
											style={{ flex: 1 }}
										>
											📋 一覧に戻る
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* 説明セクション */}
				<div className="dashboard-section">
					<div className="dashboard-section-header">
						<h2 className="dashboard-section-title">機能説明</h2>
					</div>
					<div className="dashboard-section-content">
						<div style={{ display: 'grid', gap: '1rem' }}>
							<div className="dashboard-feature-card">
								<div className="dashboard-feature-header">
									<div className="dashboard-feature-icon green">
										🎯
									</div>
									<div>
										<h3 className="dashboard-feature-title">VTT優先取得</h3>
										<p className="dashboard-feature-desc">
											ZoomのVTTファイルから実名の発言者情報を自動抽出します
										</p>
									</div>
								</div>
							</div>
							
							<div className="dashboard-feature-card">
								<div className="dashboard-feature-header">
									<div className="dashboard-feature-icon blue">
										🤖
									</div>
									<div>
										<h3 className="dashboard-feature-title">AI議事録生成</h3>
										<p className="dashboard-feature-desc">
											Claude AIが要約・整形した読みやすい議事録を自動生成します
										</p>
									</div>
								</div>
							</div>
							
							<div className="dashboard-feature-card">
								<div className="dashboard-feature-header">
									<div className="dashboard-feature-icon yellow">
										⚡
									</div>
									<div>
										<h3 className="dashboard-feature-title">フォールバック対応</h3>
										<p className="dashboard-feature-desc">
											VTTファイルが取得できない場合は、Whisper APIで音声文字起こしを実行します
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};

export default ManualTranscriptPage;