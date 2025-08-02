import React, { useState } from 'react';
import { X } from 'lucide-react';
import { tenantApi } from '../lib/api';
import { TenantFormData } from '../types/tenant';
import { toast } from 'react-hot-toast';

interface TenantCreateModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export const TenantCreateModal: React.FC<TenantCreateModalProps> = ({
	isOpen,
	onClose,
	onSuccess
}) => {
	const [formData, setFormData] = useState<TenantFormData>({
		name: '',
		admin_email: ''
	});
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<Partial<TenantFormData>>({});

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

		if (!validateForm()) {
			return;
		}

		setLoading(true);
		try {
			const response = await tenantApi.createTenant(formData);
			
			// パスワード情報を含む詳細な成功メッセージ
			if (response.admin_info) {
				toast.success(
					`テナント「${formData.name}」が作成されました。\n` +
					`管理者メール: ${response.admin_info.email}\n` +
					`初期パスワード: ${response.admin_info.default_password}\n` +
					`${response.admin_info.note}`,
					{ duration: 10000 } // 10秒間表示
				);
			} else {
				toast.success(`テナント「${formData.name}」が作成されました`);
			}
			
			console.log('作成されたテナント:', response);
			
			// フォームをリセット
			setFormData({ name: '', admin_email: '' });
			setErrors({});
			
			// 成功コールバック
			onSuccess();
			onClose();
		} catch (error: any) {
			console.error('テナント作成エラー:', error);
			
			// エラーメッセージの処理
			if (error.response?.data?.code === 'TENANT_ALREADY_EXISTS') {
				toast.error('同じ名前のテナントが既に存在します');
			} else if (error.response?.data?.error) {
				toast.error(error.response.data.error);
			} else {
				toast.error('テナントの作成に失敗しました');
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

	// モーダルを閉じる
	const handleClose = () => {
		if (!loading) {
			setFormData({ name: '', admin_email: '' });
			setErrors({});
			onClose();
		}
	};

	if (!isOpen) return null;

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
				maxWidth: '32rem',
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
					}}>新規テナント作成</h3>
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
				<form onSubmit={handleSubmit} className="login-form">
					<div className="login-field">
						<label htmlFor="tenant-name" className="login-label">
							テナント名 <span style={{color: '#ef4444'}}>*</span>
						</label>
						<input
							id="tenant-name"
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

					<div className="login-field">
						<label htmlFor="admin-email" className="login-label">
							管理者メールアドレス <span style={{color: '#ef4444'}}>*</span>
						</label>
						<input
							id="admin-email"
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

					{/* 説明文 */}
					<div style={{
						backgroundColor: '#eff6ff',
						padding: '1rem',
						borderRadius: '0.5rem',
						border: '1px solid #bfdbfe'
					}}>
						<p style={{
							fontSize: '0.875rem',
							color: '#1e40af',
							margin: 0,
							lineHeight: '1.5'
						}}>
							<strong>注意:</strong> テナント作成後、一意のテナントIDが自動生成されます。
							管理者メールアドレスは、テナント管理者への通知に使用されます。
						</p>
					</div>

					{/* パスワード情報 */}
					<div style={{
						backgroundColor: '#f0fdf4',
						padding: '1rem',
						borderRadius: '0.5rem',
						border: '1px solid #bbf7d0'
					}}>
						<p style={{
							fontSize: '0.875rem',
							color: '#166534',
							margin: 0,
							lineHeight: '1.5'
						}}>
							<strong>🔐 テナント管理者情報:</strong><br/>
							初期パスワード: <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: 'bold'}}>TenantAdmin123!</code><br/>
							<span style={{fontSize: '0.8rem'}}>※ 初回ログイン後にパスワードを変更してください</span>
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
								backgroundColor: loading ? '#9ca3af' : '#3b82f6',
								cursor: loading ? 'not-allowed' : 'pointer',
								height: '56px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								border: 'none',
								borderRadius: '0.5rem',
								color: 'white',
								fontSize: '1rem',
								fontWeight: '500',
								transition: 'all 0.2s'
							}}
						>
							{loading ? '作成中...' : '作成'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};