# 🚨 Vercel 배포 시 멤버 리스트/회원정보 미표시 문제 분석 보고서

## 📅 분석 일자
2025-12-01

---

## 🔴 문제 증상

Vercel 서버에 배포된 Mokoji 애플리케이션에서:
- ❌ 멤버 리스트가 표시되지 않음
- ❌ 회원 정보가 표시되지 않음
- ⚠️ 로컬 환경에서는 정상 작동 예상

---

## 🔍 근본 원인 분석

### 1. **치명적 보안 문제: 클라이언트 사이드 AWS 자격 증명 노출**

#### 문제 코드 위치: `/lib/dynamodb.ts:14-19`
```typescript
const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});
```

**문제점:**
- ❌ `NEXT_PUBLIC_` 접두사를 사용하면 브라우저에 환경 변수가 노출됨
- ❌ AWS Access Key와 Secret Key가 클라이언트 사이드 JavaScript 번들에 포함됨
- ❌ 브라우저 개발자 도구에서 자격 증명 확인 가능
- 🔥 **심각한 보안 위험**: 누구나 AWS 자격 증명을 탈취할 수 있음

#### 영향을 받는 파일:
1. `/contexts/AuthContext.tsx:5-6` (클라이언트 컴포넌트)
   ```typescript
   'use client'
   import { usersDB, membersDB } from '@/lib/dynamodb'
   ```

2. `/app/dashboard/page.tsx:36` (클라이언트 컴포넌트)
   ```typescript
   'use client'
   import { usersDB, organizationsDB, membersDB, schedulesDB, activityLogsDB, photosDB } from '@/lib/dynamodb'
   ```

3. `/lib/firestore-helpers.ts` (클라이언트에서 호출)

---

### 2. **Vercel 환경 변수 미설정**

#### 현재 상태:
- `.env.local` 파일은 로컬 개발 환경에서만 사용됨
- Vercel 배포 시 `.env.local` 파일이 업로드되지 않음
- Vercel 프로젝트 설정에 환경 변수가 설정되지 않음

#### 결과:
```typescript
accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '' // → ''
secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '' // → ''
```

**빈 자격 증명으로 AWS DynamoDB 호출 → 인증 실패**

---

### 3. **잘못된 아키텍처 패턴**

#### 현재 (잘못된) 아키텍처:
```
브라우저 (클라이언트)
    ↓
직접 DynamoDB 호출 (with exposed credentials)
    ↓
AWS DynamoDB
```

#### 올바른 아키텍처:
```
브라우저 (클라이언트)
    ↓
Next.js API Routes (서버 사이드)
    ↓ (서버에서만 사용하는 credentials)
AWS DynamoDB
```

---

## 📊 영향 범위

### 작동하지 않는 기능:
1. ❌ 사용자 프로필 조회 (`usersDB.getByEmail`, `usersDB.get`)
2. ❌ 멤버십 조회 (`membersDB.getByUser`, `membersDB.getByOrganization`)
3. ❌ 크루 목록 조회 (`organizationsDB.get`, `organizationsDB.getAll`)
4. ❌ 일정 조회 (`schedulesDB.getByOrganization`)
5. ❌ 사진 조회 (`photosDB.getByOrganization`)
6. ❌ 활동 로그 조회 (`activityLogsDB.getByOrganization`)
7. ❌ 모든 CRUD 작업 (create, update, delete)

### 여전히 작동하는 기능:
✅ Cognito 인증 (Cognito는 클라이언트 사이드 SDK 지원)
✅ 정적 페이지 렌더링
✅ UI 표시

---

## 🔧 해결 방안

### Option 1: API Routes 아키텍처 (권장 ⭐)

#### 장점:
- ✅ 보안: AWS 자격 증명이 서버에만 존재
- ✅ 확장성: Rate limiting, 캐싱, 로깅 추가 가능
- ✅ 유지보수: 백엔드 로직을 한 곳에서 관리

