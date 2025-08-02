import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { tenantApi } from '../lib/api';
import { Tenant, TenantFormData, ZoomSettings } from '../types/tenant';
import { toast } from 'react-hot-toast';

interface TenantEditModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	tenant: Tenant | null;
}

export const TenantEditModal: React.FC<TenantEditModalProps> = ({
	isOpen,
	onClose,
	onSuccess,
	tenant
}) => {
	const [formData, setFormData] = useState<TenantFormData>({
		name: '',
		admin_email: ''
	});
	const [zoomSettings, setZoomSettings] = useState<ZoomSettings | null>(null);
	const [zoomFormData, setZoomFormData] = useState({
		zoom_client_id: '',
		zoom_client_secret: '',
		zoom_webhook_secret: '',
		zoom_account_id: ''
	});
	const [showSecrets, setShowSecrets] = useState({
		client_id: false,
		client_secret: false,
		webhook_secret: false
	});
	const [loading, setLoading] = useState(false);
	const [zoomLoading, setZoomLoading] = useState(false);
	const [errors, setErrors] = useState<Partial<TenantFormData>>({});

	// テナント情報をフォームにセット
	useEffect(() => {
		if (tenant && isOpen) {
			setFormData({
				name: tenant.name,
				admin_email: tenant.admin_email
			});
			setErrors({});
			
			// Zoom設定を取得
			fetchZoomSettings(tenant.tenant_id);
		}
	}, [tenant, isOpen]);

	// Zoom設定取得
	const fetchZoomSettings = async (tenantId: string) => {
		try {
			setZoomLoading(true);
			const response = await tenantApi.getZoomSettings(tenantId);
			setZoomSettings(response.zoom_settings);
			
			// フォームデータにセット（セキュリティ上、実際の値は表示しない）
			setZoomFormData({
				zoom_client_id: '',
				zoom_client_secret: '',
				zoom_webhook_secret: '',
				zoom_account_id: response.zoom_settings?.zoom_account_id || ''
			});
		} catch (error: any) {
			console.error('Zoom設定取得エラー:', error);
			// エラーは非表示（必須ではないため）
		} finally {
			setZoomLoading(false);
		}
	};

	// フォームバリデーション
	const validateForm = (): boolean => {
		const newErrors: Partial<TenantFormData> = {};

		if (!formData.name.trim()) {
			newErrors.name = 'テナント名は必須です';
		} else if (formData.name.trim().length < 2) {
			newErrors.name = 'テナント名は2文字以上で入力してください';
		}

		if (!formData.admin_email.trim()) {
			newErrors.admin_email = '管理者メールアドレスは必須です';
		} else {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(formData.admin_email)) {
				newErrors.admin_email = '有効なメールアドレスを入力してください';
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// フォーム送信
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!tenant) {
			toast.error('編集対象のテナントが見つかりません');
			return;
		}

		if (!validateForm()) {
			return;
		}

		setLoading(true);
		try {
			// 1. テナント基本情報の更新
			const response = await tenantApi.updateTenant(tenant.tenant_id, formData);
			
			// 2. Zoom設定の更新（入力がある場合のみ）
			const zoomUpdateData: any = {};
			if (zoomFormData.zoom_client_id.trim()) {
				zoomUpdateData.zoom_client_id = zoomFormData.zoom_client_id.trim();
			}
			if (zoomFormData.zoom_client_secret.trim()) {
				zoomUpdateData.zoom_client_secret = zoomFormData.zoom_client_secret.trim();
			}
			if (zoomFormData.zoom_webhook_secret.trim()) {
				zoomUpdateData.zoom_webhook_secret = zoomFormData.zoom_webhook_secret.trim();
			}
			if (zoomFormData.zoom_account_id.trim()) {
				zoomUpdateData.zoom_account_id = zoomFormData.zoom_account_id.trim();
			}

			// Zoom設定に変更がある場合は更新
			if (Object.keys(zoomUpdateData).length > 0) {
				await tenantApi.updateZoomSettings(tenant.tenant_id, zoomUpdateData);
			}

			toast.success(`テナント「${formData.name}」が更新されました`);
			console.log('更新されたテナント:', response);
			
			// 成功コールバック
			onSuccess();
			onClose();
		} catch (error: any) {
			console.error('テナント更新エラー:', error);
			
			// エラーメッセージの処理
			if (error.response?.data?.code === 'TENANT_NOT_FOUND') {
				toast.error('指定されたテナントが見つかりません');
			} else if (error.response?.data?.code === 'TENANT_ALREADY_EXISTS') {
				toast.error('同じ名前のテナントが既に存在します');
			} else if (error.response?.data?.error) {
				toast.error(error.response.data.error);
			} else {
				toast.error('テナントの更新に失敗しました');
			}
		} finally {
			setLoading(false);
		}
	};

	// 入力変更ハンドラー
	const handleInputChange = (field: keyof TenantFormData, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }));
		
		// エラーをクリア
		if (errors[field]) {
			setErrors(prev => ({ ...prev, [field]: undefined }));
		}
	};

	// Zoom設定入力変更ハンドラー
	const handleZoomInputChange = (field: string, value: string) => {
		setZoomFormData(prev => ({ ...prev, [field]: value }));
	};


	// モーダルを閉じる
	const handleClose = () => {
		if (!loading) {
			setErrors({});
			onClose();
		}
	};

	if (!isOpen || !tenant) return null;

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '1rem',
			zIndex: 9999
		}}>
			<div className="login-card" style={{
				width: '100%',
				maxWidth: '56rem',
				margin: 0,
				position: 'relative'
			}}>
				{/* ヘッダー */}
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '2rem'
				}}>
					<h3 className="login-title" style={{
						fontSize: '1.5rem',
						marginBottom: 0
					}}>テナント編集</h3>
					<button
						onClick={handleClose}
						disabled={loading}
						style={{
							background: 'none',
							border: 'none',
							color: '#6b7280',
							cursor: 'pointer',
							padding: '0.5rem',
							borderRadius: '0.25rem',
							transition: 'background-color 0.2s'
						}}
						onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
						onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
					>
						<X className="w-6 h-6" />
					</button>
				</div>

				{/* フォーム */}
				<form onSubmit={handleSubmit} style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '1.5rem'
				}}>
					{/* 基本情報セクション */}
					<div style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '1.5rem'
					}}>
						{/* 左列 */}
						<div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
							{/* テナントID表示 */}
							<div>
								<label style={{
									display: 'block',
									fontSize: '0.875rem',
									fontWeight: '500',
									color: '#374151',
									marginBottom: '0.5rem'
								}}>
									テナントID
								</label>
								<div style={{
									padding: '0.75rem',
									backgroundColor: '#f9fafb',
									border: '1px solid #e5e7eb',
									borderRadius: '0.5rem',
									fontSize: '0.875rem',
									color: '#6b7280',
									fontFamily: 'monospace'
								}}>
									{tenant.tenant_id}
								</div>
							</div>

							{/* テナント名 */}
							<div>
								<label htmlFor="tenant-name-edit" style={{
									display: 'block',
									fontSize: '0.875rem',
									fontWeight: '500',
									color: '#374151',
									marginBottom: '0.5rem'
								}}>
									テナント名 <span style={{color: '#ef4444'}}>*</span>
								</label>
								<input
									id="tenant-name-edit"
									type="text"
									value={formData.name}
									onChange={(e) => handleInputChange('name', e.target.value)}
									className="login-input"
									style={{
										borderColor: errors.name ? '#ef4444' : '#d1d5db'
									}}
									placeholder="例: 株式会社サンプル"
									disabled={loading}
								/>
								{errors.name && (
									<p style={{
										marginTop: '0.5rem',
										fontSize: '0.875rem',
										color: '#ef4444'
									}}>{errors.name}</p>
								)}
							</div>

							{/* ステータス表示 */}
							<div>
								<label style={{
									display: 'block',
									fontSize: '0.875rem',
									fontWeight: '500',
									color: '#374151',
									marginBottom: '0.5rem'
								}}>
									ステータス
								</label>
								<div style={{
									padding: '0.75rem',
									backgroundColor: tenant.is_active ? '#f0fdf4' : '#fef2f2',
									border: `1px solid ${tenant.is_active ? '#bbf7d0' : '#fecaca'}`,
									borderRadius: '0.5rem',
									fontSize: '0.875rem',
									color: tenant.is_active ? '#166534' : '#dc2626',
									fontWeight: '500'
								}}>
									{tenant.is_active ? 'アクティブ' : '無効'}
								</div>
							</div>
						</div>

						{/* 右列 */}
						<div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
							{/* 管理者メールアドレス */}
							<div>
								<label htmlFor="admin-email-edit" style={{
									display: 'block',
									fontSize: '0.875rem',
									fontWeight: '500',
									color: '#374151',
									marginBottom: '0.5rem'
								}}>
									管理者メールアドレス <span style={{color: '#ef4444'}}>*</span>
								</label>
								<input
									id="admin-email-edit"
									type="email"
									value={formData.admin_email}
									onChange={(e) => handleInputChange('admin_email', e.target.value)}
									className="login-input"
									style={{
										borderColor: errors.admin_email ? '#ef4444' : '#d1d5db'
									}}
									placeholder="例: admin@sample.com"
									disabled={loading}
								/>
								{errors.admin_email && (
									<p style={{
										marginTop: '0.5rem',
										fontSize: '0.875rem',
										color: '#ef4444'
									}}>{errors.admin_email}</p>
								)}
							</div>

							{/* 作成日表示 */}
							<div>
								<label style={{
									display: 'block',
									fontSize: '0.875rem',
									fontWeight: '500',
									color: '#374151',
									marginBottom: '0.5rem'
								}}>
									作成日
								</label>
								<div style={{
									padding: '0.75rem',
									backgroundColor: '#f9fafb',
									border: '1px solid #e5e7eb',
									borderRadius: '0.5rem',
									fontSize: '0.875rem',
									color: '#6b7280'
								}}>
									{new Date(tenant.created_at).toLocaleDateString('ja-JP', {
										year: 'numeric',
										month: '2-digit',
										day: '2-digit',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
							</div>
						</div>
					</div>

					{/* Zoom設定セクション */}
					<div style={{
						border: '1px solid #e5e7eb',
						borderRadius: '0.5rem',
						padding: '1.5rem',
						backgroundColor: '#fafafa'
					}}>
						<h4 style={{
							fontSize: '1.125rem',
							fontWeight: '600',
							color: '#1f2937',
							marginBottom: '1rem',
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem'
						}}>
							📹 Zoom設定
							{zoomLoading && <span style={{fontSize: '0.875rem', color: '#6b7280'}}>読み込み中...</span>}
						</h4>

						{/* 現在の設定状況 */}
						{zoomSettings && (
							<div style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
								gap: '0.75rem',
								marginBottom: '1.5rem'
							}}>
								<div style={{
									padding: '0.75rem',
									borderRadius: '0.375rem',
									border: '1px solid #d1d5db',
									backgroundColor: 'white',
									textAlign: 'center'
								}}>
									<div style={{fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem'}}>API Key</div>
									<div style={{
										fontSize: '0.875rem',
										fontWeight: '500',
										color: zoomSettings.api_key_status === 'configured' ? '#16a34a' : '#dc2626'
									}}>
										{zoomSettings.api_key_status === 'configured' ? '設定済み' : '未設定'}
									</div>
								</div>
								<div style={{
									padding: '0.75rem',
									borderRadius: '0.375rem',
									border: '1px solid #d1d5db',
									backgroundColor: 'white',
									textAlign: 'center'
								}}>
									<div style={{fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem'}}>API Secret</div>
									<div style={{
										fontSize: '0.875rem',
										fontWeight: '500',
										color: zoomSettings.api_secret_status === 'configured' ? '#16a34a' : '#dc2626'
									}}>
										{zoomSettings.api_secret_status === 'configured' ? '設定済み' : '未設定'}
									</div>
								</div>
								<div style={{
									padding: '0.75rem',
									borderRadius: '0.375rem',
									border: '1px solid #d1d5db',
									backgroundColor: 'white',
									textAlign: 'center'
								}}>
									<div style={{fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem'}}>Webhook Secret</div>
									<div style={{
										fontSize: '0.875rem',
										fontWeight: '500',
										color: zoomSettings.webhook_secret_status === 'configured' ? '#16a34a' : '#dc2626'
									}}>
										{zoomSettings.webhook_secret_status === 'configured' ? '設定済み' : '未設定'}
									</div>
								</div>
							</div>
						)}

						{/* Zoom設定フォーム */}
						<div style={{
							display: 'grid',
							gridTemplateColumns: '1fr 1fr',
							gap: '1.5rem'
						}}>
							{/* 左列 */}
							<div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
								{/* Zoom Account ID */}
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.5rem'
									}}>
										Zoom Account ID
									</label>
									<input
										type="text"
										value={zoomFormData.zoom_account_id}
										onChange={(e) => handleZoomInputChange('zoom_account_id', e.target.value)}
										className="login-input"
										placeholder="Zoom Account ID"
										disabled={zoomLoading}
									/>
								</div>

								{/* API Key */}
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.5rem'
									}}>
										Zoom Client ID
									</label>
									<div style={{position: 'relative'}}>
										<input
											type={showSecrets.client_id ? 'text' : 'password'}
											value={zoomFormData.zoom_client_id}
											onChange={(e) => handleZoomInputChange('zoom_client_id', e.target.value)}
											className="login-input"
											style={{paddingRight: '3rem'}}
											placeholder="新しいClient ID（空白の場合は変更されません）"
											disabled={zoomLoading}
										/>
										<button
											type="button"
											onClick={() => setShowSecrets(prev => ({...prev, client_id: !prev.client_id}))}
											style={{
												position: 'absolute',
												right: '0.75rem',
												top: '50%',
												transform: 'translateY(-50%)',
												background: 'none',
												border: 'none',
												color: '#6b7280',
												cursor: 'pointer'
											}}
										>
											{showSecrets.client_id ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
										</button>
									</div>
								</div>
							</div>

							{/* 右列 */}
							<div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
								{/* API Secret */}
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.5rem'
									}}>
										Zoom Client Secret
									</label>
									<div style={{position: 'relative'}}>
										<input
											type={showSecrets.client_secret ? 'text' : 'password'}
											value={zoomFormData.zoom_client_secret}
											onChange={(e) => handleZoomInputChange('zoom_client_secret', e.target.value)}
											className="login-input"
											style={{paddingRight: '3rem'}}
											placeholder="新しいClient Secret（空白の場合は変更されません）"
											disabled={zoomLoading}
										/>
										<button
											type="button"
											onClick={() => setShowSecrets(prev => ({...prev, client_secret: !prev.client_secret}))}
											style={{
												position: 'absolute',
												right: '0.75rem',
												top: '50%',
												transform: 'translateY(-50%)',
												background: 'none',
												border: 'none',
												color: '#6b7280',
												cursor: 'pointer'
											}}
										>
											{showSecrets.client_secret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
										</button>
									</div>
								</div>

								{/* Webhook Secret */}
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.5rem'
									}}>
										Zoom Webhook Secret
									</label>
									<div style={{position: 'relative'}}>
										<input
											type={showSecrets.webhook_secret ? 'text' : 'password'}
											value={zoomFormData.zoom_webhook_secret}
											onChange={(e) => handleZoomInputChange('zoom_webhook_secret', e.target.value)}
											className="login-input"
											style={{paddingRight: '3rem'}}
											placeholder="新しいWebhook Secret（空白の場合は変更されません）"
											disabled={zoomLoading}
										/>
										<button
											type="button"
											onClick={() => setShowSecrets(prev => ({...prev, webhook_secret: !prev.webhook_secret}))}
											style={{
												position: 'absolute',
												right: '0.75rem',
												top: '50%',
												transform: 'translateY(-50%)',
												background: 'none',
												border: 'none',
												color: '#6b7280',
												cursor: 'pointer'
											}}
										>
											{showSecrets.webhook_secret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
										</button>
									</div>
								</div>
							</div>
						</div>

					</div>

					{/* 説明文 */}
					<div style={{
						backgroundColor: '#fef3c7',
						padding: '1rem',
						borderRadius: '0.5rem',
						border: '1px solid #fcd34d'
					}}>
						<p style={{
							fontSize: '0.875rem',
							color: '#92400e',
							margin: 0,
							lineHeight: '1.5'
						}}>
							<strong>注意:</strong> テナントIDは変更できません。
							テナント名と管理者メールアドレスのみ変更可能です。
						</p>
					</div>

					{/* ボタン */}
					<div style={{
						display: 'flex',
						gap: '1rem',
						marginTop: '2rem'
					}}>
						<button
							type="button"
							onClick={handleClose}
							disabled={loading}
							style={{
								flex: 1,
								padding: '1.5rem',
								border: '2px solid #d1d5db',
								borderRadius: '0.5rem',
								backgroundColor: 'white',
								color: '#374151',
								fontSize: '1rem',
								fontWeight: '500',
								cursor: 'pointer',
								transition: 'all 0.2s',
								height: '56px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center'
							}}
							onMouseOver={(e) => {
								if (!loading) {
									(e.target as HTMLElement).style.backgroundColor = '#f9fafb';
									(e.target as HTMLElement).style.borderColor = '#9ca3af';
								}
							}}
							onMouseOut={(e) => {
								(e.target as HTMLElement).style.backgroundColor = 'white';
								(e.target as HTMLElement).style.borderColor = '#d1d5db';
							}}
						>
							キャンセル
						</button>
						<button
							type="submit"
							disabled={loading}
							style={{
								flex: 1,
								padding: '1.5rem',
								backgroundColor: loading ? '#9ca3af' : '#f59e0b',
								color: 'white',
								border: 'none',
								borderRadius: '0.5rem',
								fontSize: '1rem',
								fontWeight: '500',
								cursor: loading ? 'not-allowed' : 'pointer',
								transition: 'all 0.2s',
								height: '56px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center'
							}}
							onMouseOver={(e) => {
								if (!loading) {
									(e.target as HTMLElement).style.backgroundColor = '#d97706';
								}
							}}
							onMouseOut={(e) => {
								if (!loading) {
									(e.target as HTMLElement).style.backgroundColor = '#f59e0b';
								}
							}}
						>
							{loading ? '更新中...' : '更新'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};