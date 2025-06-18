from sqlalchemy import Column, String, DateTime, Boolean, Text
from datetime import datetime
import uuid
import logging
import time
from app.db import Base, engine

# ロガーを設定
logger = logging.getLogger(__name__)

class UserToken(Base):
    __tablename__ = "user_tokens"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False)
    encrypted_token_info = Column(String(1024), nullable=False)
    encrypted_refresh_token = Column(String(1024), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False)
    email_id = Column(String(255), nullable=False)
    thread_id = Column(String(255), nullable=False)
    subject = Column(String(255))
    sender = Column(String(255))
    date = Column(String(255))
    snippet = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailTranslation(Base):
    __tablename__ = "email_translations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False)
    email_id = Column(String(255), nullable=False)
    original_subject = Column(String(500))
    translated_subject = Column(String(500))
    original_body = Column(Text)
    translated_body = Column(Text)
    sender = Column(String(255))
    date = Column(String(255))
    translation_model = Column(String(100), default="gpt-4o-mini")
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailQueryResult(Base):
    __tablename__ = "email_query_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False)
    query_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=False)
    source_nodes = Column(Text)  # JSON形式で保存
    model_used = Column(String(100), default="gpt-4o-mini")
    email_count_indexed = Column(String(10))  # インデックス化されたメール件数
    created_at = Column(DateTime, default=datetime.utcnow)

def create_tables_with_retry(max_retries=10, delay=3):
    """リトライ機能付きでデータベーステーブルを作成"""
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            logger.info(f"データベーステーブル作成成功 (試行回数: {attempt + 1})")
            return True
        except Exception as e:
            logger.warning(f"テーブル作成試行 {attempt + 1}/{max_retries} 失敗: {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)
            else:
                logger.error("テーブル作成の最大試行回数に達しました")
                raise
    return False

# データベーステーブルの作成（リトライ機能付き）
try:
    create_tables_with_retry()
except Exception as e:
    logger.error(f"テーブル作成に失敗しました: {e}")
    # アプリケーション起動時にテーブル作成に失敗した場合でも、
    # 後でリトライできるように例外を再発生させない
    pass
