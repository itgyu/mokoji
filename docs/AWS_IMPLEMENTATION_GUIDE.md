# 🚀 AWS 완전 전환 구현 가이드

**생성일**: 2025-12-01
**현재 상태**: Phase 1-4.2 완료, Phase 4.3-7 구현 필요

---

## ✅ 완료된 작업

### 1. AWS 인프라
- ✅ DynamoDB 테이블 5개 생성
- ✅ Cognito User Pool 생성
- ✅ 데이터 마이그레이션 (91개 레코드)
- ✅ 사용자 마이그레이션 (37명)

### 2. 클라이언트 라이브러리
- ✅ `/lib/cognito.ts` - Cognito 인증 라이브러리
- ✅ `/lib/dynamodb.ts` - DynamoDB 클라이언트 라이브러리
- ✅ 환경 변수 설정 완료

---

## 🔜 남은 작업 (수동 구현 필요)

완전한 AWS 전환을 위해서는 **2가지 접근 방법** 중 선택해야 합니다:

### 옵션 A: Lambda API 사용 (권장, 보안)
- Lambda 함수를 통해 DynamoDB 접근
- API Gateway로 REST API 제공
- Cognito Authorizer로 인증
- **장점**: 보안, AWS 크레덴셜 노출 없음
- **단점**: Lambda 함수 개발 필요 (복잡)

### 옵션 B: 클라이언트 직접 접근 (간단, 보안 취약)
- 클라이언트에서 직접 DynamoDB 접근
- Cognito Identity Pool 사용
- **장점**: 간단, Lambda 불필요
- **단점**: AWS 크레덴셜 노출 가능

---

## 📋 옵션 A: Lambda API 구현 (권장)

### 1단계: Lambda 함수 생성

#### 1.1 Lambda 함수 디렉토리 구조
```
lambda/
├── users/
│   ├── index.ts
│   └── package.json
├── organizations/
│   ├── index.ts
│   └── package.json
├── members/
│   ├── index.ts
│   └── package.json
├── schedules/
│   ├── index.ts
│   └── package.json
└── shared/
    └── dynamodb.ts
```

#### 1.2 Lambda 함수 예시: Users API

**lambda/users/index.ts**:
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'mokoji-users';

export const handler = async (event: any) => {
  const { httpMethod, path, pathParameters, body } = event;

  // Cognito에서 인증된 사용자 정보
  const userId = event.requestContext.authorizer.claims.sub;

  try {
    // GET /users/{userId}
    if (httpMethod === 'GET' && pathParameters?.userId) {
      const result = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: pathParameters.userId },
        })
      );

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result.Item),
      };
    }

    // PUT /users/{userId}
    if (httpMethod === 'PUT' && pathParameters?.userId) {
      const updates = JSON.parse(body);

      // 자신의 프로필만 수정 가능
      if (pathParameters.userId !== userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
        };
      }

      const updateExpression = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.keys(updates).forEach((key) => {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      });

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = Date.now();

      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: pathParameters.userId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
```

#### 1.3 Lambda 배포 스크립트

**scripts/aws/deploy-lambda.sh**:
```bash
#!/bin/bash

FUNCTION_NAME=$1
REGION="ap-northeast-2"

if [ -z "$FUNCTION_NAME" ]; then
  echo "사용법: ./deploy-lambda.sh <function-name>"
  exit 1
fi

echo "🚀 Lambda 함수 배포: $FUNCTION_NAME"

cd lambda/$FUNCTION_NAME

# 의존성 설치
npm install

# TypeScript 컴파일
npx tsc

# ZIP 파일 생성
zip -r function.zip index.js node_modules

# Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name mokoji-$FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

echo "✅ 배포 완료"
```

### 2단계: API Gateway 설정

#### 2.1 REST API 생성
```bash
# API Gateway 생성
aws apigateway create-rest-api \
  --name "mokoji-api" \
  --region ap-northeast-2

# 리소스 생성
aws apigateway create-resource \
  --rest-api-id <api-id> \
  --parent-id <root-id> \
  --path-part "users" \
  --region ap-northeast-2
