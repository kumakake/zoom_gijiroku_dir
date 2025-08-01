'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import { useParams } from 'next/navigation';
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
	raw_transcript: string;
	formatted_transcript: string;
	summary: string;
	action_items: any[];
	created_at: string;
	created_by_uuid: string;
	created_by_name: string;
	created_by_email: string;
	host_email: string;
	host_name: string;
}

export default function TranscriptDetailPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const params = useParams();
	const transcriptId = params.id as string;
	
	const [transcript, setTranscript] = useState<Transcript | null>(null);
	const [loading, setLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [editData, setEditData] = useState({
		formatted_transcript: '',
		summary: '',
		action_items: [] as any[]
	});

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		if (transcriptId) {
			loadTranscript();
		}
	}, [session, status, router, transcriptId]);

	const loadTranscript = async () => {
		try {
			setLoading(true);
			
			// セッションが確立されているか確認
			if (!session?.accessToken) {
				console.warn('セッションが確立されていません。議事録データの取得をスキップします。');
				toast.error('認証が必要です。再度ログインしてください。');
				router.push(paths.login);
				return;
			}
			
			console.log('議事録ID:', transcriptId);
			console.log('API呼び出し開始');
			const response = await transcriptApi.getTranscript(transcriptId);
			console.log('API応答:', response);
			setTranscript(response.transcript);
			setEditData({
				formatted_transcript: response.transcript.formatted_transcript || '',
				summary: response.transcript.summary || '',
				action_items: response.transcript.action_items || []
			});
		} catch (error: any) {
			console.error('議事録読み込みエラー:', error);
			console.error('エラー詳細:', error.response?.data);
			
			const errorMessage = error.response?.data?.error || '議事録の読み込みに失敗しました';
			
			// 無効なジョブIDの場合は特別に処理
			if (error.response?.status === 404) {
				toast.error(`無効なジョブIDです (ID: ${transcriptId})`);
				console.error('404エラー: 議事録が見つかりません');
			} else if (error.response?.status === 401) {
				toast.error('認証エラーです。再度ログインしてください。');
				router.push(paths.login);
			} else {
				toast.error(errorMessage);
			}
			
			router.push('/transcripts');
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			const response = await transcriptApi.updateTranscript(transcriptId, editData);
			setTranscript(response.transcript);
			setIsEditing(false);
			toast.success('議事録を更新しました');
		} catch (error: any) {
			console.error('議事録更新エラー:', error);
			toast.error('議事録の更新に失敗しました');
		}
	};

	const handleDelete = async () => {
		if (!confirm('この議事録を削除してもよろしいですか？')) {
			return;
		}

		try {
			await transcriptApi.deleteTranscript(transcriptId);
			toast.success('議事録を削除しました');
			router.push('/transcripts');
		} catch (error: any) {
			console.error('議事録削除エラー:', error);
			toast.error('議事録の削除に失敗しました');
		}
	};

	const canEdit = () => {
		return session?.user?.role === 'admin' || transcript?.created_by_uuid === session?.user?.id;
	};

	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
	};

	const formatParticipants = (participants: any[]) => {
		if (!participants || participants.length === 0) return [];
		return participants.map((p, i) => p.name || `参加者${i + 1}`);
	};

	const addActionItem = () => {
		setEditData(prev => ({
			...prev,
			action_items: [...prev.action_items, { task: '', assignee: '', deadline: '' }]
		}));
	};

	const updateActionItem = (index: number, field: string, value: string) => {
		setEditData(prev => ({
			...prev,
			action_items: prev.action_items.map((item, i) => 
				i === index ? { ...item, [field]: value } : item
			)
		}));
	};

	const removeActionItem = (index: number) => {
		setEditData(prev => ({
			...prev,
			action_items: prev.action_items.filter((_, i) => i !== index)
		}));
	};

	if (status === 'loading' || loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
			</div>
		);
	}

	if (!session || !transcript) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* ヘッダー */}
			<div className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div className="flex items-center">
							<Link href="/transcripts" className="text-blue-600 hover:text-blue-500 mr-4">
								← 議事録一覧に戻る
							</Link>
							<h1 className="text-2xl font-bold text-gray-900">
								{transcript.meeting_topic || 'タイトル未設定'}
							</h1>
						</div>
						<div className="flex items-center space-x-2">
							{canEdit() && (
								<>
									{isEditing ? (
										<>
											<button
												onClick={() => setIsEditing(false)}
												className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
											>
												キャンセル
											</button>
											<button
												onClick={handleSave}
												className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
											>
												保存
											</button>
										</>
									) : (
										<>
											<button
												onClick={() => setIsEditing(true)}
												className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
											>
												編集
											</button>
											<button
												onClick={handleDelete}
												className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
											>
												削除
											</button>
										</>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* メインコンテンツ */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* 会議情報 */}
				<div className="bg-white shadow rounded-lg mb-8">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-lg font-medium text-gray-900">会議情報</h2>
					</div>
					<div className="px-6 py-4">
						<dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
							<div>
								<dt className="text-sm font-medium text-gray-500">開催日時</dt>
								<dd className="mt-1 text-sm text-gray-900">
									{new Date(transcript.start_time).toLocaleString('ja-JP')}
								</dd>
							</div>
							<div>
								<dt className="text-sm font-medium text-gray-500">時間</dt>
								<dd className="mt-1 text-sm text-gray-900">
									{formatDuration(transcript.duration)}
								</dd>
							</div>
							<div>
								<dt className="text-sm font-medium text-gray-500">会議ID</dt>
								<dd className="mt-1 text-sm text-gray-900">
									{transcript.zoom_meeting_id}
								</dd>
							</div>
							<div>
								<dt className="text-sm font-medium text-gray-500">ホスト</dt>
								<dd className="mt-1 text-sm text-gray-900">
									{transcript.host_name || transcript.host_email || 'システム'}
								</dd>
							</div>
						</dl>

						{transcript.participants && transcript.participants.length > 0 && (
							<div className="mt-6">
								<dt className="text-sm font-medium text-gray-500 mb-2">参加者</dt>
								<dd className="text-sm text-gray-900">
									<div className="flex flex-wrap gap-2">
										{formatParticipants(transcript.participants).map((name, index) => (
											<span
												key={index}
												className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
											>
												{name}
											</span>
										))}
									</div>
								</dd>
							</div>
						)}
					</div>
				</div>

				{/* 要約 */}
				<div className="bg-white shadow rounded-lg mb-8">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-lg font-medium text-gray-900">要約</h2>
					</div>
					<div className="px-6 py-4">
						{isEditing ? (
							<textarea
								value={editData.summary}
								onChange={(e) => setEditData(prev => ({ ...prev, summary: e.target.value }))}
								className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								placeholder="要約を入力してください..."
							/>
						) : (
							<div className="prose max-w-none">
								{transcript.summary ? (
									<p className="text-gray-700 whitespace-pre-wrap">{transcript.summary}</p>
								) : (
									<p className="text-gray-500 italic">要約がありません</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* アクションアイテム */}
				<div className="bg-white shadow rounded-lg mb-8">
					<div className="px-6 py-4 border-b border-gray-200">
						<div className="flex justify-between items-center">
							<h2 className="text-lg font-medium text-gray-900">アクションアイテム</h2>
							{isEditing && (
								<button
									onClick={addActionItem}
									className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
								>
									追加
								</button>
							)}
						</div>
					</div>
					<div className="px-6 py-4">
						{isEditing ? (
							<div className="space-y-4">
								{editData.action_items.map((item, index) => (
									<div key={index} className="border border-gray-200 rounded-md p-4">
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													タスク
												</label>
												<input
													type="text"
													value={item.task || ''}
													onChange={(e) => updateActionItem(index, 'task', e.target.value)}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
													placeholder="タスク内容"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													担当者
												</label>
												<input
													type="text"
													value={item.assignee || ''}
													onChange={(e) => updateActionItem(index, 'assignee', e.target.value)}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
													placeholder="担当者名"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													期限
												</label>
												<div className="flex">
													<input
														type="date"
														value={item.deadline || ''}
														onChange={(e) => updateActionItem(index, 'deadline', e.target.value)}
														className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
													/>
													<button
														onClick={() => removeActionItem(index)}
														className="px-3 py-2 bg-red-600 text-white rounded-r-md hover:bg-red-700"
													>
														削除
													</button>
												</div>
											</div>
										</div>
									</div>
								))}
								{editData.action_items.length === 0 && (
									<p className="text-gray-500 italic text-center py-4">
										アクションアイテムがありません。「追加」ボタンで新しいアイテムを作成してください。
									</p>
								)}
							</div>
						) : (
							<div className="space-y-3">
								{transcript.action_items && transcript.action_items.length > 0 ? (
									transcript.action_items.map((item, index) => (
										<div key={index} className="border border-gray-200 rounded-md p-4">
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
												<div>
													<span className="text-sm font-medium text-gray-500">タスク:</span>
													<p className="text-sm text-gray-900">{item.task || '未設定'}</p>
												</div>
												<div>
													<span className="text-sm font-medium text-gray-500">担当者:</span>
													<p className="text-sm text-gray-900">{item.assignee || '未設定'}</p>
												</div>
												<div>
													<span className="text-sm font-medium text-gray-500">期限:</span>
													<p className="text-sm text-gray-900">
														{item.deadline ? new Date(item.deadline).toLocaleDateString('ja-JP') : '未設定'}
													</p>
												</div>
											</div>
										</div>
									))
								) : (
									<p className="text-gray-500 italic text-center py-4">
										アクションアイテムがありません
									</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* 議事録本文 */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-lg font-medium text-gray-900">議事録</h2>
					</div>
					<div className="px-6 py-4">
						{isEditing ? (
							<textarea
								value={editData.formatted_transcript}
								onChange={(e) => setEditData(prev => ({ ...prev, formatted_transcript: e.target.value }))}
								className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
								placeholder="議事録の内容を入力してください..."
							/>
						) : (
							<div className="prose max-w-none">
								{transcript.formatted_transcript ? (
									<pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
										{transcript.formatted_transcript}
									</pre>
								) : transcript.raw_transcript ? (
									<div>
										<p className="text-gray-500 italic mb-4">整形された議事録がありません。以下は生の文字起こしです:</p>
										<pre className="whitespace-pre-wrap text-sm text-gray-600 font-mono bg-gray-50 p-4 rounded">
											{transcript.raw_transcript}
										</pre>
									</div>
								) : (
									<p className="text-gray-500 italic">議事録データがありません</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* 作成日時 */}
				<div className="mt-8 text-center text-sm text-gray-500">
					作成日時: {new Date(transcript.created_at).toLocaleString('ja-JP')}
				</div>
			</div>
		</div>
	);
}