# 🚀 Firebase → AWS 완전 마이그레이션 플랜

## 📊 현재 상태 (AS-IS)

### Firebase 사용 중
- ✅ **Firebase Authentication**: 사용자 인증 (Google, Email/Password)
- ✅ **Firestore Database**: 모든 데이터 저장
  - organizations (크루)
  - organizationMembers (멤버)
  - userProfiles (사용자 프로필)
  - org_schedules (일정)
  - org_activity_logs (활동 로그)
  - org_schedules_archive (아카이브)

### AWS 사용 중
- ✅ **AWS S3**: 이미지/파일 저장 (이미 구현됨)

---

## 🎯 목표 (TO-BE)

### AWS로 완전 이전
- 🔄 **AWS Cognito**: Firebase Auth 대체
- 🔄 **AWS DynamoDB**: Firestore 대체
- ✅ **AWS S3**: 계속 사용
- 🆕 **AWS Lambda**: API/비즈니스 로직
- 🆕 **AWS API Gateway**: REST API 엔드포인트
- 🆕 **AWS AppSync** (선택): GraphQL API (필요시)
- 🆕 **AWS CloudFront**: CDN

---

## ⚠️ 마이그레이션 난이도 및 예상 시간

### 전체 마이그레이션
- **난이도**: ⭐⭐⭐⭐⭐ (매우 높음)
- **예상 시간**: 3-4주 (풀타임 기준)
- **위험도**: 높음 (모든 데이터/인증 시스템 변경)

### 단계별 난이도

| 단계 | 작업 | 난이도 | 예상 시간 |
|------|------|--------|-----------|
| 1 | AWS 인프라 설정 | ⭐⭐ | 2-3일 |
| 2 | DynamoDB 스키마 설계 | ⭐⭐⭐⭐ | 3-4일 |
| 3 | 데이터 마이그레이션 | ⭐⭐⭐⭐⭐ | 5-7일 |
| 4 | 인증 시스템 교체 | ⭐⭐⭐⭐⭐ | 5-7일 |
| 5 | API 구현 | ⭐⭐⭐⭐ | 4-5일 |
| 6 | 프론트엔드 수정 | ⭐⭐⭐⭐⭐ | 5-7일 |
| 7 | 테스트 및 배포 | ⭐⭐⭐ | 3-4일 |

---

## 📋 상세 마이그레이션 플랜

## Phase 1: AWS 인프라 설정 (2-3일)

### 1.1 AWS 계정 및 리전 설정
```bash
# AWS CLI 설치 및 설정
aws configure
# 리전: ap-northeast-2 (서울)
```

### 1.2 필요한 AWS 서비스 생성
- [ ] **Cognito User Pool**: 사용자 인증
- [ ] **DynamoDB Tables**: 데이터베이스
- [ ] **Lambda Functions**: 비즈니스 로직
- [ ] **API Gateway**: REST API
- [ ] **IAM Roles**: 권한 관리
- [ ] **CloudWatch**: 로깅/모니터링

### 1.3 환경 변수 설정
```bash
# .env.local
AWS_REGION=ap-northeast-2
AWS_COGNITO_USER_POOL_ID=...
AWS_COGNITO_CLIENT_ID=...
AWS_DYNAMODB_ENDPOINT=...
```

---

## Phase 2: DynamoDB 스키마 설계 (3-4일)

### 2.1 테이블 구조 설계

#### Table 1: Users
```
PK: userId (String)
Attributes:
  - email (String)
  - name (String)
  - avatar (String)
  - birthdate (String)
  - gender (String)
  - location (String)
  - mbti (String)
  - createdAt (Number)
  - updatedAt (Number)

GSI: email-index
```

#### Table 2: Organizations
```
PK: organizationId (String)
Attributes:
  - name (String)
  - description (String)
  - categories (List)
  - ownerUid (String)
  - ownerName (String)
  - avatar (String)
  - memberCount (Number)
  - createdAt (Number)
  - updatedAt (Number)

GSI: ownerUid-index
```

#### Table 3: OrganizationMembers
```
PK: memberId (String)
SK: organizationId#userId (String)
Attributes:
  - organizationId (String)
  - userId (String)
  - role (String)
  - joinedAt (Number) ⚠️ 보호 필요!
  - status (String)

GSI1: organizationId-index
GSI2: userId-index
```

