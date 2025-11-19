# 환경 변수 체크리스트

모꼬지 프로젝트 배포에 필요한 모든 환경 변수 목록입니다.

---

## 📋 전체 개요

**총 15개**의 환경 변수가 필요합니다:
- AWS S3: 4개
- Kakao Map API: 1개
- Firebase: 6개
- Feature Flags: 4개

---

## 1. AWS S3 Configuration (4개)

이미지 및 파일 업로드를 위한 S3 설정입니다.

### 1-1. NEXT_PUBLIC_AWS_REGION

```bash
NEXT_PUBLIC_AWS_REGION=ap-northeast-2
```

- **설명**: AWS S3 버킷이 위치한 리전
- **값**: `ap-northeast-2` (서울)
- **필수**: ✅ Yes
- **예시**: `ap-northeast-2`, `us-east-1`, `eu-west-1`

### 1-2. NEXT_PUBLIC_AWS_S3_BUCKET

```bash
NEXT_PUBLIC_AWS_S3_BUCKET=its-campers
```

- **설명**: S3 버킷 이름
- **값**: `its-campers`
- **필수**: ✅ Yes
- **확인 방법**:
  ```bash
  # AWS CLI로 확인
  aws s3 ls
  ```

### 1-3. NEXT_PUBLIC_AWS_ACCESS_KEY_ID

```bash
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=AKIA...
```

- **설명**: AWS IAM 액세스 키 ID
- **값**: `AKIA`로 시작하는 20자 문자열
- **필수**: ✅ Yes
- **보안**: ⚠️ 절대 Git에 커밋하지 마세요!
- **발급 방법**:
  1. AWS Console → **IAM** → **Users**
  2. 사용자 선택 → **Security credentials** 탭
  3. **Create access key** 클릭
  4. **Application running outside AWS** 선택
  5. 생성된 키 복사 (한 번만 표시됨!)

### 1-4. NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY

```bash
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=wJalrX...
```

- **설명**: AWS IAM 시크릿 액세스 키
- **값**: 40자 문자열
- **필수**: ✅ Yes
- **보안**: ⚠️ 절대 Git에 커밋하지 마세요!
- **발급 방법**: ACCESS_KEY_ID와 동시에 생성됨

---

## 2. Kakao Map API (1개)

지도 표시 및 장소 검색을 위한 API입니다.

### 2-1. NEXT_PUBLIC_KAKAO_MAP_API_KEY

```bash
NEXT_PUBLIC_KAKAO_MAP_API_KEY=a1b2c3d4e5f6...
```

