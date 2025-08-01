'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import Link from 'next/link';
import { transcriptApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Transcript {
	transcript_uuid: string;
	zoom_meeting_id: string;
	meeting_topic: string;
	start_time: string;
	duration: number;
	participants: any[];
	summary: string;
	created_at: string;
	created_by_uuid: string;
	created_by_name: string;
	created_by_email: string;
	host_email: string;
	host_name: string;
}

interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	pages: number;
}

export default function TranscriptsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [transcripts, setTranscripts] = useState<Transcript[]>([]);
	const [pagination, setPagination] = useState<PaginationInfo>({
		page: 1,
		limit: 10,
		total: 0,
		pages: 0
	});
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [dateRange, setDateRange] = useState('');
	const [selectedTranscripts, setSelectedTranscripts] = useState<string[]>([]);

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		loadTranscripts();
	}, [session, status, router, pagination.page, searchTerm, dateRange]);

	const loadTranscripts = async () => {
		try {
			setLoading(true);
			const params: any = {
				page: pagination.page,
				limit: pagination.limit
			};

			if (searchTerm) {
				params.search = searchTerm;
			}

			if (dateRange) {
				params.date_range = dateRange;
			}

			const response = await transcriptApi.getTranscripts(params);
			setTranscripts(response.transcripts);
			setPagination(response.pagination);
		} catch (error) {
			console.error('議事録読み込みエラー:', error);
			toast.error('議事録の読み込みに失敗しました');
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setPagination(prev => ({ ...prev, page: 1 }));
		loadTranscripts();
	};

	const handlePageChange = (newPage: number) => {
		setPagination(prev => ({ ...prev, page: newPage }));
	};

	const handleDelete = async (transcriptUuid: string) => {
		if (!confirm('この議事録を削除してもよろしいですか？')) {
			return;
		}

		try {
			await transcriptApi.deleteTranscript(transcriptUuid);
			toast.success('議事録を削除しました');
			loadTranscripts();
		} catch (error) {
			console.error('議事録削除エラー:', error);
			toast.error('議事録の削除に失敗しました');
		}
	};

	const handleBulkDelete = async () => {
		if (selectedTranscripts.length === 0) {
			toast.error('削除する議事録を選択してください');
			return;
		}

		if (!confirm(`選択した${selectedTranscripts.length}件の議事録を削除してもよろしいですか？`)) {
			return;
		}

		try {
			await Promise.all(
				selectedTranscripts.map(id => transcriptApi.deleteTranscript(id))
			);
			toast.success(`${selectedTranscripts.length}件の議事録を削除しました`);
			setSelectedTranscripts([]);
			loadTranscripts();
		} catch (error) {
			console.error('一括削除エラー:', error);
			toast.error('一括削除に失敗しました');
		}
	};

	const toggleTranscriptSelection = (transcriptUuid: string) => {
		setSelectedTranscripts(prev => 
			prev.includes(transcriptUuid)
				? prev.filter(id => id !== transcriptUuid)
				: [...prev, transcriptUuid]
		);
	};

	const toggleAllSelection = () => {
		if (selectedTranscripts.length === transcripts.length) {
			setSelectedTranscripts([]);
		} else {
			setSelectedTranscripts(transcripts.map(t => t.transcript_uuid));
		}
	};

	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
	};

	const formatParticipants = (participants: any[]) => {
		if (!participants || participants.length === 0) return '不明';
		return `${participants.length}名`;
	};

	if (status === 'loading') {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div className="flex items-center">
							<Link href="/dashboard" className="text-blue-600 hover:text-blue-500 mr-4">
								← ダッシュボードに戻る
							</Link>
							<h1 className="text-2xl font-bold text-gray-900">議事録一覧</h1>
						</div>
						<div className="flex items-center space-x-2">
							<span className="text-sm text-gray-500">
								{session.user?.role === 'admin' ? '全ユーザーの議事録' : 'あなたの議事録'}
							</span>
							{selectedTranscripts.length > 0 && (
								<button
									onClick={handleBulkDelete}
									className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
								>
									選択削除 ({selectedTranscripts.length})
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* 検索・フィルター */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="bg-white rounded-lg shadow p-6 mb-6">
					<form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
						<div className="flex-1">
							<input
								type="text"
								placeholder="会議名や議事録内容で検索..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						<div className="flex gap-2">
							<select
								value={dateRange}
								onChange={(e) => setDateRange(e.target.value)}
								className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							>
								<option value="">全期間</option>
								<option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
									過去7日間
								</option>
								<option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
									過去30日間
								</option>
								<option value={`${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
									今月
								</option>
							</select>
							<button
								type="submit"
								className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								検索
							</button>
						</div>
					</form>
				</div>

				{/* 議事録一覧 */}
				<div className="bg-white shadow rounded-lg">
					{loading ? (
						<div className="text-center py-12">
							<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
							<p className="text-gray-500">議事録を読み込んでいます...</p>
						</div>
					) : transcripts.length > 0 ? (
						<>
							{/* テーブルヘッダー */}
							<div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
								<div className="flex items-center">
									<input
										type="checkbox"
										checked={selectedTranscripts.length === transcripts.length}
										onChange={toggleAllSelection}
										className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<span className="text-sm font-medium text-gray-500">
										{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
									</span>
								</div>
							</div>

							{/* 議事録リスト */}
							<div className="divide-y divide-gray-200">
								{transcripts.map((transcript) => (
									<div key={transcript.transcript_uuid} className="px-6 py-4 hover:bg-gray-50">
										<div className="flex items-start">
											<input
												type="checkbox"
												checked={selectedTranscripts.includes(transcript.transcript_uuid)}
												onChange={() => toggleTranscriptSelection(transcript.transcript_uuid)}
												className="mt-1 mr-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
											<div className="flex-1">
												<div className="flex items-center justify-between">
													<h3 className="text-lg font-medium text-gray-900 mb-1">
														{transcript.meeting_topic || 'タイトル未設定'}
													</h3>
													<div className="flex items-center space-x-2">
														<Link
															href={`/transcripts/${transcript.transcript_uuid}`}
															className="text-blue-600 hover:text-blue-800 text-sm font-medium"
														>
															詳細表示
														</Link>
														{(session.user?.role === 'admin' || transcript.created_by_uuid === session.user?.id) && (
															<button
																onClick={() => handleDelete(transcript.transcript_uuid)}
																className="text-red-600 hover:text-red-800 text-sm font-medium"
															>
																削除
															</button>
														)}
													</div>
												</div>
												
												<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600 mb-2">
													<div>
														<span className="font-medium">開催日時:</span> 
														{new Date(transcript.start_time).toLocaleString('ja-JP')}
													</div>
													<div>
														<span className="font-medium">時間:</span> 
														{formatDuration(transcript.duration)}
													</div>
													<div>
														<span className="font-medium">ホスト:</span> 
														{transcript.host_name || transcript.host_email || 'システム'}
													</div>
												</div>

												{transcript.summary && (
													<p className="text-sm text-gray-700 line-clamp-2 mb-2">
														{transcript.summary}
													</p>
												)}

												<div className="flex items-center justify-between text-xs text-gray-500">
													<span>
														会議ID: {transcript.zoom_meeting_id}
													</span>
													<span>
														作成: {new Date(transcript.created_at).toLocaleString('ja-JP')}
													</span>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>

							{/* ページネーション */}
							{pagination.pages > 1 && (
								<div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="text-sm text-gray-700">
											{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
										</div>
										<div className="flex space-x-1">
											<button
												onClick={() => handlePageChange(pagination.page - 1)}
												disabled={pagination.page === 1}
												className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												前へ
											</button>
											{Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
												const page = i + 1;
												return (
													<button
														key={page}
														onClick={() => handlePageChange(page)}
														className={`px-3 py-2 text-sm border rounded-md ${
															pagination.page === page
																? 'bg-blue-600 text-white border-blue-600'
																: 'bg-white border-gray-300 hover:bg-gray-50'
														}`}
													>
														{page}
													</button>
												);
											})}
											<button
												onClick={() => handlePageChange(pagination.page + 1)}
												disabled={pagination.page === pagination.pages}
												className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												次へ
											</button>
										</div>
									</div>
								</div>
							)}
						</>
					) : (
						<div className="text-center py-12">
							<div className="w-16 h-16 mx-auto mb-4 text-gray-400">
								<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<p className="text-gray-500 text-lg">議事録がありません</p>
							<p className="text-gray-400 text-sm mt-2">
								Zoom会議を録画すると、自動的に議事録が作成されます
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}