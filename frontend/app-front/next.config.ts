import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // バックエンドAPIへのプロキシ設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/:path*`, // 環境変数を使用
      },
    ]
  },
  // 環境変数の設定
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000',
  },
};

export default nextConfig;
