'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { agentApi, transcriptApi } from '@/lib/api';
import { paths } from '@/lib/navigation';

export default function DashboardPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [stats, setStats] = useState({
		total: 0,
		completed: 0,
		processing: 0,
		failed: 0
	});
	const [recentJobs, setRecentJobs] = useState([]);
	const [recentTranscripts, setRecentTranscripts] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (status === 'loading') return; // Still loading
		if (!session) {
          console.log('🔍 DASHBOARD DEBUG - paths.login:', paths.login);
          console.log('🔍 DASHBOARD DEBUG - NEXT_PUBLIC_BASE_PATH:', process.env.NEXT_PUBLIC_BASE_PATH);
			router.push(paths.login);
			return;
		}
	}, [session, status, router]);

	// プルダウンメニューを閉じるためのクリック外し処理
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (isDropdownOpen) {
				const target = event.target as Element;
				if (!target.closest('.relative')) {
					setIsDropdownOpen(false);
				}
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isDropdownOpen]);

	// データを読み込む
	useEffect(() => {
		if (session) {
			loadDashboardData();
		}
	}, [session]);

	const loadDashboardData = async () => {
		try {
			setLoading(true);
			
			// セッションが確立されているか確認
			if (!session?.accessToken) {
				console.warn('セッションが確立されていません。データ取得をスキップします。');
				return;
			}
			
			console.log('セッション確認済み。データ取得を開始します。');
			
			// 統計データとジョブ一覧を並行取得
			const [statsData, jobsData, transcriptsData] = await Promise.all([
				agentApi.getStats(),
				agentApi.getJobs({ limit: 5 }),
				transcriptApi.getTranscripts({ limit: 5 })
			]);

			console.log('議事録API応答:', transcriptsData);
			console.log('議事録データ配列:', transcriptsData.transcripts);

			// 統計データのフィールド名をマッピング
			const mappedStats = {
				total: statsData.stats?.total_jobs || 0,
				completed: statsData.stats?.completed_jobs || 0,
				processing: statsData.stats?.processing_jobs || 0,
				failed: statsData.stats?.failed_jobs || 0
			};
			setStats(mappedStats);
			setRecentJobs(jobsData.jobs || []);
			setRecentTranscripts(transcriptsData.transcripts || []);

		} catch (error) {
			console.error('ダッシュボードデータ読み込みエラー:', error);
		} finally {
			setLoading(false);
		}
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
			<div className="bg-white shadow">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">
								ダッシュボード
							</h1>
							<p className="mt-1 text-sm text-gray-500">
								AIエージェントサービス管理画面
							</p>
						</div>
						<div className="flex items-center space-x-4">
							<span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
								{session.user?.role === 'admin' ? '管理者' : 'ユーザー'}
							</span>
							{/* 管理者用デバッグリンク */}
							{session.user?.role === 'admin' && (
								<button
									onClick={() => router.push('/debug')}
									className="px-3 py-2 text-xs font-medium bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 transition-colors"
								>
									デバッグ
								</button>
							)}
							
							<div className="relative">
								<button
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className="flex items-center text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
								>
									<span>こんにちは、{session.user?.name || session.user?.email || 'ユーザー'}さん</span>
									<svg
										className={`ml-2 h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								
								{isDropdownOpen && (
									<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
										<div className="py-1">
											<div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
												<div className="font-medium">
													{session.user?.name || session.user?.email || 'ユーザー'}
												</div>
												<div className="text-xs text-gray-500">
													{session.user?.email}
												</div>
											</div>
											<button
												onClick={() => {
													setIsDropdownOpen(false);
													router.push('/profile');
												}}
												className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
											>
												プロファイル設定
											</button>
											{session.user?.role === 'admin' && (
												<button
													onClick={() => {
														setIsDropdownOpen(false);
														router.push('/debug');
													}}
													className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
												>
													デバッグページ
												</button>
											)}
											<button
												onClick={() => signOut({ callbackUrl: paths.login })}
												className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
											>
												ログアウト
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="py-8">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					{/* 統計カード */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
											<span className="text-white text-sm font-medium">総</span>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												総ジョブ数
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{loading ? '--' : stats.total}
											</dd>
										</dl>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
											<span className="text-white text-sm font-medium">完</span>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												完了ジョブ
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{loading ? '--' : stats.completed}
											</dd>
										</dl>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
											<span className="text-white text-sm font-medium">処</span>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												処理中ジョブ
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{loading ? '--' : stats.processing}
											</dd>
										</dl>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
											<span className="text-white text-sm font-medium">失</span>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">
												失敗ジョブ
											</dt>
											<dd className="text-lg font-medium text-gray-900">
												{loading ? '--' : stats.failed}
											</dd>
										</dl>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* ナビゲーションカード */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
						<button
							onClick={() => router.push('/transcripts')}
							className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
						>
							<div className="flex items-center">
								<div className="flex-shrink-0">
									<div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									</div>
								</div>
								<div className="ml-4">
									<h3 className="text-lg font-medium text-gray-900">議事録一覧</h3>
									<p className="text-sm text-gray-500">作成された議事録を確認</p>
								</div>
							</div>
						</button>

						<button
							onClick={() => router.push('/upload')}
							className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
						>
							<div className="flex items-center">
								<div className="flex-shrink-0">
									<div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
										</svg>
									</div>
								</div>
								<div className="ml-4">
									<h3 className="text-lg font-medium text-gray-900">音声アップロード</h3>
									<p className="text-sm text-gray-500">音声ファイルから議事録を作成</p>
								</div>
							</div>
						</button>

						<button
							onClick={() => router.push('/jobs')}
							className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
						>
							<div className="flex items-center">
								<div className="flex-shrink-0">
									<div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
										</svg>
									</div>
								</div>
								<div className="ml-4">
									<h3 className="text-lg font-medium text-gray-900">ジョブ履歴</h3>
									<p className="text-sm text-gray-500">処理ジョブの実行状況を確認</p>
								</div>
							</div>
						</button>

						{session.user?.role === 'admin' && (
							<button
								onClick={() => router.push('/debug')}
								className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
							>
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
											<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</div>
									</div>
									<div className="ml-4">
										<h3 className="text-lg font-medium text-gray-900">デバッグ</h3>
										<p className="text-sm text-gray-500">システムのデバッグとテスト</p>
									</div>
								</div>
							</button>
						)}
					</div>

					{/* コンテンツエリア */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						{/* 最近のジョブ */}
						<div className="bg-white shadow rounded-lg">
							<div className="px-4 py-5 sm:p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg leading-6 font-medium text-gray-900">
										最近のジョブ
									</h3>
									<button
										onClick={() => router.push('/jobs')}
										className="text-sm text-blue-600 hover:text-blue-800"
									>
										すべて表示
									</button>
								</div>
								{loading ? (
									<div className="text-center py-8 text-gray-500">
										<p>ジョブデータを読み込んでいます...</p>
									</div>
								) : recentJobs.length > 0 ? (
									<div className="space-y-3">
										{recentJobs.map((job: any) => (
											<div key={job.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
												<div className="flex items-center space-x-3">
													<div className={`w-3 h-3 rounded-full ${
														job.status === 'completed' ? 'bg-green-500' :
														job.status === 'processing' ? 'bg-yellow-500' :
														job.status === 'failed' ? 'bg-red-500' :
														'bg-gray-300'
													}`}></div>
													<div>
														<p className="text-sm font-medium text-gray-900">{job.type}</p>
														<p className="text-xs text-gray-500">
															{new Date(job.created_at).toLocaleString('ja-JP')}
														</p>
													</div>
												</div>
												<span className={`px-2 py-1 text-xs font-medium rounded-full ${
													job.status === 'completed' ? 'bg-green-100 text-green-800' :
													job.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
													job.status === 'failed' ? 'bg-red-100 text-red-800' :
													'bg-gray-100 text-gray-800'
												}`}>
													{job.status === 'completed' ? '完了' :
													 job.status === 'processing' ? '処理中' :
													 job.status === 'failed' ? '失敗' :
													 job.status}
												</span>
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-8 text-gray-500">
										<p>ジョブデータがありません</p>
									</div>
								)}
							</div>
						</div>

						{/* 最近の議事録 */}
						<div className="bg-white shadow rounded-lg">
							<div className="px-4 py-5 sm:p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg leading-6 font-medium text-gray-900">
										最近の議事録
									</h3>
									<button
										onClick={() => router.push('/transcripts')}
										className="text-sm text-blue-600 hover:text-blue-800"
									>
										すべて表示
									</button>
								</div>
								{loading ? (
									<div className="text-center py-8 text-gray-500">
										<p>議事録データを読み込んでいます...</p>
									</div>
								) : recentTranscripts.length > 0 ? (
									<div className="space-y-3">
										{recentTranscripts.map((transcript: any) => (
											<div key={transcript.id} className="py-3 border-b border-gray-100 last:border-b-0">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<h4 className="text-sm font-medium text-gray-900 mb-1">
															{transcript.meeting_topic || 'タイトル未設定'}
														</h4>
														<p className="text-xs text-gray-500 mb-2">
															{new Date(transcript.start_time).toLocaleString('ja-JP')}
														</p>
														{transcript.summary && (
															<p className="text-xs text-gray-600 line-clamp-2">
																{transcript.summary}
															</p>
														)}
													</div>
													<button 
														onClick={() => {
															console.log('議事録データ:', transcript);
															const transcriptId = transcript.transcript_uuid || transcript.id;
															console.log('使用するID:', transcriptId);
															router.push(`/transcripts/${transcriptId}`);
														}}
														className="ml-2 text-xs text-blue-600 hover:text-blue-800"
													>
														詳細
													</button>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-8 text-gray-500">
										<p>議事録データがありません</p>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* システム情報 */}
					<div className="mt-8 bg-white shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
								システム情報
							</h3>
							<dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
								<div>
									<dt className="text-sm font-medium text-gray-500">
										サービス名
									</dt>
									<dd className="mt-1 text-sm text-gray-900">
										AIエージェント - Zoom議事録自動配布システム
									</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">
										バージョン
									</dt>
									<dd className="mt-1 text-sm text-gray-900">
										1.0.0
									</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">
										環境
									</dt>
									<dd className="mt-1 text-sm text-gray-900">
										開発環境
									</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">
										ステータス
									</dt>
									<dd className="mt-1 text-sm text-gray-900">
										<span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
											正常稼働中
										</span>
									</dd>
								</div>
							</dl>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