```

#### 2.2 Cognito Authorizer 연결
```bash
aws apigateway create-authorizer \
  --rest-api-id <api-id> \
  --name mokoji-cognito-authorizer \
  --type COGNITO_USER_POOLS \
  --provider-arns arn:aws:cognito-idp:ap-northeast-2:<account>:userpool/ap-northeast-2_2F6sdouGR \
  --identity-source method.request.header.Authorization \
  --region ap-northeast-2
```

### 3단계: 프론트엔드 API 클라이언트

#### 3.1 API 클라이언트 생성

**lib/api-client.ts**:
```typescript
import { getIdToken } from './cognito';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.mokoji.com';

class APIClient {
  private async fetch(path: string, options: RequestInit = {}) {
    const token = await getIdToken();

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Users
  async getUser(userId: string) {
    return this.fetch(`/users/${userId}`);
  }

  async updateUser(userId: string, updates: any) {
    return this.fetch(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Organizations
  async getOrganization(orgId: string) {
    return this.fetch(`/organizations/${orgId}`);
  }

  async getOrganizationsByOwner(ownerUid: string) {
    return this.fetch(`/organizations?ownerUid=${ownerUid}`);
  }

  // Members
  async getMembers(orgId: string) {
    return this.fetch(`/organizations/${orgId}/members`);
  }

  async addMember(orgId: string, userId: string) {
    return this.fetch(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  // Schedules
  async getSchedules(orgId: string) {
    return this.fetch(`/schedules?organizationId=${orgId}`);
  }

  async createSchedule(schedule: any) {
    return this.fetch('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }
}

export const apiClient = new APIClient();
```

---

## 📋 옵션 B: Cognito Identity Pool (간단)

### 1단계: Cognito Identity Pool 생성

```bash
aws cognito-identity create-identity-pool \
  --identity-pool-name mokoji-identity-pool \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers \
    ProviderName=cognito-idp.ap-northeast-2.amazonaws.com/ap-northeast-2_2F6sdouGR,ClientId=5vl7s1q093kpelmk8oa72krp4g \
  --region ap-northeast-2
```

### 2단계: IAM Role 생성

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-2:*:table/mokoji-*"
      ]
    }
  ]
}
```

### 3단계: 프론트엔드 설정

**.env.local에 추가**:
```bash
NEXT_PUBLIC_AWS_IDENTITY_POOL_ID=ap-northeast-2:xxxxxxxxx
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**lib/dynamodb.ts 수정**:
```typescript
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const client = new DynamoDBClient({
  region: 'ap-northeast-2',
  credentials: fromCognitoIdentityPool({
    clientConfig: { region: 'ap-northeast-2' },
    identityPoolId: process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID!,
    logins: {
      [`cognito-idp.ap-northeast-2.amazonaws.com/${process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID}`]: async () => {
        const token = await getIdToken();
        return token!;
      },
    },
  }),
});
```

---

## 🔧 프론트엔드 수정 가이드

### 1. AuthContext 전환

**contexts/AuthContext.tsx 수정**:

#### Before (Firebase):
```typescript
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}
```

#### After (Cognito):
```typescript
import { signInWithEmail, getCurrentUser, signOut } from '@/lib/cognito';

export async function signIn(email: string, password: string) {
  const { user, session } = await signInWithEmail(email, password);
  return user;
}

export async function getUser() {
  return await getCurrentUser();
}

export async function logout() {
  await signOut();
}
```

### 2. 데이터 쿼리 전환

#### Before (Firestore):
```typescript
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const q = query(
  collection(db, 'organizationMembers'),
  where('organizationId', '==', orgId)
);
const snapshot = await getDocs(q);
const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

#### After (옵션 A - API Client):
```typescript
import { apiClient } from '@/lib/api-client';

const members = await apiClient.getMembers(orgId);
```

#### After (옵션 B - DynamoDB Direct):
```typescript
import { membersDB } from '@/lib/dynamodb';

const members = await membersDB.getByOrganization(orgId);
```

### 3. 수정 필요한 파일 목록

**우선순위 1 (인증)**:
1. `contexts/AuthContext.tsx` - Cognito로 전환
2. `app/auth/page.tsx` - 로그인 UI
3. `middleware.ts` - 인증 미들웨어

**우선순위 2 (데이터)**:
4. `app/dashboard/page.tsx`
5. `app/crew/[crewId]/page.tsx`
6. `app/crew/[crewId]/settings/page.tsx`
7. `app/schedules/page.tsx`
8. `app/schedules/[scheduleId]/page.tsx`
9. `app/profile/page.tsx`

**우선순위 3 (기타)**:
10-20. 나머지 Firestore 사용 파일들

### 4. Firestore 코드 찾기

```bash
# 모든 Firestore import 찾기
grep -r "from 'firebase/firestore'" app/ lib/ components/

# 모든 collection 사용 찾기
grep -r "collection(db" app/ lib/ components/

# 모든 Firestore 쿼리 찾기
grep -r "getDocs\|getDoc\|setDoc\|updateDoc\|deleteDoc" app/ lib/ components/
```

---

## 🚀 배포 절차

### 1단계: 로컬 테스트
```bash
# 환경 변수 확인
cat .env.local

# 개발 서버 실행
npm run dev

# 테스트
# - 로그인/로그아웃
# - 데이터 읽기/쓰기
# - 권한 확인
```

### 2단계: 스테이징 배포
```bash
# Vercel 스테이징 환경 배포
vercel --env staging

# AWS 리소스 확인
aws dynamodb list-tables --region ap-northeast-2
aws cognito-idp list-users --user-pool-id ap-northeast-2_2F6sdouGR --region ap-northeast-2
```

### 3단계: 프로덕션 배포
```bash
# 백업 확인
npm run backup:members

# 배포
vercel --prod

# 모니터링
aws cloudwatch get-dashboard --dashboard-name mokoji --region ap-northeast-2
```

---

## 📊 예상 작업 시간

| 단계 | 작업 | 예상 시간 |
|-----|------|----------|
| 1 | Lambda 함수 5개 개발 | 2-3일 |
| 2 | API Gateway 설정 | 1일 |
| 3 | API 클라이언트 개발 | 1일 |
| 4 | AuthContext 전환 | 1일 |
| 5 | 프론트엔드 수정 (20개 파일) | 3-5일 |
| 6 | 테스트 | 2일 |
| 7 | 배포 | 1일 |
| **총계** | | **11-14일** |

---

## 💡 권장 사항

### 단계적 접근
1. **Week 1**: Lambda 함수 + API Gateway 구현
2. **Week 2**: AuthContext Cognito 전환 + 로그인 테스트
3. **Week 3**: 프론트엔드 데이터 쿼리 전환 (우선순위 1-2)
4. **Week 4**: 나머지 파일 전환 + 테스트 + 배포

### 하이브리드 접근 (임시)
- 인증: Cognito 사용 ✅
- 데이터: Firebase 계속 사용 (당분간)
- 점진적으로 DynamoDB로 전환

이 방식이라면:
- **1주일 내 Cognito 인증 전환 가능**
- **데이터는 나중에 천천히 전환**
- **위험 최소화**

---

## 📞 다음 단계

### 즉시 시작 가능:
1. ✅ Cognito 라이브러리 사용하여 로그인 구현
2. ✅ DynamoDB 라이브러리 테스트
3. ⏳ Lambda 함수 개발 (옵션 A 선택 시)
4. ⏳ 프론트엔드 코드 수정

### 필요한 결정:
- **옵션 A (Lambda)** vs **옵션 B (Direct Access)** 선택
- **전면 전환** vs **하이브리드 접근** 선택
- 배포 일정 및 다운타임 계획

---

**생성된 파일**:
- `/lib/cognito.ts` - Cognito 인증 라이브러리 ✅
- `/lib/dynamodb.ts` - DynamoDB 클라이언트 ✅
- `.env.local` - AWS 환경 변수 추가 ✅

**다음 작업**: Lambda 함수 개발 또는 프론트엔드 직접 수정
