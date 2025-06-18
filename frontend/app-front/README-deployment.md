# デプロイメント設定

## Vercelでの環境変数設定

Vercelにデプロイする際は、以下の環境変数を設定してください：

### 必要な環境変数

```
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api-url.com
```

### 設定方法

1. Vercelダッシュボードでプロジェクトを選択
2. Settings > Environment Variables に移動
3. 上記の環境変数を追加

### ローカル開発用

ローカル開発では以下のファイルを作成してください：

`.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

### 注意点

- `NEXT_PUBLIC_` プレフィックスが必要です（クライアントサイドでアクセスするため）
- 本番環境では実際のバックエンドAPIのURLに変更してください 