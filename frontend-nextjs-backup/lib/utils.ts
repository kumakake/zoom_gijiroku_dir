import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
	return clsx(inputs);
}

// 日付フォーマット関数
export const formatDate = (date: string | Date, format: 'short' | 'long' | 'datetime' = 'datetime'): string => {
	const d = new Date(date);
	
	if (isNaN(d.getTime())) {
		return 'Invalid Date';
	}
	
	const options: Intl.DateTimeFormatOptions = {
		timeZone: 'Asia/Tokyo',
	};
	
	switch (format) {
		case 'short':
			options.year = 'numeric';
			options.month = '2-digit';
			options.day = '2-digit';
			break;
		case 'long':
			options.year = 'numeric';
			options.month = 'long';
			options.day = 'numeric';
			options.weekday = 'long';
			break;
		case 'datetime':
		default:
			options.year = 'numeric';
			options.month = '2-digit';
			options.day = '2-digit';
			options.hour = '2-digit';
			options.minute = '2-digit';
			break;
	}
	
	return d.toLocaleDateString('ja-JP', options);
};

// 相対時間表示関数
export const formatRelativeTime = (date: string | Date): string => {
	const d = new Date(date);
	const now = new Date();
	const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
	
	if (diffInMinutes < 1) {
		return 'たった今';
	} else if (diffInMinutes < 60) {
		return `${diffInMinutes}分前`;
	} else if (diffInMinutes < 1440) {
		const hours = Math.floor(diffInMinutes / 60);
		return `${hours}時間前`;
	} else if (diffInMinutes < 10080) {
		const days = Math.floor(diffInMinutes / 1440);
		return `${days}日前`;
	} else {
		return formatDate(date, 'short');
	}
};

// 時間の長さをフォーマット
export const formatDuration = (minutes: number): string => {
	if (minutes < 60) {
		return `${minutes}分`;
	} else {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}時間${remainingMinutes}分` : `${hours}時間`;
	}
};

// ファイルサイズをフォーマット
export const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes';
	
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 文字列を短縮
export const truncateString = (str: string, maxLength: number): string => {
	if (str.length <= maxLength) return str;
	return str.substring(0, maxLength) + '...';
};

// ステータスのバッジ色を取得
export const getStatusBadgeColor = (status: string) => {
	switch (status) {
		case 'completed':
		case 'sent':
		case 'active':
			return 'bg-green-100 text-green-800 border-green-200';
		case 'processing':
		case 'in_progress':
			return 'bg-blue-100 text-blue-800 border-blue-200';
		case 'pending':
			return 'bg-yellow-100 text-yellow-800 border-yellow-200';
		case 'failed':
		case 'error':
			return 'bg-red-100 text-red-800 border-red-200';
		case 'inactive':
		case 'disabled':
			return 'bg-gray-100 text-gray-800 border-gray-200';
		default:
			return 'bg-gray-100 text-gray-800 border-gray-200';
	}
};

// ステータスの日本語変換
export const translateStatus = (status: string): string => {
	const statusMap: Record<string, string> = {
		'pending': '待機中',
		'processing': '処理中',
		'completed': '完了',
		'failed': '失敗',
		'sent': '送信済み',
		'error': 'エラー',
		'active': 'アクティブ',
		'inactive': '非アクティブ',
		'in_progress': '進行中',
		'cancelled': 'キャンセル',
		'paused': '一時停止',
	};
	
	return statusMap[status] || status;
};

// URLの検証
export const isValidUrl = (string: string): boolean => {
	try {
		new URL(string);
		return true;
	} catch (_) {
		return false;
	}
};

// メールアドレスの検証
export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

// パスワード強度チェック
export const checkPasswordStrength = (password: string): {
	score: number;
	feedback: string[];
} => {
	const feedback: string[] = [];
	let score = 0;
	
	if (password.length >= 8) {
		score += 1;
	} else {
		feedback.push('8文字以上にしてください');
	}
	
	if (/[a-z]/.test(password)) {
		score += 1;
	} else {
		feedback.push('小文字を含めてください');
	}
	
	if (/[A-Z]/.test(password)) {
		score += 1;
	} else {
		feedback.push('大文字を含めてください');
	}
	
	if (/\d/.test(password)) {
		score += 1;
	} else {
		feedback.push('数字を含めてください');
	}
	
	if (/[^a-zA-Z\d]/.test(password)) {
		score += 1;
	} else {
		feedback.push('記号を含めてください');
	}
	
	return { score, feedback };
};

// デバウンス関数
export const debounce = <T extends (...args: any[]) => any>(
	func: T,
	delay: number
): T => {
	let timeoutId: NodeJS.Timeout;
	
	return ((...args: any[]) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(null, args), delay);
	}) as T;
};

// ローカルストレージの安全な操作
export const safeLocalStorage = {
	getItem: (key: string): string | null => {
		if (typeof window === 'undefined') return null;
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	
	setItem: (key: string, value: string): boolean => {
		if (typeof window === 'undefined') return false;
		try {
			localStorage.setItem(key, value);
			return true;
		} catch {
			return false;
		}
	},
	
	removeItem: (key: string): boolean => {
		if (typeof window === 'undefined') return false;
		try {
			localStorage.removeItem(key);
			return true;
		} catch {
			return false;
		}
	},
};