const axios = require('axios');
const zoomUtils = require('./utils/zoom');

async function getZoomAccessToken() {
    try {
        const credentials = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post('https://zoom.us/oauth/token', 
            `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Zoomアクセストークン取得エラー:', error.response?.data || error.message);
        throw error;
    }
}

async function testVTTAvailability(meetingId) {
    try {
        console.log(`🔍 ミーティングID ${meetingId} のVTTファイル取得テスト開始...`);
        
        // Meeting IDを正規化
        const normalizedMeetingId = zoomUtils.normalizeMeetingId(meetingId);
        console.log(`📝 Meeting ID正規化: "${meetingId}" → "${normalizedMeetingId}"`);
        
        // アクセストークン取得
        const accessToken = await getZoomAccessToken();
        console.log('✅ Zoomアクセストークン取得成功');

        // 録画データ取得
        const response = await axios.get(
            `https://api.zoom.us/v2/meetings/${normalizedMeetingId}/recordings`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const recordings = response.data.recording_files;
        
        console.log('📁 取得された録画ファイル一覧:');
        recordings.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.file_type} (${file.recording_type}) - ${file.status} - ${file.file_size} bytes`);
        });

        // VTTファイルを検索
        const vttRecording = recordings.find(file => 
            file.file_type === 'VTT' || 
            file.file_type === 'TRANSCRIPT' || 
            file.recording_type === 'transcript' ||
            file.recording_type === 'audio_transcript'
        );

        if (vttRecording) {
            console.log('🎯 VTTファイルが見つかりました:', {
                file_type: vttRecording.file_type,
                recording_type: vttRecording.recording_type,
                status: vttRecording.status,
                file_size: vttRecording.file_size
            });

            // VTTファイルをダウンロード
            if (vttRecording.download_url) {
                console.log('📥 VTTファイルをダウンロード中...');
                const vttContent = await zoomUtils.downloadVTTFile(vttRecording.download_url, accessToken);
                
                console.log('📄 VTTファイル内容（最初の500文字）:');
                console.log(vttContent.substring(0, 500));
                
                // VTT解析
                const vttAnalysis = zoomUtils.parseVTTContent(vttContent);
                
                if (vttAnalysis.success) {
                    console.log('✅ VTT解析成功:', {
                        speakers: vttAnalysis.speakers.length,
                        speakerNames: vttAnalysis.speakers,
                        transcriptLength: vttAnalysis.chronologicalTranscript.length,
                        qualityScore: vttAnalysis.quality?.qualityScore || 'N/A'
                    });
                    
                    console.log('🗣️ 解析された文字起こし（最初の300文字）:');
                    console.log(vttAnalysis.chronologicalTranscript.substring(0, 300));
                } else {
                    console.log('❌ VTT解析失敗:', vttAnalysis.error);
                }
            } else {
                console.log('⚠️ VTTファイルのダウンロードURLがありません');
            }
        } else {
            console.log('❌ VTTファイルが見つかりませんでした');
            
            // 音声ファイルを確認
            const audioRecording = recordings.find(file => 
                file.file_type === 'M4A' || file.file_type === 'MP3'
            );
            
            if (audioRecording) {
                console.log('🎙️ 音声ファイルが利用可能です（Whisper APIでの処理が必要）:', {
                    file_type: audioRecording.file_type,
                    file_size: audioRecording.file_size
                });
            }
        }

        return {
            vttAvailable: !!vttRecording,
            audioAvailable: !!recordings.find(file => file.file_type === 'M4A' || file.file_type === 'MP3'),
            totalFiles: recordings.length
        };

    } catch (error) {
        console.error('❌ テスト失敗:', error.response?.data || error.message);
        throw error;
    }
}

// 環境変数をロード
require('dotenv').config();

// テスト実行
const meetingId = '838 1307 4567'; // スペース区切りでも正規化される
testVTTAvailability(meetingId)
    .then(result => {
        console.log('\n🎯 テスト結果:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 エラー:', error.message);
        process.exit(1);
    });