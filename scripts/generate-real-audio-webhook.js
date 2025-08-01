#!/usr/bin/env node

const crypto = require('crypto');

// 設定
const WEBHOOK_SECRET = 'Y3hnetGORy6gKaBkoy8XzA';
const NGROK_URL = 'https://c120-240f-90-a034-1-7c2b-8863-e968-5907.ngrok-free.app';

// 実音声ファイルを使用したWebhookペイロード
const payload = {
    event: 'recording.completed',
    event_ts: Date.now(),
    payload: {
        account_id: 'XnO_bZU3TWmobWvLuELShA',
        object: {
            uuid: 'real-audio-test-uuid-' + Date.now(),
            id: 888777666,
            meeting_id: 888777666,
            host_id: 'real-test-host',
            topic: '実音声ファイルテスト会議',
            type: 2,
            start_time: new Date().toISOString(),
            duration: 3600,
            recording_files: [
                {
                    id: 'real-audio-recording',
                    meeting_id: 888777666,
                    recording_start: new Date().toISOString(),
                    recording_end: new Date(Date.now() + 3600000).toISOString(),
                    file_type: 'M4A',
                    file_size: 15728640,
                    // 実際にローカルで利用可能な音声ファイルパスを指定
                    play_url: './sample_audio.mp3',
                    download_url: './sample_audio.mp3',
                    status: 'completed'
                }
            ]
        }
    }
};

// Zoom標準のv0署名を生成
function generateZoomSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const message = `v0:${timestamp}:${payloadString}`;
    const hashForVerify = crypto.createHmac('sha256', secret).update(message).digest('hex');
    const signature = `v0=${hashForVerify}`;
    return { signature, timestamp };
}

console.log('=== 実音声ファイル使用Webhookコマンド生成 ===');

const payloadString = JSON.stringify(payload);
const { signature, timestamp } = generateZoomSignature(payload, WEBHOOK_SECRET);

console.log('\n注意: download_urlを実際の音声ファイルパスに変更してください');
console.log('例: ./sample_audio.mp3, ./test.m4a など\n');

console.log('curlコマンド:');
console.log(`curl -X POST ${NGROK_URL}/api/webhooks/zoom \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "x-zm-signature: ${signature}" \\`);
console.log(`  -H "x-zm-request-timestamp: ${timestamp}" \\`);
console.log(`  -d '${payloadString}'`);

console.log('\n=== ペイロード内容 ===');
console.log(JSON.stringify(payload, null, 2));