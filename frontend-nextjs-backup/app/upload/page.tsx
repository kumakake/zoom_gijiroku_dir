'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api';

interface UploadHistory {
	id: number;
	status: string;
	title: string;
	fileName: string;
	fileSize: number;
	createdAt: string;
	completedAt: string | null;
	errorMessage: string | null;
	transcriptId: number | null;
	hasTranscript: boolean;
}

interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	pages: number;
}

export default function UploadPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	
	const [isDragOver, setIsDragOver] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [formData, setFormData] = useState({
		title: '',
		description: ''
	});
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [supportedFormats, setSupportedFormats] = useState<any>(null);
	
	// アップロード履歴
	const [uploads, setUploads] = useState<UploadHistory[]>([]);
	const [pagination, setPagination] = useState<PaginationInfo>({
		page: 1,
		limit: 10,
		total: 0,
		pages: 0
	});
	const [historyLoading, setHistoryLoading] = useState(true);
	const [autoRefresh, setAutoRefresh] = useState(true);

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		loadSupportedFormats();
		loadUploadHistory();
	}, [session, status, router]);

	// 自動リフレッシュ機能
	useEffect(() => {
		if (!autoRefresh || !session) return;

		const interval = setInterval(() => {
			// 処理中のジョブがある場合のみリフレッシュ
			const hasProcessingJobs = uploads.some(upload => 
				upload.status === 'processing' || upload.status === 'pending'
			);
			
			if (hasProcessingJobs) {
				loadUploadHistory();
			}
		}, 3000); // 3秒間隔

		return () => clearInterval(interval);
	}, [autoRefresh, session, uploads]);

	const loadSupportedFormats = async () => {
		try {
			const response = await apiClient.get('/api/upload/audio/formats');
			setSupportedFormats(response.data);
		} catch (error) {
			console.error('対応フォーマット取得エラー:', error);
		}
	};

	const loadUploadHistory = async () => {
		try {
			setHistoryLoading(true);
			const response = await apiClient.get('/api/upload/audio/history', {
				params: {
					page: pagination.page,
					limit: pagination.limit
				}
			});
			setUploads(response.data.uploads);
			setPagination(response.data.pagination);
		} catch (error) {
			console.error('アップロード履歴読み込みエラー:', error);
			toast.error('アップロード履歴の読み込みに失敗しました');
		} finally {
			setHistoryLoading(false);
		}
	};

	const handleFileSelect = (file: File) => {
		if (!file) return;
		
		// ファイルサイズチェック (100MB)
		const maxSize = 100 * 1024 * 1024;
		if (file.size > maxSize) {
			toast.error('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。');
			return;
		}
		
		// ファイル形式チェック
		const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4', '.mov', '.avi', '.webm'];
		const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
		
		if (!allowedExtensions.includes(fileExtension)) {
			toast.error('対応していないファイル形式です。音声または動画ファイルを選択してください。');
			return;
		}
		
		setSelectedFile(file);
		
		// タイトルが空の場合、ファイル名から拡張子を除いた部分を設定
		if (!formData.title) {
			const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
			setFormData(prev => ({ ...prev, title: baseName }));
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleUpload = async () => {
		if (!selectedFile) {
			toast.error('ファイルを選択してください');
			return;
		}
		
		if (!formData.title.trim()) {
			toast.error('タイトルを入力してください');
			return;
		}
		
		try {
			setIsUploading(true);
			setUploadProgress(0);
			
			const uploadFormData = new FormData();
			uploadFormData.append('audioFile', selectedFile);
			uploadFormData.append('title', formData.title.trim());
			if (formData.description.trim()) {
				uploadFormData.append('description', formData.description.trim());
			}
			
			const response = await apiClient.post('/api/upload/audio', uploadFormData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				onUploadProgress: (progressEvent) => {
					if (progressEvent.total) {
						const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
						setUploadProgress(progress);
					}
				}
			});
			
			toast.success('ファイルのアップロードが完了しました。議事録の生成を開始します。');
			
			// フォームリセット
			setSelectedFile(null);
			setFormData({ title: '', description: '' });
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
			
			// アップロード履歴を再読み込み
			loadUploadHistory();
			
		} catch (error: any) {
			console.error('アップロードエラー:', error);
			const errorMessage = error.response?.data?.error || 'アップロード中にエラーが発生しました';
			toast.error(errorMessage);
		} finally {
			setIsUploading(false);
			setUploadProgress(0);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'completed':
				return (
					<span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
						<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
						</svg>
						完了
					</span>
				);
			case 'processing':
				return (
					<span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
						<svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
							<path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						処理中
					</span>
				);
			case 'failed':
				return (
					<span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
						<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
						</svg>
						失敗
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
						<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
						</svg>
						待機中
					</span>
				);
		}
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
							<h1 className="text-2xl font-bold text-gray-900">音声ファイルアップロード</h1>
						</div>
					</div>
				</div>
			</div>

			{/* メインコンテンツ */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* アップロードフォーム */}
					<div className="bg-white shadow rounded-lg">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">新しい音声ファイルをアップロード</h2>
							<p className="mt-1 text-sm text-gray-600">
								音声または動画ファイルをアップロードして議事録を自動生成します
							</p>
						</div>
						
						<div className="px-6 py-4 space-y-6">
							{/* ファイル選択エリア */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									ファイル選択
								</label>
								<div
									className={`relative border-2 border-dashed rounded-lg px-6 py-10 text-center ${
										isDragOver
											? 'border-blue-400 bg-blue-50'
											: selectedFile
											? 'border-green-400 bg-green-50'
											: 'border-gray-300 hover:border-gray-400'
									}`}
									onDrop={handleDrop}
									onDragOver={handleDragOver}
									onDragLeave={handleDragLeave}
								>
									<input
										ref={fileInputRef}
										type="file"
										accept=".mp3,.wav,.m4a,.aac,.ogg,.mp4,.mov,.avi,.webm,audio/*,video/*"
										onChange={handleFileInputChange}
										className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
									/>
									
									{selectedFile ? (
										<div className="space-y-2">
											<svg className="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<div className="text-sm text-gray-900">
												<p className="font-medium">{selectedFile.name}</p>
												<p className="text-gray-500">{formatFileSize(selectedFile.size)}</p>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
											</svg>
											<div className="text-sm text-gray-600">
												<p>ファイルをドラッグ&ドロップするか、クリックしてファイルを選択</p>
												<p className="text-xs text-gray-500 mt-1">最大 100MB • 音声・動画ファイル対応</p>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* タイトル */}
							<div>
								<label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
									タイトル <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									id="title"
									value={formData.title}
									onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="会議のタイトルを入力してください"
									maxLength={255}
								/>
							</div>

							{/* 説明 */}
							<div>
								<label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
									説明（オプション）
								</label>
								<textarea
									id="description"
									value={formData.description}
									onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
									rows={4}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="会議の内容や備考を入力してください"
									maxLength={1000}
								/>
								<p className="mt-1 text-xs text-gray-500">
									{formData.description.length}/1000文字
								</p>
							</div>

							{/* アップロードボタン */}
							<div>
								<button
									onClick={handleUpload}
									disabled={!selectedFile || !formData.title.trim() || isUploading}
									className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isUploading ? (
										<div className="flex items-center justify-center">
											<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
											アップロード中... {uploadProgress}%
										</div>
									) : (
										'音声ファイルをアップロード'
									)}
								</button>
							</div>
						</div>
					</div>

					{/* 対応フォーマット情報 */}
					<div className="bg-white shadow rounded-lg">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">対応ファイル形式</h2>
						</div>
						
						<div className="px-6 py-4">
							{supportedFormats ? (
								<div className="space-y-4">
									<div>
										<h3 className="text-sm font-medium text-gray-900 mb-2">音声ファイル</h3>
										<div className="grid grid-cols-1 gap-2">
											{supportedFormats.supportedFormats.audio.map((format: any, index: number) => (
												<div key={index} className="flex justify-between text-sm">
													<span className="font-mono text-blue-600">{format.extension}</span>
													<span className="text-gray-600">{format.description}</span>
												</div>
											))}
										</div>
									</div>
									
									<div>
										<h3 className="text-sm font-medium text-gray-900 mb-2">動画ファイル</h3>
										<div className="grid grid-cols-1 gap-2">
											{supportedFormats.supportedFormats.video.map((format: any, index: number) => (
												<div key={index} className="flex justify-between text-sm">
													<span className="font-mono text-blue-600">{format.extension}</span>
													<span className="text-gray-600">{format.description}</span>
												</div>
											))}
										</div>
									</div>
									
									<div className="bg-blue-50 p-3 rounded-md">
										<div className="flex items-start">
											<svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
												<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
											</svg>
											<div className="text-sm">
												<p className="text-blue-800 font-medium">最大ファイルサイズ: {supportedFormats.maxFileSize}</p>
												<p className="text-blue-700 mt-1">{supportedFormats.note}</p>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="text-center py-4 text-gray-500">
									読み込み中...
								</div>
							)}
						</div>
					</div>
				</div>

				{/* アップロード履歴 */}
				<div className="mt-8 bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-lg font-medium text-gray-900">アップロード履歴</h2>
						<div className="flex items-center space-x-3">
							<button
								onClick={() => setAutoRefresh(!autoRefresh)}
								className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md ${
									autoRefresh
										? 'bg-green-100 text-green-800 hover:bg-green-200'
										: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
								}`}
							>
								<div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></div>
								<span>自動更新</span>
							</button>
							<button
								onClick={loadUploadHistory}
								disabled={historyLoading}
								className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50"
							>
								<div className="flex items-center space-x-1">
									<svg className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									<span>更新</span>
								</div>
							</button>
						</div>
					</div>
					
					<div className="px-6 py-4">
						{historyLoading ? (
							<div className="text-center py-8">
								<div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
								<p className="text-gray-500">履歴を読み込んでいます...</p>
							</div>
						) : uploads.length > 0 ? (
							<div className="space-y-4">
								{uploads.map((upload) => (
									<div key={upload.id} className="border border-gray-200 rounded-md p-4">
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<div className="flex items-center space-x-3">
													<h3 className="text-sm font-medium text-gray-900">{upload.title}</h3>
													{getStatusBadge(upload.status)}
												</div>
												<div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
													<span>ファイル: {upload.fileName}</span>
													<span>サイズ: {formatFileSize(upload.fileSize)}</span>
													<span>アップロード: {new Date(upload.createdAt).toLocaleString('ja-JP')}</span>
													{upload.completedAt && (
														<span className="text-green-600">完了: {new Date(upload.completedAt).toLocaleString('ja-JP')}</span>
													)}
												</div>
												{upload.errorMessage && (
													<p className="mt-2 text-xs text-red-600">{upload.errorMessage}</p>
												)}
											</div>
											<div className="ml-4 flex items-center space-x-2">
												{upload.hasTranscript && (
													<Link
														href={`/transcripts/${upload.transcriptId}`}
														className="text-blue-600 hover:text-blue-800 text-sm font-medium"
													>
														議事録表示
													</Link>
												)}
											</div>
										</div>
									</div>
								))}
								
								{/* ページネーション */}
								{pagination.pages > 1 && (
									<div className="flex items-center justify-between pt-4 border-t border-gray-200">
										<div className="text-sm text-gray-700">
											{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
										</div>
										<div className="flex space-x-1">
											<button
												onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
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
														onClick={() => setPagination(prev => ({ ...prev, page }))}
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
												onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
												disabled={pagination.page === pagination.pages}
												className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												次へ
											</button>
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="text-center py-8">
								<div className="w-12 h-12 mx-auto mb-4 text-gray-400">
									<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
									</svg>
								</div>
								<p className="text-gray-500">アップロード履歴がありません</p>
								<p className="text-gray-400 text-sm mt-1">
									上記のフォームから音声ファイルをアップロードしてください
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}