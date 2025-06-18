import logging
import base64
import openai
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session
import traceback
from fastapi.responses import JSONResponse
import json

from .models import EmailLog, EmailTranslation, EmailQueryResult
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor

# ロガーを設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 各メール本文を要約のためにこの長さに制限 (文字数)
MAX_EMAIL_BODY_CHARS_FOR_SUMMARY = 1500

def get_gmail_service(credentials: Credentials):
    """Gmail API サービスを構築する"""
    try:
        service = build('gmail', 'v1', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Gmail サービス構築エラー: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise

def get_email_body(message_payload: Dict[str, Any]) -> str:
    """メールのペイロードから本文を再帰的に抽出し、デコードする"""
    body = ""
    if "parts" in message_payload:
        for part in message_payload['parts']:
            if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                return body
            elif part['mimeType'] == 'text/html' and 'data' in part['body']:
                body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
            elif "parts" in part:
                body = get_email_body(part)
                if body:
                    return body
    elif 'data' in message_payload['body']:
        body = base64.urlsafe_b64decode(message_payload['body']['data']).decode('utf-8')
    return body

def get_full_email(service, message_id: str) -> Dict[str, Any]:
    """メールの詳細情報（本文含む）を取得する"""
    try:
        message = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        headers = message['payload']['headers']
        
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
        sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
        date = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
        
        snippet = message.get('snippet', '')
        body = get_email_body(message['payload'])
        
        return {
            'id': message_id,
            'thread_id': message['threadId'],
            'subject': subject,
            'sender': sender,
            'date': date,
            'snippet': snippet,
            'body': body
        }
    except Exception as e:
        logger.error(f"メール詳細取得エラー (ID: {message_id}): {e}")
        return {
            'id': message_id,
            'thread_id': '',
            'subject': '',
            'sender': '',
            'date': '',
            'snippet': '',
            'body': ''
        }

def summarize_text_with_gpt(api_key: str, text: str) -> str:
    """OpenAI APIを使用してテキストを要約する"""
    if not text:
        return "要約するテキストがありません。"

    openai.api_key = api_key
    
    try:
        logger.info(f"OpenAIに送信するテキストの長さ: {len(text)} 文字")
        logger.debug(f"OpenAIに送信するテキストの先頭: {text[:50]}...")
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたは私の優秀なアシスタントです。"},
                {"role": "user", "content": f"""以下のメール内容を読み、私が本日中に対応すべきことを明確にしてください。
以下の項目で、緊急度の高い順に整理して、簡潔な箇条書きで出力してください。

*   **【至急返信】:** 今すぐ返信が必要なメールの相手と要件
*   **【要対応タスク】:** 今日中に対応すべきタスクと期限
*   **【確認事項】:** 目を通しておくべき重要な情報
*   **【その他】:** 特筆すべき事項

---
{text}"""} # ここに結合されたメール本文 (combined_text) が入ります。
            ],
            max_tokens=1000, # 必要に応じてさらに増やすことも検討
            temperature=0.5,
        )
        summary = response.choices[0].message.content.strip()
        
        logger.info(f"OpenAIから受け取った要約テキストの長さ: {len(summary)} 文字")
        logger.debug(f"OpenAIから受け取った要約テキストの先頭: {summary[:50]}...")
        
        return summary
    except Exception as e:
        logger.error(f"OpenAI API呼び出しエラー: {e}")
        raise

def save_email_to_db(db: Session, user_id: str, email_data: Dict[str, Any]) -> bool:
    """メール情報をデータベースに保存する"""
    try:
        email_log = EmailLog(
            user_id=user_id,
            email_id=email_data['id'],
            thread_id=email_data['thread_id'],
            subject=email_data['subject'],
            sender=email_data['sender'],
            date=email_data['date'],
            snippet=email_data['snippet']
        )
        db.add(email_log)
        db.commit()
        logger.info(f"メールを保存しました (ID: {email_data['id']})")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"メール保存エラー: {e}")
        return False

