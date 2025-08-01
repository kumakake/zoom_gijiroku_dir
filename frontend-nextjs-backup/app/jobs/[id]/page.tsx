'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import { agentApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface JobDetail {
	agent_job_uuid: string;
	type: string;
	status: string;
	created_by_uuid: string;
	created_by_name: string;
	created_by_email: string;
	trigger_data: any;
	output_data: any;
	error_message: string | null;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [job, setJob] = useState<JobDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const jobUuid = params.id;

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		if (!jobUuid) {
			toast.error('無効なジョブIDです');
			router.push('/jobs');
			return;
		}
		loadJobDetail();
	}, [session, status, router, jobUuid]);

	const loadJobDetail = async () => {
		try {
			setLoading(true);
			
			// セッションが確立されているか確認
			if (!session?.accessToken) {
				console.warn('セッションが確立されていません。ジョブ詳細の取得をスキップします。');
				toast.error('認証が必要です。再度ログインしてください。');
				router.push(paths.login);
				return;
			}
			
			console.log('ジョブUUID:', jobUuid);
			console.log('API呼び出し開始');
			const response = await agentApi.getJob(jobUuid);
			console.log('API応答:', response);
			setJob(response.job);
		} catch (error: any) {
			console.error('ジョブ詳細取得エラー:', error);
			console.error('エラー詳細:', error.response?.data);
			
			if (error.response?.status === 404) {
				toast.error(`無効なジョブIDです (UUID: ${jobUuid})`);
			} else if (error.response?.status === 403) {
				toast.error('このジョブにアクセスする権限がありません');
			} else if (error.response?.status === 401) {
				toast.error('認証エラーです。再度ログインしてください。');
				router.push(paths.login);
			} else {
				toast.error('ジョブ詳細の取得に失敗しました');
			}
			router.push('/jobs');
		} finally {
			setLoading(false);
		}
	};

	const getStatusBadge = (status: string) => {
		const statusConfig: { [key: string]: { bg: string; text: string; label: string } } = {
			pending: { bg: 'bg-gray-100', text: 'text-gray-800', label: '待機中' },
			processing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '処理中' },
			completed: { bg: 'bg-green-100', text: 'text-green-800', label: '完了' },
			failed: { bg: 'bg-red-100', text: 'text-red-800', label: '失敗' }
		};
		
		const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
		
		return (
			<span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.text}`}>
				{config.label}
			</span>
		);
	};

	const getJobTypeLabel = (type: string) => {
		const typeLabels: { [key: string]: string } = {
			'zoom_webhook': 'Zoom Webhook',
			'transcript_generation': '議事録生成',
			'email_distribution': 'メール配信',
			'audio_upload': '音声アップロード'
		};
		return typeLabels[type] || type;
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	};

	const formatJSON = (data: any) => {
		if (!data) return 'データなし';
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return String(data);
		}
	};

	if (status === 'loading' || loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
					<p className="mt-2 text-gray-500">ジョブ詳細を読み込んでいます...</p>
				</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	if (!job) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<p className="text-gray-500">ジョブが見つかりません</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* ヘッダー */}
			<div className="bg-white shadow">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">ジョブ詳細</h1>
							<p className="mt-1 text-sm text-gray-500">
								ジョブUUID: {job.agent_job_uuid} - {getJobTypeLabel(job.type)}
							</p>
						</div>
						<div className="flex space-x-3">
							<button
								onClick={() => router.push('/jobs')}
								className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
							>
								ジョブ一覧に戻る
							</button>
							<button
								onClick={() => router.push('/dashboard')}
								className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
							>
								ダッシュボード
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className="py-8">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					{/* 基本情報 */}
					<div className="bg-white shadow rounded-lg mb-6">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
								基本情報
							</h3>
							<dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
								<div>
									<dt className="text-sm font-medium text-gray-500">ジョブUUID</dt>
									<dd className="mt-1 text-sm text-gray-900">{job.agent_job_uuid}</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">ジョブタイプ</dt>
									<dd className="mt-1 text-sm text-gray-900">{getJobTypeLabel(job.type)}</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">ステータス</dt>
									<dd className="mt-1">{getStatusBadge(job.status)}</dd>
								</div>
								{session.user?.role === 'admin' && (
									<div>
										<dt className="text-sm font-medium text-gray-500">作成者</dt>
										<dd className="mt-1 text-sm text-gray-900">
											{job.created_by_name || '未設定'}
											{job.created_by_email && (
												<div className="text-xs text-gray-500">{job.created_by_email}</div>
											)}
										</dd>
									</div>
								)}
								<div>
									<dt className="text-sm font-medium text-gray-500">作成日時</dt>
									<dd className="mt-1 text-sm text-gray-900">{formatDate(job.created_at)}</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">更新日時</dt>
									<dd className="mt-1 text-sm text-gray-900">{formatDate(job.updated_at)}</dd>
								</div>
								{job.completed_at && (
									<div>
										<dt className="text-sm font-medium text-gray-500">完了日時</dt>
										<dd className="mt-1 text-sm text-gray-900">{formatDate(job.completed_at)}</dd>
									</div>
								)}
								{job.completed_at && job.created_at && (
									<div>
										<dt className="text-sm font-medium text-gray-500">処理時間</dt>
										<dd className="mt-1 text-sm text-gray-900">
											{Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}秒
										</dd>
									</div>
								)}
							</dl>
						</div>
					</div>

					{/* エラーメッセージ */}
					{job.error_message && (
						<div className="bg-red-50 border border-red-200 rounded-lg mb-6">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg leading-6 font-medium text-red-900 mb-4">
									エラー情報
								</h3>
								<div className="bg-red-100 rounded-md p-3">
									<pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">
										{job.error_message}
									</pre>
								</div>
							</div>
						</div>
					)}

					{/* トリガーデータ */}
					{job.trigger_data && (
						<div className="bg-white shadow rounded-lg mb-6">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
									トリガーデータ
								</h3>
								<div className="bg-gray-50 rounded-md p-4">
									<pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
										{formatJSON(job.trigger_data)}
									</pre>
								</div>
							</div>
						</div>
					)}

					{/* 結果データ */}
					{job.output_data && (
						<div className="bg-white shadow rounded-lg mb-6">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
									結果データ
								</h3>
								<div className="bg-gray-50 rounded-md p-4">
									<pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
										{formatJSON(job.output_data)}
									</pre>
								</div>
							</div>
						</div>
					)}

					{/* アクション */}
					<div className="bg-white shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
								関連アクション
							</h3>
							<div className="flex flex-wrap gap-3">
								<button
									onClick={loadJobDetail}
									className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
								>
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									最新状態に更新
								</button>
								
								{job.type === 'transcript_generation' && job.status === 'completed' && (
									<button
										onClick={() => {
											// 関連する議事録を探してリダイレクト
											router.push('/transcripts');
										}}
										className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
									>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
										関連議事録を確認
									</button>
								)}
								
								{job.type === 'audio_upload' && job.status === 'completed' && (
									<button
										onClick={() => router.push('/upload')}
										className="inline-flex items-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100"
									>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
										</svg>
										アップロード履歴を確認
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}