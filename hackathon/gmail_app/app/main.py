import os
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Cookie, Response
from fastapi.responses import RedirectResponse
from fastapi import Request
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import traceback
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import json
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from app.db import get_db
from app.auth import (
    get_client_secrets_config,
    get_current_user_id,
    save_credentials_to_db,
    load_credentials_from_db,
    get_openai_api_key,
)
from app.gmail import fetch_and_save_emails, get_gmail_service, get_and_summarize_recent_emails, create_email_query_engine, get_and_translate_english_emails, save_query_result_to_db, preprocess_query, expand_query_with_context

# ロガーを設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPIアプリケーションの作成
app = FastAPI(title="Gmail API Application")

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001", "https://gmail-hackathon-frontend.web.app"],  # フロントエンドのURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydanticモデル
class QueryRequest(BaseModel):
    query: str

# Gmail API スコープ(閲覧のみを許可)
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# 環境設定
IS_LOCAL = os.getenv('ENVIRONMENT', 'local') == 'local'
# リダイレクトURI
# GCPデプロイ時は環境変数から取得、ローカル開発時はデフォルト値を使用
REDIRECT_URI = os.getenv('REDIRECT_URI', 'http://localhost:8000/oauth2callback')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:8001')

# Cookie設定
COOKIE_SECURE = not IS_LOCAL  # ローカル開発時はFalse、GCPデプロイ時はTrue
COOKIE_SAMESITE = "lax"
COOKIE_MAX_AGE = 3600  # 1時間

@app.get("/")
async def root():
    """APIの動作の確認用エンドポイント"""
    return {"message": "Gmail API Application is running"}

@app.get("/login")
async def login(response: Response):
    """OAuth2.0認証フローを開始する"""
    try:
        # クライアントシークレットの取得
        client_config = get_client_secrets_config()
        
        # ユーザーIDの取得（セッションIDとして使用）
        user_id = get_current_user_id()
        
        # OAuth2.0フローの作成
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        # 認証URLの生成
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='select_account',  # アカウント選択画面を強制表示
            state=user_id
        )
        
        # セッションIDをCookieに設定
        response.set_cookie(
            key="session_id",
            value=user_id,
            httponly=True,
            secure=COOKIE_SECURE,  # 環境に応じて設定
            samesite=COOKIE_SAMESITE,
            max_age=COOKIE_MAX_AGE
        )
        
        return RedirectResponse(url=auth_url)
    except Exception as e:
        logger.error(f"ログインエラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/oauth2callback")
async def oauth2callback(
    request: Request,
    response: Response,
    session_id: str = Cookie(None),
    db: Session = Depends(get_db)
):
    # Get state and code from URL parameters
    params = request.query_params
    code = params.get("code")
    state = params.get("state")
    error = params.get("error")
    
    if error:
        logger.error(f"OAuth2.0エラー: {error}")
        raise HTTPException(status_code=400, detail=f"OAuth2.0 error: {error}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing required parameters")
    
    try:
        # クライアントシークレットの取得
        client_config = get_client_secrets_config()
        
        # OAuth2.0フローの作成
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
            state=state
        )
        
        # トークンの取得
        try:
            flow.fetch_token(
                code=code,
                include_granted_scopes='true'
            )
        except Exception as e:
            logger.error(f"トークン取得エラー: {str(e)}")
            # 認証フローを再開
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent',  # 常に同意画面を表示
                state=state
            )
            return RedirectResponse(url=auth_url)
        
        credentials = flow.credentials
        
        # リフレッシュトークンの確認
        if not credentials.refresh_token:
            logger.error("リフレッシュトークンが取得できませんでした")
            # 認証フローを再開
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent',  # 常に同意画面を表示
                state=state
            )
            return RedirectResponse(url=auth_url)
        
        # 認証情報をデータベースに保存
        if not save_credentials_to_db(db, state, credentials):
            raise HTTPException(status_code=500, detail="Failed to save credentials")
        
        # セッションIDをCookieに設定
        response = RedirectResponse(url=f"{FRONTEND_URL}/oauth2callback")
        response.set_cookie(
            key="session_id",
            value=state,
            httponly=True,
            secure=COOKIE_SECURE,  # 環境に応じて設定
            samesite=COOKIE_SAMESITE,
            max_age=COOKIE_MAX_AGE
        )
        
        return response
    except Exception as e:
        logger.error(f"OAuth2.0コールバックエラー: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/emails")