def get_recent_emails(service, max_results: int = 100) -> List[Dict[str, Any]]:
    """最近のメールを取得する"""
    try:
        # メール一覧を取得
        results = service.users().messages().list(
            userId='me',
            maxResults=max_results,
            q='in:inbox'
        ).execute()
        
        messages = results.get('messages', [])
        if not messages:
            logger.info("メールが見つかりませんでした")
            return []
        
        # 各メールの詳細を取得
        email_details = []
        for message in messages:
            details = get_full_email(service, message['id'])
            email_details.append(details)
        
        return email_details
    except Exception as e:
        logger.error(f"メール取得エラー: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise

def fetch_and_save_emails(db: Session, user_id: str, credentials: Credentials, max_results: int = 10) -> List[Dict[str, Any]]:
    """メールを取得してデータベースに保存する"""
    try:
        service = get_gmail_service(credentials)
        emails = get_recent_emails(service, max_results)
        
        # 各メールをデータベースに保存
        for email in emails:
            save_email_to_db(db, user_id, email)
        
        return emails
    except Exception as e:
        logger.error(f"メール取得・保存エラー: {str(e)}")
        logger.error(f"エラーの詳細: {traceback.format_exc()}")
        raise

def get_and_summarize_recent_emails(service, api_key: str, max_results: int = 10) -> str:
    """最近のメールを取得し、内容を結合してGPTで要約する"""
    logger.info(f"直近 {max_results} 件のメールを取得して要約します。")
    
    # 1. 直近のメールを取得する（本文含む）
    emails = get_recent_emails(service, max_results=max_results)
    if not emails:
        return "要約対象のメールが見つかりませんでした。"
    
    # 2. メール内容を一つのテキストにまとめる
    combined_text = ""
    for i, email in enumerate(emails):
        # 本文を特定の長さに制限
        body = email.get('body', '')
        if len(body) > MAX_EMAIL_BODY_CHARS_FOR_SUMMARY:
            body = body[:MAX_EMAIL_BODY_CHARS_FOR_SUMMARY] + "..." # 長すぎる場合は省略
            
        combined_text += f"--- メール {i+1} ---\n"
        combined_text += f"件名: {email.get('subject', 'N/A')}\n"
        combined_text += f"送信者: {email.get('sender', 'N/A')}\n"
        combined_text += f"本文:\n{body}\n\n" # 制限された本文を使用
        
    # デバッグログ：結合されたテキストの長さを確認
    logger.info(f"結合されたメール本文の長さ: {len(combined_text)} 文字")
    logger.debug(f"結合されたメール本文の先頭: {combined_text[:200]}...") # 最初の200文字
    
    # 3. GPTで要約する
    summary = summarize_text_with_gpt(api_key, combined_text)
    
    return summary

def clean_email_text(text: str) -> str:
    """
    メールテキストをクリーニングして検索精度を向上させる
    """
    if not text:
        return ""
    
    # HTMLタグの除去
    text = re.sub(r'<[^>]+>', '', text)
    
    # 過度な改行や空白の正規化
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    
    # メール署名の除去（一般的なパターン）
    text = re.sub(r'\n--\s*\n.*$', '', text, flags=re.DOTALL)
    text = re.sub(r'\nSent from my.*$', '', text, flags=re.DOTALL)
    text = re.sub(r'\n________________________________.*$', '', text, flags=re.DOTALL)
    
    # 引用部分の除去（> で始まる行）
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        if not line.strip().startswith('>'):
            cleaned_lines.append(line)
    text = '\n'.join(cleaned_lines)
    
    return text.strip()

def calculate_email_importance_score(email: Dict[str, Any]) -> float:
    """
    メールの重要度スコアを計算する
    """
    score = 0.0
    subject = email.get('subject', '').lower()
    body = email.get('body', '').lower()
    sender = email.get('sender', '').lower()
    
    # 緊急度キーワード
    urgent_keywords = ['urgent', '緊急', '至急', 'asap', '重要', 'important', 'critical', '危険']
    for keyword in urgent_keywords:
        if keyword in subject:
            score += 3.0
        if keyword in body:
            score += 1.5
    
    # ビジネス重要キーワード
    business_keywords = ['meeting', '会議', 'deadline', '締切', 'project', 'プロジェクト', 
                        'approval', '承認', 'contract', '契約', 'budget', '予算']
    for keyword in business_keywords:
        if keyword in subject:
            score += 2.0
        if keyword in body:
            score += 1.0
    
    # 送信者の重要度（ドメインベース）
    important_domains = ['company.com', 'client.com', 'partner.com']  # 実際の重要ドメインに置き換え
    for domain in important_domains:
        if domain in sender:
            score += 1.5
    
    # 件名の長さ（適度な長さが重要）
    subject_length = len(email.get('subject', ''))
    if 10 <= subject_length <= 50:
        score += 0.5
    
    # 返信や転送の場合は重要度を調整
    if subject.startswith('re:') or subject.startswith('返信:'):
        score += 1.0
    if subject.startswith('fwd:') or subject.startswith('転送:'):
        score += 0.5
    
    return min(score, 10.0)  # 最大10点

def extract_email_metadata(email: Dict[str, Any]) -> Dict[str, Any]:
    """
    メールから詳細なメタデータを抽出する
    """
    subject = email.get('subject', '')
    sender = email.get('sender', '')
    date = email.get('date', '')
    body = email.get('body', '')
    
    # 送信者のドメインを抽出
    sender_domain = ""
    if '@' in sender:
        sender_domain = sender.split('@')[-1].split('>')[0]
    
    # 件名からキーワードを抽出
    subject_keywords = []
    if subject:
        # 一般的なビジネスキーワード
        business_keywords = ['meeting', '会議', 'project', 'プロジェクト', 'deadline', '締切', 
                           'urgent', '緊急', 'important', '重要', 'review', 'レビュー',
                           'approval', '承認', 'report', 'レポート', 'schedule', 'スケジュール']
        for keyword in business_keywords:
            if keyword.lower() in subject.lower():
                subject_keywords.append(keyword)
    
    # 本文の長さカテゴリ
    body_length_category = "short"
    if len(body) > 1000:
        body_length_category = "long"
    elif len(body) > 300:
        body_length_category = "medium"
    
    # 日付の解析
    date_category = "recent"
    try:
        # 簡単な日付解析（より詳細な解析も可能）
        if "2024" in date:
            date_category = "current_year"
        elif "2023" in date:
            date_category = "last_year"
    except:
        pass
    
    # 重要度スコアを計算
    importance_score = calculate_email_importance_score(email)
    
    return {
        "email_id": email.get('id'),
        "subject": subject,
        "sender": sender,
        "sender_domain": sender_domain,
        "date": date,
        "date_category": date_category,
        "subject_keywords": subject_keywords,
        "body_length_category": body_length_category,
        "has_attachments": "attachment" in body.lower() or "添付" in body.lower(),
        "is_reply": subject.lower().startswith('re:') or subject.startswith('返信:'),
        "is_forward": subject.lower().startswith('fwd:') or subject.startswith('転送:'),
        "importance_score": importance_score
    }

def preprocess_query(query: str) -> str:
    """
    ユーザーのクエリを前処理して検索精度を向上させる
    """
    if not query:
        return query
    
    # 日本語の敬語や丁寧語を簡略化
    query = re.sub(r'ください|してください|お願いします', '', query)
    query = re.sub(r'ですか？|でしょうか？', '？', query)
    
    # 一般的な検索キーワードの正規化
    keyword_mapping = {
        '会議': ['meeting', 'ミーティング', '打ち合わせ'],
        'プロジェクト': ['project', 'PJ'],
        '締切': ['deadline', 'due date', '期限'],
        '緊急': ['urgent', '至急', 'ASAP'],
        '重要': ['important', '大切', '大事'],
        '承認': ['approval', 'approve', '許可'],
        'レビュー': ['review', '確認', 'チェック'],
        'スケジュール': ['schedule', '予定', 'calendar']
    }
    
    # キーワードマッピングを適用
    for japanese, alternatives in keyword_mapping.items():
        if japanese in query:
            for alt in alternatives:
                if alt not in query:
                    query += f" {alt}"
    
    return query.strip()

def expand_query_with_context(query: str) -> str:
    """
    クエリにコンテキストを追加して検索精度を向上させる
    """
    # 時間関連のクエリを拡張
    if any(word in query.lower() for word in ['今日', 'today', '本日', '今週', 'this week']):
        query += " 日付 date 最近"
    
    # タスク関連のクエリを拡張
    if any(word in query.lower() for word in ['やること', 'todo', 'タスク', 'task', '対応']):
        query += " 対応 返信 確認 作業"
    
    # 人物関連のクエリを拡張
    if any(word in query.lower() for word in ['誰', 'who', '送信者', 'from']):
        query += " 送信者 from sender"
    
    return query

def create_email_query_engine(service, api_key: str, max_results: int = 30):
    """
    最近のメールを取得してLlamaIndexでインデックス化し、高精度なクエリエンジンを返す
    """
    logger.info(f"直近 {max_results} 件のメールで高精度クエリエンジンを作成します。")

    # 1. LlamaIndexの設定（より高性能なモデルを使用）
    Settings.llm = OpenAI(model="gpt-4o-mini", api_key=api_key, temperature=0.1)
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-large", api_key=api_key)
    
    # チャンクサイズの設定
    Settings.node_parser = SentenceSplitter(
        chunk_size=512,  # 適切なチャンクサイズ
        chunk_overlap=50,  # オーバーラップを追加
        separator=" "
    )

    # 2. メールの取得
    emails = get_recent_emails(service, max_results=max_results)
    if not emails:
        logger.warning("インデックス対象のメールが見つかりませんでした。")
        return None

    # 3. Documentオブジェクトへの変換（改善版）
    documents = []
    for email in emails:
        # メール本文のクリーニング
        cleaned_body = clean_email_text(email.get('body', ''))
        
        # 詳細なメタデータの抽出
        metadata = extract_email_metadata(email)
        
        # より構造化されたテキスト形式
        email_text = f"""件名: {email.get('subject', 'N/A')}
送信者: {email.get('sender', 'N/A')}
日付: {email.get('date', 'N/A')}

本文:
{cleaned_body}"""
        
        documents.append(Document(
            text=email_text,
            metadata=metadata
        ))
    
    logger.info(f"{len(documents)} 件のメールをLlamaIndex Documentに変換しました。")

    # 4. インデックスの作成
    index = VectorStoreIndex.from_documents(documents)
    logger.info("メール文書からVectorStoreIndexを作成しました。")

    # 5. 高精度クエリエンジンの作成
    try:
        # カスタムリトリーバーの設定
        retriever = VectorIndexRetriever(
            index=index,
            similarity_top_k=15,  # より多くの関連文書を取得
        )
        
        # ポストプロセッサーの設定（閾値を大幅に下げる）
        postprocessor = SimilarityPostprocessor(similarity_cutoff=0.1)  # 0.6から0.1に大幅に下げる
        
        # クエリエンジンの作成
        query_engine = RetrieverQueryEngine(
            retriever=retriever,
            node_postprocessors=[postprocessor]
        )
        
        logger.info("高精度クエリエンジンを作成しました。")
        
    except Exception as e:
        logger.warning(f"カスタムクエリエンジンの作成に失敗しました: {e}")
        logger.info("基本的なクエリエンジンを使用します。")
        
        # フォールバック: 最も基本的なクエリエンジンを使用
        try:
            query_engine = index.as_query_engine(similarity_top_k=15)
        except Exception as e2:
            logger.warning(f"基本的なクエリエンジンの作成も失敗しました: {e2}")
            # 最終フォールバック: パラメータなしで作成
            query_engine = index.as_query_engine()
    
    return query_engine

def is_english_email(subject: str, body: str) -> bool:
    """
    メールが英語かどうかを判定する
    簡単なヒューリスティック: 英語の文字が多い場合は英語と判定
    """
    combined_text = f"{subject} {body}"
    if not combined_text.strip():
        return False
    
    # 英語の文字（アルファベット）の割合を計算
    english_chars = len(re.findall(r'[a-zA-Z]', combined_text))
    total_chars = len(combined_text.replace(' ', '').replace('\n', ''))
    
    if total_chars == 0:
        return False
    
    english_ratio = english_chars / total_chars
    # 英語の文字が50%以上の場合は英語と判定
    return english_ratio > 0.5

def translate_email_with_gpt(api_key: str, subject: str, body: str) -> Dict[str, str]:
    """
    GPTを使用してメールの件名と本文を日本語に翻訳する
    """
    openai.api_key = api_key
    
    try:
        logger.info(f"メールを翻訳します - 件名: {subject[:50]}...")
        
        # 件名の翻訳
        subject_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたは優秀な翻訳者です。英語のメール件名を自然で読みやすい日本語に翻訳してください。"},
                {"role": "user", "content": f"以下の英語のメール件名を日本語に翻訳してください:\n\n{subject}"}
            ],
            max_tokens=200,
            temperature=0.3,
        )
        translated_subject = subject_response.choices[0].message.content.strip()
        
        # 本文の翻訳
        body_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたは優秀な翻訳者です。英語のメール本文を自然で読みやすい日本語に翻訳してください。ビジネスメールの場合は適切な敬語を使用してください。"},
                {"role": "user", "content": f"以下の英語のメール本文を日本語に翻訳してください:\n\n{body}"}
            ],
            max_tokens=2000,
            temperature=0.3,
        )
        translated_body = body_response.choices[0].message.content.strip()
        
        logger.info("メールの翻訳が完了しました")
        
        return {
            "translated_subject": translated_subject,
            "translated_body": translated_body
        }
        
    except Exception as e:
        logger.error(f"メール翻訳エラー: {e}")
        raise

