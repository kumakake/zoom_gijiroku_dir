import { useState, useEffect } from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
	useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/Button';
import { Plus, GripVertical, X, Eye, Save, RotateCcw } from 'lucide-react';
import { FormatSection, FormatStructure, FormatStyling } from '../types/tenant';

interface TranscriptFormatEditorProps {
	initialStructure?: FormatStructure;
	onStructureChange: (structure: FormatStructure) => void;
	onPreview: (structure: FormatStructure) => void;
	onSave: (structure: FormatStructure) => void;
	loading?: boolean;
}

const AVAILABLE_FIELDS = [
	{ id: 'meeting_topic', label: '会議名', type: 'text' },
	{ id: 'start_time', label: '開始時刻', type: 'datetime' },
	{ id: 'duration', label: '所要時間', type: 'number' },
	{ id: 'participants', label: '参加者', type: 'array' },
	{ id: 'summary', label: '要約', type: 'text' },
	{ id: 'formatted_transcript', label: '議事録本文', type: 'text' },
	{ id: 'action_items', label: 'アクションアイテム', type: 'array' },
];

const SECTION_TYPES = [
	{ id: 'header', label: '会議情報', description: '会議の基本情報を表示' },
	{ id: 'summary', label: '要約', description: '会議の概要を表示' },
	{ id: 'content', label: '議事録詳細', description: '詳細な議事録内容を表示' },
	{ id: 'action_items', label: 'アクションアイテム', description: 'タスクと担当者を表示' },
	{ id: 'custom', label: 'カスタム', description: '自由なコンテンツを表示' },
];

// ドラッグ可能なセクションコンポーネント
function SortableSection({ 
	section, 
	onUpdate, 
	onDelete, 
	availableFields 
}: {
	section: FormatSection;
	onUpdate: (section: FormatSection) => void;
	onDelete: (sectionId: string) => void;
	availableFields: typeof AVAILABLE_FIELDS;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: section.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`bg-white border rounded-lg p-4 shadow-sm ${isDragging ? 'shadow-lg' : ''}`}
		>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<div
						{...attributes}
						{...listeners}
						className="cursor-move text-gray-400 hover:text-gray-600"
					>
						<GripVertical className="w-5 h-5" />
					</div>
					<h3 className="font-medium text-gray-900">{section.title}</h3>
					<span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
						{SECTION_TYPES.find(t => t.id === section.type)?.label || section.type}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{isExpanded ? '折りたたむ' : '展開'}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onDelete(section.id)}
						className="text-red-600 hover:text-red-700"
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{isExpanded && (
				<div className="space-y-4 border-t pt-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							セクション名
						</label>
						<input
							type="text"
							value={section.title}
							onChange={(e) => onUpdate({ ...section, title: e.target.value })}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							表示フィールド
						</label>
						<div className="space-y-2">
							{availableFields.map((field) => (
								<label key={field.id} className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={section.fields.includes(field.id)}
										onChange={(e) => {
											const newFields = e.target.checked
												? [...section.fields, field.id]
												: section.fields.filter(f => f !== field.id);
											onUpdate({ ...section, fields: newFields });
										}}
										className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<span className="text-sm text-gray-700">{field.label}</span>
									<span className="text-xs text-gray-500">({field.type})</span>
								</label>
							))}
						</div>
					</div>

					{section.type === 'custom' && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								カスタムコンテンツ
							</label>
							<textarea
								value={section.custom_content || ''}
								onChange={(e) => onUpdate({ ...section, custom_content: e.target.value })}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								rows={4}
								placeholder="カスタムコンテンツを入力..."
							/>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							表示順序
						</label>
						<input
							type="number"
							value={section.order}
							onChange={(e) => onUpdate({ ...section, order: parseInt(e.target.value) || 0 })}
							className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							min="1"
						/>
					</div>
				</div>
			)}
		</div>
	);
}

