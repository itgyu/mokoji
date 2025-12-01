# API Routes 아키텍처 설계

## 📐 아키텍처 개요

```
브라우저 (클라이언트)
    ↓ fetch('/api/...')
Next.js API Routes (서버 사이드)
    ↓ AWS SDK (credentials secure)
AWS Services (DynamoDB, S3, Cognito)
```

## 🔐 보안 원칙

1. **환경 변수**: `NEXT_PUBLIC_` 제거, 서버 전용
2. **인증**: Cognito JWT 토큰 검증 (Authorization header)
3. **권한**: API에서 사용자 권한 체크
4. **Rate Limiting**: 향후 추가 고려

---

## 📋 API 엔드포인트 설계

### 1. Users API

#### `GET /api/users/[userId]`
- **설명**: 사용자 프로필 조회
- **인증**: 필수
- **응답**: UserProfile 객체

#### `GET /api/users/email/[email]`
- **설명**: 이메일로 사용자 조회
- **인증**: 필수
- **응답**: UserProfile 객체

#### `POST /api/users`
- **설명**: 사용자 생성
- **인증**: 필수
- **Body**: `{ userId, email, name, gender, birthdate, location, ... }`
- **응답**: 생성된 UserProfile

#### `PUT /api/users/[userId]`
- **설명**: 사용자 프로필 수정
- **인증**: 필수 (본인만)
- **Body**: 수정할 필드들
- **응답**: 수정된 UserProfile

---

### 2. Organizations API

#### `GET /api/organizations`
- **설명**: 전체 크루 목록 조회 (Scan)
- **인증**: 필수
- **Query**: `?limit=100`
- **응답**: Organization 배열

#### `GET /api/organizations/[orgId]`
- **설명**: 크루 상세 조회
- **인증**: 필수
- **응답**: Organization 객체

#### `GET /api/organizations/owner/[ownerUid]`
- **설명**: 소유자별 크루 조회
- **인증**: 필수
- **응답**: Organization 배열

#### `POST /api/organizations`
- **설명**: 크루 생성
- **인증**: 필수
- **Body**: `{ name, description, categories, ownerUid, ... }`
- **응답**: 생성된 Organization

#### `PUT /api/organizations/[orgId]`
- **설명**: 크루 수정
- **인증**: 필수 (owner/admin만)
- **Body**: 수정할 필드들
- **응답**: 수정된 Organization

#### `DELETE /api/organizations/[orgId]`
- **설명**: 크루 삭제
- **인증**: 필수 (owner만)
- **응답**: `{ success: true }`

---

### 3. Members API

#### `GET /api/members/organization/[orgId]`
- **설명**: 크루별 멤버 조회
- **인증**: 필수
- **응답**: Member 배열

#### `GET /api/members/user/[userId]`
- **설명**: 사용자별 멤버십 조회
- **인증**: 필수
- **응답**: OrganizationMember 배열

#### `POST /api/members`
- **설명**: 멤버 추가
- **인증**: 필수
- **Body**: `{ userId, organizationId, role, joinedAt, ... }`
- **응답**: 생성된 Member

#### `PUT /api/members/[memberId]`
- **설명**: 멤버 정보 수정 (역할 변경 등)
- **인증**: 필수 (owner/admin만)
- **Body**: `{ role, status, ... }`
- **응답**: 수정된 Member

#### `DELETE /api/members/[memberId]`
- **설명**: 멤버 제거
- **인증**: 필수 (owner/admin만)
- **응답**: `{ success: true }`

---

### 4. Schedules API

#### `GET /api/schedules/organization/[orgId]`
- **설명**: 크루별 일정 조회
- **인증**: 필수
- **Query**: `?startDate=2025-11-01&endDate=2025-11-30`
- **응답**: Schedule 배열

#### `GET /api/schedules/[scheduleId]`
- **설명**: 일정 상세 조회
- **인증**: 필수
- **응답**: Schedule 객체

#### `POST /api/schedules`
- **설명**: 일정 생성
- **인증**: 필수
- **Body**: `{ title, date, time, location, organizationId, ... }`
- **응답**: 생성된 Schedule

#### `PUT /api/schedules/[scheduleId]`
- **설명**: 일정 수정
- **인증**: 필수
- **Body**: 수정할 필드들
- **응답**: 수정된 Schedule

#### `DELETE /api/schedules/[scheduleId]`
- **설명**: 일정 삭제
- **인증**: 필수
- **응답**: `{ success: true }`

---

### 5. Photos API

