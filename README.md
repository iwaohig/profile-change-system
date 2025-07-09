# 📝 登録情報変更システム

LINE WORKS Bot連携による登録情報変更申請システム

## 🎯 概要

WOFFフォームを使用した登録情報変更申請システムです。以下の3種類の変更に対応しています：

- 🏠 **住所変更**: 郵便番号・住所の変更
- 📞 **連絡先変更**: 電話番号・緊急連絡先の変更  
- 🏦 **口座変更**: 銀行口座情報の変更

## 🚀 機能

### フロントエンド
- **WOFF統合**: LINE WORKSユーザー情報の自動取得
- **レスポンシブデザイン**: モバイル完全対応
- **直感的なUI**: 変更種類選択 → フォーム入力 → 送信

### バックエンド
- **AWS Lambda**: サーバーレス処理
- **DynamoDB**: 申請データの永続化
- **API Gateway**: RESTful API
- **LINE WORKS Bot**: 自動通知

### 通知機能
- **申請時通知**: 新規申請をチャンネルに通知
- **ステータス更新通知**: 承認・却下時の通知
- **詳細情報**: 申請内容、申請者情報、申請日時

## 📊 システム構成

```
WOFF Form → API Gateway → Lambda → DynamoDB
                                  ↓
                             Bot Notification
```

## 🔧 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript, WOFF SDK
- **バックエンド**: AWS Lambda (Node.js 18.x)
- **データベース**: Amazon DynamoDB
- **API**: Amazon API Gateway
- **通知**: LINE WORKS Bot API
- **認証**: WOFF Profile API
- **ホスティング**: GitHub Pages

## 📋 API エンドポイント

- **ベースURL**: `https://u7t6bk9az0.execute-api.ap-northeast-1.amazonaws.com/prod`
- **申請送信**: `POST /changes`
- **申請履歴**: `GET /changes`
- **ステータス更新**: `PUT /changes/{id}`

## 🎨 デザイン特徴

- **モダンUI**: グラデーション・シャドウ効果
- **アクセシビリティ**: 適切なコントラスト・フォーカス
- **ユーザビリティ**: 段階的な入力フロー
- **レスポンシブ**: モバイルファースト設計

## 🧪 テスト

テストスクリプトで動作確認可能：

```bash
node test.js
```

## 📱 使用方法

### 1. アクセス
[GitHub Pages](https://iwaohig.github.io/profile-change-system/) からアクセス

### 2. 変更種類選択
- 住所変更
- 連絡先変更  
- 口座変更

### 3. 情報入力
- 現在の情報
- 新しい情報
- 変更理由

### 4. 申請送信
確認後、申請を送信

## 🔒 セキュリティ

- **HTTPS通信**: 全データの暗号化
- **CORS設定**: 適切なオリジン制限
- **認証**: WOFF Profile認証
- **権限管理**: IAMによる最小権限

## 🚀 デプロイ

### CloudFormation
```bash
aws cloudformation create-stack \
  --stack-name profile-change-system \
  --template-body file://cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

---

**最終更新**: 2025年7月9日  
**バージョン**: 1.0  
**ステータス**: 本番利用可能