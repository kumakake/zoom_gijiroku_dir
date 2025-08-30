import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { TranscriptFormatEditor } from '../components/TranscriptFormatEditor';
import { FormatPreviewModal } from '../components/FormatPreviewModal';
import { Button } from '../components/ui/Button';
import { transcriptTemplateApi } from '../lib/api';
import { FormatStructure, TranscriptFormatTemplate } from '../types/tenant';
import { FileText, Plus, Edit, Trash2, Star } from 'lucide-react';

export function TranscriptFormatPage() {
	console.log('🏠 TranscriptFormatPage レンダリング開始');
	const location = useLocation();
	const navigate = useNavigate();
	const params = useParams();
	console.log('🏠 URL情報:', { pathname: location.pathname, params });
	
	const [selectedTemplate, setSelectedTemplate] = useState<TranscriptFormatTemplate | null>(null);
	
	// URL based state management
	const isCreating = location.pathname === '/transcript-formats/new';
	const isEditing = location.pathname.startsWith('/transcript-formats/edit/');
	const isListView = location.pathname === '/transcript-formats';
	console.log('🏠 状態判定:', { isCreating, isEditing, isListView });
	const [showPreview, setShowPreview] = useState(false);
	const [previewHtml, setPreviewHtml] = useState('');
	const [previewLoading, setPreviewLoading] = useState(false);
	const [currentStructure, setCurrentStructure] = useState<FormatStructure | null>(null);
	const [templateName, setTemplateName] = useState('');
	const [templateDescription, setTemplateDescription] = useState('');

	const queryClient = useQueryClient();

	// テンプレート一覧取得（リスト画面用）
	const { data: templatesData, isLoading: templatesLoading } = useQuery({
		queryKey: ['transcript-templates'],
		queryFn: transcriptTemplateApi.getTemplates,
		enabled: isListView, // リスト表示時のみ取得
	});

	// 編集時の個別テンプレート取得
	const { data: editTemplateData, isLoading: editTemplateLoading } = useQuery({
		queryKey: ['transcript-template', params.id],
		queryFn: () => transcriptTemplateApi.getTemplate(params.id!),
		enabled: isEditing && !!params.id, // 編集時かつIDがある場合のみ取得
	});

	const templates = templatesData?.templates || [];

	// 新規作成時の初期化
	useEffect(() => {
		if (isCreating) {
			console.log('🔧 新規作成モード: リセット');
			setSelectedTemplate(null);
			setCurrentStructure(null);
			setTemplateName('');
			setTemplateDescription('');
		}
	}, [isCreating]);

	// 編集時のデータ設定（個別取得完了後）
	useEffect(() => {
		console.log('🔧 編集データ設定useEffect実行:', {
			isEditing,
			editTemplateLoading,
			editTemplateDataExists: !!editTemplateData,
			templateExists: !!editTemplateData?.template,
			templateData: editTemplateData
		});

		if (isEditing && editTemplateData?.template) {
			const template = editTemplateData.template;
			console.log('🔧 編集テンプレート取得完了:', {
				templateName: template.template_name,
				formatStructure: template.format_structure,
				sectionsLength: template.format_structure?.sections?.length || 0,
				sectionsContent: template.format_structure?.sections
			});
			
			setSelectedTemplate(template);
			setCurrentStructure(template.format_structure);
			setTemplateName(template.template_name);
			setTemplateDescription(template.template_description || '');
			
			console.log('🔧 編集状態更新完了:', {
				templateName: template.template_name,
				structureSections: template.format_structure?.sections?.length || 0,
				currentStructureSet: template.format_structure
			});
		}
	}, [isEditing, editTemplateData]);

	// プレビュー生成ミューテーション
	const previewMutation = useMutation({
		mutationFn: transcriptTemplateApi.generatePreview,
		onSuccess: (data) => {
			console.log('✅ プレビューAPI成功:', data);
			setPreviewHtml(data.preview_html);
			setShowPreview(true);
			setPreviewLoading(false);
			console.log('✅ モーダル表示状態設定完了: showPreview =', true);
		},
		onError: (error: unknown) => {
			console.error('❌ プレビュー生成エラー:', error);
			console.error('❌ エラー詳細:', JSON.stringify(error, null, 2));
			toast.error('プレビュー生成に失敗しました');
			setPreviewLoading(false);
		},
	});

	// テンプレート作成ミューテーション
	const createMutation = useMutation({
		mutationFn: transcriptTemplateApi.createTemplate,
		onSuccess: () => {
			toast.success('テンプレートが作成されました');
			queryClient.invalidateQueries({ queryKey: ['transcript-templates'] });
			navigate('/transcript-formats');
		},
		onError: (error: unknown) => {
			console.error('テンプレート作成エラー:', error);
			toast.error('テンプレート作成に失敗しました');
		},
	});

	// テンプレート更新ミューテーション
	const updateMutation = useMutation({
		mutationFn: ({ templateUuid, data }: { templateUuid: string; data: object }) =>
			transcriptTemplateApi.updateTemplate(templateUuid, data),
		onSuccess: () => {
			toast.success('テンプレートが更新されました');
			queryClient.invalidateQueries({ queryKey: ['transcript-templates'] });
			queryClient.invalidateQueries({ queryKey: ['transcript-template', params.id] });
			navigate('/transcript-formats');
		},
		onError: (error: unknown) => {
			console.error('テンプレート更新エラー:', error);
			toast.error('テンプレート更新に失敗しました');
		},
	});

	// テンプレート削除ミューテーション
	const deleteMutation = useMutation({
		mutationFn: transcriptTemplateApi.deleteTemplate,
		onSuccess: () => {
			toast.success('テンプレートが削除されました');
			queryClient.invalidateQueries({ queryKey: ['transcript-templates'] });
		},
		onError: (error: unknown) => {
			console.error('テンプレート削除エラー:', error);
			toast.error('テンプレート削除に失敗しました');
		},
	});

	// デフォルト設定切り替えミューテーション
	const toggleDefaultMutation = useMutation({
		mutationFn: ({ templateUuid, isDefault }: { templateUuid: string; isDefault: boolean }) =>
			transcriptTemplateApi.updateTemplate(templateUuid, { is_default: isDefault }),
		onSuccess: () => {
			toast.success('デフォルト設定が更新されました');
			queryClient.invalidateQueries({ queryKey: ['transcript-templates'] });
		},
		onError: (error: unknown) => {
			console.error('デフォルト設定エラー:', error);
			toast.error('デフォルト設定の更新に失敗しました');
		},
	});

	// プレビュー実行
	const handlePreview = (structure: FormatStructure) => {
		console.log('🔍 プレビュー開始:', structure);
		setPreviewLoading(true);
		console.log('🔍 showPreview状態:', showPreview);
		console.log('🔍 previewLoading状態:', true);
		previewMutation.mutate(structure);
	};

	// テンプレート保存
	const handleSave = (structure: FormatStructure) => {
		if (!templateName.trim()) {
			toast.error('テンプレート名を入力してください');
			return;
		}

		const templateData = {
			template_name: templateName,
			template_description: templateDescription,
			format_structure: structure,
		};

		if (isCreating) {
			createMutation.mutate(templateData);
		} else if (selectedTemplate) {
			updateMutation.mutate({
				templateUuid: selectedTemplate.template_uuid,
				data: templateData
			});
		}
	};

	// テンプレート編集開始
	const startEditing = (template: TranscriptFormatTemplate) => {
		navigate(`/transcript-formats/edit/${template.template_uuid}`);
	};

	// 新規作成開始
	const startCreating = () => {
		navigate('/transcript-formats/new');
	};

	// 編集キャンセル
	const cancelEditing = () => {
		navigate('/transcript-formats');
	};

	// テンプレート削除
	const handleDelete = (template: TranscriptFormatTemplate) => {
		if (template.is_default) {
			toast.error('デフォルトテンプレートは削除できません');
			return;
		}

		if (confirm(`テンプレート「${template.template_name}」を削除しますか？`)) {
			deleteMutation.mutate(template.template_uuid);
		}
	};

	// デフォルト設定切り替え
	const handleToggleDefault = (template: TranscriptFormatTemplate) => {
		const newDefaultState = !template.is_default;
		const action = newDefaultState ? 'デフォルトに設定' : 'デフォルトを解除';
		
		if (confirm(`テンプレート「${template.template_name}」を${action}しますか？`)) {
			toggleDefaultMutation.mutate({
				templateUuid: template.template_uuid,
				isDefault: newDefaultState
			});
		}
	};

	// 編集・作成画面の表示
	if (isEditing || isCreating) {
		// 編集時はデータ取得完了まで待機
		if (isEditing && editTemplateLoading) {
			return (
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					minHeight: '100vh'
				}}>
					<div>テンプレートを読み込み中...</div>
				</div>
			);
		}

		console.log('🏠 編集・作成画面をレンダリング');
		return (
			<div style={{
				minHeight: '100vh',
				backgroundColor: '#f9fafb',
				padding: '2rem 0'
			}}>
				<div style={{
					maxWidth: '1200px',
					margin: '0 auto',
					padding: '0 1rem'
				}}>
					{/* ヘッダー */}
					<div style={{ marginBottom: '1.5rem' }}>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '1rem',
							marginBottom: '1rem'
						}}>
							<button
								onClick={cancelEditing}
								style={{
									backgroundColor: 'transparent',
									color: '#374151',
									border: '1px solid #d1d5db',
									borderRadius: '0.375rem',
									padding: '0.5rem 1rem',
									cursor: 'pointer',
									fontSize: '0.875rem',
									fontWeight: '500'
								}}
							>
								← 戻る
							</button>
							<button
								onClick={() => navigate('/tenant-admin')}
								style={{
									backgroundColor: '#3b82f6',
									color: 'white',
									border: 'none',
									borderRadius: '0.375rem',
									padding: '0.5rem 1rem',
									cursor: 'pointer',
									fontSize: '0.875rem',
									fontWeight: '500'
								}}
							>
								テナント管理
							</button>
							<h1 style={{
								fontSize: '1.875rem',
								fontWeight: 'bold',
								color: '#1f2937',
								margin: 0
							}}>
								{isCreating ? '新規テンプレート作成' : 'テンプレート編集'}
							</h1>
						</div>

						{/* テンプレート基本情報 */}
						<div className="login-card" style={{
							padding: '1.5rem',
							marginBottom: '1.5rem',
							backgroundColor: 'white',
							borderRadius: '0.5rem',
							boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
							border: '1px solid #e5e7eb'
						}}>
							<h2 style={{
								fontSize: '1.125rem',
								fontWeight: '500',
								color: '#1f2937',
								marginBottom: '1rem'
							}}>テンプレート情報</h2>
							<div style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
								gap: '1rem'
							}}>
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.25rem'
									}}>
										テンプレート名 *
									</label>
									<input
										type="text"
										value={templateName}
										onChange={(e) => setTemplateName(e.target.value)}
										style={{
											width: '100%',
											padding: '0.75rem',
											border: '1px solid #d1d5db',
											borderRadius: '0.375rem',
											fontSize: '0.875rem'
										}}
										placeholder="例: 営業会議用フォーマット"
										required
									/>
								</div>
								<div>
									<label style={{
										display: 'block',
										fontSize: '0.875rem',
										fontWeight: '500',
										color: '#374151',
										marginBottom: '0.25rem'
									}}>
										説明
									</label>
									<input
										type="text"
										value={templateDescription}
										onChange={(e) => setTemplateDescription(e.target.value)}
										style={{
											width: '100%',
											padding: '0.75rem',
											border: '1px solid #d1d5db',
											borderRadius: '0.375rem',
											fontSize: '0.875rem'
										}}
										placeholder="テンプレートの説明を入力"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* エディター */}
					{console.log('🏠 TranscriptFormatEditor呼び出し前', { 
						currentStructure, 
						sectionsCount: currentStructure?.sections?.length || 0,
						sectionsArray: currentStructure?.sections,
						currentStructureKeys: currentStructure ? Object.keys(currentStructure) : [],
						handlePreview: typeof handlePreview,
						selectedTemplate: selectedTemplate?.template_name,
						editTemplateData: editTemplateData?.template?.format_structure
					})}
					<TranscriptFormatEditor
						initialStructure={editTemplateData?.template?.format_structure || currentStructure || undefined}
						onStructureChange={setCurrentStructure}
						onPreview={handlePreview}
						onSave={handleSave}
						loading={createMutation.isPending || updateMutation.isPending}
					/>

					{/* プレビューモーダル */}
					<FormatPreviewModal
						isOpen={showPreview}
						onClose={() => {
							console.log('🔒 プレビューモーダル閉じる (編集画面)');
							setShowPreview(false);
						}}
						previewHtml={previewHtml}
						loading={previewLoading}
					/>
				</div>
			</div>
		);
	}

	// リスト画面の表示
	if (isListView) {
		return (
		<div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
				<h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
					議事録フォーマット管理
				</h1>
				<div style={{ display: 'flex', gap: '1rem' }}>
					<button
						onClick={() => navigate('/tenant-admin')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							backgroundColor: 'transparent',
							color: '#374151',
							border: '1px solid #d1d5db',
							borderRadius: '0.5rem',
							padding: '0.75rem 1rem',
							cursor: 'pointer',
							fontSize: '0.875rem',
							fontWeight: '500'
						}}
					>
						← テナント管理
					</button>
					<button
						onClick={startCreating}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '0.5rem',
							padding: '0.75rem 1rem',
							cursor: 'pointer',
							fontSize: '0.875rem',
							fontWeight: '500'
						}}
					>
						<Plus style={{ width: '1rem', height: '1rem' }} />
						新規テンプレート
					</button>
				</div>
			</div>

			{/* テンプレート一覧 */}
			{templatesLoading ? (
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					minHeight: '200px'
				}}>
					<div>テンプレートを読み込み中...</div>
				</div>
			) : templates.length === 0 ? (
				<div className="login-card" style={{ textAlign: 'center', padding: '3rem' }}>
					<FileText style={{ width: '3rem', height: '3rem', color: '#6b7280', margin: '0 auto 1rem' }} />
					<h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
						テンプレートがありません
					</h3>
					<p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
						最初のフォーマットテンプレートを作成しましょう
					</p>
					<button
						onClick={startCreating}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.5rem',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '0.5rem',
							padding: '0.75rem 1rem',
							cursor: 'pointer',
							fontSize: '0.875rem',
							fontWeight: '500'
						}}
					>
						<Plus style={{ width: '1rem', height: '1rem' }} />
						新規テンプレート作成
					</button>
				</div>
			) : (
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
					gap: '1.5rem'
				}}>
					{templates.map((template: TranscriptFormatTemplate) => (
						<div key={template.template_uuid} className="login-card" style={{ padding: '1.5rem' }}>
							<div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '1rem' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
									<FileText style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
									<h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{template.template_name}</h3>
									{template.is_default && (
										<>
											<Star style={{ width: '1rem', height: '1rem', color: '#f59e0b', fill: 'currentColor' }} />
											<span style={{
												fontSize: '0.75rem',
												fontWeight: '500',
												color: '#f59e0b',
												backgroundColor: '#fef3c7',
												padding: '0.25rem 0.5rem',
												borderRadius: '0.25rem',
												border: '1px solid #f59e0b'
											}}>
												デフォルト
											</span>
										</>
									)}
								</div>
							</div>

							{template.template_description && (
								<p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
									{template.template_description}
								</p>
							)}

							<div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
								<p>セクション数: {template.format_structure.sections?.length || 0}</p>
								<p>更新日: {new Date(template.updated_at).toLocaleDateString('ja-JP')}</p>
							</div>

							<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
								<button
									onClick={() => handlePreview(template.format_structure)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.25rem',
										backgroundColor: 'transparent',
										color: '#374151',
										border: '1px solid #d1d5db',
										borderRadius: '0.25rem',
										padding: '0.5rem 0.75rem',
										cursor: 'pointer',
										fontSize: '0.75rem',
										fontWeight: '500',
										minWidth: '80px'
									}}
								>
									<FileText style={{ width: '0.75rem', height: '0.75rem' }} />
									プレビュー
								</button>
								<button
									onClick={() => startEditing(template)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.25rem',
										backgroundColor: 'transparent',
										color: '#374151',
										border: '1px solid #d1d5db',
										borderRadius: '0.25rem',
										padding: '0.5rem 0.75rem',
										cursor: 'pointer',
										fontSize: '0.75rem',
										fontWeight: '500',
										minWidth: '60px'
									}}
								>
									<Edit style={{ width: '0.75rem', height: '0.75rem' }} />
									編集
								</button>
								<button
									onClick={() => handleToggleDefault(template)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.25rem',
										backgroundColor: template.is_default ? '#fef3c7' : 'transparent',
										color: template.is_default ? '#f59e0b' : '#374151',
										border: `1px solid ${template.is_default ? '#f59e0b' : '#d1d5db'}`,
										borderRadius: '0.25rem',
										padding: '0.5rem 0.75rem',
										cursor: 'pointer',
										fontSize: '0.75rem',
										fontWeight: '500',
										minWidth: '85px'
									}}
									disabled={toggleDefaultMutation.isPending}
								>
									<Star 
										style={{ 
											width: '0.75rem', 
											height: '0.75rem',
											fill: template.is_default ? 'currentColor' : 'none'
										}} 
									/>
									{template.is_default ? 'デフォルト' : 'デフォルト設定'}
								</button>
								{!template.is_default && (
									<button
										onClick={() => handleDelete(template)}
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											backgroundColor: 'transparent',
											color: '#dc2626',
											border: '1px solid #d1d5db',
											borderRadius: '0.25rem',
											padding: '0.5rem',
											cursor: 'pointer',
											fontSize: '0.75rem',
											fontWeight: '500',
											minWidth: '40px'
										}}
									>
										<Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* プレビューモーダル */}
			<FormatPreviewModal
				isOpen={showPreview}
				onClose={() => {
					console.log('🔒 プレビューモーダル閉じる (リスト画面)');
					setShowPreview(false);
				}}
				previewHtml={previewHtml}
				loading={previewLoading}
			/>
		</div>
		);
	}

	// デフォルト（リスト画面に戻る）
	return null;
}