"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Brain, ArrowLeft, MessageSquare } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface SearchResult {
  query?: string
  answer: string
  confidence: "high" | "medium" | "low"
  model_used?: string
  processing_time?: number
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) {
      setError("検索クエリを入力してください")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      setResult(null)

      const response = await fetch("/api/query_emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim() }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/")
          return
        }
        throw new Error("検索に失敗しました")
      }

      const data = await response.json()
      
      // レスポンスデータに不足しているフィールドを補完
      const searchResult: SearchResult = {
        query: query.trim(),
        answer: data.answer || "回答が取得できませんでした",
        confidence: data.confidence || "low",
        model_used: data.model_used || "gpt-4o-mini",
        processing_time: data.processing_time || 0
      }
      
      setResult(searchResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: { variant: "default" as const, label: "高信頼度", color: "bg-green-500" },
      medium: { variant: "secondary" as const, label: "中信頼度", color: "bg-yellow-500" },
      low: { variant: "outline" as const, label: "低信頼度", color: "bg-red-500" },
    }

    return variants[confidence as keyof typeof variants] || variants.low
  }

  const exampleQueries = [
    "最近の重要なメールは何ですか？",
    "会議の予定について教えて",
    "プロジェクトの進捗はどうですか？",
    "請求書や支払いに関するメールはありますか？",
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/emails" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            メール一覧に戻る
          </Link>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">メール検索</h1>
            <p className="text-gray-600">RAG技術を使った高精度なメール検索・質問応答</p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Brain className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-center">AI検索エンジン</CardTitle>
            <CardDescription className="text-center">
              自然言語でメールを検索し、AIが最適な回答を生成します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="メールについて質問してください..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !query.trim()}>
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">検索例:</h4>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(example)}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    {example}
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

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  検索結果
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge {...getConfidenceBadge(result.confidence)}>
                    {getConfidenceBadge(result.confidence).label}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>クエリ: {result.query || "未設定"}</span>
                {result.model_used && <span>モデル: {result.model_used}</span>}
                {result.processing_time !== undefined && (
                  <span>処理時間: {result.processing_time.toFixed(2)}秒</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-6 rounded-lg border-l-4 border-blue-500">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{result.answer}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!result && !isLoading && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">検索を開始</h3>
              <p className="text-gray-600">上の検索ボックスに質問を入力して、メールから情報を検索しましょう。</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
