/**
 * Test Auth API - 인증 디버깅용
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    const debug: any = {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : null,
      env: {
        userPoolId: process.env.AWS_COGNITO_USER_POOL_ID ? 'SET' : 'NOT SET',
        clientId: process.env.AWS_COGNITO_CLIENT_ID ? 'SET' : 'NOT SET',
        region: process.env.AWS_REGION ? 'SET' : 'NOT SET',
      }
    };

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // JWT 페이로드 디코딩 (검증 없이)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          debug.tokenPayload = {
            sub: payload.sub,
            email: payload.email,
            iss: payload.iss,
            aud: payload.aud,
            client_id: payload.client_id,
            token_use: payload.token_use,
            exp: payload.exp,
            iat: payload.iat,
          };
        }
      } catch (e: any) {
        debug.tokenDecodeError = e.message;
      }

      // JWT 검증 시도
      try {
        const { withAuth } = await import('@/lib/api-auth');
        const authUser = await withAuth(request);
        debug.authVerified = true;
        debug.authUser = authUser;
      } catch (e: any) {
        debug.authVerified = false;
        debug.authError = e.message;
        debug.authErrorStack = e.stack;
      }
    }

    return NextResponse.json(debug);
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
