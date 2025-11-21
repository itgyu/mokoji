import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // 구버전 도메인에서 접속한 경우 신버전으로 강제 리다이렉트
  if (hostname.includes('its-campers.vercel.app')) {
    const url = request.nextUrl.clone()
    url.host = 'mokoji.vercel.app'
    url.protocol = 'https'

    console.log(`[Redirect] ${hostname} → mokoji.vercel.app${url.pathname}`)

    return NextResponse.redirect(url, 308) // 308 = Permanent Redirect
  }

  return NextResponse.next()
}

// 모든 경로에 적용
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
