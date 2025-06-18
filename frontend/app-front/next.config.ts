import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // バックエンドAPIへのプロキシ設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://gmail-hackathon-633399924693.us-central1.run.app/:path*', // 直接URLを指定
      },
    ]
  },
};

export default nextConfig;