#### `GET /api/photos/organization/[orgId]`
- **설명**: 크루별 사진 조회
- **인증**: 필수
- **Query**: `?limit=50`
- **응답**: Photo 배열

#### `POST /api/photos`
- **설명**: 사진 추가 (메타데이터만, S3 업로드는 별도)
- **인증**: 필수
- **Body**: `{ photoId, url, organizationId, uploaderUid, ... }`
- **응답**: 생성된 Photo

#### `DELETE /api/photos/[photoId]`
- **설명**: 사진 삭제
- **인증**: 필수
- **응답**: `{ success: true }`

---

### 6. Activity Logs API

#### `GET /api/activity-logs/organization/[orgId]`
- **설명**: 크루별 활동 로그 조회
- **인증**: 필수
- **Query**: `?limit=50`
- **응답**: ActivityLog 배열

#### `POST /api/activity-logs`
- **설명**: 활동 로그 추가
- **인증**: 필수
- **Body**: `{ organizationId, action, userName, ... }`
- **응답**: 생성된 ActivityLog

---

## 🔒 인증 처리

### 미들웨어 함수: `withAuth()`

```typescript
// lib/api-auth.ts
export async function withAuth(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }

  const token = authHeader.substring(7)
  // Cognito JWT 토큰 검증
  const user = await verifyToken(token)
  return user
}
```

### 사용 예시

```typescript
// app/api/users/[userId]/route.ts
import { withAuth } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    const user = await withAuth(request)
    // ... 로직
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

---

## 📂 파일 구조

```
app/api/
├── users/
│   ├── [userId]/
│   │   └── route.ts          # GET, PUT /api/users/[userId]
│   ├── email/
│   │   └── [email]/
│   │       └── route.ts      # GET /api/users/email/[email]
│   └── route.ts              # POST /api/users
├── organizations/
│   ├── [orgId]/
│   │   └── route.ts          # GET, PUT, DELETE /api/organizations/[orgId]
│   ├── owner/
│   │   └── [ownerUid]/
│   │       └── route.ts      # GET /api/organizations/owner/[ownerUid]
│   └── route.ts              # GET, POST /api/organizations
├── members/
│   ├── [memberId]/
│   │   └── route.ts          # PUT, DELETE /api/members/[memberId]
│   ├── organization/
│   │   └── [orgId]/
│   │       └── route.ts      # GET /api/members/organization/[orgId]
│   ├── user/
│   │   └── [userId]/
│   │       └── route.ts      # GET /api/members/user/[userId]
│   └── route.ts              # POST /api/members
├── schedules/
│   ├── [scheduleId]/
│   │   └── route.ts          # GET, PUT, DELETE /api/schedules/[scheduleId]
│   ├── organization/
│   │   └── [orgId]/
│   │       └── route.ts      # GET /api/schedules/organization/[orgId]
│   └── route.ts              # POST /api/schedules
├── photos/
│   ├── [photoId]/
│   │   └── route.ts          # DELETE /api/photos/[photoId]
│   ├── organization/
│   │   └── [orgId]/
│   │       └── route.ts      # GET /api/photos/organization/[orgId]
│   └── route.ts              # POST /api/photos
└── activity-logs/
    ├── organization/
    │   └── [orgId]/
    │       └── route.ts      # GET /api/activity-logs/organization/[orgId]
    └── route.ts              # POST /api/activity-logs
```

---

## 🔄 클라이언트 전환 예시

### Before (직접 DynamoDB 호출)

```typescript
import { usersDB } from '@/lib/dynamodb'

const user = await usersDB.get(userId)
```

### After (API Routes 사용)

```typescript
const response = await fetch(`/api/users/${userId}`, {
  headers: {
    'Authorization': `Bearer ${idToken}`,
  },
})
const user = await response.json()
```

---

## 🚀 구현 순서

1. ✅ API 설계 문서 작성
2. ⏳ `lib/dynamodb-server.ts` 생성 (서버 전용)
3. ⏳ `lib/api-auth.ts` 생성 (인증 미들웨어)
4. ⏳ Users API Routes 구현
5. ⏳ Organizations API Routes 구현
6. ⏳ Members API Routes 구현
7. ⏳ Schedules API Routes 구현
8. ⏳ Photos & ActivityLogs API Routes 구현
9. ⏳ 클라이언트 코드 전환 (AuthContext, Dashboard 등)
10. ⏳ 환경 변수 재설정
11. ⏳ 테스트 및 검증

---

**작성일**: 2025-12-01
**상태**: 설계 완료, 구현 시작