#### 작업 내용:
1. **API Routes 생성** (`/app/api/` 디렉토리)
   - `GET /api/users/[userId]` - 사용자 프로필 조회
   - `GET /api/organizations` - 크루 목록 조회
   - `GET /api/organizations/[orgId]/members` - 멤버 조회
   - `POST /api/organizations` - 크루 생성
   - `PUT /api/organizations/[orgId]` - 크루 수정
   - `DELETE /api/organizations/[orgId]` - 크루 삭제
   - 등등...

2. **lib/dynamodb.ts 수정**
   ```typescript
   // NEXT_PUBLIC_ 제거
   const client = new DynamoDBClient({
     region: process.env.AWS_REGION || 'ap-northeast-2',
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
     },
   });
   ```

3. **클라이언트 코드 수정**
   - `usersDB.get()` → `fetch('/api/users/' + userId)`
   - `organizationsDB.getAll()` → `fetch('/api/organizations')`
   - 등등...

4. **Vercel 환경 변수 설정** (NEXT_PUBLIC_ 없이)
   ```
   AWS_REGION=ap-northeast-2
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=mqAO...
   AWS_S3_BUCKET=mokoji
   AWS_COGNITO_USER_POOL_ID=ap-northeast-2_2F6sdouGR
   AWS_COGNITO_CLIENT_ID=5vl7s1q093kpelmk8oa72krp4g
   DYNAMODB_USERS_TABLE=mokoji-users
   DYNAMODB_ORGANIZATIONS_TABLE=mokoji-organizations
   DYNAMODB_MEMBERS_TABLE=mokoji-organization-members
   DYNAMODB_SCHEDULES_TABLE=mokoji-schedules
   DYNAMODB_ACTIVITY_LOGS_TABLE=mokoji-activity-logs
   DYNAMODB_PHOTOS_TABLE=mokoji-photos
   ```

#### 예상 작업 시간:
- API Routes 생성: **4-6시간**
- 클라이언트 코드 전환: **3-4시간**
- 테스트 및 디버깅: **2-3시간**
- **총 예상 시간: 9-13시간 (1-2일)**

---

### Option 2: IAM Role 기반 인증 (AWS 전문가용)

#### 장점:
- ✅ 자격 증명 하드코딩 불필요
- ✅ AWS best practice

#### 단점:
- ❌ Vercel에서 IAM Role 사용 복잡
- ❌ 추가 설정 필요 (AWS IAM, Vercel 환경)

#### 작업 내용:
- AWS IAM 역할 생성
- Vercel에서 임시 자격 증명 사용
- STS AssumeRole 구현

---

### Option 3: 임시 조치 (비권장 ⚠️)

**Vercel에 NEXT_PUBLIC_ 환경 변수 설정**

#### 장점:
- ✅ 빠른 해결 (5분 이내)

#### 치명적 단점:
- 🔥 **보안 위험**: AWS 자격 증명이 클라이언트에 노출
- 🔥 **악용 가능**: 누구나 DynamoDB 데이터 조작 가능
- 🔥 **비용 폭탄**: 악의적 사용자가 무제한 요청 가능
- ❌ 프로덕션 환경에 절대 사용 금지

#### 설정 방법 (테스트 목적으로만):
1. Vercel 프로젝트 → Settings → Environment Variables
2. 다음 변수 추가:
   ```
   NEXT_PUBLIC_AWS_REGION=ap-northeast-2
   NEXT_PUBLIC_AWS_ACCESS_KEY_ID=AKIA******************
   NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=****************************************
   NEXT_PUBLIC_AWS_S3_BUCKET=mokoji
   NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=ap-northeast-2_2F6sdouGR
   NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=5vl7s1q093kpelmk8oa72krp4g
   NEXT_PUBLIC_DYNAMODB_USERS_TABLE=mokoji-users
   NEXT_PUBLIC_DYNAMODB_ORGANIZATIONS_TABLE=mokoji-organizations
   NEXT_PUBLIC_DYNAMODB_MEMBERS_TABLE=mokoji-organization-members
   NEXT_PUBLIC_DYNAMODB_SCHEDULES_TABLE=mokoji-schedules
   NEXT_PUBLIC_DYNAMODB_ACTIVITY_LOGS_TABLE=mokoji-activity-logs
   NEXT_PUBLIC_DYNAMODB_PHOTOS_TABLE=mokoji-photos
   ```
