import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('=== /api/emails デバッグ開始 ===');
  
  // リクエストヘッダーの詳細ログ
  console.log('リクエストヘッダー:');
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('cookie') || key.toLowerCase().includes('origin') || key.toLowerCase().includes('referer')) {
      console.log(`  ${key}: ${value}`);
    }
  });
  
  const cookies = request.headers.get('cookie');
  console.log('フロントエンドから受信したCookie:', cookies);
  
  try {
    // バックエンドへのリクエスト準備
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'NextJS-API-Route',
    };
    
    // Cookieを転送
    if (cookies) {
      backendHeaders['Cookie'] = cookies;
      console.log('バックエンドに転送するCookie:', cookies);
    } else {
      console.log('⚠️ 転送するCookieがありません');
    }
    
    // Origin/Refererを転送
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    if (origin) backendHeaders['Origin'] = origin;
    if (referer) backendHeaders['Referer'] = referer;
    
    console.log('バックエンドに送信するヘッダー:', backendHeaders);
    
    const response = await fetch('https://gmail-hackathon-633399924693.us-central1.run.app/emails', {
      method: 'GET',
      headers: backendHeaders,
      credentials: 'include',
    });
    
    console.log('バックエンドレスポンス ステータス:', response.status);
    console.log('バックエンドレスポンス ヘッダー:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('バックエンドエラーレスポンス:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch emails', details: errorText, status: response.status },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('バックエンドから受信したデータ:', data ? 'データあり' : 'データなし');
    
    // Set-Cookieヘッダーを転送
    const nextResponse = NextResponse.json(data);
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log('Set-Cookieヘッダーを転送:', setCookieHeader);
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    
    console.log('=== /api/emails デバッグ終了 ===');
    return nextResponse;
    
  } catch (error) {
    console.error('API Route エラー:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 