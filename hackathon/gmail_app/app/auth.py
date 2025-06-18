import os
import json
import base64
import logging
from typing import Optional
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from fastapi import HTTPException
from google.oauth2.credentials import Credentials
from google.cloud import secretmanager
from google.api_core import exceptions as google_api_exceptions
from sqlalchemy.orm import Session
import traceback

from .models import UserToken

# ロガーを設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 環境設定 ---
# <ここからデバッグログ追加>
raw_env_value = os.getenv('ENVIRONMENT')
defaulted_env_value = os.getenv('ENVIRONMENT', 'local') # 既存の IS_LOCAL で使っているもの

logger.info(f"--- デバッグログ開始 (auth.py) ---")
logger.info(f"デバッグログ: os.getenv('ENVIRONMENT') の直接の値: '{raw_env_value}'")
logger.info(f"デバッグログ: os.getenv('ENVIRONMENT', 'local') の値 (IS_LOCAL判定前): '{defaulted_env_value}'")

IS_LOCAL = defaulted_env_value.lower() == 'local' # 既存の IS_LOCAL 定義ロジック

logger.info(f"デバッグログ: IS_LOCAL の判定結果: {IS_LOCAL}")
logger.info(f"--- デバッグログ終了 (auth.py) ---")
# <ここまでデバッグログ追加>

# Secret Manager 設定
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "term7-takeru-hiyoshi")
CLIENT_SECRET_NAME = os.getenv('SECRET_NAME', 'oauth-client-credentials')  # SECRET_NAME を優先的に使用
ENCRYPTION_KEY_SECRET_NAME = os.getenv('ENCRYPTION_KEY_SECRET_NAME', 'token-encryption-key')
OPENAI_API_KEY_SECRET_NAME = os.getenv('OPENAI_API_KEY_SECRET_NAME', 'openai-api-key')
SECRET_VERSION = "latest"

# ローカル開発用設定
LOCAL_CLIENT_SECRET_PATH = os.getenv("CLIENT_SECRET_PATH", "/app/json/client_secret.json")
LOCAL_ENCRYPTION_KEY = os.getenv("LOCAL_ENCRYPTION_KEY")
LOCAL_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def access_secret_version(secret_name: str, version: str = "latest") -> Optional[str]:
    """Google Secret Manager から指定されたシークレットのバージョンを取得します。
    
    Args:
        secret_name: 取得するシークレットの名前
        version: シークレットのバージョン（デフォルト: "latest"）
        
    Returns:
        str: シークレットの値
        
    Raises:
        RuntimeError: シークレットの取得に失敗した場合
    """
    # ローカル開発環境ではSecret Managerを使用しない
    if IS_LOCAL:
        logger.info("ローカル開発環境ではSecret Managerを使用しません")
        return None

    if not GCP_PROJECT_ID or not secret_name:
        raise RuntimeError(f"GCP_PROJECT_ID ({GCP_PROJECT_ID}) と対象のシークレット名 ({secret_name}) が必要です。")

    try:
        client = secretmanager.SecretManagerServiceClient()
        secret_version_name = f"projects/{GCP_PROJECT_ID}/secrets/{secret_name}/versions/{version}"
        response = client.access_secret_version(request={"name": secret_version_name})
        payload = response.payload.data.decode("UTF-8")
        logger.info(f"シークレット '{secret_name}' を取得しました")
        return payload
    except google_api_exceptions.NotFound:
        raise RuntimeError(f"シークレット '{secret_name}' またはバージョン '{version}' が見つかりません。")
    except google_api_exceptions.PermissionDenied:
        raise RuntimeError(f"シークレット '{secret_name}' へのアクセス権限がありません。")
    except Exception as e:
        raise RuntimeError(f"Secret Manager アクセスエラーが発生しました: {e}")

def get_openai_api_key() -> str:
    """OpenAI APIキーを取得します。
    
    環境変数またはSecret Managerからキーを取得し、取得できない場合は
    RuntimeErrorを発生させます。
    """
    # ローカル開発環境では環境変数から取得
    if IS_LOCAL:
        if not LOCAL_OPENAI_API_KEY:
            raise RuntimeError("ローカル環境で OPENAI_API_KEY が設定されていません。")
        return LOCAL_OPENAI_API_KEY

    # GCP環境ではSecret Managerから取得
    if not OPENAI_API_KEY_SECRET_NAME:
        raise RuntimeError("GCP環境で OPENAI_API_KEY_SECRET_NAME が設定されていません。")
    
    key = access_secret_version(OPENAI_API_KEY_SECRET_NAME, SECRET_VERSION)
    
    if not key:
        raise RuntimeError(
            f"Secret Manager から OpenAI APIキー '{OPENAI_API_KEY_SECRET_NAME}' を"
            "取得できませんでした。"
        )
    
    return key.strip()

