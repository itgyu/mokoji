import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import VersionChecker from "@/components/VersionChecker"

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
}

export const metadata: Metadata = {
  title: "It's Campers - 캠핑 크루와 함께하는 아웃도어 라이프",
  description: "캠핑 크루 매칭, 일정 관리, 장비 공유 - 당신의 캠핑 라이프를 더욱 특별하게",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" style={{ scrollBehavior: 'smooth' }}>
      <head>
        {/* Kakao Maps SDK - 직접 주입 */}
        <script
          type="text/javascript"
          src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=ff364c3f44129afc87e31935ac353ba2&libraries=services"
        ></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <VersionChecker />
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
