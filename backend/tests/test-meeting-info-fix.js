#!/usr/bin/env node

/**
 * 議事録メール表示修正のテストスクリプト
 * 所要時間と参加者情報表示問題の修正を検証する統合テスト
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 議事録メール表示修正のテスト開始');
console.log('=' .repeat(60));

// テスト対象ファイル
const testFiles = [
	'tests/meeting-info-display.test.js',
	'tests/vtt-participant-extraction.test.js', 
	'tests/email-content-regression.test.js'
];

// カラーコード
const colors = {
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	reset: '\x1b[0m',
	bold: '\x1b[1m'
};

function runTest(testFile) {
	console.log(`\n${colors.blue}📋 テスト実行: ${testFile}${colors.reset}`);
	console.log('-'.repeat(40));
	
	try {
		const result = execSync(`npm test -- ${testFile}`, {
			cwd: path.dirname(__filename),
			encoding: 'utf8',
			stdio: 'pipe'
		});
		
		console.log(`${colors.green}✅ ${testFile} - 成功${colors.reset}`);
		
		// テスト結果のサマリーを抽出
		const lines = result.split('\n');
		const summaryLine = lines.find(line => line.includes('Tests:') && line.includes('passed'));
		if (summaryLine) {
			console.log(`   ${summaryLine.trim()}`);
		}
		
		return true;
	} catch (error) {
		console.log(`${colors.red}❌ ${testFile} - 失敗${colors.reset}`);
		console.log(`   エラー: ${error.message}`);
		
		// エラー詳細を表示
		if (error.stdout) {
			const errorLines = error.stdout.split('\n');
			const importantLines = errorLines.filter(line => 
				line.includes('FAIL') || 
				line.includes('Error:') || 
				line.includes('Expected:') ||
				line.includes('Received:')
			);
			
			if (importantLines.length > 0) {
				console.log(`   詳細:`);
				importantLines.slice(0, 5).forEach(line => {
					console.log(`     ${line.trim()}`);
				});
			}
		}
		
		return false;
	}
}

function runManualTest() {
	console.log(`\n${colors.yellow}🧪 手動テスト: 実際のメール生成テスト${colors.reset}`);
	console.log('-'.repeat(40));
	
	try {
		// 実際のサービスクラスをインポートしてテスト
		const EmailService = require('./services/emailService');
		const TranscriptWorker = require('./workers/transcriptWorker');
		
		const emailService = new EmailService();
		const transcriptWorker = new TranscriptWorker();
		
		// 修正前の問題パターンをシミュレート
		console.log('1. 修正前問題パターンの確認...');
		const problemData = {
			meeting_id: '123456789',
			duration: undefined,
			participants: []
		};
		
		const problemMeetingInfo = transcriptWorker.extractMeetingInfo(problemData);
		console.log(`   問題パターン: duration=${problemMeetingInfo.duration}, participants=${problemMeetingInfo.participants.length}名`);
		
		// 修正後パターン
		console.log('2. 修正後パターンの確認...');
		const fixedData = {
			meeting_id: '123456789',
			topic: 'テスト会議',
			start_time: '2025-07-21T10:00:00Z',
			duration: 30,
			participants: [
				{ user_name: '上辻としゆき', email: 'test@example.com' }
			]
		};
		
		const fixedMeetingInfo = transcriptWorker.extractMeetingInfo(fixedData);
		console.log(`   修正後: duration=${fixedMeetingInfo.duration}分, participants=${fixedMeetingInfo.participants.length}名`);
		
		// メール生成テスト
		console.log('3. メール内容生成テスト...');
		const transcript = {
			formatted_transcript: 'テスト議事録内容',
			summary: 'テスト要約'
		};
		
		const emailContent = emailService.generateTranscriptEmailContent(transcript, fixedMeetingInfo);
		
		// 重要な内容をチェック
		const hasDuration = emailContent.html.includes('所要時間:</strong> 30分');
		const hasParticipants = emailContent.html.includes('参加者:</strong> 上辻としゆき');
		const notUnknownDuration = !emailContent.html.includes('所要時間:</strong> 不明');
		const notUnknownParticipants = !emailContent.html.includes('参加者:</strong> 不明');
		
		console.log(`   ✓ 所要時間表示: ${hasDuration ? '正常' : '異常'}`);
		console.log(`   ✓ 参加者表示: ${hasParticipants ? '正常' : '異常'}`);
		console.log(`   ✓ 「不明」回避(時間): ${notUnknownDuration ? '正常' : '異常'}`);
		console.log(`   ✓ 「不明」回避(参加者): ${notUnknownParticipants ? '正常' : '異常'}`);
		
		const allPassed = hasDuration && hasParticipants && notUnknownDuration && notUnknownParticipants;
		
		if (allPassed) {
			console.log(`${colors.green}✅ 手動テスト - 成功${colors.reset}`);
		} else {
			console.log(`${colors.red}❌ 手動テスト - 失敗${colors.reset}`);
		}
		
		return allPassed;
	} catch (error) {
		console.log(`${colors.red}❌ 手動テスト - エラー: ${error.message}${colors.reset}`);
		return false;
	}
}

// メイン処理
async function main() {
	let totalTests = 0;
	let passedTests = 0;
	
	// Jestテストの実行
	for (const testFile of testFiles) {
		totalTests++;
		if (runTest(testFile)) {
			passedTests++;
		}
	}
	
	// 手動テストの実行
	totalTests++;
	if (runManualTest()) {
		passedTests++;
	}
	
	// 結果サマリー
	console.log('\n' + '='.repeat(60));
	console.log(`${colors.bold}📊 テスト結果サマリー${colors.reset}`);
	console.log(`総テスト数: ${totalTests}`);
	console.log(`成功: ${colors.green}${passedTests}${colors.reset}`);
	console.log(`失敗: ${passedTests === totalTests ? colors.green + '0' : colors.red + (totalTests - passedTests)}${colors.reset}`);
	
	if (passedTests === totalTests) {
		console.log(`\n${colors.green}${colors.bold}🎉 すべてのテストが成功しました！${colors.reset}`);
		console.log(`${colors.green}修正が正しく動作しています。${colors.reset}`);
		process.exit(0);
	} else {
		console.log(`\n${colors.red}${colors.bold}⚠️  一部のテストが失敗しました${colors.reset}`);
		console.log(`${colors.red}修正に問題がある可能性があります。${colors.reset}`);
		process.exit(1);
	}
}

// 使用方法表示
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(`
${colors.bold}議事録メール表示修正テストスクリプト${colors.reset}

使用方法:
  node test-meeting-info-fix.js [オプション]

オプション:
  --help, -h     このヘルプを表示
  
テスト内容:
  1. extractMeetingInfo関数の動作確認
  2. 所要時間計算ロジックの検証  
  3. 参加者情報処理の検証
  4. VTT発言者情報抽出の検証
  5. メール表示内容のデグレード防止確認
  6. 実際のメール生成の統合テスト

修正対象の問題:
  - 所要時間が「不明」と表示される問題
  - 参加者が「不明」と表示される問題
  - VTTファイルから発言者名が正しく抽出されない問題
`);
	process.exit(0);
}

// 実行
main().catch(error => {
	console.error(`${colors.red}予期しないエラー: ${error.message}${colors.reset}`);
	process.exit(1);
});