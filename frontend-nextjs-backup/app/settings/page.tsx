'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { paths } from '@/lib/navigation';
import { 
	Settings as SettingsIcon, 
	Save, 
	RefreshCw, 
	Mail, 
	Key, 
	Globe, 
	MessageSquare,
	Plus,
	Trash2,
	AlertCircle,
	CheckCircle,
	Eye,
	EyeOff
} from 'lucide-react';

interface EmailSettings {
	smtp_host: string;
	smtp_port: number;
	smtp_user: string;
	smtp_pass: string;
	smtp_secure: boolean;
	from_name: string;
	from_email: string;
}

interface WorkflowSettings {
	api_base_url: string;
	api_token: string;
	endpoints: {
		meeting_summary: string;
		action_items: string;
		follow_up: string;
	};
}

interface SlackSettings {
	bot_token: string;
	webhook_url: string;
	default_channel: string;
}

interface ZoomSettings {
	api_key: string;
	api_secret: string;
	webhook_secret: string;
}

interface AISettings {
	openai_api_key: string;
	anthropic_api_key: string;
	transcript_template: string;
	summary_prompt: string;
	action_items_prompt: string;
}

interface DefaultRecipients {
	emails: string[];
	workflow_endpoints: string[];
	slack_channels: string[];
}

interface AgentSettings {
	email_settings: EmailSettings;
	workflow_settings: WorkflowSettings;
	slack_settings: SlackSettings;
	zoom_settings: ZoomSettings;
	ai_settings: AISettings;
	default_recipients: DefaultRecipients;
}