async def get_emails(
    request: Request,
    session_id: str = Cookie(None),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """ユーザーのメールを取得する"""
    try:
        logger.info(f"セッションID: {session_id}")
        
        if not session_id:
            logger.error("セッションIDが設定されていません")
            raise HTTPException(
                status_code=401,
                detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
            )
        
        # 認証情報の読み込み
        credentials = load_credentials_from_db(db, session_id)
        if not credentials:
            logger.error(f"ユーザー {session_id} の認証情報が見つかりません")
            raise HTTPException(
                status_code=401,
                detail="認証情報が無効です。再度 /login から認証を行ってください。"
            )
        
        logger.info(f"ユーザー {session_id} の認証情報を読み込みました")
        
        # メールの取得と保存
        try:
            emails = fetch_and_save_emails(db, session_id, credentials, max_results=20)
            logger.info(f"{len(emails)} 件のメールを取得しました")
            return JSONResponse(content=emails, media_type="application/json; charset=utf-8")
        except Exception as e:
            logger.error(f"メール取得処理でエラーが発生しました: {str(e)}")
            logger.error(f"エラーの詳細: {traceback.format_exc()}")
            raise HTTPException(
                status_code=500,
                detail=f"メールの取得に失敗しました: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"予期せぬエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"予期せぬエラーが発生しました: {str(e)}"
        )

@app.get("/summarize_recent")
async def summarize_recent_emails_endpoint(
    session_id: str = Cookie(None),
    db: Session = Depends(get_db)
):
    """直近10件のメールを要約する"""
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
        )
    
    try:
        # 1. ユーザーの認証情報を読み込む
        credentials = load_credentials_from_db(db, session_id)
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="認証情報が無効です。再度 /login から認証を行ってください。"
            )

        # 2. OpenAI APIキーを取得する
        api_key = get_openai_api_key()

        # 3. Gmailサービスを構築する
        service = get_gmail_service(credentials)

        # 4. 直近のメールを取得して要約する
        start_time = datetime.now()
        summary = get_and_summarize_recent_emails(service, api_key, max_results=10)
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()

        # 5. 要約結果を返す（フロントエンドが期待する形式に合わせる）
        return JSONResponse(
            content={
                "summary": summary,
                "email_count": 10,
                "model_used": "gpt-4o-mini",
                "processing_time": processing_time
            }, 
            media_type="application/json; charset=utf-8"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"メール要約エンドポイントでエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"メールの要約処理中にエラーが発生しました: {str(e)}"
        )

