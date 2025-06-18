"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw } from "lucide-react"

// OAuth2CallbackContentを動的にインポート
const OAuth2CallbackContent = dynamic(() => import('./OAuth2CallbackContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">認証処理中...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">
              Googleアカウントでの認証を処理しています。<br />
              しばらくお待ちください...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

export default function OAuth2CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold">認証処理中...</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600">
                Googleアカウントでの認証を処理しています。<br />
                しばらくお待ちください...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <OAuth2CallbackContent />
    </Suspense>
  )
} 