import type { Metadata, Viewport } from "next"
import Script from "next/script"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import VersionChecker from "@/components/VersionChecker"
import { BRAND } from "@/lib/brand"

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#5f0080',
}

export const metadata: Metadata = {
  title: `${BRAND.NAME} - ${BRAND.TAGLINE}`,
  description: BRAND.FULL_DESCRIPTION,
  keywords: ['모꼬지', '동네모임', '취미모임', '크루', '소모임', '지역커뮤니티'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon', sizes: '180x180', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '모꼬지',
  },
  openGraph: {
    title: `${BRAND.NAME} - ${BRAND.TAGLINE}`,
    description: BRAND.FULL_DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=ff364c3f44129afc87e31935ac353ba2&libraries=services&autoload=false"
          strategy="beforeInteractive"
        />
        <VersionChecker />
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
