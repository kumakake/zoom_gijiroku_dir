/** @type {import('next').NextConfig} */

// 環境変数からサブパス設定を取得
const basePath = process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : '/zm';
const assetPrefix = process.env.ASSET_PREFIX !== undefined ? process.env.ASSET_PREFIX : basePath;

const nextConfig = {
	// サブパス設定（本番環境: /zm）
	basePath: basePath,
	assetPrefix: assetPrefix,
	
	// Next.js 14では experimental.appDir と serverActions は不要
	// experimental: {
	//     appDir: true,      // Next.js 13.4+ では標準
	//     serverActions: true, // Next.js 14では標準
	// },
	typescript: {
		// 本番ビルド時にTypeScriptエラーを無視（開発時は型チェックを行う）
		ignoreBuildErrors: false,
	},
	eslint: {
		// ESLintエラーがある場合はビルドを停止
		ignoreDuringBuilds: false,
	},
	// 画像最適化の設定
	images: {
		// サブパス対応
		path: `${assetPrefix}/_next/image`,
		domains: ['localhost', 'tools.cross-astem.jp'],
		formats: ['image/webp', 'image/avif'],
	},
	// 環境変数の公開設定
	env: {
		NEXTAUTH_URL: process.env.NEXTAUTH_URL,
		BACKEND_API_URL: process.env.BACKEND_API_URL,
		BASE_PATH: basePath,
		NEXT_PUBLIC_BASE_PATH: basePath,
	},
	
	// 公開実行時設定
	publicRuntimeConfig: {
		basePath: basePath,
		apiUrl: process.env.BACKEND_API_URL,
	},
	// リダイレクト設定
	async redirects() {
		return [
			{
				source: '/',
				destination: '/dashboard',
				permanent: false,
			},
		];
	},
	// リライト設定（APIプロキシ）
	async rewrites() {
		const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
		return [
			{
				source: '/api/backend/:path*',
				destination: `${backendUrl}/api/:path*`,
			},
		];
	},
	// CORS設定
	async headers() {
		return [
			{
				source: '/api/:path*',
				headers: [
					{
						key: 'Access-Control-Allow-Origin',
						value: process.env.NODE_ENV === 'production' 
							? 'https://tools.cross-astem.jp' 
							: '*',
					},
					{
						key: 'Access-Control-Allow-Methods',
						value: 'GET, POST, PUT, DELETE, OPTIONS',
					},
					{
						key: 'Access-Control-Allow-Headers',
						value: 'Content-Type, Authorization',
					},
				],
			},
		];
	},
};

module.exports = nextConfig;