@app.post("/query_emails")
async def query_emails_endpoint(
    request: QueryRequest,
    session_id: str = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    ユーザーのクエリに基づき、高精度RAGを使ってメール内容を検索し、回答を生成する
    """
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
        )

    try:
        # 1. 認証情報の読み込み
        credentials = load_credentials_from_db(db, session_id)
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="認証情報が無効です。再度 /login から認証を行ってください。"
            )

        # 2. OpenAI APIキーの取得
        api_key = get_openai_api_key()

        # 3. Gmailサービスの構築
        service = get_gmail_service(credentials)

        # 4. 高精度メールクエリエンジンの作成
        logger.info(f"高精度RAGクエリエンジンを作成中...")
        query_engine = create_email_query_engine(service, api_key, max_results=30)
        if query_engine is None:
            return JSONResponse(
                content={
                    "answer": "検索対象のメールが見つかりませんでした。",
                    "confidence": "low",
                    "source_count": 0
                }, 
                status_code=404
            )

        # 5. クエリの実行
        logger.info(f"高精度RAGクエリを実行します: '{request.query}'")
        
        # クエリの前処理と拡張
        processed_query = preprocess_query(request.query)
        expanded_query = expand_query_with_context(processed_query)
        
        if expanded_query != request.query:
            logger.info(f"クエリを拡張しました: '{request.query}' -> '{expanded_query}'")
        
        start_time = datetime.now()
        
        response = query_engine.query(expanded_query)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        answer = str(response)
        
        # Empty Responseの場合の代替回答
        if not answer or answer.strip() == "" or answer.strip().lower() == "empty response":
            answer = "該当するメールは見つかりませんでした。検索条件を変更してお試しください。"
            confidence_level = "low"
            confidence_score = 0.0
        else:
            # ソースノードから信頼度を計算
            confidence_score = 0.0
            source_count = 0
            
            if hasattr(response, 'source_nodes') and response.source_nodes:
                for node in response.source_nodes:
                    confidence_score += getattr(node, 'score', 0.0)
                    source_count += 1
                
                confidence_score = confidence_score / len(response.source_nodes) if response.source_nodes else 0.0
            
            # 信頼度の判定
            confidence_level = "high" if confidence_score > 0.7 else "medium" if confidence_score > 0.4 else "low"
        
        logger.info(f"生成された回答: {answer[:100]}... (信頼度: {confidence_level}, 処理時間: {processing_time:.2f}秒)")

        # 6. クエリ結果をDBに保存
        save_query_result_to_db(
            db=db,
            user_id=session_id,
            query=request.query,
            answer=answer,
            source_nodes="",  # 簡潔にするため詳細なソース情報は保存しない
            model_used="gpt-4o-mini",
            email_count=30
        )

        # 7. 簡潔な回答を返す
        return JSONResponse(
            content={
                "query": request.query,
                "answer": answer,
                "confidence": confidence_level,
                "model_used": "gpt-4o-mini",
                "processing_time": processing_time
            },
            media_type="application/json; charset=utf-8"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"高精度RAGクエリエンドポイントでエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"クエリ処理中に予期せぬエラーが発生しました: {str(e)}"
        )

@app.get("/translate_english_emails")
async def translate_english_emails_endpoint(
    session_id: str = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    直近のメールから英語のメールを検出し、GPTで翻訳してDBに保存する
    既存の翻訳も含めて返す
    """
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
        )

    try:
        # 1. 認証情報の読み込み
        credentials = load_credentials_from_db(db, session_id)
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="認証情報が無効です。再度 /login から認証を行ってください。"
            )

        # 2. OpenAI APIキーの取得
        api_key = get_openai_api_key()

        # 3. Gmailサービスの構築
        service = get_gmail_service(credentials)

        # 4. 英語メールの検出・翻訳・保存
        translated_emails = get_and_translate_english_emails(
            db, service, session_id, api_key, max_results=30
        )

        # 5. データベースから既存の翻訳を取得
        from app.models import EmailTranslation
        existing_translations = db.query(EmailTranslation).filter(
            EmailTranslation.user_id == session_id
        ).order_by(EmailTranslation.created_at.desc()).limit(10).all()

        # 6. 新しい翻訳と既存の翻訳を統合
        all_translations = []
        
        # 新しい翻訳を追加
        for email in translated_emails:
            all_translations.append({
                "id": email["email_id"],
                "original_subject": email["original_subject"],
                "translated_subject": email["translated_subject"],
                "original_snippet": email["original_body"][:200] + "..." if len(email["original_body"]) > 200 else email["original_body"],
                "translated_snippet": email["translated_body"][:200] + "..." if len(email["translated_body"]) > 200 else email["translated_body"],
                "sender": email["sender"],
                "date": email["date"]
            })
        
        # 既存の翻訳を追加（新しい翻訳と重複しないもの）
        new_email_ids = {email["email_id"] for email in translated_emails}
        for translation in existing_translations:
            if translation.email_id not in new_email_ids:
                all_translations.append({
                    "id": translation.email_id,
                    "original_subject": translation.original_subject or "",
                    "translated_subject": translation.translated_subject or "",
                    "original_snippet": (translation.original_body[:200] + "...") if translation.original_body and len(translation.original_body) > 200 else (translation.original_body or ""),
                    "translated_snippet": (translation.translated_body[:200] + "...") if translation.translated_body and len(translation.translated_body) > 200 else (translation.translated_body or ""),
                    "sender": translation.sender or "",
                    "date": translation.date or ""
                })

        # 7. 結果を返す
        return JSONResponse(
            content={
                "translations": all_translations,
                "total_processed": len(all_translations),
                "model_used": "gpt-4o-mini"
            },
            media_type="application/json; charset=utf-8"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"英語メール翻訳エンドポイントでエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"英語メール翻訳処理中に予期せぬエラーが発生しました: {str(e)}"
        )

