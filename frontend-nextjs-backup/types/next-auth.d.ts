import NextAuth from 'next-auth';

declare module 'next-auth' {
	interface Session {
		accessToken?: string;
		user: {
			id: string; // UUID文字列
			email: string;
			name: string;
			role: 'admin' | 'user';
			isActive: boolean;
			createdAt: string;
			updatedAt: string;
		};
	}

	interface User {
		id: string; // UUID文字列
		email: string;
		name: string;
		role: 'admin' | 'user';
		accessToken: string;
		refreshToken: string;
		isActive: boolean;
		createdAt: string;
		updatedAt: string;
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		accessToken?: string;
		refreshToken?: string;
		user: {
			id: string; // UUID文字列
			email: string;
			name: string;
			role: 'admin' | 'user';
			isActive: boolean;
			createdAt: string;
			updatedAt: string;
		};
	}
}