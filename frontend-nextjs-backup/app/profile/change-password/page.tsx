'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { authApi } from '@/lib/api';

export default function ChangePasswordPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
	});

	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
	}, [session, status, router]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData(prev => ({
			...prev,
			[e.target.name]: e.target.value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			// パスワード確認チェック
			if (formData.newPassword !== formData.confirmPassword) {
				toast.error('新しいパスワードが一致しません');
				return;
			}

			// パスワード強度チェック
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
			if (!passwordRegex.test(formData.newPassword)) {
				toast.error('新しいパスワードは8文字以上で、大文字・小文字・数字を含む必要があります');
				return;
			}

			// 現在のパスワードと同じかチェック
			if (formData.currentPassword === formData.newPassword) {
				toast.error('新しいパスワードは現在のパスワードと異なる必要があります');
				return;
			}

			await authApi.changePassword({
				currentPassword: formData.currentPassword,
				newPassword: formData.newPassword,
			});

			toast.success('パスワードを変更しました');
			
			// フォームをリセット
			setFormData({
				currentPassword: '',
				newPassword: '',
				confirmPassword: '',
			});
			
		} catch (error: any) {
			console.error('パスワード変更エラー:', error);
			const errorMessage = error.response?.data?.error || 'パスワード変更中にエラーが発生しました';
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
							<Link href="/profile" className="text-blue-600 hover:text-blue-500 mr-4">
								← プロファイルに戻る
							</Link>
							<h1 className="text-2xl font-bold text-gray-900">パスワード変更</h1>
						</div>
					</div>
				</div>
			</div>

			{/* メインコンテンツ */}
			<div className="py-8">
				<div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
					<div className="bg-white shadow rounded-lg">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">パスワードを変更</h2>
							<p className="mt-1 text-sm text-gray-600">
								セキュリティのため、現在のパスワードを入力してください
							</p>
						</div>

						<form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
							{/* 現在のパスワード */}
							<div>
								<label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
									現在のパスワード
								</label>
								<input
									id="currentPassword"
									name="currentPassword"
									type="password"
									required
									className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									value={formData.currentPassword}
									onChange={handleChange}
									disabled={isLoading}
								/>
							</div>

							{/* 新しいパスワード */}
							<div>
								<label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
									新しいパスワード
								</label>
								<input
									id="newPassword"
									name="newPassword"
									type="password"
									required
									className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									value={formData.newPassword}
									onChange={handleChange}
									disabled={isLoading}
								/>
							</div>

							{/* 新しいパスワード確認 */}
							<div>
								<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
									新しいパスワード（確認）
								</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									required
									className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									value={formData.confirmPassword}
									onChange={handleChange}
									disabled={isLoading}
								/>
							</div>

							{/* 保存ボタン */}
							<div className="flex justify-end pt-4 border-t border-gray-200">
								<Button
									type="submit"
									disabled={isLoading || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
									className="px-6 py-2"
								>
									{isLoading ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
											変更中...
										</>
									) : (
										'パスワードを変更'
									)}
								</Button>
							</div>
						</form>
					</div>

					{/* パスワード要件の説明 */}
					<div className="mt-6 bg-blue-50 rounded-lg p-4">
						<h3 className="text-sm font-medium text-blue-800 mb-2">
							パスワード要件
						</h3>
						<ul className="text-sm text-blue-700 space-y-1">
							<li>• 8文字以上</li>
							<li>• 大文字を1文字以上含む</li>
							<li>• 小文字を1文字以上含む</li>
							<li>• 数字を1文字以上含む</li>
							<li>• 現在のパスワードと異なる</li>
						</ul>
					</div>

					{/* セキュリティヒント */}
					<div className="mt-4 bg-yellow-50 rounded-lg p-4">
						<h3 className="text-sm font-medium text-yellow-800 mb-2">
							セキュリティのヒント
						</h3>
						<ul className="text-sm text-yellow-700 space-y-1">
							<li>• 他のサイトで使用していないパスワードを使用</li>
							<li>• 定期的にパスワードを変更</li>
							<li>• パスワードを他人と共有しない</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}