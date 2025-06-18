"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, RefreshCw, Calendar, User, LogOut, MessageSquare, Languages, History, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Email {
  id: string
  subject: string
  sender: string
  snippet: string
  date: string
  thread_id: string
  body?: string
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Check authentication by trying to fetch emails
      await fetchEmails()
    } catch (error) {
      // If authentication fails, redirect to login
      router.push("/")
    }
  }

  const logout = () => {
    window.location.href = 'https://gmail-hackathon-633399924693.us-central1.run.app/logout'
  }

  const fetchEmails = async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch('https://gmail-hackathon-633399924693.us-central1.run.app/emails', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized, redirect to login
          router.push("/")
          return
        }
        throw new Error("メールの取得に失敗しました")
      }

      const data = await response.json()
      console.log("Received data:", data) // デバッグログ
      
      // データが配列であることを確認
      if (Array.isArray(data)) {
        setEmails(data)
      } else if (data && Array.isArray(data.emails)) {
        // データがオブジェクトで、emailsプロパティが配列の場合
        setEmails(data.emails)
      } else {
        console.error("Unexpected data format:", data)
        setEmails([])
        setError("メールデータの形式が正しくありません")
      }
    } catch (err) {
      console.error("Fetch emails error:", err) // デバッグログ
      setError(err instanceof Error ? err.message : "エラーが発生しました")
      setEmails([]) // エラー時は空配列を設定
      // If error is authentication related, redirect to login
      if (err instanceof Error && err.message.includes("認証")) {
        router.push("/")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const features = [
    {
      title: "メール要約",
      description: "AIで要約",
      icon: Sparkles,
      href: "/summarize",
      color: "bg-green-500",
    },
    {
      title: "メール検索",
      description: "RAG検索",
      icon: MessageSquare,
      href: "/search",
      color: "bg-purple-500",
    },
    {
      title: "翻訳機能",
      description: "英語→日本語",
      icon: Languages,
      href: "/translate",
      color: "bg-orange-500",
    },
    {
      title: "検索履歴",
      description: "履歴確認",
      icon: History,
      href: "/history",
      color: "bg-gray-500",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with user info and logout */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">メール一覧</h1>
            <p className="text-gray-600 mt-1">Gmail AI アシスタント</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={fetchEmails} disabled={isLoading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "取得中..." : "更新"}
            </Button>
            <Button onClick={logout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </div>
        </div>

        {/* AI Features Navigation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">AI機能</CardTitle>
            <CardDescription>メールをAIで分析・処理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.isArray(features) && features.map((feature, index) => (
                <Link key={index} href={feature.href}>
                  <Button
                    variant="outline"
                    className="h-20 w-full flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
                  >
                    <div className={`w-8 h-8 rounded-lg ${feature.color} flex items-center justify-center`}>
                      <feature.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-sm">{feature.title}</div>
                      <div className="text-xs text-gray-500">{feature.description}</div>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {emails.length === 0 && !isLoading && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">メールがありません</h3>
              <p className="text-gray-600 mb-4">「更新」ボタンをクリックしてGmailからメールを取得してください。</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {Array.isArray(emails) && emails.map((email) => (
            <Card key={email.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{email.subject || "件名なし"}</CardTitle>
                    <div className="flex items-center text-sm text-gray-600 space-x-4">
                      <div className="flex items-center">
                        <User className="mr-1 h-4 w-4" />
                        {email.sender || "送信者不明"}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        {formatDate(email.date)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {email.snippet || "プレビューなし"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
