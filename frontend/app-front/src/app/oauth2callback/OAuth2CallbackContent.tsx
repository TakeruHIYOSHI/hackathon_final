"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, CheckCircle, XCircle } from "lucide-react"

export default function OAuth2CallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      // デバッグ: Cookieの状況を確認
      console.log('=== OAuth2 Callback Debug ===')
      console.log('All cookies:', document.cookie)
      console.log('Location:', window.location.href)
      console.log('Search params:', Object.fromEntries(searchParams.entries()))
      
      // Check if there's an error parameter from OAuth
      const errorParam = searchParams.get('error')
      if (errorParam) {
        setError(`認証エラー: ${errorParam}`)
        setStatus('error')
        return
      }

      // 認証が成功したかをテストするため、メールエンドポイントにアクセス
      console.log('Fetching /api/emails to test authentication...')
      const response = await fetch('/api/emails', {
        method: 'GET',
        credentials: 'include'
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        setStatus('success')
        // Redirect to emails page after a short delay
        setTimeout(() => {
          router.push('/emails')
        }, 2000)
      } else {
        const errorText = await response.text()
        console.error('API error:', errorText)
        throw new Error('認証に失敗しました')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証処理中にエラーが発生しました')
      setStatus('error')
      // Redirect to home page after error
      setTimeout(() => {
        router.push('/')
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              {status === 'loading' && (
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-8 w-8 text-green-600" />
              )}
              {status === 'error' && (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && '認証処理中...'}
              {status === 'success' && '認証成功！'}
              {status === 'error' && '認証失敗'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {status === 'loading' && (
              <p className="text-gray-600">
                Googleアカウントでの認証を処理しています。<br />
                しばらくお待ちください...
              </p>
            )}
            
            {status === 'success' && (
              <div className="space-y-2">
                <p className="text-green-600 font-medium">
                  認証が完了しました！
                </p>
                <p className="text-gray-600">
                  メール一覧ページに移動します...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <p className="text-gray-600">
                  ホームページに戻ります...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 