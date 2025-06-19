"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function DebugPage() {
  const [sessionId, setSessionId] = useState('he_27GmGE-EB3eZvx19o_Q==')
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const establishSession = async () => {
    setIsLoading(true)
    setResult('')
    
    try {
      console.log('=== Debug: Establishing Session ===')
      console.log('Session ID:', sessionId)
      
      const response = await fetch('/api/establish_session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId })
      })
      
      console.log('Establish Session Status:', response.status)
      console.log('Establish Session Headers:', [...response.headers.entries()])
      
      const data = await response.json()
      console.log('Establish Session Response:', data)
      
      if (response.ok) {
        setResult(`✅ セッション確立成功: ${JSON.stringify(data, null, 2)}`)
        
        // Test emails endpoint
        console.log('=== Testing /api/emails ===')
        const emailsResponse = await fetch('/api/emails', { 
          credentials: 'include' 
        })
        
        console.log('Emails Status:', emailsResponse.status)
        console.log('Emails Headers:', [...emailsResponse.headers.entries()])
        
        const emailsData = await emailsResponse.json()
        console.log('Emails Response:', emailsData)
        
        setResult(prev => prev + `\n\n📧 メールテスト結果:\nStatus: ${emailsResponse.status}\nResponse: ${JSON.stringify(emailsData, null, 2)}`)
      } else {
        setResult(`❌ セッション確立失敗: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (error) {
      console.error('Debug error:', error)
      setResult(`❌ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testCookies = () => {
    console.log('=== Cookie Debug ===')
    console.log('All cookies:', document.cookie)
    console.log('Location:', window.location.href)
    
    setResult(`🍪 Cookie情報:\n${document.cookie || 'No cookies found'}\n\n📍 Location: ${window.location.href}`)
  }

  const clearCookies = () => {
    // Clear all cookies for this domain
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    })
    setResult('🧹 Cookieをクリアしました')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🔧 デバッグツール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700">
                セッションID
              </label>
              <input
                id="sessionId"
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="セッションIDを入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex space-x-4">
              <Button 
                onClick={establishSession} 
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? '処理中...' : '🔑 セッション確立 & メールテスト'}
              </Button>
              
              <Button 
                onClick={testCookies}
                variant="outline"
              >
                🍪 Cookie確認
              </Button>
              
              <Button 
                onClick={clearCookies}
                variant="outline"
              >
                🧹 Cookie削除
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>📋 結果</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertDescription>
                  <pre className="whitespace-pre-wrap text-sm">{result}</pre>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 