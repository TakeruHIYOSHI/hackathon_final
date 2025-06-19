import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('=== /api/establish_session デバッグ開始 ===');
  
  try {
    // セッションIDを生成（実際のOAuth認証で取得されるものをシミュレート）
    const sessionId = 'debug_session_' + Math.random().toString(36).substring(2, 15);
    
    console.log('生成されたセッションID:', sessionId);
    
    // レスポンスを作成
    const response = NextResponse.json({
      message: 'Session established successfully',
      session_id: sessionId
    });
    
    // 🎯 重要: Cookieを設定
    const cookieValue = `session_id=${sessionId}; Path=/; Secure; SameSite=None; Max-Age=3600`;
    console.log('設定するCookie:', cookieValue);
    
    response.headers.set('Set-Cookie', cookieValue);
    
    console.log('=== /api/establish_session デバッグ終了 ===');
    return response;
    
  } catch (error) {
    console.error('API Route エラー:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 