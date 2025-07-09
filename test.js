/**
 * 登録情報変更システムのテストスクリプト
 */

const https = require('https');

const API_ENDPOINT = 'https://u7t6bk9az0.execute-api.ap-northeast-1.amazonaws.com/prod/changes';

// テストデータ
const testCases = [
    {
        name: '住所変更テスト',
        data: {
            changeType: 'address',
            userDisplayName: 'テストユーザー',
            userEmail: 'test-user@example.com',
            userId: 'test-user-id',
            currentData: {
                zipCode: '123-4567',
                address: '東京都渋谷区テスト町1-2-3 テストマンション101'
            },
            newData: {
                zipCode: '234-5678',
                address: '東京都新宿区新テスト町4-5-6 新テストマンション202'
            },
            reason: '引っ越しのため'
        }
    },
    {
        name: '連絡先変更テスト',
        data: {
            changeType: 'contact',
            userDisplayName: 'テストユーザー',
            userEmail: 'test-user@example.com',
            userId: 'test-user-id',
            currentData: {
                phone: '090-1234-5678',
                emergencyContact: '090-9876-5432'
            },
            newData: {
                phone: '080-1111-2222',
                emergencyContact: '090-3333-4444'
            },
            reason: '携帯電話を変更したため'
        }
    },
    {
        name: '口座変更テスト',
        data: {
            changeType: 'bankAccount',
            userDisplayName: 'テストユーザー',
            userEmail: 'test-user@example.com',
            userId: 'test-user-id',
            currentData: {
                bankName: 'テスト銀行',
                branchName: 'テスト支店',
                accountNumber: '1234567',
                accountName: 'テスト タロウ'
            },
            newData: {
                bankName: '新テスト銀行',
                branchName: '新テスト支店',
                accountType: 'ordinary',
                accountNumber: '7654321',
                accountName: 'テスト タロウ'
            },
            reason: '転職により給与振込口座を変更'
        }
    }
];

async function testProfileChangeRequest(testCase) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(testCase.data);
        
        const url = new URL(API_ENDPOINT);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        console.log(`🧪 ${testCase.name} 実行中...`);
        
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    
                    if (res.statusCode === 200 && result.success) {
                        console.log(`✅ ${testCase.name} 成功`);
                        console.log(`📋 申請ID: ${result.requestId}`);
                        console.log(`⏰ 申請日時: ${result.timestamp}`);
                        resolve(result);
                    } else {
                        console.log(`❌ ${testCase.name} 失敗: ${result.error || 'Unknown error'}`);
                        reject(new Error(result.error || 'Request failed'));
                    }
                } catch (error) {
                    console.log(`❌ ${testCase.name} レスポンス解析エラー:`, error.message);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ ${testCase.name} リクエストエラー:`, error.message);
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
}

async function testGetRequests() {
    return new Promise((resolve, reject) => {
        const url = new URL(API_ENDPOINT);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        console.log('📋 登録情報変更履歴取得テスト実行中...');
        
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    
                    if (res.statusCode === 200 && result.success) {
                        console.log(`✅ 履歴取得成功: ${result.data.length}件`);
                        result.data.slice(0, 3).forEach((item, index) => {
                            const changeTypeNames = {
                                'address': '住所変更',
                                'contact': '連絡先変更',
                                'bankAccount': '口座変更'
                            };
                            console.log(`${index + 1}. ${changeTypeNames[item.changeType]} - ${item.userDisplayName} (${item.status})`);
                        });
                        resolve(result);
                    } else {
                        console.log(`❌ 履歴取得失敗: ${result.error || 'Unknown error'}`);
                        reject(new Error(result.error || 'Request failed'));
                    }
                } catch (error) {
                    console.log('❌ 履歴取得レスポンス解析エラー:', error.message);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log('❌ 履歴取得リクエストエラー:', error.message);
            reject(error);
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('📝 登録情報変更システムテスト開始...\n');
    
    try {
        // 各変更タイプのテスト実行
        for (const testCase of testCases) {
            await testProfileChangeRequest(testCase);
            console.log(''); // 空行
            
            // APIの負荷を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('⏱️  3秒待機...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 履歴取得テスト
        await testGetRequests();
        
        console.log('\n📱 LINE WORKSトークルームで以下の通知が送信されているはずです:');
        console.log('「📝 登録情報変更申請がありました！」');
        console.log('変更種類: 住所変更、連絡先変更、口座変更');
        console.log('申請者: テストユーザー');
        
        console.log('\n🎉 全テスト完了！');
        
    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生しました:', error.message);
        process.exit(1);
    }
}

// テスト実行
runTests();