const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const https = require('https');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

const PROFILE_CHANGES_TABLE = process.env.PROFILE_CHANGES_TABLE;
const TOKEN_TABLE = process.env.TOKEN_TABLE;
const BOT_ID = process.env.BOT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Content-Type': 'application/json'
    };

    try {
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
        }

        if (event.httpMethod === 'POST') {
            return await handleProfileChangeRequest(event, headers);
        }

        if (event.httpMethod === 'GET') {
            return await getProfileChangeRequests(event, headers);
        }

        if (event.httpMethod === 'PUT') {
            return await updateProfileChangeStatus(event, headers);
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

async function handleProfileChangeRequest(event, headers) {
    const body = JSON.parse(event.body);
    console.log('Profile change request:', body);
    
    // 必須フィールドの検証 (userEmailを削除)
    const requiredFields = ['changeType', 'userDisplayName'];
    for (const field of requiredFields) {
        if (!body[field]) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Missing required field: ${field}`
                })
            };
        }
    }
    
    const timestamp = new Date().toISOString();
    const requestId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const changeRequest = {
        id: requestId,
        timestamp: timestamp,
        userId: body.userId || body.lineWorksId || 'unknown',
        changeType: body.changeType,
        userDisplayName: body.userDisplayName,
        userEmail: body.userEmail || '',
        lineWorksId: body.lineWorksId || '',
        status: 'pending',
        newData: body.newData || {},
        reason: body.reason || '',
        createdAt: timestamp,
        updatedAt: timestamp
    };
    
    try {
        // DynamoDBに保存
        const params = {
            TableName: PROFILE_CHANGES_TABLE,
            Item: marshall(changeRequest, { removeUndefinedValues: true })
        };
        
        await dynamodb.send(new PutItemCommand(params));
        console.log('Profile change request saved:', requestId);
        
        // Bot通知を送信
        try {
            await sendProfileChangeNotification(changeRequest);
        } catch (notificationError) {
            console.error('Bot notification failed but request saved:', notificationError.message);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Profile change request submitted successfully',
                requestId: requestId,
                timestamp: timestamp
            })
        };
    } catch (error) {
        console.error('Profile change request error:', error);
        throw error;
    }
}

async function getProfileChangeRequests(event, headers) {
    try {
        const userId = event.queryStringParameters?.userId;
        const status = event.queryStringParameters?.status;
        
        let params = {
            TableName: PROFILE_CHANGES_TABLE
        };
        
        if (userId) {
            params.IndexName = 'UserIdIndex';
            params.KeyConditionExpression = 'userId = :userId';
            params.ExpressionAttributeValues = marshall({ ':userId': userId });
        } else if (status) {
            params.IndexName = 'StatusIndex';
            params.KeyConditionExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues = marshall({ ':status': status });
        }
        
        const command = params.KeyConditionExpression ? 
            new (require('@aws-sdk/client-dynamodb').QueryCommand)(params) : 
            new ScanCommand(params);
        
        const result = await dynamodb.send(command);
        const requests = result.Items ? result.Items.map(item => unmarshall(item)) : [];
        
        // 日付順でソート（新しい順）
        requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: requests
            })
        };
    } catch (error) {
        console.error('Get profile change requests error:', error);
        throw error;
    }
}

async function updateProfileChangeStatus(event, headers) {
    const body = JSON.parse(event.body);
    const requestId = event.pathParameters?.id;
    
    if (!requestId || !body.status) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Missing requestId or status'
            })
        };
    }
    
    try {
        const params = {
            TableName: PROFILE_CHANGES_TABLE,
            Key: marshall({ id: requestId }),
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: marshall({
                ':status': body.status,
                ':updatedAt': new Date().toISOString()
            }),
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.send(new UpdateItemCommand(params));
        const updatedRequest = unmarshall(result.Attributes);
        
        // ステータス変更通知
        try {
            await sendStatusUpdateNotification(updatedRequest);
        } catch (notificationError) {
            console.error('Status update notification failed:', notificationError.message);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Status updated successfully',
                data: updatedRequest
            })
        };
    } catch (error) {
        console.error('Update status error:', error);
        throw error;
    }
}

async function getAccessToken() {
    try {
        const params = {
            TableName: TOKEN_TABLE,
            Key: { id: { S: 'line-works-token' } }
        };
        
        const command = new GetItemCommand(params);
        const result = await dynamodb.send(command);
        
        if (!result.Item) {
            throw new Error('Token not found in DynamoDB');
        }
        
        const tokenData = unmarshall(result.Item);
        return tokenData.accessToken;
    } catch (error) {
        console.error('Failed to get access token:', error);
        throw error;
    }
}

async function sendProfileChangeNotification(changeRequest) {
    if (!CHANNEL_ID) {
        console.log('Channel ID not configured, skipping notification');
        return;
    }
    
    const accessToken = await getAccessToken();
    
    const changeTypeNames = {
        'address': '住所変更',
        'contact': '連絡先変更',
        'bankAccount': '口座変更'
    };
    
    const message = {
        content: {
            type: 'text',
            text: `📝 登録情報変更申請がありました！

🔄 変更種類: ${changeTypeNames[changeRequest.changeType] || changeRequest.changeType}
👤 申請者: ${changeRequest.userDisplayName}
🆔 LINE WORKS ID: ${changeRequest.lineWorksId || 'N/A'}
📅 申請日時: ${new Date(changeRequest.timestamp).toLocaleString('ja-JP')}
📋 ステータス: ${changeRequest.status}

${changeRequest.reason ? `理由: ${changeRequest.reason}

` : ''}申請ID: ${changeRequest.id}`
        }
    };
    
    return sendToChannel(message, accessToken);
}

async function sendStatusUpdateNotification(changeRequest) {
    if (!CHANNEL_ID) return;
    
    const accessToken = await getAccessToken();
    
    const statusNames = {
        'pending': '処理中',
        'approved': '承認済み',
        'rejected': '却下',
        'completed': '完了'
    };
    
    const message = {
        content: {
            type: 'text',
            text: `✅ 登録情報変更のステータスが更新されました！

申請ID: ${changeRequest.id}
申請者: ${changeRequest.userDisplayName}
ステータス: ${statusNames[changeRequest.status] || changeRequest.status}
更新日時: ${new Date(changeRequest.updatedAt).toLocaleString('ja-JP')}`
        }
    };
    
    return sendToChannel(message, accessToken);
}

async function sendToChannel(message, accessToken) {
    const data = JSON.stringify(message);
    
    const options = {
        hostname: 'www.worksapis.com',
        path: `/v1.0/bots/${BOT_ID}/channels/${encodeURIComponent(CHANNEL_ID)}/messages`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    console.log('Profile change notification sent successfully');
                    resolve();
                } else {
                    console.error(`Failed to send notification: ${res.statusCode} - ${responseData}`);
                    reject(new Error(`Failed to send notification: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Notification request error:', error);
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
}