- **설명**: Kakao Developers에서 발급받은 JavaScript 키
- **값**: 32자 문자열
- **필수**: ✅ Yes
- **발급 방법**:
  1. [Kakao Developers](https://developers.kakao.com/) 로그인
  2. **내 애플리케이션** → **애플리케이션 추가**
  3. 앱 이름: `모꼬지`
  4. 생성된 앱 클릭 → **앱 키** 탭
  5. **JavaScript 키** 복사
  6. **플랫폼** 탭에서 Web 플랫폼 추가:
     - 사이트 도메인: `http://localhost:3000`
     - 사이트 도메인: `https://mokoji.vercel.app` (배포 후)

---

## 3. Firebase Configuration (6개)

사용자 인증, 데이터베이스, 스토리지를 위한 Firebase 설정입니다.

### 3-1. NEXT_PUBLIC_FIREBASE_API_KEY

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
```

- **설명**: Firebase 프로젝트 API 키
- **값**: `AIzaSy`로 시작하는 문자열
- **필수**: ✅ Yes
- **확인 방법**:
  1. [Firebase Console](https://console.firebase.google.com/)
  2. 프로젝트 선택 (`mokoji-95640`)
  3. **프로젝트 설정** (⚙️ 아이콘) 클릭
  4. **일반** 탭 → **내 앱** 섹션
  5. **웹 앱** 선택 (없으면 앱 추가)
  6. **SDK 설정 및 구성** 보기

### 3-2. NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN

```bash
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mokoji-95640.firebaseapp.com
```

- **설명**: Firebase 인증 도메인
- **값**: `{프로젝트ID}.firebaseapp.com`
- **필수**: ✅ Yes
- **형식**: `mokoji-95640.firebaseapp.com`

### 3-3. NEXT_PUBLIC_FIREBASE_PROJECT_ID

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mokoji-95640
```

- **설명**: Firebase 프로젝트 ID
- **값**: `mokoji-95640`
- **필수**: ✅ Yes
- **확인 방법**: Firebase Console → 프로젝트 설정 → 프로젝트 ID

### 3-4. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

```bash
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mokoji-95640.firebasestorage.app
```

- **설명**: Firebase Storage 버킷
- **값**: `{프로젝트ID}.firebasestorage.app`
- **필수**: ✅ Yes
- **형식**: `mokoji-95640.firebasestorage.app`

### 3-5. NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID

```bash
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
```

- **설명**: Firebase Cloud Messaging 발신자 ID
- **값**: 12자리 숫자
- **필수**: ✅ Yes
- **확인 방법**: Firebase Console → 프로젝트 설정 → Cloud Messaging → 발신자 ID

### 3-6. NEXT_PUBLIC_FIREBASE_APP_ID

```bash
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

- **설명**: Firebase 앱 ID
- **값**: `1:{숫자}:web:{문자열}` 형식
- **필수**: ✅ Yes
- **확인 방법**: Firebase Console → 프로젝트 설정 → 일반 → 앱 ID

---

## 4. Feature Flags (4개)

채팅 기능의 점진적 배포를 위한 Feature Flag 설정입니다.

### 4-1. NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT

```bash
NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true
```

- **설명**: 채팅 기능 전체 활성화 여부
- **값**: `true` 또는 `false`
- **필수**: ✅ Yes
- **권장값**:
  - 개발: `true`
  - 프로덕션 (초기): `true` (rollout percentage로 제어)
  - 프로덕션 (문제 시): `false` (긴급 비활성화)

### 4-2. NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE

```bash
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
```

- **설명**: 채팅 기능 활성화 비율 (0-100)
- **값**: 0부터 100까지의 숫자
- **필수**: ✅ Yes
- **권장 전략**:
  - **1단계**: `10` (테스트 사용자 + 10%)
  - **2단계**: `50` (전체의 50%)
  - **3단계**: `100` (전체 배포)
- **예시**:
  ```bash
  # 10% 사용자만 활성화
  NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=10

  # 전체 활성화
  NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100

  # 비활성화 (ENABLE_SCHEDULE_CHAT은 true 유지)
  NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=0
  ```

### 4-3. NEXT_PUBLIC_CHAT_TEST_USERS

```bash
NEXT_PUBLIC_CHAT_TEST_USERS=
```

- **설명**: 채팅 기능을 우선 활성화할 사용자 ID (쉼표로 구분)
- **값**: 빈 문자열 또는 `userId1,userId2,userId3`
- **필수**: ⚠️ Optional
- **사용 시기**: 특정 사용자에게 먼저 테스트하고 싶을 때
- **예시**:
  ```bash
  # 테스트 사용자 지정
  NEXT_PUBLIC_CHAT_TEST_USERS=abc123,def456,ghi789

  # 사용 안 함 (비워둠)
  NEXT_PUBLIC_CHAT_TEST_USERS=
  ```

### 4-4. NEXT_PUBLIC_CHAT_TEST_ORGS

```bash
NEXT_PUBLIC_CHAT_TEST_ORGS=
```

- **설명**: 채팅 기능을 우선 활성화할 크루 ID (쉼표로 구분)
- **값**: 빈 문자열 또는 `orgId1,orgId2,orgId3`
- **필수**: ⚠️ Optional
- **사용 시기**: 특정 크루에게 먼저 테스트하고 싶을 때
- **예시**:
  ```bash
  # 테스트 크루 지정
  NEXT_PUBLIC_CHAT_TEST_ORGS=org_abc123,org_def456

  # 사용 안 함 (비워둠)
  NEXT_PUBLIC_CHAT_TEST_ORGS=
  ```

---

## ✅ 체크리스트

### 로컬 개발 환경 (.env.local)

- [ ] AWS S3 설정 (4개)
  - [ ] `NEXT_PUBLIC_AWS_REGION`
  - [ ] `NEXT_PUBLIC_AWS_S3_BUCKET`
  - [ ] `NEXT_PUBLIC_AWS_ACCESS_KEY_ID`
  - [ ] `NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY`

- [ ] Kakao Map API (1개)
  - [ ] `NEXT_PUBLIC_KAKAO_MAP_API_KEY`

- [ ] Firebase 설정 (6개)
  - [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
  - [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`

- [ ] Feature Flags (4개)
  - [ ] `NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true`
  - [ ] `NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100`
  - [ ] `NEXT_PUBLIC_CHAT_TEST_USERS=` (비워둠)
  - [ ] `NEXT_PUBLIC_CHAT_TEST_ORGS=` (비워둠)

### 프로덕션 환경 (.env.production)

- [ ] AWS S3 설정 (4개)
- [ ] Kakao Map API (1개)
- [ ] Firebase 설정 (6개)
- [ ] Feature Flags (4개)

### Vercel 환경 변수

- [ ] 총 15개 변수 Vercel Dashboard에 입력
- [ ] 모든 변수 **Production** 환경에 설정
- [ ] placeholder 값 (`YOUR_...`) 없음
- [ ] 빈 값 없음 (TEST_USERS, TEST_ORGS 제외)

---

## 🔐 보안 체크리스트

### Git에 커밋하면 안 되는 파일

- [ ] `.env.local` → ✅ `.gitignore`에 포함됨
- [ ] `.env.production` → ✅ `.gitignore`에 포함됨
- [ ] `firebase-service-account.json` (있다면)

### 안전한 환경 변수 관리

- [ ] `.env.production.example` 파일은 Git에 커밋 가능 (placeholder 값만)
- [ ] 실제 키 값은 Vercel Dashboard에만 입력
- [ ] AWS 키는 IAM 사용자별로 발급 (루트 계정 키 사용 금지)
- [ ] Firebase 키는 웹 앱용 키 사용 (Admin SDK 키 아님)

---

## 🧪 환경 변수 테스트

### 로컬에서 테스트

```bash
# .env.local 파일 확인
cat .env.local

# 개발 서버 실행
npm run dev

# 브라우저 개발자 도구 → Console
# Feature Flag 로그 확인:
# 🎯 Feature Flags Status: ...
```

### Vercel에서 테스트

1. Vercel Dashboard → **Settings** → **Environment Variables**
2. 모든 변수 설정 확인
3. **Deployments** → 최신 배포 클릭
4. **Visit** 버튼으로 앱 접속
5. 기능 테스트:
   - 로그인 (Firebase Auth)
   - 이미지 업로드 (AWS S3)
   - 지도 표시 (Kakao Map)
   - 채팅 (Feature Flag)

---

## 📝 환경 변수 백업

### 안전한 백업 방법

**방법 1: 비밀번호 관리자 사용**
- 1Password, LastPass, Bitwarden 등에 저장
- 프로젝트별 Secure Note 생성
- 팀원과 안전하게 공유

**방법 2: 암호화된 파일**
```bash
# .env.production을 암호화하여 저장
openssl enc -aes-256-cbc -salt -in .env.production -out .env.production.enc

# 복호화
openssl enc -d -aes-256-cbc -in .env.production.enc -out .env.production
```

**방법 3: Vercel에서 내보내기**
```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 환경 변수 확인
vercel env ls

# 특정 변수 가져오기
vercel env pull .env.production
```

---

## 🚨 문제 해결

### 환경 변수가 작동하지 않을 때

**증상:**
- `undefined` 에러
- Firebase 연결 실패
- S3 업로드 실패

**체크리스트:**

1. **변수 이름 확인**
   ```bash
   # 올바른 형식
   NEXT_PUBLIC_AWS_REGION=ap-northeast-2

   # 잘못된 형식 (오타)
   NEXT_PUBLC_AWS_REGION=ap-northeast-2  # ❌ PUBLC
   NEXT_PUBLIC_AWS_REGON=ap-northeast-2  # ❌ REGON
   ```

2. **클라이언트 변수 접두사**
   ```bash
   # 브라우저에서 접근 가능 ✅
   NEXT_PUBLIC_FIREBASE_API_KEY=...

   # 브라우저에서 접근 불가 ❌
   FIREBASE_API_KEY=...
   ```

3. **서버 재시작**
   ```bash
   # 환경 변수 변경 후 반드시 재시작
   npm run dev  # Ctrl+C 후 다시 실행
   ```

4. **Vercel Redeploy**
   - 환경 변수 변경 후
   - Dashboard → Deployments → Redeploy

---

## 📖 관련 문서

- [Git 설정 가이드](./GIT_SETUP.md)
- [Vercel 배포 가이드](./VERCEL_DEPLOY.md)
- [빠른 배포 가이드](../DEPLOY_NOW.md)
- [배포 가이드](../DEPLOYMENT.md)

---

## 📞 문의

환경 변수 설정 중 문제가 발생하면:

1. **AWS 관련**: [AWS IAM 문서](https://docs.aws.amazon.com/iam/)
2. **Kakao 관련**: [Kakao Developers](https://developers.kakao.com/docs)
3. **Firebase 관련**: [Firebase 문서](https://firebase.google.com/docs)
4. **Vercel 관련**: [Vercel 환경 변수 문서](https://vercel.com/docs/environment-variables)

---

완료! ✅

**총 15개 환경 변수** 설정 완료 후 배포 진행하세요.
