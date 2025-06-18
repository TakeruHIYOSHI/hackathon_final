import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // バックエンドAPIへのプロキシ設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*', // バックエンドAPIへのプロキシ（ポート8000）
      },
    ]
  },
};

export default nextConfig;