@app.get("/get_translations")
async def get_translations_endpoint(
    session_id: str = Cookie(None),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    データベースから既存の翻訳を取得する
    """
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
        )

    try:
        # データベースから翻訳を取得
        from app.models import EmailTranslation
        translations = db.query(EmailTranslation).filter(
            EmailTranslation.user_id == session_id
        ).order_by(EmailTranslation.created_at.desc()).limit(limit).all()

        # レスポンス用のデータを作成
        translation_data = []
        for translation in translations:
            translation_data.append({
                "id": translation.email_id,
                "original_subject": translation.original_subject or "",
                "translated_subject": translation.translated_subject or "",
                "original_snippet": (translation.original_body[:200] + "...") if translation.original_body and len(translation.original_body) > 200 else (translation.original_body or ""),
                "translated_snippet": (translation.translated_body[:200] + "...") if translation.translated_body and len(translation.translated_body) > 200 else (translation.translated_body or ""),
                "sender": translation.sender or "",
                "date": translation.date or ""
            })

        return JSONResponse(
            content={
                "translations": translation_data,
                "total_processed": len(translation_data),
                "model_used": "gpt-4o-mini"
            },
            media_type="application/json; charset=utf-8"
        )

    except Exception as e:
        logger.error(f"翻訳取得エンドポイントでエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"翻訳取得中に予期せぬエラーが発生しました: {str(e)}"
        )

@app.get("/query_history")
async def get_query_history_endpoint(
    session_id: str = Cookie(None),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    ユーザーの過去のRAGクエリ履歴を取得する
    """
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="認証が必要です。先に /login にアクセスして認証を完了してください。"
        )

    try:
        # EmailQueryResultモデルをインポート
        from app.models import EmailQueryResult
        
        # 過去のクエリ履歴を取得（最新順）
        query_history = db.query(EmailQueryResult).filter(
            EmailQueryResult.user_id == session_id
        ).order_by(EmailQueryResult.created_at.desc()).limit(limit).all()

        # レスポンス用のデータを作成
        history_data = []
        for record in query_history:
            history_data.append({
                "id": record.id,
                "query": record.query_text,
                "answer": record.answer_text,
                "model_used": record.model_used,
                "email_count_indexed": record.email_count_indexed,
                "created_at": record.created_at.isoformat()
            })

        return JSONResponse(
            content={
                "message": f"{len(history_data)} 件のクエリ履歴を取得しました。",
                "query_history": history_data
            },
            media_type="application/json; charset=utf-8"
        )

    except Exception as e:
        logger.error(f"クエリ履歴取得エンドポイントでエラーが発生しました: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"クエリ履歴取得中に予期せぬエラーが発生しました: {str(e)}"
        )

@app.get("/logout")
async def logout(response: Response, session_id: str = Cookie(None), db: Session = Depends(get_db)):
    """ユーザーをログアウトし、セッションをクリアする"""
    try:
        # データベースから認証情報を削除
        if session_id:
            from app.models import UserCredentials
            db.query(UserCredentials).filter(UserCredentials.user_id == session_id).delete()
            db.commit()
            logger.info(f"セッション {session_id} の認証情報をデータベースから削除しました")
        
        # レスポンスを作成
        response = RedirectResponse(url="http://localhost:8001/")
        
        # セッションCookieを削除
        response.delete_cookie(
            key="session_id",
            path="/",
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE
        )
        
        logger.info("ログアウト処理が完了しました")
        return response
        
    except Exception as e:
        logger.error(f"ログアウトエラー: {e}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

#ユーザー → /login → Google認証画面 → /oauth2callback → アプリケーション