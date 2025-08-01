'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// デバッグ状態の型定義
interface DebugStatus {
	environment: {
		zoom: {
			accountId: boolean;
			clientId: boolean;
			clientSecret: boolean;
			webhookSecret: boolean;
		};
		ai: {
			openai: boolean;
			anthropic: boolean;
		};
		email: {
			smtpHost: boolean;
			smtpUser: boolean;
			smtpPass: boolean;
		};
		database: boolean;
		redis: boolean;
	};
	database: {
		connected: boolean;
		recentJobs: any[];
	};
	endpoints: {
		[key: string]: string;
	};
}

interface TestResult {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
	results?: {
		steps?: any[];
		progress?: any;
		summary?: any;
	};
}

interface VTTStats {
	totalTranscripts: number;
	vttUsage: number;
	whisperUsage: number;
	vttUsageRate: number;
	whisperUsageRate: number;
	costSavings: number;
	totalProcessed: number;
	processingTimes: {
		averageVtt: number;
		averageWhisper: number;
	};
	recentJobs: Array<{
		id: string;
		type: string;
		status: string;
		meetingTopic: string;
		processingMethod: string;
		createdAt: string;
		completedAt: string;
		processingDuration: number;
	}>;
}

interface QueueStatus {
	success: boolean;
	message: string;
	queues: {
		transcript: QueueInfo;
		email: QueueInfo;
	};
}

interface QueueInfo {
	name: string;
	counts: {
		waiting: number;
		active: number;
		completed: number;
		failed: number;
	};
	jobs: {
		waiting: JobInfo[];
		active: JobInfo[];
		completed: JobInfo[];
		failed: JobInfo[];
	};
}

interface JobInfo {
	id: number;
	data: any;
	created: number;
	progress?: any;
	finished?: number;
	failed?: string;
	error?: string;
	result?: any;
	opts?: any;
}

