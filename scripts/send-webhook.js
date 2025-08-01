#!/usr/bin/env node

const crypto = require('crypto');
const axios = require('axios');

// 環境変数または直接設定
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
            meeting_id: 999888777,
            host_id: 'manual-test-host',
            topic: '手動テスト会議 - Webhook署名テスト',
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

// HMAC-SHA256署名を生成
function generateSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    return signature;
}

async function sendWebhook() {
    try {
        console.log('=== 手動Webhook送信テスト開始 ===');
        
        const payloadString = JSON.stringify(payload);
        const signature = generateSignature(payload, WEBHOOK_SECRET);
        
        console.log('ペイロード:', JSON.stringify(payload, null, 2));
        console.log('署名:', signature);
        console.log('送信先URL:', `${NGROK_URL}/api/webhooks/zoom`);
        
        const response = await axios.post(`${NGROK_URL}/api/webhooks/zoom`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'authorization': signature
            }
        });
        
        console.log('\n✅ Webhook送信成功!');
        console.log('レスポンス:', response.data);
        console.log('ステータス:', response.status);
        
    } catch (error) {
        console.error('\n❌ Webhook送信エラー:');
        if (error.response) {
            console.error('ステータス:', error.response.status);
            console.error('レスポンス:', error.response.data);
        } else {
            console.error('エラー:', error.message);
        }
    }
}

// 実行
sendWebhook();