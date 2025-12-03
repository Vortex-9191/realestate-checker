import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google/generative-ai'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  // APIルートのボディサイズ制限
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'x-custom-header',
            value: 'my-custom-header-value',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