export default function DebugPage() {
	const { data: session } = useSession();
	const [debugStatus, setDebugStatus] = useState<DebugStatus | null>(null);
	const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
	const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
	const [vttStats, setVttStats] = useState<VTTStats | null>(null);
	const [vttStatsLoading, setVttStatsLoading] = useState(false);
	const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
	const [queueLoading, setQueueLoading] = useState(false);

	// デバッグ状態の取得
	useEffect(() => {
		fetchDebugStatus();
		fetchVttStats();
		fetchQueueStatus();
	}, []);

	const fetchDebugStatus = async () => {
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const response = await fetch(`${backendUrl}/api/debug/status`, {
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
			});
			const data = await response.json();
			setDebugStatus(data);
		} catch (error) {
			console.error('デバッグ状態の取得エラー:', error);
		}
	};

	// VTT統計情報の取得
	const fetchVttStats = async () => {
		if (!session?.accessToken) return;
		
		setVttStatsLoading(true);
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const response = await fetch(`${backendUrl}/api/debug/vtt-stats`, {
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
			});
			const data = await response.json();
			if (data.success) {
				setVttStats(data.stats);
			} else {
				console.error('VTT統計情報の取得エラー:', data.message);
			}
		} catch (error) {
			console.error('VTT統計情報の取得エラー:', error);
		} finally {
			setVttStatsLoading(false);
		}
	};

	// キュー状況の取得
	const fetchQueueStatus = async () => {
		if (!session?.accessToken) return;
		
		setQueueLoading(true);
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const response = await fetch(`${backendUrl}/api/debug/queue-status`, {
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
			});
			const data = await response.json();
			if (data.success) {
				setQueueStatus(data);
			} else {
				console.error('キュー状況の取得エラー:', data.message);
			}
		} catch (error) {
			console.error('キュー状況の取得エラー:', error);
		} finally {
			setQueueLoading(false);
		}
	};

	// キュークリア
	const clearQueue = async (queueName: string, jobStatus: string) => {
		if (!session?.accessToken) return;
		
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const response = await fetch(`${backendUrl}/api/debug/clear-queue`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ queueName, jobStatus }),
			});
			const data = await response.json();
			if (data.success) {
				alert(`${data.message}\n削除件数: ${data.deletedCount}`);
				fetchQueueStatus(); // 状況を再取得
			} else {
				alert(`エラー: ${data.message}`);
			}
		} catch (error) {
			console.error('キュークリアエラー:', error);
			alert(`キュークリアに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	// 失敗ジョブ再実行
	const retryFailedJobs = async (queueName: string) => {
		if (!session?.accessToken) return;
		
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const response = await fetch(`${backendUrl}/api/debug/retry-failed-jobs`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ queueName }),
			});
			const data = await response.json();
			if (data.success) {
				alert(`${data.message}\n再実行件数: ${data.retriedCount}`);
				fetchQueueStatus(); // 状況を再取得
			} else {
				alert(`エラー: ${data.message}`);
			}
		} catch (error) {
			console.error('失敗ジョブ再実行エラー:', error);
			alert(`失敗ジョブ再実行に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	// APIテスト実行
	const runTest = async (testName: string, endpoint: string, payload?: any) => {
		setLoading(prev => ({ ...prev, [testName]: true }));
		try {
			const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
			const fullEndpoint = endpoint.startsWith('http') ? endpoint : `${backendUrl}${endpoint}`;
			
			const response = await fetch(fullEndpoint, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${session?.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload || {}),
			});
			const result = await response.json();
			setTestResults(prev => ({ ...prev, [testName]: result }));
		} catch (error) {
			setTestResults(prev => ({ 
				...prev, 
				[testName]: { 
					success: false, 
					message: 'テスト実行エラー', 
					error: error instanceof Error ? error.message : 'Unknown error' 
				} 
			}));
		} finally {
			setLoading(prev => ({ ...prev, [testName]: false }));
		}
	};

	// 環境変数状態の表示
	const renderEnvironmentStatus = () => {
		if (!debugStatus) return null;

		const { environment } = debugStatus;
		
		return (
			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">環境変数状態</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div className="space-y-2">
						<h3 className="font-medium text-gray-700">Zoom API</h3>
						<div className="space-y-1">
							<div className={`text-sm flex items-center ${environment.zoom.accountId ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Account ID: {environment.zoom.accountId ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.zoom.clientId ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Client ID: {environment.zoom.clientId ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.zoom.clientSecret ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Client Secret: {environment.zoom.clientSecret ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.zoom.webhookSecret ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Webhook Secret: {environment.zoom.webhookSecret ? '設定済み' : '未設定'}
							</div>
						</div>
					</div>
					
					<div className="space-y-2">
						<h3 className="font-medium text-gray-700">AI API</h3>
						<div className="space-y-1">
							<div className={`text-sm flex items-center ${environment.ai.openai ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								OpenAI: {environment.ai.openai ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.ai.anthropic ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Anthropic: {environment.ai.anthropic ? '設定済み' : '未設定'}
							</div>
						</div>
					</div>
					
					<div className="space-y-2">
						<h3 className="font-medium text-gray-700">Email</h3>
						<div className="space-y-1">
							<div className={`text-sm flex items-center ${environment.email.smtpHost ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								SMTP Host: {environment.email.smtpHost ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.email.smtpUser ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								SMTP User: {environment.email.smtpUser ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.email.smtpPass ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								SMTP Pass: {environment.email.smtpPass ? '設定済み' : '未設定'}
							</div>
						</div>
					</div>
					
					<div className="space-y-2">
						<h3 className="font-medium text-gray-700">接続</h3>
						<div className="space-y-1">
							<div className={`text-sm flex items-center ${environment.database ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Database: {environment.database ? '設定済み' : '未設定'}
							</div>
							<div className={`text-sm flex items-center ${environment.redis ? 'text-green-600' : 'text-red-600'}`}>
								<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
								Redis: {environment.redis ? '設定済み' : '未設定'}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// キュー管理の表示
	const renderQueueManagement = () => {
		if (queueLoading) {
			return (
				<div className="bg-white rounded-lg shadow-md p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">キュー管理</h2>
					<div className="text-center py-4">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
						<p className="text-gray-600 mt-2">キュー状況を読み込み中...</p>
					</div>
				</div>
			);
		}

		if (!queueStatus) return null;

		const { transcript, email } = queueStatus.queues;

		return (
			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-semibold">キュー管理</h2>
					<button
						onClick={fetchQueueStatus}
						className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
					>
						更新
					</button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* 議事録処理キュー */}
					<div className="border rounded-lg p-4">
						<h3 className="font-semibold text-gray-800 mb-3">議事録処理キュー</h3>
						<div className="grid grid-cols-2 gap-2 mb-4">
							<div className="bg-yellow-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-yellow-800">{transcript.counts.waiting}</div>
								<div className="text-xs text-yellow-600">待機中</div>
							</div>
							<div className="bg-blue-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-blue-800">{transcript.counts.active}</div>
								<div className="text-xs text-blue-600">実行中</div>
							</div>
							<div className="bg-green-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-green-800">{transcript.counts.completed}</div>
								<div className="text-xs text-green-600">完了</div>
							</div>
							<div className="bg-red-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-red-800">{transcript.counts.failed}</div>
								<div className="text-xs text-red-600">失敗</div>
							</div>
						</div>
						<div className="space-y-2">
							<button
								onClick={() => clearQueue('transcript', 'failed')}
								className="w-full px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
								disabled={transcript.counts.failed === 0}
							>
								失敗ジョブをクリア ({transcript.counts.failed})
							</button>
							<button
								onClick={() => clearQueue('transcript', 'completed')}
								className="w-full px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
								disabled={transcript.counts.completed === 0}
							>
								完了ジョブをクリア ({transcript.counts.completed})
							</button>
							<button
								onClick={() => retryFailedJobs('transcript')}
								className="w-full px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
								disabled={transcript.counts.failed === 0}
							>
								失敗ジョブを再実行 ({transcript.counts.failed})
							</button>
						</div>
						
						{/* 最新ジョブ表示 */}
						{transcript.jobs.failed.length > 0 && (
							<div className="mt-3">
								<div className="text-sm font-medium text-gray-700 mb-2">最新の失敗ジョブ:</div>
								<div className="space-y-1">
									{transcript.jobs.failed.slice(0, 2).map((job) => (
										<div key={job.id} className="text-xs bg-red-50 p-2 rounded">
											<div className="font-medium">ジョブID: {job.id}</div>
											<div className="text-red-600 truncate">{job.failed}</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* メール送信キュー */}
					<div className="border rounded-lg p-4">
						<h3 className="font-semibold text-gray-800 mb-3">メール送信キュー</h3>
						<div className="grid grid-cols-2 gap-2 mb-4">
							<div className="bg-yellow-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-yellow-800">{email.counts.waiting}</div>
								<div className="text-xs text-yellow-600">待機中</div>
							</div>
							<div className="bg-blue-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-blue-800">{email.counts.active}</div>
								<div className="text-xs text-blue-600">実行中</div>
							</div>
							<div className="bg-green-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-green-800">{email.counts.completed}</div>
								<div className="text-xs text-green-600">完了</div>
							</div>
							<div className="bg-red-50 p-2 rounded text-center">
								<div className="text-lg font-bold text-red-800">{email.counts.failed}</div>
								<div className="text-xs text-red-600">失敗</div>
							</div>
						</div>
						<div className="space-y-2">
							<button
								onClick={() => clearQueue('email', 'failed')}
								className="w-full px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
								disabled={email.counts.failed === 0}
							>
								失敗ジョブをクリア ({email.counts.failed})
							</button>
							<button
								onClick={() => clearQueue('email', 'completed')}
								className="w-full px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
								disabled={email.counts.completed === 0}
							>
								完了ジョブをクリア ({email.counts.completed})
							</button>
							<button
								onClick={() => retryFailedJobs('email')}
								className="w-full px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
								disabled={email.counts.failed === 0}
							>
								失敗ジョブを再実行 ({email.counts.failed})
							</button>
						</div>

						{/* 最新ジョブ表示 */}
						{email.jobs.failed.length > 0 && (
							<div className="mt-3">
								<div className="text-sm font-medium text-gray-700 mb-2">最新の失敗ジョブ:</div>
								<div className="space-y-1">
									{email.jobs.failed.slice(0, 2).map((job) => (
										<div key={job.id} className="text-xs bg-red-50 p-2 rounded">
											<div className="font-medium">ジョブID: {job.id}</div>
											<div className="text-red-600 truncate">{job.failed}</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 危険な操作 */}
				<div className="mt-6 pt-4 border-t">
					<div className="text-sm font-medium text-red-700 mb-2">⚠️ 危険な操作</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						<button
							onClick={() => {
								if (confirm('議事録処理キューの全ジョブを削除しますか？この操作は取り消せません。')) {
									clearQueue('transcript', 'all');
								}
							}}
							className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
						>
							議事録キュー全削除
						</button>
						<button
							onClick={() => {
								if (confirm('メール送信キューの全ジョブを削除しますか？この操作は取り消せません。')) {
									clearQueue('email', 'all');
								}
							}}
							className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
						>
							メールキュー全削除
						</button>
					</div>
				</div>
			</div>
		);
	};

	// VTT統計情報の表示
	const renderVttStats = () => {
		if (vttStatsLoading) {
			return (
				<div className="bg-white rounded-lg shadow-md p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">VTT/Whisper使用状況</h2>
					<div className="text-center py-4">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
						<p className="text-gray-600 mt-2">統計データを読み込み中...</p>
					</div>
				</div>
			);
		}

		if (!vttStats) return null;

		const { totalTranscripts, vttUsage, whisperUsage, vttUsageRate, whisperUsageRate, costSavings, totalProcessed } = vttStats;

		return (
			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-semibold">VTT/Whisper使用状況 (過去30日)</h2>
					<button
						onClick={fetchVttStats}
						className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
					>
						更新
					</button>
				</div>
				
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 rounded p-4">
						<div className="text-2xl font-bold text-gray-800">{totalTranscripts}</div>
						<div className="text-sm text-gray-600">総議事録数</div>
					</div>
					<div className="bg-green-50 rounded p-4">
						<div className="text-2xl font-bold text-green-800">{vttUsage}</div>
						<div className="text-sm text-green-600">VTT使用 ({vttUsageRate.toFixed(1)}%)</div>
					</div>
					<div className="bg-yellow-50 rounded p-4">
						<div className="text-2xl font-bold text-yellow-800">{whisperUsage}</div>
						<div className="text-sm text-yellow-600">Whisper使用 ({whisperUsageRate.toFixed(1)}%)</div>
					</div>
					<div className="bg-blue-50 rounded p-4">
						<div className="text-2xl font-bold text-blue-800">${costSavings.toFixed(2)}</div>
						<div className="text-sm text-blue-600">節約金額 (推定)</div>
					</div>
				</div>
				
				{totalProcessed > 0 && (
					<div className="mb-4">
						<h3 className="font-medium text-gray-700 mb-2">処理方法の内訳</h3>
						<div className="bg-gray-200 rounded-full h-4 overflow-hidden">
							<div 
								className="bg-green-500 h-full transition-all duration-500 ease-out"
								style={{ width: `${vttUsageRate}%` }}
							></div>
							<div 
								className="bg-yellow-500 h-full transition-all duration-500 ease-out"
								style={{ width: `${whisperUsageRate}%`, marginTop: '-1rem' }}
							></div>
						</div>
						<div className="flex justify-between text-sm text-gray-600 mt-1">
							<span>VTT: {vttUsageRate.toFixed(1)}% (コスト削減)</span>
							<span>Whisper: {whisperUsageRate.toFixed(1)}% (API使用)</span>
						</div>
					</div>
				)}
				
				{vttStats.processingTimes && (
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div className="bg-green-50 rounded p-3">
							<div className="text-sm text-green-600">平均処理時間 (VTT)</div>
							<div className="text-lg font-semibold text-green-800">
								{vttStats.processingTimes.averageVtt.toFixed(1)}秒
							</div>
						</div>
						<div className="bg-yellow-50 rounded p-3">
							<div className="text-sm text-yellow-600">平均処理時間 (Whisper)</div>
							<div className="text-lg font-semibold text-yellow-800">
								{vttStats.processingTimes.averageWhisper.toFixed(1)}秒
							</div>
						</div>
					</div>
				)}
				
				{vttStats.recentJobs && vttStats.recentJobs.length > 0 && (
					<div>
						<h3 className="font-medium text-gray-700 mb-2">最近の処理履歴</h3>
						<div className="space-y-2">
							{vttStats.recentJobs.slice(0, 5).map((job, index) => (
								<div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
									<div className="flex-1">
										<div className="text-sm font-medium">{job.meetingTopic}</div>
										<div className="text-xs text-gray-500">
											{new Date(job.createdAt).toLocaleString('ja-JP')}
										</div>
									</div>
									<div className="text-right">
										<div className={`text-sm font-medium px-2 py-1 rounded ${
											job.processingMethod === 'vtt' ? 'bg-green-100 text-green-800' : 
											job.processingMethod === 'whisper' ? 'bg-yellow-100 text-yellow-800' : 
											'bg-gray-100 text-gray-800'
										}`}>
											{job.processingMethod === 'vtt' ? 'VTT' : 
											 job.processingMethod === 'whisper' ? 'Whisper' : 
											 job.processingMethod || 'Unknown'}
										</div>
										{job.processingDuration && (
											<div className="text-xs text-gray-500 mt-1">
												{job.processingDuration.toFixed(1)}秒
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

	// テスト結果の表示
	const renderTestResult = (testName: string) => {
		const result = testResults[testName];
		if (!result) return null;

		return (
			<div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
				<div className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
					{result.success ? '✅ 成功' : '❌ 失敗'}
				</div>
				<div className="text-sm mt-1 text-gray-600">
					{result.message}
				</div>
				{result.data && (
					<details className="mt-2">
						<summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
							詳細データを表示
						</summary>
						<pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
							{JSON.stringify(result.data, null, 2)}
						</pre>
					</details>
				)}
				{result.error && (
					<div className="mt-2 text-sm text-red-600">
						エラー: {typeof result.error === 'object' ? JSON.stringify(result.error) : result.error}
					</div>
				)}
			</div>
		);
	};

	// 統合フローテスト専用の結果表示
	const renderFullFlowResult = () => {
		const result = testResults.fullFlow;
		if (!result) return null;

		const steps = result.results?.steps || [];
		const progress = result.results?.progress || {};
		const summary = result.results?.summary || {};

		return (
			<div className="mt-4 space-y-4">
				{/* 進捗バー */}
				{progress.current !== undefined && (
					<div className="bg-gray-50 p-4 rounded-lg">
						<div className="flex justify-between items-center mb-2">
							<span className="text-sm font-medium text-gray-700">
								{progress.message || '処理中...'}
							</span>
							<span className="text-sm text-gray-500">
								{progress.current}%
							</span>
						</div>
						<div className="w-full bg-gray-200 rounded-full h-2">
							<div 
								className={`h-2 rounded-full transition-all duration-300 ${
									progress.current === 100 
										? (result.success ? 'bg-green-500' : 'bg-red-500')
										: 'bg-blue-500'
								}`}
								style={{ width: `${progress.current}%` }}
							></div>
						</div>
						{progress.details && (
							<p className="text-xs text-gray-600 mt-2">
								{progress.details}
							</p>
						)}
					</div>
				)}

				{/* ステップ詳細 */}
				{steps.length > 0 && (
					<div className="space-y-3">
						{steps.map((step: any, index: number) => (
							<div key={index} className={`p-3 rounded-lg border ${
								step.status === 'success' ? 'bg-green-50 border-green-200' :
								step.status === 'failed' ? 'bg-red-50 border-red-200' :
								'bg-gray-50 border-gray-200'
							}`}>
								<div className="flex items-center justify-between">
									<div className="flex items-center">
										<span className={`mr-2 ${
											step.status === 'success' ? 'text-green-600' :
											step.status === 'failed' ? 'text-red-600' :
											'text-gray-600'
										}`}>
											{step.status === 'success' ? '✅' :
											 step.status === 'failed' ? '❌' : '⏳'}
										</span>
										<span className="font-medium">
											ステップ{step.step}: {step.name}
										</span>
									</div>
									{step.duration && (
										<span className="text-xs text-gray-500">
											{step.duration > 1000 ? `${Math.round(step.duration / 1000)}秒` : `${step.duration}ms`}
										</span>
									)}
								</div>
								
								{step.details && (
									<div className="mt-2 text-sm">
										<p className="font-medium text-gray-700">
											{step.details.message}
										</p>
										<div className="mt-1 space-y-1 text-xs text-gray-600">
											{Object.entries(step.details).map(([key, value]: [string, any]) => {
												if (key === 'message') return null;
												return (
													<div key={key} className="flex">
														<span className="font-medium capitalize mr-2">
															{key.replace(/([A-Z])/g, ' $1').trim()}:
														</span>
														<span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
													</div>
												);
											})}
										</div>
									</div>
								)}
								
								{step.error && (
									<div className="mt-2 text-sm text-red-600">
										<span className="font-medium">エラー:</span> {step.error}
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* サマリー */}
				{summary.totalSteps && (
					<div className={`p-4 rounded-lg ${
						result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
					}`}>
						<div className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
							{result.success ? '🎉 統合フローテスト完了' : '⚠️ 統合フローテスト完了（一部エラー）'}
						</div>
						<div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
							<div>
								<span className="text-gray-600">成功率:</span>
								<span className="ml-1 font-medium">{summary.successRate}</span>
							</div>
							<div>
								<span className="text-gray-600">処理時間:</span>
								<span className="ml-1 font-medium">{Math.round(summary.totalDuration / 1000)}秒</span>
							</div>
							<div>
								<span className="text-gray-600">会議名:</span>
								<span className="ml-1 font-medium">{summary.meetingTopic}</span>
							</div>
							<div>
								<span className="text-gray-600">開催日時:</span>
								<span className="ml-1 font-medium">
									{summary.startTime && summary.startTime !== '未設定' 
										? new Date(summary.startTime).toLocaleString('ja-JP')
										: '未設定'
									}
								</span>
							</div>
							<div>
								<span className="text-gray-600">所要時間:</span>
								<span className="ml-1 font-medium">
									{summary.duration && summary.duration !== 'unknown' 
										? `${summary.duration}分` 
										: '未設定'
									}
								</span>
							</div>
							<div>
								<span className="text-gray-600">参加者:</span>
								<span className="ml-1 font-medium">
									{summary.participants && summary.participants !== '未設定' 
										? summary.participants 
										: '未設定'
									}
								</span>
							</div>
							<div>
								<span className="text-gray-600">送信先:</span>
								<span className="ml-1 font-medium">{summary.recipient}</span>
							</div>
							{summary.processingMethod && (
								<div>
									<span className="text-gray-600">処理方法:</span>
									<span className={`ml-1 font-medium px-2 py-1 rounded text-xs ${
										summary.processingMethod === 'vtt' ? 'bg-green-100 text-green-800' : 
										summary.processingMethod === 'whisper' ? 'bg-yellow-100 text-yellow-800' : 
										'bg-gray-100 text-gray-800'
									}`}>
										{summary.processingMethod === 'vtt' ? 'VTT (コスト削減)' : 
										 summary.processingMethod === 'whisper' ? 'Whisper (API使用)' : 
										 summary.processingMethod}
									</span>
								</div>
							)}
							{summary.costSavings !== undefined && (
								<div>
									<span className="text-gray-600">コスト削減:</span>
									<span className={`ml-1 font-medium ${summary.costSavings ? 'text-green-600' : 'text-yellow-600'}`}>
										{summary.costSavings ? '✅ 削減済み' : '❌ API使用'}
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* 全体エラー */}
				{result.error && (
					<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
						<div className="font-medium text-red-800">システムエラー</div>
						<div className="text-sm text-red-600 mt-1">
							{typeof result.error === 'object' ? JSON.stringify(result.error) : result.error}
						</div>
					</div>
				)}
			</div>
		);
	};

	// 管理者権限確認
	if (!session) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="bg-white p-8 rounded-lg shadow-md">
					<h1 className="text-2xl font-bold mb-4">デバッグページ</h1>
					<p className="text-gray-600">ログインが必要です</p>
				</div>
			</div>
		);
	}

	if (session.user.role !== 'admin') {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="bg-white p-8 rounded-lg shadow-md">
					<h1 className="text-2xl font-bold mb-4">アクセス拒否</h1>
					<p className="text-gray-600">このページは管理者のみアクセス可能です</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 p-6">
			<div className="max-w-7xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-4">
						<Link href="/dashboard">
							<Button variant="outline" className="text-sm">
								← ダッシュボードに戻る
							</Button>
						</Link>
						<h1 className="text-3xl font-bold text-gray-900">Zoom連携デバッグダッシュボード</h1>
					</div>
					<Button
						onClick={fetchDebugStatus}
						variant="outline"
						className="text-sm"
					>
						状態を更新
					</Button>
				</div>

				{/* 環境変数状態 */}
				{renderEnvironmentStatus()}

				{/* キュー管理 */}
				{renderQueueManagement()}

				{/* VTT/Whisper使用状況 */}
				{renderVttStats()}

				{/* データベース状態 */}
				{debugStatus && (
					<div className="bg-white rounded-lg shadow-md p-6 mb-6">
						<h2 className="text-xl font-semibold mb-4">データベース状態</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<div className={`text-sm flex items-center ${debugStatus.database.connected ? 'text-green-600' : 'text-red-600'}`}>
									<span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
									接続状態: {debugStatus.database.connected ? '接続済み' : '未接続'}
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">
									最近のジョブ: {debugStatus.database.recentJobs.length}件
								</div>
								{debugStatus.database.recentJobs.length > 0 && (
									<div className="mt-2 text-xs">
										{debugStatus.database.recentJobs.map((job, index) => (
											<div key={index} className="bg-gray-50 p-2 rounded mb-1">
												<div>ID: {job.id}, Type: {job.type}, Status: {job.status}</div>
												<div className="text-gray-500">Topic: {job.meeting_topic}</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* テスト実行セクション */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{/* 1. Webhook受信テスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">1. Webhook受信テスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							Zoom Webhookの受信処理をテストします
						</p>
						<Button
							onClick={() => runTest('webhook', '/api/debug/test-webhook', {})}
							disabled={loading.webhook}
							className="w-full"
						>
							{loading.webhook ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('webhook')}
					</div>

					{/* 2. Zoom API認証テスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">2. Zoom API認証テスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							Zoom APIの認証処理をテストします
						</p>
						<Button
							onClick={() => runTest('auth', '/api/debug/test-auth', {})}
							disabled={loading.auth}
							className="w-full"
						>
							{loading.auth ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('auth')}
					</div>

					{/* 3. 録画データ取得テスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">3. 録画データ取得テスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							Zoom録画データの取得をテストします
						</p>
						<div className="space-y-2 mb-4">
							<input
								type="text"
								placeholder="822 5973 5801 (スペース入りOK)"
								id="meetingId"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
							/>
							<p className="text-xs text-gray-500">
								Meeting IDはスペース入りで入力できます。システムが自動で正規化します。
							</p>
						</div>
						<Button
							onClick={() => {
								const meetingId = (document.getElementById('meetingId') as HTMLInputElement)?.value;
								if (meetingId) {
									runTest('recording', `/api/debug/test-recording/${meetingId}`);
								}
							}}
							disabled={loading.recording}
							className="w-full"
						>
							{loading.recording ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('recording')}
					</div>

					{/* 4. 文字起こしテスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">4. 文字起こしテスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							音声ファイルの文字起こしをテストします
						</p>
						<div className="space-y-2 mb-4">
							<input
								type="url"
								placeholder="音声ファイルURL"
								id="audioUrl"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
							/>
						</div>
						<Button
							onClick={() => {
								const audioUrl = (document.getElementById('audioUrl') as HTMLInputElement)?.value;
								if (audioUrl) {
									runTest('transcription', '/api/debug/test-transcription', { audioUrl });
								}
							}}
							disabled={loading.transcription}
							className="w-full"
						>
							{loading.transcription ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('transcription')}
					</div>

					{/* 5. 議事録生成テスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">5. 議事録生成テスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							文字起こしから議事録生成をテストします
						</p>
						<div className="space-y-2 mb-4">
							<textarea
								placeholder="文字起こしテキスト"
								id="transcriptionText"
								rows={3}
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
								defaultValue="これはテスト用の文字起こしテキストです。会議の内容について議論し、重要な決定事項がいくつか決められました。"
							/>
							<input
								type="text"
								placeholder="会議タイトル"
								id="meetingTopic"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
								defaultValue="テスト会議"
							/>
						</div>
						<Button
							onClick={() => {
								const transcription = (document.getElementById('transcriptionText') as HTMLTextAreaElement)?.value;
								const meetingTopic = (document.getElementById('meetingTopic') as HTMLInputElement)?.value;
								if (transcription) {
									runTest('transcript', '/api/debug/test-transcript-generation', { transcription, meetingTopic });
								}
							}}
							disabled={loading.transcript}
							className="w-full"
						>
							{loading.transcript ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('transcript')}
					</div>

					{/* 6. メール配信テスト */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h3 className="text-lg font-semibold mb-4">6. メール配信テスト</h3>
						<p className="text-sm text-gray-600 mb-4">
							議事録メールの配信をテストします
						</p>
						<div className="space-y-2 mb-4">
							<input
								type="email"
								placeholder="送信先メールアドレス"
								id="recipient"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
							/>
						</div>
						<Button
							onClick={() => {
								const recipient = (document.getElementById('recipient') as HTMLInputElement)?.value;
								if (recipient) {
									runTest('email', '/api/debug/test-email', { recipient });
								}
							}}
							disabled={loading.email}
							className="w-full"
						>
							{loading.email ? '実行中...' : 'テスト実行'}
						</Button>
						{renderTestResult('email')}
					</div>
				</div>

				{/* 統合テスト */}
				<div className="bg-white rounded-lg shadow-md p-6 mt-6">
					<h3 className="text-lg font-semibold mb-4">統合フローテスト</h3>
					<p className="text-sm text-gray-600 mb-4">
						全体のフローを一括でテストします（録画データ取得→VTT優先文字起こし→議事録生成→メール配信）
					</p>
					<div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-md mb-4">
						<strong>VTT優先処理:</strong> 字幕ファイル(VTT)があれば発言者情報付きで高速処理、なければ音声ファイルでWhisper API使用
					</div>
					<div className="space-y-3 mb-4">
						<div>
							<input
								type="text"
								placeholder="822 5973 5801 (スペース入りOK)"
								id="fullFlowMeetingId"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
							/>
							<p className="text-xs text-gray-500 mt-1">
								Meeting IDはスペース入りで入力できます
							</p>
						</div>
						<div>
							<input
								type="email"
								placeholder="test@example.com"
								id="fullFlowRecipient"
								className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
							/>
							<p className="text-xs text-gray-500 mt-1">
								議事録が送信されるメールアドレス（MailHog: localhost:8025で確認）
							</p>
						</div>
					</div>
					<Button
						onClick={() => {
							const meetingId = (document.getElementById('fullFlowMeetingId') as HTMLInputElement)?.value;
							const recipient = (document.getElementById('fullFlowRecipient') as HTMLInputElement)?.value;
							if (meetingId && recipient) {
								runTest('fullFlow', '/api/debug/test-full-flow', { meetingId, recipient });
							}
						}}
						disabled={loading.fullFlow}
						className="w-full"
					>
						{loading.fullFlow ? '実行中...' : '統合テスト実行'}
					</Button>
					{renderFullFlowResult()}
				</div>
			</div>
		</div>
	);
}