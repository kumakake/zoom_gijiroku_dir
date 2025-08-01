const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
	constructor() {
		// SMTP設定を環境変数から取得
		this.smtpConfig = {
			host: process.env.SMTP_HOST || 'localhost',
			port: parseInt(process.env.SMTP_PORT) || 587,
			secure: process.env.SMTP_SECURE === 'true', // SSL/TLS
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS
			}
		};

		// 開発環境用の設定
		if (process.env.NODE_ENV === 'development') {
			this.smtpConfig = {
				host: 'mailhog',
				port: 1025,
				secure: false,
				auth: null // MailHogは認証不要
			};
		}

		this.transporter = nodemailer.createTransport(this.smtpConfig);
		this.fromEmail = process.env.SMTP_FROM || 'ai-agent@example.com';
		this.fromName = process.env.SMTP_FROM_NAME || 'AIエージェント 議事録配布システム';

		console.log('Email Service initialized');
	}

	/**
	 * SMTP接続をテスト
	 * @returns {Promise<boolean>} 接続成功/失敗
	 */
	async testConnection() {
		try {
			await this.transporter.verify();
			console.log('SMTP接続テスト成功');
			return true;
		} catch (error) {
			console.error('SMTP接続テストエラー:', error);
			return false;
		}
	}

	/**
	 * 議事録メールを送信
	 * @param {Object} emailData - メール送信データ
	 * @returns {Promise<Object>} 送信結果
	 */
	async sendTranscriptEmail(emailData) {
		try {
			const {
				recipients,
				bccRecipients = [],
				transcript,
				meetingInfo,
				attachments = [],
				distributionMode = 'host_only' // 'host_only' または 'all_participants'
			} = emailData;

			// メール本文を生成
			const emailContent = this.generateTranscriptEmailContent(transcript, meetingInfo);

			let mailOptions = {
				from: `${this.fromName} <${this.fromEmail}>`,
				subject: `【議事録】${meetingInfo.topic || '会議'} - ${this.formatDate(meetingInfo.start_time)}`,
				html: emailContent.html,
				text: emailContent.text,
				attachments: attachments
			};

			// 配信モードに応じて宛先を設定
			if (distributionMode === 'all_participants' && bccRecipients.length > 0) {
				// 全参加者配信：ホストをTo、参加者をBccに設定
				mailOptions.to = recipients; // ホストのメールアドレス
				mailOptions.bcc = bccRecipients; // 参加者のメールアドレス
				
				console.log(`Bcc一括配信: To=${recipients}, Bcc=${bccRecipients.length}名`);
			} else {
				// ホストのみ配信：従来通り
				mailOptions.to = recipients;
				
				console.log(`ホストのみ配信: To=${recipients}`);
			}

			const result = await this.transporter.sendMail(mailOptions);
			
			console.log('議事録メール送信成功:', result.messageId);
			return {
				success: true,
				messageId: result.messageId,
				recipients: recipients,
				bccRecipients: bccRecipients,
				distributionMode: distributionMode,
				totalRecipients: 1 + bccRecipients.length, // To + Bcc
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error('議事録メール送信エラー:', error);
			throw new Error(`メール送信に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 複数の議事録を一括送信
	 * @param {Array} emailDataList - メール送信データの配列
	 * @returns {Promise<Array>} 送信結果の配列
	 */
	async sendBulkTranscriptEmails(emailDataList) {
		const results = [];

		for (const emailData of emailDataList) {
			try {
				const result = await this.sendTranscriptEmail(emailData);
				results.push(result);
				
				// 送信間隔を空ける（レート制限対策）
				await this.sleep(1000);
				
			} catch (error) {
				results.push({
					success: false,
					error: error.message,
					recipients: emailData.recipients,
					timestamp: new Date().toISOString()
				});
			}
		}

		return results;
	}

	/**
	 * 議事録メールの本文を生成
	 * @param {Object} transcript - 議事録データ
	 * @param {Object} meetingInfo - 会議情報
	 * @returns {Object} HTML・テキスト形式のメール本文
	 */
	generateTranscriptEmailContent(transcript, meetingInfo) {
		const meetingDate = this.formatDate(meetingInfo.start_time);
		const duration = meetingInfo.duration ? `${meetingInfo.duration}分` : '不明';
		
		// 参加者名の処理を改善
		let participants = '不明';
		if (meetingInfo.participants && Array.isArray(meetingInfo.participants) && meetingInfo.participants.length > 0) {
			participants = meetingInfo.participants
				.map(p => p.name || p.email || 'Unknown')
				.filter(name => name && name !== 'Unknown')
				.join(', ');
			
			// 空の場合は不明とする
			if (!participants) {
				participants = '不明';
			}
		}
		
		console.log('🔍 メール生成時の会議情報:', {
			duration: meetingInfo.duration,
			participants: participants,
			participantArray: meetingInfo.participants
		});

		// HTML形式
		const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>会議議事録</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
		.content { padding: 20px; }
		.meeting-info { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
		.section { margin-bottom: 25px; }
		.section h3 { color: #4a90e2; border-bottom: 2px solid #4a90e2; padding-bottom: 5px; }
		.action-items { background-color: #fff3cd; padding: 15px; border-radius: 5px; }
		.action-item { margin-bottom: 10px; padding: 10px; background-color: #fff; border-left: 4px solid #ffc107; }
		.footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
		ul { padding-left: 20px; }
		li { margin-bottom: 5px; }
	</style>
</head>
<body>
	<div class="header">
		<h1>📝 会議議事録</h1>
		<p>${meetingInfo.topic || '会議'}</p>
	</div>
	
	<div class="content">
		<div class="meeting-info">
			<h3>📅 会議情報</h3>
			<ul>
				<li><strong>会議名:</strong> ${meetingInfo.topic || '未設定'}</li>
				<li><strong>開催日時:</strong> ${meetingDate}</li>
				<li><strong>所要時間:</strong> ${duration}</li>
				<li><strong>参加者:</strong> ${participants}</li>
			</ul>
		</div>

		${transcript.summary ? `
		<div class="section">
			<h3>📋 会議要約</h3>
			<p>${transcript.summary}</p>
		</div>
		` : ''}

		${transcript.key_decisions && transcript.key_decisions.length > 0 ? `
		<div class="section">
			<h3>✅ 重要な決定事項</h3>
			<ul>
				${transcript.key_decisions.map(decision => `<li>${decision}</li>`).join('')}
			</ul>
		</div>
		` : ''}

		${transcript.action_items && transcript.action_items.length > 0 ? `
		<div class="section">
			<h3>🎯 アクションアイテム</h3>
			<div class="action-items">
				${transcript.action_items.map(item => `
					<div class="action-item">
						<strong>${item.item}</strong>
						${item.assignee ? `<br>担当者: ${item.assignee}` : ''}
						${item.due_date ? `<br>期限: ${item.due_date}` : ''}
						${item.priority ? `<br>優先度: ${item.priority}` : ''}
					</div>
				`).join('')}
			</div>
		</div>
		` : ''}

		<div class="section">
			<h3>📄 議事録詳細</h3>
			<div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 1.6;">
				${this.formatMarkdownForHTML(transcript.formatted_transcript) || '議事録の詳細内容はありません'}
			</div>
		</div>

		${transcript.next_meeting ? `
		<div class="section">
			<h3>📅 次回会議予定</h3>
			<p>${transcript.next_meeting}</p>
		</div>
		` : ''}

		<div class="footer">
			<p>この議事録は AIエージェント 議事録配布システム により自動生成されました。</p>
			<p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
			<p>質問やご不明な点がございましたら、管理者までお問い合わせください。</p>
		</div>
	</div>
</body>
</html>
		`;

		// テキスト形式
		const text = `
【会議議事録】${meetingInfo.topic || '会議'}

== 会議情報 ==
会議名: ${meetingInfo.topic || '未設定'}
開催日時: ${meetingDate}
所要時間: ${duration}
参加者: ${participants}

${transcript.summary ? `
== 会議要約 ==
${transcript.summary}
` : ''}

${transcript.key_decisions && transcript.key_decisions.length > 0 ? `
== 重要な決定事項 ==
${transcript.key_decisions.map((decision, index) => `${index + 1}. ${decision}`).join('\n')}
` : ''}

${transcript.action_items && transcript.action_items.length > 0 ? `
== アクションアイテム ==
${transcript.action_items.map((item, index) => {
	let itemText = `${index + 1}. ${item.item}`;
	if (item.assignee) itemText += `\n   担当者: ${item.assignee}`;
	if (item.due_date) itemText += `\n   期限: ${item.due_date}`;
	if (item.priority) itemText += `\n   優先度: ${item.priority}`;
	return itemText;
}).join('\n\n')}
` : ''}

== 議事録詳細 ==
${transcript.formatted_transcript || '議事録の詳細内容はありません'}

${transcript.next_meeting ? `
== 次回会議予定 ==
${transcript.next_meeting}
` : ''}

---
この議事録は AIエージェント 議事録配布システム により自動生成されました。
生成日時: ${new Date().toLocaleString('ja-JP')}
		`;

		return { html, text };
	}

	/**
	 * 一般的なメール送信
	 * @param {Object} mailOptions - メール送信設定
	 * @returns {Promise<Object>} 送信結果
	 */
	async sendEmail(mailOptions) {
		try {
			const options = {
				from: `${this.fromName} <${this.fromEmail}>`,
				...mailOptions
			};

			const result = await this.transporter.sendMail(options);
			
			console.log('メール送信成功:', result.messageId);
			return {
				success: true,
				messageId: result.messageId,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error('メール送信エラー:', error);
			throw new Error(`メール送信に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 簡単なマークダウンをHTMLに変換
	 * @param {string} markdown - マークダウンテキスト
	 * @returns {string} HTML形式のテキスト
	 */
	formatMarkdownForHTML(markdown) {
		if (!markdown) return '';
		
		// マークダウンの見出しをHTMLに変換
		let html = markdown
			// # 見出し1 → <h2>見出し1</h2>
			.replace(/^# (.+)$/gm, '<h2 style="color: #2c3e50; margin: 15px 0 10px 0; font-size: 18px;">$1</h2>')
			// ## 見出し2 → <h3>見出し2</h3>
			.replace(/^## (.+)$/gm, '<h3 style="color: #34495e; margin: 12px 0 8px 0; font-size: 16px;">$1</h3>')
			// ### 見出し3 → <h4>見出し3</h4>
			.replace(/^### (.+)$/gm, '<h4 style="color: #34495e; margin: 10px 0 6px 0; font-size: 14px;">$1</h4>')
			// **太字** → <strong>太字</strong>
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			// *斜体* → <em>斜体</em>
			.replace(/\*(.+?)\*/g, '<em>$1</em>');
		
		return html;
	}

	/**
	 * 日付を日本語形式でフォーマット
	 * @param {string|Date} date - 日付
	 * @returns {string} フォーマット済み日付
	 */
	formatDate(date) {
		if (!date) return '未設定';
		
		try {
			const d = new Date(date);
			return d.toLocaleString('ja-JP', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				weekday: 'long'
			});
		} catch (error) {
			return '日付形式エラー';
		}
	}

	/**
	 * 指定時間待機
	 * @param {number} ms - 待機時間（ミリ秒）
	 * @returns {Promise<void>}
	 */
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * エラー通知メールを送信
	 * @param {Object} errorData - エラー情報
	 * @returns {Promise<Object>} 送信結果
	 */
	async sendErrorNotification(errorData) {
		try {
			const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
			
			const mailOptions = {
				to: adminEmail,
				subject: '【エラー通知】AIエージェント 議事録システム',
				html: `
					<h2>システムエラーが発生しました</h2>
					<p><strong>エラー時刻:</strong> ${new Date().toLocaleString('ja-JP')}</p>
					<p><strong>エラーメッセージ:</strong> ${errorData.message}</p>
					<p><strong>詳細:</strong></p>
					<pre>${JSON.stringify(errorData, null, 2)}</pre>
				`,
				text: `
システムエラーが発生しました

エラー時刻: ${new Date().toLocaleString('ja-JP')}
エラーメッセージ: ${errorData.message}
詳細: ${JSON.stringify(errorData, null, 2)}
				`
			};

			return await this.sendEmail(mailOptions);

		} catch (error) {
			console.error('エラー通知メール送信失敗:', error);
			throw error;
		}
	}
}

module.exports = EmailService;