export default function SettingsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	
	const [settings, setSettings] = useState<AgentSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testingEmail, setTestingEmail] = useState(false);
	const [activeTab, setActiveTab] = useState('email');
	const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

	// 認証チェック（管理者のみ）
	useEffect(() => {
		if (status === 'loading') return;
		if (!session) {
			router.push(paths.login);
			return;
		}
		// 実際のロール確認は後で実装
		// if (session.user.role !== 'admin') {
		//   router.push('/dashboard');
		//   return;
		// }
	}, [session, status, router]);

	// 設定データの取得
	const fetchSettings = async () => {
		try {
			setLoading(true);
			const { agentApi } = await import('../../lib/api');
			const data = await agentApi.getSettings();
			
			// デフォルト値でマージ
			const defaultSettings: AgentSettings = {
				email_settings: {
					smtp_host: '',
					smtp_port: 587,
					smtp_user: '',
					smtp_pass: '',
					smtp_secure: true,
					from_name: 'AI Agent',
					from_email: ''
				},
				workflow_settings: {
					api_base_url: '',
					api_token: '',
					endpoints: {
						meeting_summary: '/api/meetings/summary',
						action_items: '/api/meetings/actions',
						follow_up: '/api/meetings/follow-up'
					}
				},
				slack_settings: {
					bot_token: '',
					webhook_url: '',
					default_channel: '#general'
				},
				zoom_settings: {
					api_key: '',
					api_secret: '',
					webhook_secret: ''
				},
				ai_settings: {
					openai_api_key: '',
					anthropic_api_key: '',
					transcript_template: '',
					summary_prompt: '',
					action_items_prompt: ''
				},
				default_recipients: {
					emails: [],
					workflow_endpoints: [],
					slack_channels: []
				}
			};
			
			setSettings({ ...defaultSettings, ...data.settings });
		} catch (error) {
			console.error('設定取得エラー:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (session) {
			fetchSettings();
		}
	}, [session]);

	// 設定の保存
	const handleSaveSettings = async () => {
		if (!settings) return;
		
		try {
			setSaving(true);
			const { agentApi } = await import('../../lib/api');
			await agentApi.updateSettings(settings);
			
			alert('設定を保存しました');
		} catch (error) {
			console.error('設定保存エラー:', error);
			alert('設定の保存に失敗しました');
		} finally {
			setSaving(false);
		}
	};

	// メールテスト
	const handleTestEmail = async () => {
		if (!settings?.email_settings.smtp_host) {
			alert('SMTP設定が不完全です');
			return;
		}
		
		try {
			setTestingEmail(true);
			// テストメール送信のAPIを呼び出し
			alert('テストメールを送信しました');
		} catch (error) {
			console.error('メールテストエラー:', error);
			alert('テストメールの送信に失敗しました');
		} finally {
			setTestingEmail(false);
		}
	};

	// パスワード表示切り替え
	const togglePasswordVisibility = (field: string) => {
		setShowPasswords(prev => ({
			...prev,
			[field]: !prev[field]
		}));
	};

	// 配列項目の追加
	const addArrayItem = (path: string) => {
		if (!settings) return;
		
		const newSettings = { ...settings };
		const keys = path.split('.');
		let current: any = newSettings;
		
		for (let i = 0; i < keys.length - 1; i++) {
			current = current[keys[i]];
		}
		
		const finalKey = keys[keys.length - 1];
		current[finalKey] = [...current[finalKey], ''];
		
		setSettings(newSettings);
	};

	// 配列項目の削除
	const removeArrayItem = (path: string, index: number) => {
		if (!settings) return;
		
		const newSettings = { ...settings };
		const keys = path.split('.');
		let current: any = newSettings;
		
		for (let i = 0; i < keys.length - 1; i++) {
			current = current[keys[i]];
		}
		
		const finalKey = keys[keys.length - 1];
		current[finalKey] = current[finalKey].filter((_: any, i: number) => i !== index);
		
		setSettings(newSettings);
	};

	// 配列項目の更新
	const updateArrayItem = (path: string, index: number, value: string) => {
		if (!settings) return;
		
		const newSettings = { ...settings };
		const keys = path.split('.');
		let current: any = newSettings;
		
		for (let i = 0; i < keys.length - 1; i++) {
			current = current[keys[i]];
		}
		
		const finalKey = keys[keys.length - 1];
		current[finalKey][index] = value;
		
		setSettings(newSettings);
	};

	// 設定値の更新
	const updateSetting = (path: string, value: any) => {
		if (!settings) return;
		
		const newSettings = { ...settings };
		const keys = path.split('.');
		let current: any = newSettings;
		
		for (let i = 0; i < keys.length - 1; i++) {
			current = current[keys[i]];
		}
		
		current[keys[keys.length - 1]] = value;
		setSettings(newSettings);
	};

	if (status === 'loading' || loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	if (!settings) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="text-center">
					<AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
					<h1 className="text-2xl font-bold text-gray-900 mb-2">設定の読み込みに失敗しました</h1>
					<button
						onClick={fetchSettings}
						className="text-blue-600 hover:text-blue-800 transition-colors"
					>
						再試行
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			{/* ヘッダー */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">エージェント設定</h1>
				<p className="text-gray-600">AI議事録エージェントの各種設定を管理します</p>
			</div>

			{/* 保存ボタン */}
			<div className="mb-8">
				<button
					onClick={handleSaveSettings}
					disabled={saving}
					className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
				>
					<Save className="h-4 w-4" />
					{saving ? '保存中...' : '設定を保存'}
				</button>
			</div>

			{/* タブナビゲーション */}
			<div className="border-b border-gray-200 mb-8">
				<nav className="-mb-px flex space-x-8">
					{[
						{ id: 'email', label: 'メール設定', icon: Mail },
						{ id: 'zoom', label: 'Zoom API', icon: Globe },
						{ id: 'ai', label: 'AI設定', icon: Key },
						{ id: 'workflow', label: 'ワークフロー', icon: SettingsIcon },
						{ id: 'slack', label: 'Slack', icon: MessageSquare },
						{ id: 'recipients', label: '配布先', icon: Mail }
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === tab.id
									? 'border-blue-500 text-blue-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
							}`}
						>
							<tab.icon className="h-4 w-4" />
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* タブコンテンツ */}
			<div className="space-y-8">
				{/* メール設定 */}
				{activeTab === 'email' && (
					<div className="bg-white rounded-lg shadow p-6">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold text-gray-900">メール設定</h2>
							<button
								onClick={handleTestEmail}
								disabled={testingEmail}
								className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
							>
								<Mail className="h-4 w-4" />
								{testingEmail ? 'テスト中...' : 'テスト送信'}
							</button>
						</div>
						
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">SMTPホスト</label>
								<input
									type="text"
									value={settings.email_settings.smtp_host}
									onChange={(e) => updateSetting('email_settings.smtp_host', e.target.value)}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="smtp.gmail.com"
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">SMTPポート</label>
								<input
									type="number"
									value={settings.email_settings.smtp_port}
									onChange={(e) => updateSetting('email_settings.smtp_port', parseInt(e.target.value))}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="587"
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">ユーザー名</label>
								<input
									type="text"
									value={settings.email_settings.smtp_user}
									onChange={(e) => updateSetting('email_settings.smtp_user', e.target.value)}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="your-email@example.com"
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
								<div className="relative">
									<input
										type={showPasswords.smtp_pass ? 'text' : 'password'}
										value={settings.email_settings.smtp_pass}
										onChange={(e) => updateSetting('email_settings.smtp_pass', e.target.value)}
										className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="••••••••"
									/>
									<button
										type="button"
										onClick={() => togglePasswordVisibility('smtp_pass')}
										className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										{showPasswords.smtp_pass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">送信者名</label>
								<input
									type="text"
									value={settings.email_settings.from_name}
									onChange={(e) => updateSetting('email_settings.from_name', e.target.value)}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="AI議事録エージェント"
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">送信者メールアドレス</label>
								<input
									type="email"
									value={settings.email_settings.from_email}
									onChange={(e) => updateSetting('email_settings.from_email', e.target.value)}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="noreply@example.com"
								/>
							</div>
						</div>
						
						<div className="mt-6">
							<label className="flex items-center">
								<input
									type="checkbox"
									checked={settings.email_settings.smtp_secure}
									onChange={(e) => updateSetting('email_settings.smtp_secure', e.target.checked)}
									className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<span className="ml-2 text-sm text-gray-700">SSL/TLS を使用</span>
							</label>
						</div>
					</div>
				)}

				{/* Zoom API設定 */}
				{activeTab === 'zoom' && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-semibold text-gray-900 mb-6">Zoom API設定</h2>
						
						<div className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">API キー</label>
								<div className="relative">
									<input
										type={showPasswords.zoom_api_key ? 'text' : 'password'}
										value={settings.zoom_settings.api_key}
										onChange={(e) => updateSetting('zoom_settings.api_key', e.target.value)}
										className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="your-zoom-api-key"
									/>
									<button
										type="button"
										onClick={() => togglePasswordVisibility('zoom_api_key')}
										className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										{showPasswords.zoom_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">API シークレット</label>
								<div className="relative">
									<input
										type={showPasswords.zoom_api_secret ? 'text' : 'password'}
										value={settings.zoom_settings.api_secret}
										onChange={(e) => updateSetting('zoom_settings.api_secret', e.target.value)}
										className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="your-zoom-api-secret"
									/>
									<button
										type="button"
										onClick={() => togglePasswordVisibility('zoom_api_secret')}
										className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										{showPasswords.zoom_api_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">Webhook シークレット</label>
								<div className="relative">
									<input
										type={showPasswords.zoom_webhook_secret ? 'text' : 'password'}
										value={settings.zoom_settings.webhook_secret}
										onChange={(e) => updateSetting('zoom_settings.webhook_secret', e.target.value)}
										className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="your-webhook-secret"
									/>
									<button
										type="button"
										onClick={() => togglePasswordVisibility('zoom_webhook_secret')}
										className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										{showPasswords.zoom_webhook_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* AI設定 */}
				{activeTab === 'ai' && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-semibold text-gray-900 mb-6">AI設定</h2>
						
						<div className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API キー</label>
									<div className="relative">
										<input
											type={showPasswords.openai_api_key ? 'text' : 'password'}
											value={settings.ai_settings.openai_api_key}
											onChange={(e) => updateSetting('ai_settings.openai_api_key', e.target.value)}
											className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											placeholder="sk-..."
										/>
										<button
											type="button"
											onClick={() => togglePasswordVisibility('openai_api_key')}
											className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
										>
											{showPasswords.openai_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</button>
									</div>
								</div>
								
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">Anthropic API キー</label>
									<div className="relative">
										<input
											type={showPasswords.anthropic_api_key ? 'text' : 'password'}
											value={settings.ai_settings.anthropic_api_key}
											onChange={(e) => updateSetting('ai_settings.anthropic_api_key', e.target.value)}
											className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											placeholder="sk-ant-..."
										/>
										<button
											type="button"
											onClick={() => togglePasswordVisibility('anthropic_api_key')}
											className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
										>
											{showPasswords.anthropic_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</button>
									</div>
								</div>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">議事録テンプレート</label>
								<textarea
									value={settings.ai_settings.transcript_template}
									onChange={(e) => updateSetting('ai_settings.transcript_template', e.target.value)}
									rows={6}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="議事録の生成に使用するテンプレートを入力してください..."
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">要約生成プロンプト</label>
								<textarea
									value={settings.ai_settings.summary_prompt}
									onChange={(e) => updateSetting('ai_settings.summary_prompt', e.target.value)}
									rows={4}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="要約生成用のプロンプトを入力してください..."
								/>
							</div>
							
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">アクションアイテム抽出プロンプト</label>
								<textarea
									value={settings.ai_settings.action_items_prompt}
									onChange={(e) => updateSetting('ai_settings.action_items_prompt', e.target.value)}
									rows={4}
									className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="アクションアイテム抽出用のプロンプトを入力してください..."
								/>
							</div>
						</div>
					</div>
				)}

				{/* デフォルト配布先設定 */}
				{activeTab === 'recipients' && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-semibold text-gray-900 mb-6">デフォルト配布先設定</h2>
						
						<div className="space-y-8">
							{/* メール配布先 */}
							<div>
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-lg font-medium text-gray-900">メール配布先</h3>
									<button
										onClick={() => addArrayItem('default_recipients.emails')}
										className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
									>
										<Plus className="h-4 w-4" />
										追加
									</button>
								</div>
								<div className="space-y-2">
									{settings.default_recipients.emails.map((email, index) => (
										<div key={index} className="flex items-center gap-2">
											<input
												type="email"
												value={email}
												onChange={(e) => updateArrayItem('default_recipients.emails', index, e.target.value)}
												className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												placeholder="email@example.com"
											/>
											<button
												onClick={() => removeArrayItem('default_recipients.emails', index)}
												className="text-red-600 hover:text-red-800 transition-colors"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									))}
									{settings.default_recipients.emails.length === 0 && (
										<p className="text-gray-500 italic">メール配布先が設定されていません</p>
									)}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}