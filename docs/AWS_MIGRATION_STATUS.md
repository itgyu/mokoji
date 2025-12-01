# 🚀 AWS 마이그레이션 현황

**마지막 업데이트**: 2025-12-01

---

## ✅ 완료된 작업 (Phase 1-3)

### Phase 1: AWS 인프라 설정 ✅
- **DynamoDB 테이블 5개 생성 완료**
  - mokoji-users
  - mokoji-organizations
  - mokoji-organization-members
  - mokoji-schedules
  - mokoji-activity-logs
- **Cognito User Pool 생성 완료**
  - User Pool ID: `ap-northeast-2_2F6sdouGR`
  - Client ID: `5vl7s1q093kpelmk8oa72krp4g`
  - Region: ap-northeast-2 (서울)
- **환경 변수 설정**: `.env.aws` 파일 생성 완료

### Phase 2: DynamoDB 스키마 설계 ✅
- 5개 테이블 스키마 설계 완료
- GSI (Global Secondary Index) 설정 완료
- On-Demand 빌링 모드 설정 (비용 최적화)

### Phase 3: 데이터 마이그레이션 ✅

#### Phase 3.1: 백업 완료 ✅
- `organizationMembers` 백업: 38명
- 백업 파일: `/backups/organizationMembers_2025-12-01T05-17-22.json`
- **모든 joinedAt 데이터 보존됨**

#### Phase 3.2: Firebase → DynamoDB 마이그레이션 완료 ✅
| 컬렉션 | 성공 | 전체 | 상태 |
|--------|------|------|------|
| Users | 37 | 44 | ✅ (7명 email 없음) |
| Organizations | 1 | 1 | ✅ |
| **Members** | **38** | **38** | ✅ **joinedAt 보존!** |
| Schedules | 15 | 19 | ✅ (4개 orgId 없음) |
| Activity Logs | 0 | 0 | ✅ (데이터 없음) |

**마이그레이션 보고서**: `/backups/migration-report-2025-12-01T05-22-40.json`

#### Phase 3.3: Firebase Auth → Cognito 마이그레이션 완료 ✅
- **37명 사용자 100% 성공**
- 임시 비밀번호 생성 및 저장 완료
- 보고서: `/backups/cognito-migration-2025-12-01T05-27-00.json`

---

## 📊 마이그레이션 통계

### 데이터
- ✅ 사용자: 37명
- ✅ 조직: 1개
- ✅ 멤버: 38명 (joinedAt 보존 완료!)
- ✅ 일정: 15개
- ✅ 활동 로그: 0개

### AWS 리소스
- ✅ DynamoDB 테이블: 5개
- ✅ Cognito 사용자: 37명
- ✅ Region: ap-northeast-2 (서울)

---

## 🔜 다음 단계 (Phase 4-7)

### Phase 4: Cognito 인증 시스템 구현
**예상 시간**: 5-7일

#### 4.1 Cognito SDK 설치
```bash
npm install @aws-sdk/client-cognito-identity-provider amazon-cognito-identity-js
```

#### 4.2 AuthContext 재작성
- `/contexts/AuthContext.tsx` - Firebase → Cognito 전환
- Cognito 로그인/로그아웃 구현
- 세션 관리 (JWT 토큰)

#### 4.3 인증 페이지 수정
- `/app/auth/page.tsx` - Cognito 로그인 UI
- 비밀번호 재설정 플로우
- 이메일 인증 플로우

**주요 파일**:
- `contexts/AuthContext.tsx`
- `app/auth/page.tsx`
- `lib/cognito.ts` (새로 생성)

---

### Phase 5: Lambda API 함수 구현
**예상 시간**: 4-5일

#### 5.1 Lambda 함수 생성
필요한 Lambda 함수:
1. `users-api` - GET/PUT/DELETE /users/{userId}
2. `organizations-api` - GET/POST/PUT/DELETE /organizations
3. `members-api` - GET/POST/DELETE /organizations/{orgId}/members
4. `schedules-api` - GET/POST/PUT/DELETE /schedules
5. `activity-logs-api` - GET /activity-logs

#### 5.2 API Gateway 설정
- REST API 엔드포인트 생성
- Cognito Authorizer 연결
- CORS 설정

#### 5.3 배포 스크립트
```bash
./scripts/aws/deploy-lambda-functions.sh
```

**디렉토리 구조**:
```
lambda/
├── users/
│   └── index.ts
├── organizations/
│   └── index.ts
├── members/
│   └── index.ts
├── schedules/
│   └── index.ts
└── activity-logs/
    └── index.ts
```

---

### Phase 6: 프론트엔드 코드 전면 수정
**예상 시간**: 5-7일

#### 6.1 수정 필요한 파일 (20개)

**인증 관련**:
- `contexts/AuthContext.tsx`
- `app/auth/page.tsx`

**대시보드**:
- `app/dashboard/page.tsx`
- `app/dashboard/DashboardClient.tsx`

**크루 관리**:
- `app/crew/[crewId]/page.tsx`
- `app/crew/[crewId]/settings/page.tsx`
- `app/crew/[crewId]/settings/CrewSettingsClient.tsx`

**일정 관리**:
- `app/schedules/page.tsx`
- `app/schedules/[scheduleId]/page.tsx`
- `app/schedules/[scheduleId]/ScheduleDetailClient.tsx`

