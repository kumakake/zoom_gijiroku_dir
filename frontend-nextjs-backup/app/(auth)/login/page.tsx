'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		email: '',
		password: '',
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
			const result = await signIn('credentials', {
				email: formData.email,
				password: formData.password,
				redirect: false,
			});

			if (result?.error) {
				toast.error(result.error);
			} else if (result?.ok) {
				toast.success('ログインしました');
				
				// セッション情報を取得してからリダイレクト
				const session = await getSession();
				if (session) {
					router.push('/dashboard');
				}
			}
		} catch (error) {
			console.error('ログインエラー:', error);
			toast.error('ログイン処理中にエラーが発生しました');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
						AIエージェントサービス
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600">
						Zoom議事録自動配布システム
					</p>
				</div>
				
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="rounded-md shadow-sm -space-y-px">
						<div>
							<label htmlFor="email" className="sr-only">
								メールアドレス
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="メールアドレス"
								value={formData.email}
								onChange={handleChange}
								disabled={isLoading}
							/>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								パスワード
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
								placeholder="パスワード"
								value={formData.password}
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
									ログイン中...
								</>
							) : (
								'ログイン'
							)}
						</Button>
					</div>

					<div className="text-center">
						<Link
							href="/register"
							className="text-blue-600 hover:text-blue-500 text-sm"
						>
							アカウントをお持ちでない方はこちら
						</Link>
					</div>
				</form>

				{/* デモ用ログイン情報 */}
				<div className="mt-8 p-4 bg-blue-50 rounded-md">
					<h3 className="text-sm font-medium text-blue-800 mb-2">
						デモ用ログイン情報
					</h3>
					<p className="text-xs text-blue-600">
						メール: admin@example.com<br />
						パスワード: DemoPassword123
					</p>
				</div>
			</div>
		</div>
	);
}