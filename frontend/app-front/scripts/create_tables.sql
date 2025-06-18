-- Create database tables for Gmail AI Assistant

-- Users table for storing user authentication info
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email logs table for storing fetched emails
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    gmail_id VARCHAR(255) NOT NULL,
    subject TEXT,
    sender VARCHAR(255),
    snippet TEXT,
    body TEXT,
    date TIMESTAMP,
    labels TEXT[], -- Array of labels
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gmail_id)
);

-- Email query results table for RAG search results
CREATE TABLE IF NOT EXISTS email_query_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    answer TEXT NOT NULL,
    confidence VARCHAR(10) CHECK (confidence IN ('high', 'medium', 'low')),
    model_used VARCHAR(100),
    processing_time DECIMAL(10, 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email translations table for storing translated emails
CREATE TABLE IF NOT EXISTS email_translations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email_log_id INTEGER REFERENCES email_logs(id) ON DELETE CASCADE,
    original_subject TEXT,
    translated_subject TEXT,
    original_snippet TEXT,
    translated_snippet TEXT,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_log_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_query_results_user_id ON email_query_results(user_id);
CREATE INDEX IF NOT EXISTS idx_query_results_created_at ON email_query_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_user_id ON email_translations(user_id);
