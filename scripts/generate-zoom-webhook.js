#!/usr/bin/env node

const crypto = require('crypto');

// 設定
const WEBHOOK_SECRET = 'Y3hnetGORy6gKaBkoy8XzA';
const NGROK_URL = 'https://c120-240f-90-a034-1-7c2b-8863-e968-5907.ngrok-free.app';

// テスト用Webhookペイロード
const payload = {
    event: 'recording.completed',
    event_ts: Date.now(),
    payload: {
        account_id: 'XnO_bZU3TWmobWvLuELShA',
        object: {
            uuid: 'manual-test-uuid-' + Date.now(),
            id: 999888777, // meeting_id ではなく id を使用
            meeting_id: 999888777,
            host_id: 'manual-test-host',
            topic: '手動テスト会議 - Zoom標準署名テスト',
            type: 2,
            start_time: new Date().toISOString(),
            duration: 3600,
            recording_files: [
                {
                    id: 'manual-test-recording-audio',
                    meeting_id: 999888777,
                    recording_start: new Date().toISOString(),
                    recording_end: new Date(Date.now() + 3600000).toISOString(),
                    file_type: 'M4A',
                    file_size: 15728640,
                    play_url: 'https://example.com/manual-test-audio.m4a',
                    download_url: 'https://example.com/manual-test-audio.m4a',
                    status: 'completed'
                }
            ]
        }
    }
};

// Zoom標準のv0署名を生成
function generateZoomSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
    const payloadString = JSON.stringify(payload);
    const message = `v0:${timestamp}:${payloadString}`;
    const hashForVerify = crypto.createHmac('sha256', secret).update(message).digest('hex');
    const signature = `v0=${hashForVerify}`;
    return { signature, timestamp };
}

console.log('=== Zoom標準署名付きWebhookコマンド生成 ===');

const payloadString = JSON.stringify(payload);
const { signature, timestamp } = generateZoomSignature(payload, WEBHOOK_SECRET);

console.log('\n生成された署名:', signature);
console.log('タイムスタンプ:', timestamp);

console.log('\ncurlコマンド:');
console.log(`curl -X POST ${NGROK_URL}/api/webhooks/zoom \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "x-zm-signature: ${signature}" \\`);
console.log(`  -H "x-zm-request-timestamp: ${timestamp}" \\`);
console.log(`  -d '${payloadString}'`);

console.log('\n=== ペイロード内容 ===');
console.log(JSON.stringify(payload, null, 2));