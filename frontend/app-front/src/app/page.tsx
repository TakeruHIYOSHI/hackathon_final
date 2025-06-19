"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Shield, Zap, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const emailsResponse = await fetch('/api/emails', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (emailsResponse.ok) {
        // User is authenticated, redirect to emails
        router.push("/emails")
        return
      }
    } catch (error) {
      console.log("Auth check failed:", error)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const handleLogin = () => {
    window.location.href = '/api/login'
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">認証状態を確認中...</span>
        </div>
      </div>
    )
  }

  const features = [
    {
      icon: Mail,
      title: "Gmail統合",
      description: "Gmailアカウントと安全に連携",
    },
    {
      icon: Shield,
      title: "セキュア認証",
      description: "OAuth2.0による安全な認証",
    },
    {
      icon: Zap,
      title: "AI機能",
      description: "メール要約・検索・翻訳機能",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gmail AI アシスタント</h1>
          <p className="text-gray-600">AIを活用したメール管理・分析プラットフォーム</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">ログイン</CardTitle>
            <CardDescription>Googleアカウントでログインして開始</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleLogin} disabled={isLoading} className="w-full h-12 text-lg" size="lg">
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ログイン中...
                </div>
              ) : (
                <div className="flex items-center">
                  <Mail className="mr-2 h-5 w-5" />
                  Googleでログイン
                </div>
              )}
            </Button>

            <div className="space-y-4">
              <h3 className="font-semibold text-center">主な機能</h3>
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <feature.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{feature.title}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 text-center">
              ログインすることで、アプリケーションの使用に同意したものとみなされます
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
