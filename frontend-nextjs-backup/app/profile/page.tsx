'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { authApi } from '@/lib/api';

export default function ProfilePage() {
	const { data: session, status, update } = useSession();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		email_distribution_preference: 'host_only' as 'host_only' | 'all_participants',
	});

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		
		// セッション情報からフォームデータを初期化
		setFormData({
			name: session.user?.name || '',
			email: session.user?.email || '',
			email_distribution_preference: (session.user as any)?.email_distribution_preference || 'host_only',
		});
	}, [session, status, router]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData(prev => ({
			...prev,
			[e.target.name]: e.target.value,
		}));
	};

	const handleDistributionChange = (value: 'host_only' | 'all_participants') => {
		setFormData(prev => ({
			...prev,
			email_distribution_preference: value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			// 名前または配信設定が変更された場合にAPI呼び出し
			const hasNameChange = formData.name !== session?.user?.name;
			const hasDistributionChange = formData.email_distribution_preference !== (session?.user as any)?.email_distribution_preference;
			
			if (hasNameChange || hasDistributionChange) {
				const result = await authApi.updateProfile({
					name: formData.name,
					email_distribution_preference: formData.email_distribution_preference
				});
				
				toast.success('プロファイルを更新しました');
				
				// セッション更新
				await update({
					...session,
					user: {
						...session?.user,
						name: result.user.name,
						email_distribution_preference: result.user.email_distribution_preference
					}
				});
			} else {
				toast('変更する項目がありません');
			}
			
		} catch (error: any) {
			console.error('プロファイル更新エラー:', error);
			const errorMessage = error.response?.data?.error || 'プロファイル更新中にエラーが発生しました';
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
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
							<h1 className="text-2xl font-bold text-gray-900">プロファイル設定</h1>
						</div>
					</div>
				</div>
			</div>

			{/* メインコンテンツ */}
			<div className="py-8">
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="bg-white shadow rounded-lg">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">基本情報</h2>
							<p className="mt-1 text-sm text-gray-600">
								アカウントの基本情報を確認・更新できます
							</p>
						</div>

						<form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
							{/* 名前 */}
							<div>
								<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
									名前
								</label>
								<input
									id="name"
									name="name"
									type="text"
									required
									className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									value={formData.name}
									onChange={handleChange}
									disabled={isLoading}
								/>
							</div>

							{/* メールアドレス */}
							<div>
								<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
									メールアドレス
								</label>
								<input
									id="email"
									name="email"
									type="email"
									disabled
									className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
									value={formData.email}
								/>
								<p className="mt-1 text-xs text-gray-500">
									メールアドレスは変更できません
								</p>
							</div>

							{/* ロール */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									ロール
								</label>
								<div className="flex items-center">
									<span className={`px-3 py-1 rounded-full text-xs font-medium ${
										session.user?.role === 'admin' 
											? 'bg-purple-100 text-purple-800' 
											: 'bg-green-100 text-green-800'
									}`}>
										{session.user?.role === 'admin' ? '管理者' : 'ユーザー'}
									</span>
								</div>
								<p className="mt-1 text-xs text-gray-500">
									ロールは管理者によって設定されます
								</p>
							</div>

							{/* 作成日 */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									アカウント作成日
								</label>
								<div className="text-sm text-gray-900">
									{session.user?.createdAt 
										? new Date(session.user.createdAt).toLocaleDateString('ja-JP', {
											year: 'numeric',
											month: 'long',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})
										: '不明'
									}
								</div>
							</div>

							{/* メール配信設定 */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									議事録メール配信設定
								</label>
								<div className="space-y-3">
									<div className="text-sm text-gray-600 mb-3">
										Zoom会議の議事録をメールで自動配信する際の配信先を設定できます。
									</div>
									
									<label className="flex items-start cursor-pointer">
										<input
											type="radio"
											name="distribution"
											value="host_only"
											checked={formData.email_distribution_preference === 'host_only'}
											onChange={(e) => handleDistributionChange(e.target.value as 'host_only' | 'all_participants')}
											className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
											disabled={isLoading}
										/>
										<div className="ml-3">
											<div className="font-medium text-gray-900">ホストのみに配信</div>
											<div className="text-sm text-gray-500">
												会議ホスト（あなた）のみに議事録を配信します
											</div>
										</div>
									</label>
									
									<label className="flex items-start cursor-pointer">
										<input
											type="radio"
											name="distribution"
											value="all_participants"
											checked={formData.email_distribution_preference === 'all_participants'}
											onChange={(e) => handleDistributionChange(e.target.value as 'host_only' | 'all_participants')}
											className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
											disabled={isLoading}
										/>
										<div className="ml-3">
											<div className="font-medium text-gray-900">全参加者に配信（Bcc）</div>
											<div className="text-sm text-gray-500">
												認証済み参加者全員に議事録をBccで一括配信します
											</div>
										</div>
									</label>

									{/* 注意事項 */}
									{formData.email_distribution_preference === 'all_participants' && (
										<div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
											<div className="flex">
												<div className="flex-shrink-0">
													<svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
														<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
													</svg>
												</div>
												<div className="ml-3">
													<h3 className="text-sm font-medium text-yellow-800">
														全参加者配信について
													</h3>
													<div className="mt-2 text-sm text-yellow-700">
														<ul className="list-disc list-inside space-y-1">
															<li>Zoomアカウントにログインした参加者のみメールアドレスを取得できます</li>
															<li>ゲスト参加者（認証なし）にはメールを送信できません</li>
															<li>Bcc配信により、参加者同士のメールアドレスは見えません</li>
															<li>配信エラーの場合はホストのみに配信されます</li>
														</ul>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* 保存ボタン */}
							<div className="flex justify-end pt-4 border-t border-gray-200">
								<Button
									type="submit"
									disabled={isLoading}
									className="px-6 py-2"
								>
									{isLoading ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
											更新中...
										</>
									) : (
										'変更を保存'
									)}
								</Button>
							</div>
						</form>
					</div>

					{/* セキュリティ設定 */}
					<div className="mt-8 bg-white shadow rounded-lg">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">セキュリティ</h2>
							<p className="mt-1 text-sm text-gray-600">
								パスワードとセキュリティ設定を管理
							</p>
						</div>

						<div className="px-6 py-4 space-y-4">
							{/* パスワード変更 */}
							<div className="flex items-center justify-between py-3 border-b border-gray-100">
								<div>
									<h3 className="text-sm font-medium text-gray-900">パスワード</h3>
									<p className="text-sm text-gray-500">最後の更新: 不明</p>
								</div>
								<Link
									href="/profile/change-password"
									className="text-blue-600 hover:text-blue-500 text-sm font-medium"
								>
									変更する
								</Link>
							</div>

							{/* アカウント削除 */}
							<div className="flex items-center justify-between py-3">
								<div>
									<h3 className="text-sm font-medium text-red-900">アカウント削除</h3>
									<p className="text-sm text-red-500">この操作は取り消せません</p>
								</div>
								<button
									type="button"
									className="text-red-600 hover:text-red-500 text-sm font-medium"
									onClick={() => toast.error('アカウント削除機能は未実装です')}
								>
									削除する
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}