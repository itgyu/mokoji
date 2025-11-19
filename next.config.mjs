/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 캐시 제어 헤더 설정
  async headers() {
    return [
      {
        // version.json은 절대 캐시하지 않음 (항상 최신 버전 체크)
        source: '/version.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        // HTML 페이지도 짧은 캐시로 설정 (1분)
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