def get_encryption_key() -> str:
    """暗号化キーを取得します。
    
    環境変数またはSecret Managerからキーを取得し、取得できない場合は
    RuntimeErrorを発生させます。
    """
    # ローカル開発環境では環境変数から取得
    if IS_LOCAL:
        if not LOCAL_ENCRYPTION_KEY:
            raise RuntimeError(
                "ローカル環境で LOCAL_ENCRYPTION_KEY が設定されていません。"
                "以下のコマンドでキーを生成し、環境変数に設定してください："
                "\npython -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            )
        return LOCAL_ENCRYPTION_KEY

    # GCP環境ではSecret Managerから取得
    if not ENCRYPTION_KEY_SECRET_NAME:
        raise RuntimeError("ENCRYPTION_KEY_SECRET_NAME が設定されていません。")
    
    key = access_secret_version(ENCRYPTION_KEY_SECRET_NAME, SECRET_VERSION)
    
    if not key:
        raise RuntimeError(
            f"Secret Manager から暗号化キー '{ENCRYPTION_KEY_SECRET_NAME}' を"
            "取得できませんでした。Secret Managerにキーが正しく設定されて"
            "いることを確認してください。"
        )
    
    return key.strip()

# 暗号化キーの初期化
try:
    ENCRYPTION_KEY = get_encryption_key()
except Exception as e:
    logger.error(f"暗号化キーの取得に失敗しました: {e}")
    raise RuntimeError("アプリケーションの起動を中止します。") from e

# 暗号化用のFernetインスタンスを作成
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

def get_client_secrets_config():
    """クライアントシークレットを取得します。
    
    ローカル環境: ローカルファイルから取得
    GCP環境: Secret Managerから取得（フォールバックなし）
    """
    # ローカル開発環境ではローカルファイルから取得
    if IS_LOCAL:
        try:
            with open(LOCAL_CLIENT_SECRET_PATH, "r") as f:
                config = json.load(f)
                if 'web' not in config and 'installed' not in config:
                    raise ValueError("クライアントシークレットの形式が無効です。'web' または 'installed' キーが必要です。")
                logger.info(f"ローカルファイル {LOCAL_CLIENT_SECRET_PATH} からクライアントシークレットを取得しました")
                return config
        except FileNotFoundError:
            raise RuntimeError(f"クライアントシークレットファイルが見つかりません: {LOCAL_CLIENT_SECRET_PATH}")
        except json.JSONDecodeError:
            raise RuntimeError(f"クライアントシークレットファイルの形式が無効です: {LOCAL_CLIENT_SECRET_PATH}")
        except Exception as e:
            raise RuntimeError(f"クライアントシークレットファイルの読み込みに失敗: {e}")

    # GCP環境ではSecret Managerから取得
    if not GCP_PROJECT_ID:
        raise RuntimeError("GCP環境で GCP_PROJECT_ID が設定されていません。")
    if not CLIENT_SECRET_NAME:
        raise RuntimeError("GCP環境で SECRET_NAME または CLIENT_SECRET_NAME が設定されていません。")

    try:
        payload = access_secret_version(CLIENT_SECRET_NAME, SECRET_VERSION)
        if not payload:
            raise RuntimeError(
                f"Secret Manager からクライアントシークレット '{CLIENT_SECRET_NAME}' を"
                "取得できませんでした。Secret Managerに設定が存在することを確認してください。"
            )
        
        config = json.loads(payload)
        if 'web' not in config and 'installed' not in config:
            raise RuntimeError("クライアントシークレットの形式が無効です。'web' または 'installed' キーが必要です。")
        return config
        
    except json.JSONDecodeError:
        raise RuntimeError("Secret Managerから取得したクライアントシークレットの形式が無効です。")
    except Exception as e:
        raise RuntimeError(f"クライアントシークレットの取得に失敗: {e}")

def encrypt_token(token_data: str) -> str:
    """トークンデータを暗号化する"""
    try:
        encrypted_data = cipher_suite.encrypt(token_data.encode())
        return encrypted_data.decode()
    except Exception as e:
        logger.error(f"トークン暗号化エラー: {e}")
        raise HTTPException(status_code=500, detail="トークンの暗号化に失敗しました")

def decrypt_token(encrypted_data: str) -> str:
    """暗号化されたトークンデータを復号する"""
    try:
        decrypted_data = cipher_suite.decrypt(encrypted_data.encode())
        return decrypted_data.decode()
    except Exception as e:
        logger.error(f"トークン復号エラー: {e}")
        raise HTTPException(status_code=500, detail="トークンの復号に失敗しました")

def get_current_user_id(session_id: Optional[str] = None) -> str:
    """現在のユーザーIDを特定する。"""
    if not session_id:
        session_id = base64.urlsafe_b64encode(os.urandom(16)).decode('utf-8')
        logger.info(f"新しいセッションID（ユーザーID）を生成しました: {session_id}")
    else:
        logger.info(f"既存のセッションIDを使用します: {session_id}")
    return session_id

def save_credentials_to_db(db: Session, user_id: str, creds: Credentials) -> bool:
    """認証情報をデータベースに保存する"""
    try:
        creds_json = creds.to_json()
        # creds.expiryはUTCのdatetimeオブジェクトとして提供される
        expires_at = creds.expiry if creds.expiry else datetime.utcnow() + timedelta(seconds=3600)
        scopes_str = ",".join(creds.scopes) if isinstance(creds.scopes, list) else creds.scopes
        encrypted_token_info = encrypt_token(creds_json)
        encrypted_refresh_token = None
        if creds.refresh_token:
            encrypted_refresh_token = encrypt_token(creds.refresh_token)
        
        existing_token = db.query(UserToken).filter(UserToken.user_id == user_id).first()
        
        if existing_token:
            existing_token.encrypted_token_info = encrypted_token_info
            if encrypted_refresh_token:
                existing_token.encrypted_refresh_token = encrypted_refresh_token
            existing_token.expires_at = expires_at
            existing_token.scopes = scopes_str
            existing_token.updated_at = datetime.utcnow()
            existing_token.is_active = True
            db.commit()
            logger.info(f"ユーザー {user_id} の認証情報を更新しました")
        else:
            new_token = UserToken(
                user_id=user_id,
                encrypted_refresh_token=encrypted_refresh_token,
                encrypted_token_info=encrypted_token_info,
                expires_at=expires_at,
                scopes=scopes_str,
                is_active=True
            )
            db.add(new_token)
            db.commit()
            logger.info(f"ユーザー {user_id} の認証情報を新規作成しました")
        
        return True
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        logger.error(f"認証情報保存エラー: {e}")
        return False

def load_credentials_from_db(db: Session, user_id: str) -> Optional[Credentials]:
    """データベースから指定されたユーザーの認証情報を読み込む"""
    try:
        user_token = db.query(UserToken).filter(UserToken.user_id == user_id, UserToken.is_active).first()
        if not user_token:
            logger.warning(f"ユーザー {user_id} の認証情報が見つかりません")
            return None
        
        decrypted_token_info = decrypt_token(user_token.encrypted_token_info)
        token_info = json.loads(decrypted_token_info)
        
        client_config_outer = get_client_secrets_config()
        client_config = client_config_outer.get('web') or client_config_outer.get('installed')
        if not client_config:
            raise ValueError("有効なクライアント設定が見つかりません")
        
        try:
            credentials = Credentials.from_authorized_user_info(token_info)
            logger.info(f"ユーザー {user_id} の認証情報を読み込みました")
            return credentials
        except Exception as inner_e:
            logger.error(f"認証情報の復元エラー: {inner_e}")
            
            required_keys = ["refresh_token", "token_uri"]
            missing_keys = [key for key in required_keys if key not in token_info]
            if missing_keys:
                logger.warning(f"トークン情報に必要なキーが不足: {missing_keys}")
                
            merged_info = {
                **token_info,
                "client_id": client_config.get("client_id"),
                "client_secret": client_config.get("client_secret"),
                "scopes": token_info.get("scopes", ["https://www.googleapis.com/auth/gmail.readonly"])
            }
            
            if isinstance(merged_info.get("scopes"), str):
                merged_info["scopes"] = merged_info["scopes"].split()
            
            try:
                credentials = Credentials.from_authorized_user_info(merged_info)
                logger.info(f"ユーザー {user_id} の認証情報を再構築しました")
                return credentials
            except Exception as retry_e:
                logger.error(f"認証情報の復元再試行に失敗: {retry_e}")
                return None
    
    except ValueError as e:
        logger.error(f"値エラー: {e}")
        return None
    except Exception as e:
        logger.error(f"認証情報の読み込みエラー: {e}")
        return None 