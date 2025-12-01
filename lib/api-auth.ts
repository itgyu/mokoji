/**
 * API 인증 미들웨어
 *
 * API Routes에서 사용하는 Cognito JWT 토큰 검증
 *
 * ⚠️ Dynamic import를 사용하여 빌드 시 모듈 평가를 방지합니다
 */

export interface AuthUser {
  sub: string;        // User ID (Cognito sub)
  email: string;
  name?: string;
}

// Lazy initialization - 빌드 타임이 아닌 런타임에 생성
let verifier: any | null = null;
let verifierError: Error | null = null;

async function getVerifier() {
  // 이미 verifier가 생성되었으면 반환
  if (verifier) {
    return verifier;
  }

  // 이전에 verifier 생성 실패했으면 에러 throw
  if (verifierError) {
    throw verifierError;
  }

  try {
    // Dynamic import를 사용하여 런타임에만 aws-jwt-verify 로드
    const { CognitoJwtVerifier } = await import('aws-jwt-verify');

    // Trim whitespace and newlines from environment variables (fix for Vercel env var issue)
    const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID?.trim();
    const clientId = process.env.AWS_COGNITO_CLIENT_ID?.trim();

    // 환경 변수가 없으면 에러
    if (!userPoolId || !clientId) {
      verifierError = new Error(
        `Missing Cognito configuration. ` +
        `AWS_COGNITO_USER_POOL_ID=${userPoolId ? 'set' : 'missing'}, ` +
        `AWS_COGNITO_CLIENT_ID=${clientId ? 'set' : 'missing'}`
      );
      throw verifierError;
    }

    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });

    return verifier;
  } catch (error: any) {
    verifierError = new Error(`Failed to create Cognito JWT verifier: ${error.message}`);
    throw verifierError;
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