3. 재배포

⚠️ **경고: 이 방법은 테스트 목적으로만 사용하고, 즉시 Option 1로 전환하세요!**

---

## 🎯 권장 해결 순서

### 1단계: 임시 조치 (긴급)
- Vercel에 NEXT_PUBLIC_ 환경 변수 설정
- 애플리케이션 작동 확인
- ⏱️ **시간: 5분**

### 2단계: 장기 해결 (필수)
- API Routes 아키텍처로 전환
- NEXT_PUBLIC_ 제거
- 보안 강화
- ⏱️ **시간: 1-2일**

### 3단계: 추가 보안 강화
- AWS IAM 권한 최소화 (Least Privilege)
- DynamoDB 테이블별 세밀한 권한 설정
- API Rate Limiting 추가
- ⏱️ **시간: 2-3시간**

---

## 📋 체크리스트

### 즉시 해결 (임시)
- [ ] Vercel 환경 변수 설정
- [ ] 재배포
- [ ] 멤버 리스트 표시 확인
- [ ] 회원 정보 표시 확인

### 장기 해결 (필수)
- [ ] API Routes 설계 문서 작성
- [ ] API Routes 구현
- [ ] 클라이언트 코드 전환
- [ ] NEXT_PUBLIC_ 제거
- [ ] Vercel 환경 변수 재설정 (NEXT_PUBLIC_ 없이)
- [ ] 재배포 및 테스트
- [ ] 브라우저 번들에서 자격 증명 제거 확인

### 보안 강화
- [ ] AWS IAM 권한 최소화
- [ ] API Rate Limiting 구현
- [ ] 로깅 및 모니터링 추가
- [ ] 보안 테스트

---

## 💰 비용 영향

### 현재 아키텍처 (클라이언트 직접 호출)
- 🔥 **보안 위험으로 인한 잠재적 비용 폭탄**
- 악의적 사용자가 무제한 DynamoDB 작업 가능
- 예상 최악의 시나리오: **수천~수만 달러/월**

### API Routes 아키텍처
- ✅ Rate Limiting으로 비용 제어
- ✅ 예상 비용: **$5-50/월** (정상 사용 시)

---

## 🎓 교훈

### 잘못된 점
1. ❌ AWS 자격 증명을 클라이언트 사이드에 노출
2. ❌ `NEXT_PUBLIC_` 접두사를 AWS 자격 증명에 사용
3. ❌ 클라이언트 컴포넌트에서 직접 AWS SDK 사용
4. ❌ Vercel 배포 전 보안 검토 부족

### 올바른 방법
1. ✅ 서버 사이드에서만 AWS 자격 증명 사용
2. ✅ API Routes를 통한 간접 접근
3. ✅ 환경 변수에 `NEXT_PUBLIC_` 사용 금지 (비밀 정보)
4. ✅ 배포 전 보안 체크리스트 확인

---

## 🚀 다음 단계

### 즉시 (오늘 내로):
1. ⚠️ Vercel 환경 변수 설정 (임시 조치)
2. ⚠️ 애플리케이션 작동 확인

### 긴급 (1-2일 내):
1. 🔴 API Routes 아키텍처 설계
2. 🔴 API Routes 구현 시작
3. 🔴 클라이언트 코드 전환

### 중요 (1주일 내):
1. 🟡 보안 강화 (IAM 권한, Rate Limiting)
2. 🟡 모니터링 및 로깅 추가
3. 🟡 보안 테스트

---

## 📞 참고 자료

### Next.js 공식 문서
- [API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

### AWS 보안 Best Practices
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [DynamoDB Security](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/security.html)

### Vercel 문서
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**작성자**: Claude (AI Assistant)
**작성일**: 2025-12-01
**우선순위**: 🔴 **긴급 - 보안 위험**
**상태**: ⚠️ **프로덕션 배포 불가 상태**
