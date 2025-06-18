"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MessageSquare, Sparkles, ArrowLeft, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface SummaryResult {
  summary: string
  email_count: number
  model_used: string
  processing_time: number
}

export default function SummarizePage() {
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/', {
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

  const generateSummary = async () => {
    try {
      setIsLoading(true)
      setError("")
      setSummary(null)

      const response = await fetch('/api/summarize_recent', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/")
          return
        }
        throw new Error("要約の生成に失敗しました")
      }

      const data = await response.json()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsLoading(false)
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

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">メール要約</h1>
            <p className="text-gray-600">AIが直近10件のメールを分析・要約します</p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">AI要約機能</CardTitle>
            <CardDescription>最新のメールを分析し、重要なポイントを簡潔にまとめます</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={generateSummary} disabled={isLoading} size="lg" className="w-full sm:w-auto">
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  要約生成中...
                </div>
              ) : (
                <div className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  要約を生成
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                メール要約結果
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>対象メール: {summary.email_count}件</span>
                <span>使用モデル: {summary.model_used}</span>
                <div className="flex items-center">
                  <Clock className="mr-1 h-4 w-4" />
                  処理時間: {summary.processing_time.toFixed(2)}秒
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <div className="bg-gray-50 p-6 rounded-lg border-l-4 border-blue-500">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!summary && !isLoading && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">要約を開始</h3>
              <p className="text-gray-600">「要約を生成」ボタンをクリックして、最新のメールを要約しましょう。</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
