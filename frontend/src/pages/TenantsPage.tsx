import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, Settings, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tenantApi } from '../lib/api';
import { Tenant, TenantListResponse, TenantSearchParams } from '../types/tenant';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { TenantCreateModal } from '../components/TenantCreateModal';
import { TenantEditModal } from '../components/TenantEditModal';
import { toast } from 'react-hot-toast';

export const TenantsPage: React.FC = () => {
	const { user, logout } = useAuth();
	const [tenants, setTenants] = useState<Tenant[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

	// テナント一覧取得
	const fetchTenants = async (params: TenantSearchParams = {}) => {
		try {
			setLoading(true);
			const response: TenantListResponse = await tenantApi.getTenants({
				page: params.page || currentPage,
				limit: 10,
				search: params.search || searchQuery
			});

			setTenants(response.tenants);
			setTotalPages(response.pagination.totalPages);
			setTotalCount(response.pagination.totalCount);
			setCurrentPage(response.pagination.currentPage);
		} catch (error) {
			console.error('テナント一覧取得エラー:', error);
			toast.error('テナント一覧の取得に失敗しました');
		} finally {
			setLoading(false);
		}
	};

	// 初期データ取得
	useEffect(() => {
		fetchTenants();
	}, []);

	// 検索実行
	const handleSearch = () => {
		setCurrentPage(1);
		fetchTenants({ page: 1, search: searchQuery });
	};

	// テナント削除
	const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
		if (tenantId === 'default0') {
			toast.error('デフォルトテナントは削除できません');
			return;
		}

		if (!confirm(`テナント「${tenantName}」を削除しますか？\nこの操作は取り消せません。`)) {
			return;
		}

		try {
			await tenantApi.deleteTenant(tenantId);
			toast.success('テナントが削除されました');
			fetchTenants(); // 一覧を再取得
		} catch (error) {
			console.error('テナント削除エラー:', error);
			toast.error('テナントの削除に失敗しました');
		}
	};

	// テナント編集
	const handleEditTenant = (tenantId: string) => {
		const tenant = tenants.find(t => t.tenant_id === tenantId);
		if (tenant) {
			setSelectedTenant(tenant);
			setShowEditModal(true);
		} else {
			toast.error('編集対象のテナントが見つかりません');
		}
	};

	// ページ変更
	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		fetchTenants({ page, search: searchQuery });
	};

	// 日付フォーマット
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	if (loading && tenants.length === 0) {
		return (
			<div className="dashboard">
				{/* Header */}
				<header className="dashboard-header">
					<div className="dashboard-header-content">
						<div className="dashboard-logo">
							<div className="dashboard-logo-icon">
								AI
							</div>
							<div>
								<h1 className="dashboard-title">
									テナント管理
								</h1>
								<p className="dashboard-subtitle">
									システム内のテナントを管理します
								</p>
							</div>
						</div>
						<div className="dashboard-nav">
							<Link to="/dashboard" className="dashboard-nav-link">
								ダッシュボード
							</Link>
							<Link to="/profile" className="dashboard-nav-link">
								プロフィール
							</Link>
							<button onClick={logout} className="dashboard-logout-btn">
								ログアウト
							</button>
						</div>
					</div>
				</header>
				<main className="dashboard-main">
					<div className="flex justify-center items-center h-64">
						<LoadingSpinner />
					</div>
				</main>
			</div>
		);
	}

	return (
		<div className="dashboard">
			{/* Header */}
			<header className="dashboard-header">
				<div className="dashboard-header-content">
					<div className="dashboard-logo">
						<div className="dashboard-logo-icon">
							AI
						</div>
						<div>
							<h1 className="dashboard-title">
								テナント管理
							</h1>
							<p className="dashboard-subtitle">
								システム内のテナントを管理します
							</p>
						</div>
					</div>
					<div className="dashboard-nav">
						<Link to="/dashboard" className="dashboard-nav-link">
							ダッシュボード
						</Link>
						<Link to="/profile" className="dashboard-nav-link">
							プロフィール
						</Link>
						<button onClick={logout} className="dashboard-logout-btn">
							ログアウト
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="dashboard-main">

				{/* 統計情報 */}
				<div style={{
					display: 'flex',
					gap: '1rem',
					marginBottom: '1.5rem',
					alignItems: 'center'
				}}>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						padding: '0.75rem 1rem',
						backgroundColor: '#dbeafe',
						borderRadius: '0.5rem',
						border: '1px solid #bfdbfe'
					}}>
						<span style={{
							fontSize: '1.25rem',
							fontWeight: '700',
							color: '#1e40af'
						}}>
							{totalCount}
						</span>
						<span style={{
							fontSize: '0.875rem',
							color: '#1e40af',
							fontWeight: '500'
						}}>
							総テナント数
						</span>
					</div>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						padding: '0.75rem 1rem',
						backgroundColor: '#d1fae5',
						borderRadius: '0.5rem',
						border: '1px solid #a7f3d0'
					}}>
						<span style={{
							fontSize: '1.25rem',
							fontWeight: '700',
							color: '#059669'
						}}>
							{tenants.filter(t => t.is_active).length}
						</span>
						<span style={{
							fontSize: '0.875rem',
							color: '#059669',
							fontWeight: '500'
						}}>
							アクティブテナント
						</span>
					</div>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						padding: '0.75rem 1rem',
						backgroundColor: '#e9d5ff',
						borderRadius: '0.5rem',
						border: '1px solid #ddd6fe'
					}}>
						<span style={{
							fontSize: '1.25rem',
							fontWeight: '700',
							color: '#7c3aed'
						}}>
							{tenants.reduce((sum, t) => sum + (parseInt(String(t.user_count || 0))), 0)}
						</span>
						<span style={{
							fontSize: '0.875rem',
							color: '#7c3aed',
							fontWeight: '500'
						}}>
							総ユーザー数
						</span>
					</div>
					<button
						onClick={() => setShowCreateModal(true)}
						className="dashboard-feature-button indigo"
						style={{padding: '0.75rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto', flexShrink: 0, marginLeft: 'auto'}}
					>
						<Plus className="w-4 h-4" />
						新規テナント作成
					</button>
				</div>

				{/* 検索セクション */}
				<div style={{
					display: 'flex',
					gap: '1rem',
					marginBottom: '1.5rem',
					alignItems: 'center'
				}}>
					<div style={{position: 'relative', flex: 1}}>
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
						<input
							type="text"
							placeholder="テナント名またはメールアドレスで検索..."
							className="login-input"
							style={{paddingLeft: '2.5rem', margin: 0}}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
						/>
					</div>
					<button
						onClick={handleSearch}
						className="dashboard-feature-button blue"
						style={{padding: '0.75rem 1rem', fontSize: '0.875rem', width: 'auto', flexShrink: 0}}
					>
						検索
					</button>
				</div>

				{/* テナント一覧テーブル */}
				<div className="dashboard-section">
					<div className="dashboard-section-header">
						<h3 className="dashboard-section-title">テナント一覧</h3>
					</div>
					<div className="dashboard-section-content">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											テナント情報
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											管理者
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											ユーザー数
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											ステータス
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											作成日
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											アクション
										</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-200">
									{tenants.map((tenant) => (
										<tr key={tenant.tenant_id} className="hover:bg-gray-50">
											<td className="px-6 py-4 whitespace-nowrap">
												<div>
													<div className="text-sm font-medium text-gray-900">
														{tenant.name}
													</div>
													<div className="text-sm text-gray-500">
														ID: {tenant.tenant_id}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-900">{tenant.admin_email}</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-900">{tenant.user_count || 0}</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
													tenant.is_active 
														? 'bg-green-100 text-green-800' 
														: 'bg-red-100 text-red-800'
												}`}>
													{tenant.is_active ? 'アクティブ' : '無効'}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{formatDate(tenant.created_at)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
												<div className="flex gap-2">
													<button
														className="text-blue-600 hover:text-blue-900"
														onClick={() => handleEditTenant(tenant.tenant_id)}
														title="編集"
													>
														<Edit className="w-4 h-4" />
													</button>
													<button
														className="text-red-600 hover:text-red-900"
														onClick={() => handleDeleteTenant(tenant.tenant_id, tenant.name)}
														disabled={tenant.tenant_id === 'default0'}
														title={tenant.tenant_id === 'default0' ? '削除不可' : '削除'}
													>
														<Trash2 className="w-4 h-4" />
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* ページネーション */}
						{totalPages > 1 && (
							<div style={{
								padding: '1rem',
								borderTop: '1px solid #e5e7eb',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center'
							}}>
								{/* 左側：件数表示 */}
								<div style={{fontSize: '0.875rem', color: '#6b7280'}}>
									<span style={{fontWeight: '500'}}>{totalCount}</span> 件中{' '}
									<span style={{fontWeight: '500'}}>{(currentPage - 1) * 10 + 1}</span> から{' '}
									<span style={{fontWeight: '500'}}>
										{Math.min(currentPage * 10, totalCount)}
									</span>{' '}
									を表示
								</div>

								{/* 右側：ページネーション */}
								<div style={{
									display: 'flex',
									alignItems: 'center',
									gap: '0.25rem'
								}}>
									{/* 最初のページ */}
									<button
										onClick={() => handlePageChange(1)}
										disabled={currentPage === 1}
										style={{
											padding: '0.5rem 0.75rem',
											border: '1px solid #d1d5db',
											backgroundColor: 'white',
											color: currentPage === 1 ? '#9ca3af' : '#374151',
											borderRadius: '0.375rem',
											fontSize: '0.875rem',
											cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
											transition: 'all 0.2s'
										}}
										onMouseOver={(e) => {
											if (currentPage !== 1) {
												e.target.style.backgroundColor = '#f3f4f6';
											}
										}}
										onMouseOut={(e) => {
											e.target.style.backgroundColor = 'white';
										}}
									>
										&lt;&lt;
									</button>

									{/* 前のページ */}
									<button
										onClick={() => handlePageChange(currentPage - 1)}
										disabled={currentPage === 1}
										style={{
											padding: '0.5rem 0.75rem',
											border: '1px solid #d1d5db',
											backgroundColor: 'white',
											color: currentPage === 1 ? '#9ca3af' : '#374151',
											borderRadius: '0.375rem',
											fontSize: '0.875rem',
											cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
											transition: 'all 0.2s'
										}}
										onMouseOver={(e) => {
											if (currentPage !== 1) {
												e.target.style.backgroundColor = '#f3f4f6';
											}
										}}
										onMouseOut={(e) => {
											e.target.style.backgroundColor = 'white';
										}}
									>
										&lt;
									</button>

									{/* ページ番号 */}
									{(() => {
										const pageNumbers = [];
										const startPage = Math.max(1, currentPage - 2);
										const endPage = Math.min(totalPages, currentPage + 2);
										
										for (let i = startPage; i <= endPage; i++) {
											pageNumbers.push(i);
										}
										
										return pageNumbers.map((page) => (
											<button
												key={page}
												onClick={() => handlePageChange(page)}
												style={{
													padding: '0.5rem 0.75rem',
													border: '1px solid #d1d5db',
													backgroundColor: page === currentPage ? '#3b82f6' : 'white',
													color: page === currentPage ? 'white' : '#374151',
													borderRadius: '0.375rem',
													fontSize: '0.875rem',
													cursor: 'pointer',
													fontWeight: page === currentPage ? '600' : '400',
													transition: 'all 0.2s',
													minWidth: '2.5rem'
												}}
												onMouseOver={(e) => {
													if (page !== currentPage) {
														e.target.style.backgroundColor = '#f3f4f6';
													}
												}}
												onMouseOut={(e) => {
													if (page !== currentPage) {
														e.target.style.backgroundColor = 'white';
													}
												}}
											>
												{page}
											</button>
										));
									})()}

									{/* 次のページ */}
									<button
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage === totalPages}
										style={{
											padding: '0.5rem 0.75rem',
											border: '1px solid #d1d5db',
											backgroundColor: 'white',
											color: currentPage === totalPages ? '#9ca3af' : '#374151',
											borderRadius: '0.375rem',
											fontSize: '0.875rem',
											cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
											transition: 'all 0.2s'
										}}
										onMouseOver={(e) => {
											if (currentPage !== totalPages) {
												e.target.style.backgroundColor = '#f3f4f6';
											}
										}}
										onMouseOut={(e) => {
											e.target.style.backgroundColor = 'white';
										}}
									>
										&gt;
									</button>

									{/* 最後のページ */}
									<button
										onClick={() => handlePageChange(totalPages)}
										disabled={currentPage === totalPages}
										style={{
											padding: '0.5rem 0.75rem',
											border: '1px solid #d1d5db',
											backgroundColor: 'white',
											color: currentPage === totalPages ? '#9ca3af' : '#374151',
											borderRadius: '0.375rem',
											fontSize: '0.875rem',
											cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
											transition: 'all 0.2s'
										}}
										onMouseOver={(e) => {
											if (currentPage !== totalPages) {
												e.target.style.backgroundColor = '#f3f4f6';
											}
										}}
										onMouseOut={(e) => {
											e.target.style.backgroundColor = 'white';
										}}
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 空の状態 */}
				{tenants.length === 0 && !loading && (
					<div className="dashboard-section">
						<div className="dashboard-section-content">
							<div className="text-center py-12">
								<Users className="mx-auto h-12 w-12 text-gray-400" />
								<h3 className="mt-2 text-sm font-medium text-gray-900">テナントがありません</h3>
								<p className="mt-1 text-sm text-gray-500">
									最初のテナントを作成してください。
								</p>
								<div className="mt-6">
									<button
										onClick={() => setShowCreateModal(true)}
										className="dashboard-feature-button blue"
										style={{padding: '0.75rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto'}}
									>
										<Plus className="w-4 h-4" />
										新規テナント作成
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* テナント作成モーダル */}
				<TenantCreateModal
					isOpen={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onSuccess={() => fetchTenants()}
				/>

				{/* テナント編集モーダル */}
				<TenantEditModal
					isOpen={showEditModal}
					onClose={() => {
						setShowEditModal(false);
						setSelectedTenant(null);
					}}
					onSuccess={() => {
						fetchTenants();
						setShowEditModal(false);
						setSelectedTenant(null);
					}}
					tenant={selectedTenant}
				/>
			</main>
		</div>
	);
};