export function TranscriptFormatEditor({ 
	initialStructure,
	onStructureChange,
	onPreview,
	onSave,
	loading = false
}: TranscriptFormatEditorProps) {
	console.log('📝 TranscriptFormatEditor: 初期化開始', {
		initialStructureExists: !!initialStructure,
		initialSectionsCount: initialStructure?.sections?.length || 0,
		onPreviewType: typeof onPreview
	});
	
	// initialStructureをそのまま使用（シンプル）
	const [structure, setStructure] = useState<FormatStructure>(
		initialStructure || {
			sections: [],
			styling: {
				use_markdown: true,
				include_timestamps: true,
				include_speakers: true,
			}
		}
	);
	
	console.log('📝 TranscriptFormatEditor: useState初期化完了', {
		structureSectionsCount: structure.sections?.length || 0
	});

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// initialStructureが変更された時に内部stateを更新（シンプル化）
	useEffect(() => {
		console.log('📝 TranscriptFormatEditor: initialStructure変更検知:', {
			initialStructureExists: !!initialStructure,
			initialStructure: initialStructure,
			sectionsCount: initialStructure?.sections?.length || 0,
			sectionsData: initialStructure?.sections
		});

		if (initialStructure) {
			console.log('📝 TranscriptFormatEditor: initialStructure更新:', {
				sectionsCount: initialStructure.sections?.length || 0,
				sections: initialStructure.sections?.map(s => ({ id: s.id, type: s.type, title: s.title })) || []
			});
			
			setStructure(initialStructure);
		} else {
			console.log('📝 TranscriptFormatEditor: initialStructureがnullまたはundefined');
		}
	}, [initialStructure]);

	useEffect(() => {
		onStructureChange(structure);
	}, [structure, onStructureChange]);

	// セクションの順序変更
	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (active.id !== over?.id) {
			setStructure(prev => {
				const oldIndex = prev.sections.findIndex(section => section.id === active.id);
				const newIndex = prev.sections.findIndex(section => section.id === over?.id);

				const newSections = arrayMove(prev.sections, oldIndex, newIndex);
				// 順序を更新
				const updatedSections = newSections.map((section, index) => ({
					...section,
					order: index + 1
				}));

				return {
					...prev,
					sections: updatedSections
				};
			});
		}
	}

	// 新しいセクション追加
	const addSection = (type: string) => {
		const newSection: FormatSection = {
			id: `section_${Date.now()}`,
			type: type as FormatSection['type'],
			title: SECTION_TYPES.find(t => t.id === type)?.label || 'セクション',
			fields: [],
			order: structure.sections.length + 1,
		};

		setStructure(prev => ({
			...prev,
			sections: [...prev.sections, newSection]
		}));
	};

	// セクション更新
	const updateSection = (updatedSection: FormatSection) => {
		setStructure(prev => ({
			...prev,
			sections: prev.sections.map(section =>
				section.id === updatedSection.id ? updatedSection : section
			)
		}));
	};

	// セクション削除
	const deleteSection = (sectionId: string) => {
		setStructure(prev => ({
			...prev,
			sections: prev.sections.filter(section => section.id !== sectionId)
		}));
	};

	// スタイリング設定更新
	const updateStyling = (newStyling: Partial<FormatStyling>) => {
		setStructure(prev => ({
			...prev,
			styling: { ...prev.styling, ...newStyling }
		}));
	};

	// リセット（空の状態）
	const resetToDefault = () => {
		const emptyStructure: FormatStructure = {
			sections: [], // 空の配列
			styling: {
				use_markdown: true,
				include_timestamps: true,
				include_speakers: true
			}
		};
		setStructure(emptyStructure);
	};

	return (
		<div style={{
			maxWidth: '1200px',
			margin: '0 auto',
			display: 'flex',
			flexDirection: 'column',
			gap: '1.5rem'
		}}>
			{/* ヘッダー */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between'
			}}>
				<h2 style={{
					fontSize: '1.5rem',
					fontWeight: 'bold',
					color: '#1f2937'
				}}>議事録フォーマットエディター</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={resetToDefault}
						className="flex items-center gap-2"
					>
						<RotateCcw className="w-4 h-4" />
						リセット
					</Button>
					<Button
						variant="outline"
						onClick={() => {
							console.log('🎯 プレビューボタンクリック (ヘッダー)', structure);
							onPreview(structure);
						}}
						className="flex items-center gap-2"
						disabled={loading}
					>
						<Eye className="w-4 h-4" />
						プレビュー
					</Button>
					<Button
						onClick={() => onSave(structure)}
						className="flex items-center gap-2"
						disabled={loading}
					>
						<Save className="w-4 h-4" />
						保存
					</Button>
				</div>
			</div>

			{/* スタイル設定とセクション追加（横並び） */}
			<div style={{
				display: 'grid',
				gridTemplateColumns: '1fr 1fr',
				gap: '1.5rem'
			}}>
				{/* スタイリング設定 */}
				<div className="login-card" style={{ 
					padding: '1.5rem',
					backgroundColor: 'white',
					borderRadius: '0.5rem',
					boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
					border: '1px solid #e5e7eb'
				}}>
					<h3 style={{
						fontSize: '1.125rem',
						fontWeight: '500',
						color: '#1f2937',
						marginBottom: '1rem',
						margin: 0
					}}>スタイル設定</h3>
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '0.75rem',
						marginTop: '1rem'
					}}>
						<label style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem'
						}}>
							<input
								type="checkbox"
								checked={structure.styling.use_markdown}
								onChange={(e) => updateStyling({ use_markdown: e.target.checked })}
								style={{
									borderRadius: '0.25rem',
									border: '1px solid #d1d5db'
								}}
							/>
							<span style={{
								fontSize: '0.875rem',
								color: '#374151'
							}}>Markdown形式を使用</span>
						</label>
						<label style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem'
						}}>
							<input
								type="checkbox"
								checked={structure.styling.include_timestamps}
								onChange={(e) => updateStyling({ include_timestamps: e.target.checked })}
								style={{
									borderRadius: '0.25rem',
									border: '1px solid #d1d5db'
								}}
							/>
							<span style={{
								fontSize: '0.875rem',
								color: '#374151'
							}}>タイムスタンプを含める</span>
						</label>
						<label style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem'
						}}>
							<input
								type="checkbox"
								checked={structure.styling.include_speakers}
								onChange={(e) => updateStyling({ include_speakers: e.target.checked })}
								style={{
									borderRadius: '0.25rem',
									border: '1px solid #d1d5db'
								}}
							/>
							<span style={{
								fontSize: '0.875rem',
								color: '#374151'
							}}>発言者名を含める</span>
						</label>
					</div>
				</div>

				{/* セクション追加ボタン */}
				<div className="login-card" style={{ 
					padding: '1.5rem',
					backgroundColor: 'white',
					borderRadius: '0.5rem',
					boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
					border: '1px solid #e5e7eb'
				}}>
					<h3 style={{
						fontSize: '1.125rem',
						fontWeight: '500',
						color: '#1f2937',
						marginBottom: '1rem',
						margin: 0
					}}>セクション追加</h3>
					<div style={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: '0.5rem',
						marginTop: '1rem'
					}}>
						{SECTION_TYPES.map((type) => (
							<button
								key={type.id}
								onClick={() => addSection(type.id)}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '0.5rem',
									backgroundColor: 'white',
									color: '#374151',
									border: '1px solid #d1d5db',
									borderRadius: '0.375rem',
									padding: '0.5rem 0.75rem',
									cursor: 'pointer',
									fontSize: '0.875rem',
									fontWeight: '500'
								}}
							>
								<Plus style={{ width: '1rem', height: '1rem' }} />
								{type.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* ドラッグ&ドロップセクション */}
			<div style={{
				backgroundColor: '#f9fafb',
				borderRadius: '0.5rem',
				padding: '1.5rem',
				border: '1px solid #e5e7eb'
			}}>
				<h3 className="text-lg font-medium text-gray-900 mb-4">フォーマット構成</h3>
				
				{structure.sections.length === 0 ? (
					<div className="text-center py-8 text-gray-500">
						<p>セクションが追加されていません</p>
						<p className="text-sm">上記のボタンからセクションを追加してください</p>
					</div>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={structure.sections.map(s => s.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-4">
								{structure.sections
									.sort((a, b) => a.order - b.order)
									.map((section) => (
										<SortableSection
											key={section.id}
											section={section}
											onUpdate={updateSection}
											onDelete={deleteSection}
											availableFields={AVAILABLE_FIELDS}
										/>
									))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</div>

			{/* プレビューエリア（条件付き表示） */}
			{structure.sections.length > 0 && (
				<div className="login-card" style={{ 
				padding: '1.5rem',
				backgroundColor: 'white',
				borderRadius: '0.5rem',
				boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
				border: '1px solid #e5e7eb'
			}}>
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-gray-900">構成プレビュー</h3>
						<button
							onClick={() => {
								console.log('🎯 詳細プレビューボタンクリック (native button)', structure);
								onPreview(structure);
							}}
							disabled={loading}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '0.5rem',
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
							<Eye className="w-4 h-4" />
							詳細プレビュー
						</button>
					</div>
					<div className="text-sm text-gray-600 space-y-1">
						{structure.sections
							.sort((a, b) => a.order - b.order)
							.map((section, index) => (
								<div key={section.id} className="flex items-center gap-2">
									<span className="font-medium">{index + 1}.</span>
									<span>{section.title}</span>
									<span className="text-gray-500">
										({section.fields.length}個のフィールド)
									</span>
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	);
}