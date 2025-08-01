'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		email: '',
		name: '',
		password: '',
		confirmPassword: '',
	});

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
			if (formData.password !== formData.confirmPassword) {
				toast.error('パスワードが一致しません');
				return;
			}

			// パスワード強度チェック
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
			if (!passwordRegex.test(formData.password)) {
				toast.error('パスワードは8文字以上で、大文字・小文字・数字を含む必要があります');
				return;
			}

			const result = await authApi.register({
				email: formData.email,
				name: formData.name,
				password: formData.password,
			});

			toast.success('アカウントが作成されました');
			console.log('登録成功:', result);
			
			// ログイン画面にリダイレクト
			router.push(paths.login);
			
		} catch (error: any) {
			console.error('登録エラー:', error);
			const errorMessage = error.response?.data?.error || 'アカウント作成中にエラーが発生しました';
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
						アカウント作成
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600">
						AIエージェントサービスに新規登録
					</p>
				</div>
				
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="rounded-md shadow-sm space-y-4">
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
								メールアドレス
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="your@example.com"
								value={formData.email}
								onChange={handleChange}
								disabled={isLoading}
							/>
						</div>
						
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
								名前
							</label>
							<input
								id="name"
								name="name"
								type="text"
								autoComplete="name"
								required
								className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="山田 太郎"
								value={formData.name}
								onChange={handleChange}
								disabled={isLoading}
							/>
						</div>
						
						<div>
							<label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
								パスワード
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="8文字以上（大文字・小文字・数字を含む）"
								value={formData.password}
								onChange={handleChange}
								disabled={isLoading}
							/>
						</div>
						
						<div>
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
								パスワード確認
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
								className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="パスワードを再入力"
								value={formData.confirmPassword}
								onChange={handleChange}
								disabled={isLoading}
							/>
						</div>
					</div>

					<div>
						<Button
							type="submit"
							className="group relative w-full flex justify-center"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
									アカウント作成中...
								</>
							) : (
								'アカウント作成'
							)}
						</Button>
					</div>

					<div className="text-center">
						<Link
							href="/login"
							className="text-blue-600 hover:text-blue-500 text-sm"
						>
							既にアカウントをお持ちの方はこちら
						</Link>
					</div>
				</form>

				{/* パスワード要件の説明 */}
				<div className="mt-8 p-4 bg-yellow-50 rounded-md">
					<h3 className="text-sm font-medium text-yellow-800 mb-2">
						パスワード要件
					</h3>
					<ul className="text-xs text-yellow-700 space-y-1">
						<li>• 8文字以上</li>
						<li>• 大文字を1文字以上含む</li>
						<li>• 小文字を1文字以上含む</li>
						<li>• 数字を1文字以上含む</li>
					</ul>
				</div>
			</div>
		</div>
	);
}