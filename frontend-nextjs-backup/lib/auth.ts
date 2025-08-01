import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';
import { User } from '@/types';

// NextAuth.js は常にサーバーサイドで動作するため、Docker サービス名を使用
const backendUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
const basePath = process.env.BASE_PATH || '';

  console.log('🔍 AUTH.TS DEBUG - BASE_PATH:', process.env.BASE_PATH);
  console.log('🔍 AUTH.TS DEBUG - basePath:', basePath);
  console.log('🔍 AUTH.TS DEBUG - signIn path:', `${basePath}/login`);
  console.log('🔍 AUTH.TS DEBUG - NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

export const authOptions: NextAuthOptions = {
	providers: [
		CredentialsProvider({
			name: 'credentials',
			credentials: {
				email: { label: 'メールアドレス', type: 'email' },
				password: { label: 'パスワード', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					throw new Error('メールアドレスとパスワードが必要です');
				}

				try {
					const response = await axios.post(`${backendUrl}/api/auth/login`, {
						email: credentials.email,
						password: credentials.password,
					});

					const { user, accessToken, refreshToken } = response.data;

					if (user && accessToken) {
						return {
							id: user.user_uuid,
							email: user.email,
							name: user.name,
							image: null,
							role: user.role,
							accessToken,
							refreshToken,
						} as any;
					}

					return null;
				} catch (error: any) {
					console.error('認証エラー:', error.response?.data || (error instanceof Error ? error.message : 'Unknown error'));
					
					if (error.response?.status === 401) {
						throw new Error('メールアドレスまたはパスワードが正しくありません');
					}
					
					throw new Error('認証処理中にエラーが発生しました');
				}
			},
		}),
	],
	
	callbacks: {
		async jwt({ token, user }) {
			// 初回ログイン時にユーザー情報をトークンに保存
			if (user) {
				token.accessToken = (user as any).accessToken;
				token.refreshToken = (user as any).refreshToken;
				token.user = {
					id: (user as any).id, // UUIDをそのまま使用
					email: (user as any).email,
					name: (user as any).name,
					role: (user as any).role,
					isActive: true,
					createdAt: '',
					updatedAt: '',
				} as any;
			}

			// トークンの有効期限チェックとリフレッシュ（簡略化）
			return token;
		},

		async session({ session, token }) {
			// セッションにトークン情報を含める
			session.accessToken = token.accessToken as string;
			session.user = token.user as any;

			return session;
		},
	},

	pages: {
		signIn: `${basePath}/login`,
		error:  `${basePath}/login`,
	},

	session: {
		strategy: 'jwt',
		maxAge: 24 * 60 * 60, // 24時間
	},

	jwt: {
		maxAge: 24 * 60 * 60, // 24時間
	},

	secret: process.env.NEXTAUTH_SECRET,

	debug: process.env.NODE_ENV === 'development',
};
