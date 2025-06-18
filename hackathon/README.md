# Gmail AI アシスタント

AIを活用したGmailメール管理・分析プラットフォーム

## 🚀 機能

- **Gmail統合**: OAuth2.0による安全なGmailアカウント連携
- **AI要約**: 最新10件のメールをAIが自動要約
- **RAG検索**: 自然言語でメールを検索し、AIが回答を生成
- **翻訳機能**: 英語メールを日本語に自動翻訳（最大4件）
- **検索履歴**: 過去の検索クエリと結果を保存・確認

## 🏗️ アーキテクチャ

- **フロントエンド**: Next.js (React) - ポート8001
- **バックエンド**: FastAPI (Python) - ポート8000
- **データベース**: MySQL - ポート3306
- **管理ツール**: Adminer - ポート8080

## 📋 前提条件

- Docker & Docker Compose
- Node.js (18以上)
- npm
- Google Cloud Console プロジェクト（Gmail API有効化済み）

## ⚙️ セットアップ

### 1. 環境変数の設定

`hackathon/.env` ファイルを作成し、以下の環境変数を設定してください：

```bash
# Google OAuth2.0 設定
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI API設定
OPENAI_API_KEY=your_openai_api_key

# その他の設定
ENVIRONMENT=local
REDIRECT_URI=http://localhost:8000/oauth2callback
```

### 2. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Gmail APIを有効化
3. OAuth2.0認証情報を作成
4. 承認済みリダイレクトURIに `http://localhost:8000/oauth2callback` を追加

### 3. アプリケーションの起動

```bash
# アプリケーションを起動
./start_app.sh
```

### 4. アプリケーションの停止

```bash
# アプリケーションを停止
./stop_app.sh
```

## 🌐 アクセスURL

- **メインアプリケーション**: http://localhost:8001
- **バックエンドAPI**: http://localhost:8000
- **データベース管理**: http://localhost:8080 (Adminer)

## 📱 使用方法

### 1. 認証
1. http://localhost:8001 にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Googleアカウントで認証

### 2. メール管理
- **メール一覧**: 認証後、自動的にGmailからメールを取得
- **更新**: 「更新」ボタンで最新メールを取得

### 3. AI機能
- **要約**: 「メール要約」で最新10件のメールをAI要約
- **検索**: 「メール検索」で自然言語による検索・質問応答
- **翻訳**: 「翻訳機能」で英語メールを日本語に翻訳
- **履歴**: 「検索履歴」で過去の検索結果を確認

## 🛠️ 開発

### フロントエンド開発

```bash
cd frontend/gmail-app
npm install
npm run dev
```

### バックエンド開発

```bash
cd hackathon
docker-compose up -d
```

## 📊 データベース管理

Adminer (http://localhost:8080) でデータベースにアクセス：

- **システム**: MySQL
- **サーバー**: mysql-container
- **ユーザー**: mysqluser
- **パスワード**: mysqlpassword
- **データベース**: encrypted_token

## 🔧 トラブルシューティング

### ポート競合エラー
```bash
# 使用中のポートを確認
lsof -i :8000
lsof -i :8001

# プロセスを停止
./stop_app.sh
```

### Docker関連エラー
```bash
# Dockerコンテナを完全にリセット
cd hackathon
docker-compose down -v
docker-compose up -d
```

### 認証エラー
1. Google Cloud Consoleで認証情報を確認
2. リダイレクトURIが正しく設定されているか確認
3. `.env`ファイルの設定を確認

## 📝 API エンドポイント

- `GET /` - ヘルスチェック
- `GET /login` - OAuth2.0認証開始
- `GET /oauth2callback` - OAuth2.0コールバック
- `GET /emails` - メール一覧取得
- `GET /summarize_recent` - メール要約
- `POST /query_emails` - RAG検索
- `GET /translate_english_emails` - 英語メール翻訳
- `GET /query_history` - 検索履歴取得

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。