#### Table 4: Schedules
```
PK: scheduleId (String)
Attributes:
  - organizationId (String)
  - title (String)
  - date (String)
  - time (String)
  - location (String)
  - participants (List)
  - maxParticipants (Number)
  - createdBy (String)
  - createdAt (Number)
  - updatedAt (Number)

GSI: organizationId-date-index
```

#### Table 5: ActivityLogs
```
PK: logId (String)
SK: organizationId#timestamp (String)
Attributes:
  - organizationId (String)
  - userId (String)
  - userName (String)
  - action (String)
  - details (Map)
  - timestamp (Number)

GSI: organizationId-index
```

### 2.2 DynamoDB 테이블 생성 스크립트
```typescript
// scripts/aws/create-dynamodb-tables.ts
```

---

## Phase 3: 데이터 마이그레이션 (5-7일)

### 3.1 Firebase → DynamoDB 마이그레이션 스크립트

⚠️ **중요**: 마이그레이션 전 반드시 백업!

```bash
# 1. Firebase 데이터 전체 백업
npm run backup:members
# + 모든 컬렉션 백업
```

### 3.2 마이그레이션 순서

1. **Users 마이그레이션**
   ```typescript
   // userProfiles → Users 테이블
   ```

2. **Organizations 마이그레이션**
   ```typescript
   // organizations → Organizations 테이블
   ```

3. **OrganizationMembers 마이그레이션**
   ```typescript
   // organizationMembers → OrganizationMembers 테이블
   // ⚠️ joinedAt 보존 필수!
   ```

4. **Schedules 마이그레이션**
   ```typescript
   // org_schedules → Schedules 테이블
   ```

5. **ActivityLogs 마이그레이션**
   ```typescript
   // org_activity_logs → ActivityLogs 테이블
   ```

### 3.3 데이터 검증
- [ ] 모든 레코드 수 일치
- [ ] joinedAt 데이터 보존 확인
- [ ] 관계 데이터 무결성 확인

---

## Phase 4: 인증 시스템 교체 (5-7일)

### 4.1 Cognito User Pool 설정
```typescript
// lib/cognito.ts
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
```

### 4.2 Firebase Users → Cognito 마이그레이션
- [ ] 모든 사용자 계정 생성
- [ ] 비밀번호는 재설정 링크 발송
- [ ] 소셜 로그인 재연동 필요

### 4.3 AuthContext 재작성
```typescript
// contexts/AuthContext.tsx
// Firebase Auth → Cognito
```

### 4.4 모든 페이지 인증 로직 수정
- [ ] app/auth/page.tsx
- [ ] 모든 protected routes
- [ ] 세션 관리

---

## Phase 5: API 구현 (4-5일)

### 5.1 Lambda Functions 구현

#### Function 1: users-api
```typescript
// GET /users/{userId}
// PUT /users/{userId}
// DELETE /users/{userId}
```

#### Function 2: organizations-api
```typescript
// GET /organizations
// POST /organizations
// PUT /organizations/{orgId}
// DELETE /organizations/{orgId}
```

#### Function 3: members-api
```typescript
// GET /organizations/{orgId}/members
// POST /organizations/{orgId}/members
// DELETE /organizations/{orgId}/members/{memberId}
```

#### Function 4: schedules-api
```typescript
// GET /schedules
// POST /schedules
// PUT /schedules/{scheduleId}
// DELETE /schedules/{scheduleId}
```

### 5.2 API Gateway 설정
```yaml
/api/users/{userId}:
  GET: users-api
  PUT: users-api
  DELETE: users-api

/api/organizations:
  GET: organizations-api
  POST: organizations-api

/api/organizations/{orgId}/members:
  GET: members-api
  POST: members-api
```

---

## Phase 6: 프론트엔드 수정 (5-7일)

### 6.1 모든 Firestore 쿼리 교체

#### Before (Firestore)
```typescript
import { collection, getDocs, query, where } from 'firebase/firestore'

const q = query(
  collection(db, 'organizationMembers'),
  where('organizationId', '==', orgId)
)
const snapshot = await getDocs(q)
```

#### After (AWS API)
```typescript
const response = await fetch(`/api/organizations/${orgId}/members`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
const members = await response.json()
```

