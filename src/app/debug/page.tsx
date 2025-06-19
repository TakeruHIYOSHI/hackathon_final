'use client';

import React, { useState } from 'react';

export default function DebugPage() {
  const [establishResult, setEstablishResult] = useState<string>('');
  const [emailResult, setEmailResult] = useState<string>('');
  const [directResult, setDirectResult] = useState<string>('');
  const [cookieInfo, setCookieInfo] = useState<string>('');

  const establishSession = async () => {
    try {
      const response = await fetch('/api/establish_session', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      setEstablishResult(`✅ セッション確立成功: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setEstablishResult(`❌ セッション確立失敗: ${error}`);
    }
  };

  const testApiRoute = async () => {
    try {
      console.log('=== フロントエンド: API Route テスト開始 ===');
      console.log('現在のCookie:', document.cookie);
      
      const response = await fetch('/api/emails', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API Route レスポンス ステータス:', response.status);
      console.log('API Route レスポンス ヘッダー:');
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
      const data = await response.json();
      setEmailResult(`📧 メールテスト結果:\nStatus: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setEmailResult(`❌ メールテスト失敗: ${error}`);
    }
  };

  const testDirectBackend = async () => {
    try {
      console.log('=== フロントエンド: 直接バックエンドテスト開始 ===');
      console.log('現在のCookie:', document.cookie);
      
      const response = await fetch('https://gmail-hackathon-633399924693.us-central1.run.app/emails', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('直接バックエンド レスポンス ステータス:', response.status);
      const data = await response.json();
      setDirectResult(`🔗 直接バックエンドテスト結果:\nStatus: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setDirectResult(`❌ 直接バックエンドテスト失敗: ${error}`);
    }
  };

  const checkCookies = () => {
    const cookies = document.cookie;
    const cookieArray = cookies.split(';').map(c => c.trim()).filter(c => c);
    
    let info = `🍪 Cookie情報:\n`;
    info += `Raw Cookie String: "${cookies}"\n\n`;
    
    if (cookieArray.length === 0) {
      info += '❌ Cookieが設定されていません\n';
    } else {
      info += `📊 Cookie数: ${cookieArray.length}\n\n`;
      cookieArray.forEach((cookie, index) => {
        const [name, value] = cookie.split('=');
        info += `${index + 1}. ${name} = ${value || '(値なし)'}\n`;
      });
    }
    
    // localStorage/sessionStorageもチェック
    info += `\n📦 LocalStorage項目数: ${localStorage.length}\n`;
    info += `📦 SessionStorage項目数: ${sessionStorage.length}\n`;
    
    setCookieInfo(info);
  };

  const clearAllData = () => {
    // Cookieをクリア
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Storage をクリア
    localStorage.clear();
    sessionStorage.clear();
    
    setCookieInfo('🧹 全データをクリアしました');
    setEstablishResult('');
    setEmailResult('');
    setDirectResult('');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🛠️ Cookie認証デバッグツール</h1>
        
        <div className="grid gap-6">
          {/* セッション確立 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">1. セッション確立テスト</h2>
            <button
              onClick={establishSession}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-4"
            >
              Establish Session Manually
            </button>
            <button
              onClick={checkCookies}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mr-4"
            >
              Check Cookies
            </button>
            <button
              onClick={clearAllData}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Clear All Data
            </button>
            {establishResult && (
              <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-x-auto">
                {establishResult}
              </pre>
            )}
          </div>

          {/* Cookie情報 */}
          {cookieInfo && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">🍪 Cookie詳細情報</h2>
              <pre className="p-4 bg-gray-100 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {cookieInfo}
              </pre>
            </div>
          )}

          {/* API Routeテスト */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">2. API Route経由テスト</h2>
            <button
              onClick={testApiRoute}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Test API Route (/api/emails)
            </button>
            {emailResult && (
              <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {emailResult}
              </pre>
            )}
          </div>

          {/* 直接バックエンドテスト */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">3. 直接バックエンドテスト</h2>
            <button
              onClick={testDirectBackend}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
            >
              Test Direct Backend
            </button>
            {directResult && (
              <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {directResult}
              </pre>
            )}
          </div>

          {/* 使用方法 */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">📋 使用方法</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><strong>セッション確立</strong>: まず "Establish Session Manually" でセッションを作成</li>
              <li><strong>Cookie確認</strong>: "Check Cookies" でCookieが正しく設定されているか確認</li>
              <li><strong>API Routeテスト</strong>: "/api/emails" 経由でのアクセスをテスト</li>
              <li><strong>直接テスト</strong>: バックエンドへの直接アクセスをテスト</li>
              <li><strong>コンソール確認</strong>: ブラウザの開発者ツールでログを確認</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 