from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
import time
from google.cloud.sql.connector import Connector, IPTypes
import pymysql

# ロガーを設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 環境設定
IS_LOCAL = os.getenv('ENVIRONMENT', 'local') == 'local'

# データベース接続設定
DB_USER = os.getenv("DB_USER", "mysqluser")
DB_PASS = os.getenv("DB_PASS", "mysqlpassword")
DB_NAME = os.getenv("DB_NAME", "encrypted_token")
DB_HOST = os.getenv("DB_HOST", "mysql-container")
DB_PORT = os.getenv("DB_PORT", "3306")
CLOUD_SQL_CONNECTION_NAME = os.getenv("INSTANCE_CONNECTION_NAME", "pdd-ml-dev01:us-central1:uttc-ai07-hackathon-tutorial-db")

def wait_for_db_connection(engine, max_retries=30, delay=2):
    """データベース接続を待機する関数"""
    for attempt in range(max_retries):
        try:
            # 接続テスト
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            logger.info(f"データベース接続成功 (試行回数: {attempt + 1})")
            return True
        except Exception as e:
            logger.warning(f"データベース接続試行 {attempt + 1}/{max_retries} 失敗: {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)
            else:
                logger.error("データベース接続の最大試行回数に達しました")
                raise
    return False

def connect_with_connector():
    """Cloud SQL Python Connectorを使用してMySQLインスタンスに接続"""
    logger.info("Cloud SQL Connectorでデータベースに接続...")
    ip_type = IPTypes.PRIVATE if os.getenv("PRIVATE_IP") else IPTypes.PUBLIC
    connector = Connector()
    def getconn():
        conn = connector.connect(
            CLOUD_SQL_CONNECTION_NAME,
            "pymysql",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME,
            ip_type=ip_type,
        )
        return conn
    logger.info(f"Cloud SQLインスタンス '{CLOUD_SQL_CONNECTION_NAME}' への接続設定完了")
    return create_engine(
        "mysql+pymysql://",
        creator=getconn,
    )

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemyのデータベース接続設定
if not IS_LOCAL: # GCP環境での接続
    try:
        engine = connect_with_connector()
        wait_for_db_connection(engine)
        logger.info("Cloud SQL Connectorでデータベース接続完了")
    except Exception as e:
        logger.error(f"GCP環境でのCloud SQL Connector接続失敗: {e}")
        # GCP環境では接続失敗した場合、アプリケーションを起動させない
        raise RuntimeError("GCP環境でのデータベース接続に失敗しました。") from e
else: # ローカル環境での直接接続
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    engine = create_engine(DATABASE_URL)
    wait_for_db_connection(engine)
    logger.info("ローカル環境で直接データベース接続完了")

# セッションローカル作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Baseクラス（モデルクラスがこれを継承します）
Base = declarative_base()

# データベース接続セッションを取得するための関数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
