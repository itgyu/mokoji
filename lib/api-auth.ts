/**
 * API 인증 미들웨어
 *
 * Cognito JWT 토큰 검증 (jose 라이브러리 사용)
 *
 * ✅ jose는 빌드 시점에 아무것도 검증하지 않아 Vercel 배포 문제 해결
 * ✅ 빌드 캐시 무효화를 위한 변경 (2025-12-01)
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthUser {
  sub: string;        // User ID (Cognito sub)
  email: string;
  name?: string;
}

// JWKS URL 생성
function getJwksUrl(): URL {
  const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID?.trim();
  const region = process.env.AWS_REGION?.trim() || 'ap-northeast-2';

  if (!userPoolId) {
    throw new Error('AWS_COGNITO_USER_POOL_ID 환경 변수가 설정되지 않았습니다');
  }

  return new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`);
}

// JWKS 캐시 (런타임에만 생성) + 자동 갱신
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCreatedAt: number | null = null;
const JWKS_CACHE_TTL = 3600000; // 1시간 (밀리초)

function getJwks() {
  const now = Date.now();
  // JWKS가 없거나 1시간 이상 지났으면 새로 생성
  if (!jwks || !jwksCreatedAt || (now - jwksCreatedAt) > JWKS_CACHE_TTL) {
    jwks = createRemoteJWKSet(getJwksUrl());
    jwksCreatedAt = now;
  }
  return jwks;
}

// JWKS 캐시 강제 리셋 (키 로테이션 시)
function resetJwks() {
  jwks = null;
  jwksCreatedAt = null;
}

/**
 * JWT 토큰 검증
 */
async function verifyToken(token: string) {
  const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.AWS_COGNITO_CLIENT_ID?.trim();
  const region = process.env.AWS_REGION?.trim() || 'ap-northeast-2';

  if (!userPoolId || !clientId) {
    throw new Error('Cognito 환경 변수가 설정되지 않았습니다');
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  try {
    // ID 토큰 검증 (audience 포함)
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      audience: clientId,
    });

    return payload;
  } catch (error: any) {
    // JWKSNoMatchingKey 에러: 키 로테이션으로 인한 오류 → JWKS 캐시 리셋 후 재시도
    if (error?.code === 'ERR_JWKS_NO_MATCHING_KEY' || error?.message?.includes('JWKSNoMatchingKey')) {
      console.log('🔄 JWKS 키 불일치 감지 - 캐시 리셋 후 재시도');
      resetJwks(); // 캐시 강제 리셋

      try {
        // 새 JWKS로 재시도
        const { payload } = await jwtVerify(token, getJwks(), {
          issuer,
          audience: clientId,
        });
        return payload;
      } catch (retryError) {
        // 재시도 실패 - Access 토큰으로 시도
      }
    }

    // Access 토큰 검증 (audience 없이 재시도)
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer,
      });

      // client_id 수동 검증 (access token)
      if (payload.client_id && payload.client_id !== clientId) {
        throw new Error('Invalid client_id');
      }

      return payload;
    } catch (retryError: any) {
      // Access 토큰도 JWKSNoMatchingKey 에러면 한 번 더 재시도
      if (retryError?.code === 'ERR_JWKS_NO_MATCHING_KEY' || retryError?.message?.includes('JWKSNoMatchingKey')) {
        console.log('🔄 Access 토큰도 JWKS 키 불일치 - 캐시 리셋 후 재시도');
        resetJwks();

        try {
          const { payload } = await jwtVerify(token, getJwks(), {
            issuer,
          });

          if (payload.client_id && payload.client_id !== clientId) {
            throw new Error('Invalid client_id');
          }

          return payload;
        } catch (finalError) {
          console.error('❌ JWT 검증 최종 실패:', finalError);
          throw new Error('유효하지 않은 토큰입니다');
        }
      }

      console.error('❌ JWT 검증 실패:', retryError);
      throw new Error('유효하지 않은 토큰입니다');
    }
  }
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

    // JWT 토큰 검증
    const payload = await verifyToken(token);

    // 사용자 정보 반환
    return {
      sub: payload.sub as string,
      email: (payload.email as string) || (payload['cognito:username'] as string) || '',
      name: payload.name as string | undefined,
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
