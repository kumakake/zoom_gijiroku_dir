import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'AIエージェント - Zoom議事録自動配布システム',
	description: 'Zoom会議の議事録を自動生成・配布するAIエージェントサービス',
	keywords: ['AI', 'Zoom', '議事録', '自動化', '会議'],
	authors: [{ name: 'AI Agent Service Team' }],
	viewport: 'width=device-width, initial-scale=1',
	robots: 'noindex, nofollow', // 開発環境では検索エンジンからの索引を防ぐ
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="ja" suppressHydrationWarning>
			<body className={inter.className}>
				<Providers>
					{children}
				</Providers>
			</body>
		</html>
	);
}