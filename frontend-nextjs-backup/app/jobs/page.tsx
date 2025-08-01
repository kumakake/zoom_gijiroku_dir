'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import { agentApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Job {
	agent_job_uuid: string;
	id: string; // バックエンドで agent_job_uuid as id として返される
	type: string;
	status: string;
	created_by_uuid: string;
	created_by_name: string;
	trigger_data: any;
	error_message: string | null;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
}

interface JobsResponse {
	jobs: Job[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		pages: number;
	};
}

export default function JobsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 20,
		total: 0,
		pages: 0
	});
	const [filters, setFilters] = useState({
		status: '',
		type: ''
	});

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		loadJobs();
	}, [session, status, router, filters, pagination.page]);

	const loadJobs = async () => {
		try {
			setLoading(true);
			
			// セッションが確立されているか確認
			if (!session?.accessToken) {
				console.warn('セッションが確立されていません。ジョブ履歴の取得をスキップします。');
				return;
			}
			
			const params: any = {
				page: pagination.page,
				limit: pagination.limit
			};
			
			if (filters.status) params.status = filters.status;
			if (filters.type) params.type = filters.type;

			const response: JobsResponse = await agentApi.getJobs(params);
			console.log('ジョブ履歴API応答:', response);
			console.log('ジョブデータ配列:', response.jobs);
			setJobs(response.jobs);
			setPagination(prev => ({
				...prev,
				total: response.pagination.total,
				pages: response.pagination.pages
			}));
		} catch (error) {
			console.error('ジョブ履歴取得エラー:', error);
			toast.error('ジョブ履歴の取得に失敗しました');
		} finally {
			setLoading(false);
		}
	};

	const handlePageChange = (newPage: number) => {
		setPagination(prev => ({ ...prev, page: newPage }));
	};

	const handleFilterChange = (key: string, value: string) => {
		setFilters(prev => ({ ...prev, [key]: value }));
		setPagination(prev => ({ ...prev, page: 1 })); // フィルター変更時は1ページ目に戻る
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
			<span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
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
			minute: '2-digit'
		});
	};

	if (status === 'loading') {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* ヘッダー */}
			<div className="bg-white shadow">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">ジョブ履歴</h1>
							<p className="mt-1 text-sm text-gray-500">
								{session.user?.role === 'admin' ? '全ユーザーのジョブ履歴' : 'あなたのジョブ履歴'}
							</p>
						</div>
						<button
							onClick={() => router.push('/dashboard')}
							className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
						>
							ダッシュボードに戻る
						</button>
					</div>
				</div>
			</div>

			<div className="py-8">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					{/* フィルター */}
					<div className="bg-white p-4 rounded-lg shadow mb-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									ステータス
								</label>
								<select
									value={filters.status}
									onChange={(e) => handleFilterChange('status', e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									<option value="">すべて</option>
									<option value="pending">待機中</option>
									<option value="processing">処理中</option>
									<option value="completed">完了</option>
									<option value="failed">失敗</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									ジョブタイプ
								</label>
								<select
									value={filters.type}
									onChange={(e) => handleFilterChange('type', e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									<option value="">すべて</option>
									<option value="zoom_webhook">Zoom Webhook</option>
									<option value="transcript_generation">議事録生成</option>
									<option value="email_distribution">メール配信</option>
									<option value="audio_upload">音声アップロード</option>
								</select>
							</div>
							<div className="flex items-end">
								<button
									onClick={loadJobs}
									className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									検索
								</button>
							</div>
						</div>
					</div>

					{/* ジョブ一覧 */}
					<div className="bg-white shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<div className="flex justify-between items-center mb-4">
								<h3 className="text-lg leading-6 font-medium text-gray-900">
									ジョブ一覧 ({pagination.total}件)
								</h3>
							</div>

							{loading ? (
								<div className="text-center py-8">
									<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
									<p className="mt-2 text-gray-500">ジョブデータを読み込んでいます...</p>
								</div>
							) : jobs.length > 0 ? (
								<>
									{/* デスクトップ表示 */}
									<div className="hidden md:block overflow-x-auto">
										<table className="min-w-full divide-y divide-gray-200">
											<thead className="bg-gray-50">
												<tr>
													<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
														ジョブタイプ
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
														ステータス
													</th>
													{session.user?.role === 'admin' && (
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
															作成者
														</th>
													)}
													<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
														作成日時
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
														完了日時
													</th>
													<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
														操作
													</th>
												</tr>
											</thead>
											<tbody className="bg-white divide-y divide-gray-200">
												{jobs.map((job) => (
													<tr key={job.agent_job_uuid} className="hover:bg-gray-50">
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm font-medium text-gray-900">
																{getJobTypeLabel(job.type)}
															</div>
															<div className="text-xs text-gray-500">
																ID: {job.id || job.agent_job_uuid}
															</div>
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															{getStatusBadge(job.status)}
															{job.error_message && (
																<div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={job.error_message}>
																	{job.error_message}
																</div>
															)}
														</td>
														{session.user?.role === 'admin' && (
															<td className="px-6 py-4 whitespace-nowrap">
																<div className="text-sm text-gray-900">
																	{job.created_by_name || '未設定'}
																</div>
															</td>
														)}
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm text-gray-900">
																{formatDate(job.created_at)}
															</div>
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="text-sm text-gray-900">
																{job.completed_at ? formatDate(job.completed_at) : '---'}
															</div>
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
															<button
																onClick={() => {
																	const jobId = job.id || job.agent_job_uuid;
																	console.log('ジョブ詳細への遷移:', jobId);
																	router.push(`/jobs/${jobId}`);
																}}
																className="text-blue-600 hover:text-blue-900"
															>
																詳細
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									{/* モバイル表示 */}
									<div className="md:hidden space-y-4">
										{jobs.map((job) => (
											<div key={job.agent_job_uuid} className="border border-gray-200 rounded-lg p-4">
												<div className="flex justify-between items-start mb-2">
													<div>
														<h4 className="text-sm font-medium text-gray-900">
															{getJobTypeLabel(job.type)}
														</h4>
														<p className="text-xs text-gray-500">ID: {job.id || job.agent_job_uuid}</p>
													</div>
													{getStatusBadge(job.status)}
												</div>
												
												{session.user?.role === 'admin' && job.created_by_name && (
													<div className="mb-2">
														<span className="text-xs text-gray-500">作成者: </span>
														<span className="text-xs text-gray-900">{job.created_by_name}</span>
													</div>
												)}
												
												<div className="mb-2">
													<span className="text-xs text-gray-500">作成: </span>
													<span className="text-xs text-gray-900">{formatDate(job.created_at)}</span>
												</div>
												
												{job.completed_at && (
													<div className="mb-2">
														<span className="text-xs text-gray-500">完了: </span>
														<span className="text-xs text-gray-900">{formatDate(job.completed_at)}</span>
													</div>
												)}
												
												{job.error_message && (
													<div className="mb-2">
														<span className="text-xs text-red-600">エラー: {job.error_message}</span>
													</div>
												)}
												
												<div className="flex justify-end">
													<button
														onClick={() => {
															const jobId = job.id || job.agent_job_uuid;
															console.log('ジョブ詳細への遷移（モバイル）:', jobId);
															router.push(`/jobs/${jobId}`);
														}}
														className="text-sm text-blue-600 hover:text-blue-900"
													>
														詳細表示
													</button>
												</div>
											</div>
										))}
									</div>

									{/* ページネーション */}
									{pagination.pages > 1 && (
										<div className="flex items-center justify-between mt-6">
											<div className="text-sm text-gray-700">
												{((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}件
											</div>
											<div className="flex space-x-1">
												<button
													onClick={() => handlePageChange(pagination.page - 1)}
													disabled={pagination.page <= 1}
													className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													前へ
												</button>
												
												{[...Array(Math.min(5, pagination.pages))].map((_, i) => {
													const pageNum = Math.max(1, pagination.page - 2) + i;
													if (pageNum > pagination.pages) return null;
													
													return (
														<button
															key={pageNum}
															onClick={() => handlePageChange(pageNum)}
															className={`px-3 py-2 text-sm font-medium rounded-md ${
																pageNum === pagination.page
																	? 'bg-blue-600 text-white'
																	: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
															}`}
														>
															{pageNum}
														</button>
													);
												})}
												
												<button
													onClick={() => handlePageChange(pagination.page + 1)}
													disabled={pagination.page >= pagination.pages}
													className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													次へ
												</button>
											</div>
										</div>
									)}
								</>
							) : (
								<div className="text-center py-8 text-gray-500">
									<div className="w-16 h-16 mx-auto mb-4">
										<svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									</div>
									<p className="text-lg font-medium text-gray-900 mb-2">ジョブデータがありません</p>
									<p className="text-gray-500">
										{filters.status || filters.type ? 'フィルター条件に該当するジョブが見つかりません' : 'まだジョブが実行されていません'}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}