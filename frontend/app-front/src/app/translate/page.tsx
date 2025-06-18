"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Languages, Mail, ArrowLeft, Globe } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Translation {
  id: string
  original_subject: string
  translated_subject: string
  original_snippet: string
  translated_snippet: string
  sender: string
  date: string
}

interface TranslationResult {
  translations: Translation[]
  total_processed: number
  model_used: string
}

export default function TranslatePage() {
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

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

  const translateEmails = async () => {
    try {
      setIsLoading(true)
      setError("")
      setResult(null)

      const response = await fetch('https://gmail-hackathon-633399924693.us-central1.run.app/translate_english_emails', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/")
          return
        }
        throw new Error("翻訳に失敗しました")
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/emails" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            メール一覧に戻る
          </Link>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">メール翻訳</h1>
            <p className="text-gray-600">英語のメールを日本語に自動翻訳します（最大4件）</p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
              <Languages className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">AI翻訳機能</CardTitle>
            <CardDescription>最新の英語メールを検出し、GPTで高品質な日本語翻訳を提供します</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={translateEmails} disabled={isLoading} size="lg" className="w-full sm:w-auto">
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  翻訳中...
                </div>
              ) : (
                <div className="flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  英語メールを翻訳
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

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Languages className="mr-2 h-5 w-5" />
                  翻訳結果
                </CardTitle>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>処理済み: {result.total_processed}件</span>
                  <span>翻訳済み: {result.translations.length}件</span>
                  <span>使用モデル: {result.model_used}</span>
                </div>
              </CardHeader>
            </Card>

            {result.translations.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">翻訳対象なし</h3>
                  <p className="text-gray-600">最近の英語メールが見つかりませんでした。</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {result.translations.map((translation) => (
                  <Card key={translation.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Badge variant="outline" className="mr-2">
                              英語
                            </Badge>
                            <span className="text-sm text-gray-600">{translation.sender}</span>
                            <span className="text-sm text-gray-400 ml-2">{formatDate(translation.date)}</span>
                          </div>
                          <h3 className="font-medium text-gray-800 mb-1">{translation.original_subject}</h3>
                          <p className="text-sm text-gray-600 mb-4">{translation.original_snippet}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                        <div className="flex items-center mb-2">
                          <Badge className="mr-2">日本語翻訳</Badge>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2">{translation.translated_subject}</h4>
                        <p className="text-gray-800 leading-relaxed">{translation.translated_snippet}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {!result && !isLoading && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <Languages className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">翻訳を開始</h3>
              <p className="text-gray-600">
                「英語メールを翻訳」ボタンをクリックして、最新の英語メールを翻訳しましょう。
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
