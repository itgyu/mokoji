import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import VersionChecker from "@/components/VersionChecker"
import { BRAND } from "@/lib/brand"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#FF9B50',
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
  const kakaoMapKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || 'ff364c3f44129afc87e31935ac353ba2'

  return (
    <html lang="ko" style={{ scrollBehavior: 'smooth' }}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {/* Kakao Maps SDK */}
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapKey}&libraries=services`}
          strategy="beforeInteractive"
          onError={(e) => {
            console.error('Kakao Maps script failed to load', e)
          }}
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