def save_translation_to_db(db: Session, user_id: str, email_data: Dict[str, Any], translation_data: Dict[str, str]) -> bool:
    """
    翻訳結果をデータベースに保存する
    """
    try:
        translation = EmailTranslation(
            user_id=user_id,
            email_id=email_data['id'],
            original_subject=email_data['subject'],
            translated_subject=translation_data['translated_subject'],
            original_body=email_data['body'],
            translated_body=translation_data['translated_body'],
            sender=email_data['sender'],
            date=email_data['date'],
            translation_model="gpt-4o-mini"
        )
        db.add(translation)
        db.commit()
        logger.info(f"翻訳結果を保存しました (Email ID: {email_data['id']})")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"翻訳結果保存エラー: {e}")
        return False

def get_and_translate_english_emails(db: Session, service, user_id: str, api_key: str, max_results: int = 20, max_translations: int = 4) -> List[Dict[str, Any]]:
    """
    英語のメールを取得し、翻訳してDBに保存する（最大翻訳数を制限）
    """
    logger.info(f"直近 {max_results} 件のメールから英語メールを検出し、最大 {max_translations} 件を翻訳します。")
    
    # 1. 最近のメールを取得
    emails = get_recent_emails(service, max_results=max_results)
    if not emails:
        logger.info("取得対象のメールが見つかりませんでした。")
        return []
    
    # 2. 英語のメールを抽出
    english_emails = []
    for email in emails:
        subject = email.get('subject', '')
        body = email.get('body', '')
        
        if is_english_email(subject, body):
            english_emails.append(email)
            logger.info(f"英語メールを検出: {subject[:50]}...")
    
    if not english_emails:
        logger.info("英語のメールが見つかりませんでした。")
        return []
    
    logger.info(f"{len(english_emails)} 件の英語メールを検出しました。")
    
    # 3. 翻訳対象を最大数に制限
    emails_to_translate = english_emails[:max_translations]
    if len(english_emails) > max_translations:
        logger.info(f"翻訳対象を最新の {max_translations} 件に制限しました。")
    
    # 4. 各英語メールを翻訳してDBに保存
    translated_emails = []
    for i, email in enumerate(emails_to_translate, 1):
        try:
            logger.info(f"翻訳中 ({i}/{len(emails_to_translate)}): {email.get('subject', '')[:50]}...")
            
            # 翻訳実行
            translation_result = translate_email_with_gpt(
                api_key, 
                email.get('subject', ''), 
                email.get('body', '')
            )
            
            # DBに保存
            if save_translation_to_db(db, user_id, email, translation_result):
                # レスポンス用のデータを作成
                translated_email = {
                    "email_id": email.get('id'),
                    "original_subject": email.get('subject'),
                    "translated_subject": translation_result['translated_subject'],
                    "original_body": email.get('body')[:500] + "..." if len(email.get('body', '')) > 500 else email.get('body'),  # 長い場合は省略
                    "translated_body": translation_result['translated_body'],
                    "sender": email.get('sender'),
                    "date": email.get('date')
                }
                translated_emails.append(translated_email)
                
        except Exception as e:
            logger.error(f"メール翻訳処理でエラーが発生しました (ID: {email.get('id')}): {e}")
            continue
    
    logger.info(f"{len(translated_emails)} 件のメールの翻訳が完了しました。")
    return translated_emails

def save_query_result_to_db(db: Session, user_id: str, query: str, answer: str, source_nodes: str, model_used: str = "gpt-4-turbo-preview", email_count: int = 30) -> bool:
    """
    RAGクエリの結果をデータベースに保存する
    """
    try:
        query_result = EmailQueryResult(
            user_id=user_id,
            query_text=query,
            answer_text=answer,
            source_nodes=source_nodes,
            model_used=model_used,
            email_count_indexed=str(email_count)
        )
        db.add(query_result)
        db.commit()
        logger.info(f"RAGクエリ結果を保存しました (Query: {query[:50]}...)")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"RAGクエリ結果保存エラー: {e}")
        return False 