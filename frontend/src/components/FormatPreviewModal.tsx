import { Button } from './ui/Button';
import { X, Download } from 'lucide-react';

interface FormatPreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	previewHtml: string;
	loading?: boolean;
}

export function FormatPreviewModal({ 
	isOpen, 
	onClose, 
	previewHtml, 
	loading = false 
}: FormatPreviewModalProps) {
	console.log('🎭 FormatPreviewModal レンダリング:', {
		isOpen,
		previewHtml: previewHtml ? `${previewHtml.length}文字` : 'なし',
		loading
	});

	const handleDownloadHtml = () => {
		const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `議事録プレビュー_${new Date().getTime()}.html`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div 
			style={{ 
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0, 0, 0, 0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 10000,
				padding: '1rem'
			}}
		>
			{/* モーダルコンテンツ */}
			<div 
				style={{ 
					backgroundColor: 'white',
					borderRadius: '0.75rem',
					boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
					width: '100%',
					maxWidth: '64rem',
					maxHeight: '90vh',
					display: 'flex',
					flexDirection: 'column'
				}}
			>
				{/* ヘッダー */}
				<div style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '1.5rem',
					borderBottom: '1px solid #e5e7eb'
				}}>
					<h2 style={{
						fontSize: '1.125rem',
						fontWeight: '500',
						color: '#1f2937',
						margin: 0
					}}>
						議事録フォーマット プレビュー
					</h2>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<Button
							variant="outline"
							onClick={handleDownloadHtml}
							className="flex items-center gap-2"
							disabled={loading}
						>
							<Download className="w-4 h-4" />
							HTMLダウンロード
						</Button>
						<button
							onClick={onClose}
							style={{
								color: '#9ca3af',
								cursor: 'pointer',
								border: 'none',
								background: 'transparent',
								fontSize: '1.25rem',
								padding: '0.5rem'
							}}
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* プレビュー内容 */}
				<div style={{
					flex: 1,
					overflowY: 'auto',
					padding: '1.5rem'
				}}>
					{loading ? (
						<div style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '3rem 0'
						}}>
							<div style={{
								width: '2rem',
								height: '2rem',
								border: '2px solid #3b82f6',
								borderTop: '2px solid transparent',
								borderRadius: '50%',
								animation: 'spin 1s linear infinite'
							}}></div>
							<span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
								プレビューを生成中...
							</span>
						</div>
					) : (
						<div 
							dangerouslySetInnerHTML={{ __html: previewHtml }}
							style={{
								fontFamily: 'system-ui, -apple-system, sans-serif',
								lineHeight: '1.6',
								fontSize: '0.875rem'
							}}
						/>
					)}
				</div>

				{/* フッター */}
				<div style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'flex-end',
					gap: '0.75rem',
					padding: '1.5rem',
					borderTop: '1px solid #e5e7eb',
					backgroundColor: '#f9fafb',
					borderBottomLeftRadius: '0.75rem',
					borderBottomRightRadius: '0.75rem'
				}}>
					<Button variant="outline" onClick={onClose}>
						閉じる
					</Button>
				</div>
			</div>

			{/* プレビュー用のCSS */}
			<style>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
				
				.preview-content h1 {
					font-size: 1.5rem;
					font-weight: bold;
					margin-bottom: 1rem;
					color: #1f2937;
				}
				.preview-content h2 {
					font-size: 1.25rem;
					font-weight: 600;
					margin-bottom: 0.75rem;
					color: #374151;
				}
				.preview-content h3 {
					font-size: 1.125rem;
					font-weight: 600;
					margin-bottom: 0.5rem;
					color: #4b5563;
				}
				.preview-content p {
					margin-bottom: 0.75rem;
					color: #6b7280;
				}
				.preview-content .section {
					margin-bottom: 2rem;
					padding: 1rem;
					border-left: 4px solid #3b82f6;
					background-color: #f8fafc;
				}
				.preview-content .section-title {
					font-weight: 600;
					margin-bottom: 1rem;
					color: #1e40af;
				}
				.preview-content .header-info p {
					margin-bottom: 0.5rem;
				}
				.preview-content .summary-content {
					font-style: italic;
					background-color: #eff6ff;
					padding: 1rem;
					border-radius: 0.5rem;
				}
				.preview-content .transcript-content {
					background-color: white;
					padding: 1rem;
					border-radius: 0.5rem;
					border: 1px solid #e5e7eb;
				}
				.preview-content .action-items-list {
					list-style-type: disc;
					padding-left: 1.5rem;
				}
				.preview-content .action-items-list li {
					margin-bottom: 0.25rem;
				}
				.preview-content .custom-section {
					background-color: #fef3c7;
					padding: 1rem;
					border-radius: 0.5rem;
					border: 1px solid #f59e0b;
				}
			`}</style>
		</div>
	);
}