### 6.2 수정 필요한 파일 (20개)
- [ ] app/dashboard/page.tsx
- [ ] app/schedules/[scheduleId]/ScheduleDetailClient.tsx
- [ ] app/crew/[crewId]/settings/page.tsx
- [ ] app/crew/[crewId]/settings/CrewSettingsClient.tsx
- [ ] contexts/AuthContext.tsx
- [ ] ... (나머지 16개 파일)

### 6.3 새로운 API 클라이언트 라이브러리
```typescript
// lib/api-client.ts
export class APIClient {
  async getMembers(orgId: string) { }
  async createSchedule(data: Schedule) { }
  // ...
}
```

---

## Phase 7: 테스트 및 배포 (3-4일)

### 7.1 로컬 테스트
- [ ] 모든 기능 동작 확인
- [ ] 인증 플로우 테스트
- [ ] CRUD 작업 테스트
- [ ] 에러 핸들링 테스트

### 7.2 스테이징 배포
- [ ] 스테이징 환경 구축
- [ ] 실제 데이터로 테스트
- [ ] 성능 테스트
- [ ] 부하 테스트

### 7.3 프로덕션 배포
- [ ] DNS 전환
- [ ] 모니터링 설정
- [ ] 롤백 플랜 준비

---

## 💰 비용 예상 (월간)

### Firebase (현재)
- Firestore: 무료 (소규모)
- Authentication: 무료
- **총 비용**: $0 ~ $10/월

### AWS (마이그레이션 후)
- DynamoDB: $5 ~ $20/월
- Cognito: $0 (무료 티어)
- Lambda: $5 ~ $15/월
- API Gateway: $3 ~ $10/월
- S3: $1 ~ $5/월 (이미 사용 중)
- CloudWatch: $2 ~ $5/월
- **총 비용**: $16 ~ $55/월

---

## 🚨 리스크 및 고려사항

### 높은 리스크
1. **데이터 유실 가능성**
   - 마이그레이션 중 오류 발생 시
   - 해결책: 완전한 백업, 단계별 검증

2. **인증 시스템 전환**
   - 모든 사용자가 재로그인 필요
   - 비밀번호 재설정 필요
   - 해결책: 사전 공지, 재설정 링크 자동 발송

3. **다운타임**
   - 최소 몇 시간 ~ 하루
   - 해결책: 계획된 유지보수 공지

### 기술적 복잡성
- DynamoDB는 Firestore보다 복잡함
- NoSQL 쿼리 패턴 다름
- Lambda 콜드 스타트 이슈

---

## 🤔 대안 제안

### 대안 1: Firebase 계속 사용 + 보안 강화 (현재)
**장점**:
- ✅ 이미 구현됨
- ✅ Security Rules로 데이터 보호
- ✅ 백업/복구 시스템 구축됨
- ✅ 비용 저렴
- ✅ 빠른 개발 속도

**단점**:
- ❌ Firebase 종속성
- ❌ 과거 데이터 유실 경험

### 대안 2: 점진적 마이그레이션
**Phase 1**: 새 기능만 AWS (하이브리드)
**Phase 2**: 기존 데이터 점진적 이전
**Phase 3**: Firebase 완전 제거

**장점**:
- ✅ 리스크 분산
- ✅ 다운타임 최소화
- ✅ 롤백 용이

### 대안 3: 다른 서비스 고려
- **Supabase**: PostgreSQL + Auth
- **PlanetScale**: MySQL
- **MongoDB Atlas**: MongoDB

---

## 📞 다음 단계

제가 권장하는 접근:

### 옵션 A: 현재 Firebase 유지 (권장)
**이유**:
1. ✅ Security Rules로 데이터 완전 보호
2. ✅ 백업 시스템 구축 완료
3. ✅ 안정적인 서비스
4. ✅ 빠른 개발 속도
5. ✅ 저렴한 비용

**추가 조치**:
- 정기 백업 자동화
- 모니터링 강화
- 코드 리뷰 프로세스

### 옵션 B: AWS 완전 마이그레이션
**조건**:
- 3-4주 개발 시간 확보
- 다운타임 허용
- 비용 증가 감수
- 복잡성 증가 감수

**저는 어떤 옵션을 선택하시겠습니까?**

1. **현재 Firebase 유지** (안전하고 검증됨)
2. **AWS 완전 마이그레이션** (3-4주 소요)
3. **점진적 하이브리드** (새 기능부터 AWS)

선택해주시면 바로 진행하겠습니다.
