/**
 * API 인증 미들웨어
 *
 * API Routes에서 사용하는 Cognito JWT 토큰 검증
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthUser {
  sub: string;        // User ID (Cognito sub)
  email: string;
  name?: string;
}

// Lazy initialization - 빌드 타임이 아닌 런타임에 생성
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    // Trim whitespace and newlines from environment variables (fix for Vercel env var issue)
    const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID?.trim();
    const clientId = process.env.AWS_COGNITO_CLIENT_ID?.trim();

    // 빌드 타임에는 환경 변수가 없을 수 있으므로, 런타임에만 에러 throw
    if (!userPoolId || !clientId) {
      // 빌드 타임 (next build 중) 체크
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        // 빌드 중에는 더미 verifier 반환 (실제로 호출되지 않음)
        console.warn('⚠️ Cognito config not available during build - this is expected');
        return null as any;
      }
      throw new Error(
        'Missing Cognito configuration. Please set AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID environment variables.'
      );
    }

    try {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'id',
        clientId,
      });
    } catch (error: any) {
      // 빌드 중에는 에러를 무시
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.warn('⚠️ Failed to create verifier during build - this is expected');
        return null as any;
      }
      throw error;
    }
  }
  return verifier;
}

/**
 * Authorization 헤더에서 Bearer 토큰을 추출하고 검증
 *
 * @param request - Next.js Request 객체
 * @returns 검증된 사용자 정보
 * @throws 인증 실패 시 에러
 */
export async function withAuth(request: Request): Promise<AuthUser> {
  try {
    // Authorization 헤더 확인
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    // Bearer 토큰 추출
    const token = authHeader.substring(7); // "Bearer " 제거
    if (!token) {
      throw new Error('No token provided');
    }

    // Cognito JWT 토큰 검증
    const payload = await getVerifier().verify(token);

    // 사용자 정보 반환
    return {
      sub: payload.sub,
      email: payload.email || '',
      name: payload.name,
    };
  } catch (error: any) {
    console.error('❌ Auth verification failed:', error.message);
    throw new Error('Unauthorized');
  }
}

/**
 * 옵셔널 인증 (인증되지 않아도 에러를 던지지 않음)
 *
 * @param request - Next.js Request 객체
 * @returns 검증된 사용자 정보 또는 null
 */
export async function withOptionalAuth(request: Request): Promise<AuthUser | null> {
  try {
    return await withAuth(request);
  } catch (error) {
    return null;
  }
}

/**
 * 인증 에러 응답 생성
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * 권한 부족 에러 응답 생성
 */
export function forbiddenResponse(message = 'Forbidden') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * 서버 에러 응답 생성
 */
export function serverErrorResponse(message = 'Internal Server Error', error?: any) {
  console.error('❌ Server error:', error);
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * 성공 응답 생성
 */
export function successResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