**프로필**:
- `app/profile/page.tsx`
- `app/profile/ProfileClient.tsx`

**기타 (나머지 8개)**:
- 모든 Firestore 쿼리를 API 호출로 변경
- `import { db } from 'lib/firebase'` → `import { apiClient } from 'lib/api-client'`

#### 6.2 API 클라이언트 라이브러리 생성
```typescript
// lib/api-client.ts
export class APIClient {
  async getUser(userId: string) { }
  async getMembers(orgId: string) { }
  async createSchedule(data: Schedule) { }
  // ...
}
```

#### 6.3 Firebase 코드 제거
모든 Firestore 쿼리 찾기:
```bash
grep -r "collection(db" app/
grep -r "getDocs" app/
grep -r "getDoc" app/
grep -r "setDoc" app/
grep -r "updateDoc" app/
grep -r "deleteDoc" app/
```

---

### Phase 7: 테스트 및 배포
**예상 시간**: 3-4일

#### 7.1 로컬 테스트
- [ ] 로그인/로그아웃
- [ ] 크루 생성/수정/삭제
- [ ] 멤버 추가/삭제
- [ ] 일정 생성/수정/삭제/참여
- [ ] 프로필 수정

#### 7.2 스테이징 배포
- Vercel 스테이징 환경 배포
- AWS 스테이징 리소스 생성

#### 7.3 프로덕션 배포
- DNS 전환
- 모니터링 설정 (CloudWatch)
- 롤백 플랜 준비

---

## 💰 비용 예상

### 현재 (Phase 1-3 완료)
- DynamoDB: ~$0/월 (프리 티어)
- Cognito: $0 (프리 티어, 50,000 MAU까지)
- **월 예상 비용**: $0

### 완전 마이그레이션 후 (Phase 4-7 완료)
- DynamoDB: $5-20/월
- Cognito: $0
- Lambda: $5-15/월
- API Gateway: $3-10/월
- CloudWatch: $2-5/월
- **월 예상 비용**: $15-50/월

---

## 📝 마이그레이션 스크립트

### 생성된 스크립트
1. ✅ `scripts/aws/create-dynamodb-tables.sh` - DynamoDB 테이블 생성
2. ✅ `scripts/aws/create-cognito-user-pool.sh` - Cognito User Pool 생성
3. ✅ `scripts/aws/migrate-firebase-to-dynamodb.ts` - Firebase → DynamoDB 데이터 마이그레이션
4. ✅ `scripts/aws/migrate-users-to-cognito.ts` - Firebase Auth → Cognito 사용자 마이그레이션
5. ✅ `scripts/backup-organization-members.ts` - organizationMembers 백업
6. ✅ `scripts/restore-organization-members.ts` - organizationMembers 복구

### 실행 명령어
```bash
# 백업
npm run backup:members

# 복구
npm run restore:members <백업파일명>

# DynamoDB 테이블 생성
./scripts/aws/create-dynamodb-tables.sh

# Cognito User Pool 생성
./scripts/aws/create-cognito-user-pool.sh

# 데이터 마이그레이션
npm run migrate:firebase-to-dynamodb

# 사용자 마이그레이션
npm run migrate:users-to-cognito
```

---

## 🎯 핵심 성과

### 데이터 보호
- ✅ **joinedAt 필드 100% 보존** (38명 전원)
- ✅ Firestore Security Rules 배포 완료
- ✅ 백업/복구 시스템 구축 완료
- ✅ 데이터 유실 방지 시스템 완비

### 마이그레이션
- ✅ DynamoDB: 91개 레코드 마이그레이션 성공
- ✅ Cognito: 37명 사용자 마이그레이션 성공
- ✅ 데이터 무결성 검증 완료

---

## ⚠️ 주의사항

### 현재 상태
- **Firebase는 아직 활성화되어 있습니다**
- **프론트엔드는 여전히 Firebase를 사용 중입니다**
- **DynamoDB와 Cognito는 준비되었지만 아직 연결되지 않았습니다**

### Phase 4-7 완료 전까지
- 사용자는 Firebase로 로그인합니다
- 데이터는 Firebase Firestore에서 읽고 씁니다
- DynamoDB의 데이터는 사용되지 않습니다

### Phase 4-7 완료 후
- 사용자는 Cognito로 로그인합니다
- 데이터는 DynamoDB (via Lambda API)에서 읽고 씁니다
- Firebase는 완전히 비활성화할 수 있습니다

---

## 📞 다음 작업 우선순위

### 옵션 A: 점진적 전환 (권장)
1. Phase 4: Cognito 인증 구현 (1주)
2. Phase 5: Lambda API 구현 (1주)
3. Phase 6: 프론트엔드 수정 (1-2주)
4. Phase 7: 테스트 및 배포 (3-4일)

**총 예상 시간**: 3-4주

### 옵션 B: 현재 상태 유지
- DynamoDB와 Cognito는 준비됨
- 필요할 때 Phase 4-7 진행
- Firebase 계속 사용

---

## 🔗 관련 문서
- [AWS 마이그레이션 플랜](./AWS_MIGRATION_PLAN.md)
- [데이터 보호 가이드](./DATA_PROTECTION_GUIDE.md)

---

**마이그레이션 진행률**: Phase 1-3 완료 (42%) | Phase 4-7 대기 중 (58%)
