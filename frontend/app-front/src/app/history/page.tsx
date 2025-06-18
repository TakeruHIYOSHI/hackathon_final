"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { History, MessageSquare, ArrowLeft, Clock, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface QueryHistory {
  id: string
  query: string
  answer: string
  confidence?: "high" | "medium" | "low"
  model_used: string
  created_at: string
  processing_time?: number
  email_count_indexed?: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<QueryHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [limit, setLimit] = useState(10)

  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('https://gmail-hackathon-633399924693.us-central1.run.app/', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        router.push("/")
      }
    } catch (error) {
      router.push("/")
    }
  }

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      setError("")

      const response = await fetch(`https://gmail-hackathon-633399924693.us-central1.run.app/query_history?limit=${limit}`, {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/")
          return
        }
        throw new Error("履歴の取得に失敗しました")
      }

      const data = await response.json()
      console.log("History API response:", data) // デバッグログ
      
      // バックエンドのレスポンス形式に合わせて修正
      const historyArray = data.query_history || data || []
      
      // 配列であることを確認
      if (Array.isArray(historyArray)) {
        setHistory(historyArray)
      } else {
        console.error("Expected array but got:", typeof historyArray, historyArray)
        setHistory([])
        setError("履歴データの形式が正しくありません")
      }
    } catch (err) {
      console.error("History fetch error:", err)
      setError(err instanceof Error ? err.message : "エラーが発生しました")
      setHistory([]) // エラー時は空配列を設定
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (limit) {
      fetchHistory()
    }
  }, [limit])

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: { variant: "default" as const, label: "高信頼度", color: "text-green-600" },
      medium: { variant: "secondary" as const, label: "中信頼度", color: "text-yellow-600" },
      low: { variant: "outline" as const, label: "低信頼度", color: "text-red-600" },
    }

    return variants[confidence as keyof typeof variants] || variants.low
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/emails" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            メール一覧に戻る
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">検索履歴</h1>
              <p className="text-gray-600 mt-2">過去のメール検索クエリと結果を確認</p>
            </div>
            <Button onClick={fetchHistory} disabled={isLoading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              更新
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-5 w-5" />
              表示設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">表示件数:</span>
              <div className="flex space-x-2">
                {[10, 25, 50].map((count) => (
                  <Button
                    key={count}
                    variant={limit === count ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLimit(count)}
                    disabled={isLoading}
                  >
                    {count}件
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {history.length === 0 && !isLoading && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">履歴がありません</h3>
              <p className="text-gray-600 mb-4">メール検索を実行すると、ここに履歴が表示されます。</p>
              <Link href="/search">
                <Button>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  メール検索を開始
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {history.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{item.query}</CardTitle>
                    <div className="flex items-center text-sm text-gray-600 space-x-4">
                      <div className="flex items-center">
                        <Clock className="mr-1 h-4 w-4" />
                        {formatDate(item.created_at)}
                      </div>
                      <span>モデル: {item.model_used}</span>
                      <span>処理時間: {item.processing_time?.toFixed(2) || "不明"}秒</span>
                    </div>
                  </div>
                  <Badge {...getConfidenceBadge(item.confidence || "low")}>{getConfidenceBadge(item.confidence || "low").label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                  <CardDescription className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {item.answer}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-600">{history.length}件の履歴を表示中</p>
          </div>
        )}
      </div>
    </div>
  )
}
