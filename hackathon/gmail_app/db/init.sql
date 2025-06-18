-- ユーザートークンテーブルの作成
CREATE TABLE IF NOT EXISTS user_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    encrypted_token_info TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT,
    is_active BOOLEAN DEFAULT true
);

-- メールログテーブルの作成
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    subject TEXT,
    sender TEXT,
    date TIMESTAMP WITH TIME ZONE,
    snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_tokens(user_id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_thread_id ON email_logs(thread_id); 