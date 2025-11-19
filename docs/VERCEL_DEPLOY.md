# Vercel 배포 가이드

모꼬지 프로젝트를 Vercel에 배포하는 방법입니다.

---

## 📋 사전 준비

### 필수 항목

- [x] GitHub 저장소 생성 완료 ([가이드 보기](./GIT_SETUP.md))
- [x] 코드가 GitHub에 푸시 완료
- [x] Vercel 계정 (없으면 GitHub으로 가입)
- [x] 환경 변수 값 준비 ([체크리스트 보기](./ENV_CHECKLIST.md))

---

## 1. Vercel 프로젝트 생성

### 1-1. Vercel 로그인

브라우저에서:
```
https://vercel.com/login
```

**Continue with GitHub** 클릭하여 GitHub 계정으로 로그인

### 1-2. 새 프로젝트 가져오기

1. Dashboard에서 **Add New...** → **Project** 클릭
2. **Import Git Repository** 섹션에서 GitHub 저장소 검색
3. `mokoji` (또는 `its-campers`) 저장소 찾기
4. **Import** 클릭

### 1-3. 프로젝트 설정

**Configure Project** 화면에서:

```
Project Name: mokoji (또는 원하는 이름)
Framework Preset: Next.js (자동 감지됨)
Root Directory: ./
Build Command: npm run build (자동)
Output Directory: .next (자동)
Install Command: npm install (자동)
```

**아직 Deploy 버튼 누르지 마세요!** 먼저 환경 변수를 설정해야 합니다.

---

## 2. 환경 변수 설정

### 2-1. Environment Variables 섹션 열기

**Configure Project** 화면에서 **Environment Variables** 섹션 확장

### 2-2. 필수 환경 변수 입력

총 **15개**의 환경 변수를 입력해야 합니다.

#### AWS S3 설정 (4개)

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_AWS_REGION` | `ap-northeast-2` | Production |
| `NEXT_PUBLIC_AWS_S3_BUCKET` | `its-campers` | Production |
| `NEXT_PUBLIC_AWS_ACCESS_KEY_ID` | `AKIA...` | Production |
| `NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY` | `wJalrX...` | Production |

#### Kakao Map API (1개)

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | `a1b2c3...` | Production |

#### Firebase 설정 (6개)

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyC...` | Production |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `mokoji-95640.firebaseapp.com` | Production |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `mokoji-95640` | Production |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `mokoji-95640.firebasestorage.app` | Production |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789` | Production |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123456789:web:abc...` | Production |

#### Feature Flags (4개)

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT` | `true` | Production |
| `NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE` | `100` | Production |
| `NEXT_PUBLIC_CHAT_TEST_USERS` | *(비워둠)* | Production |
| `NEXT_PUBLIC_CHAT_TEST_ORGS` | *(비워둠)* | Production |

### 2-3. 환경 변수 입력 방법

**방법 A: 하나씩 입력**
1. Name 필드에 변수 이름 입력 (예: `NEXT_PUBLIC_AWS_REGION`)
2. Value 필드에 값 입력 (예: `ap-northeast-2`)
3. Environment: **Production** 체크
4. **Add** 버튼 클릭
5. 다음 변수로 반복

**방법 B: .env 파일에서 복사**
```bash
# 로컬에서 .env.production 파일 내용 복사
cat .env.production
```

Vercel에서:
1. **Paste .env** 버튼 클릭 (환경 변수 섹션 상단)
2. 복사한 내용 붙여넣기
3. **Add Variables** 클릭

### 2-4. 환경 변수 확인

모든 변수 추가 후:
- ✅ 총 15개 변수 확인
- ✅ 모든 변수가 **Production** 환경에 설정됨
- ✅ 빈 값이나 `YOUR_...` placeholder 없음

---

## 3. 배포 시작

### 3-1. Deploy 버튼 클릭

**Configure Project** 화면 하단의 **Deploy** 버튼 클릭

### 3-2. 배포 진행 상황 확인

**Building** 화면에서:
```
1. ✅ Cloning repository
2. ✅ Installing dependencies (npm install)
3. ✅ Building application (next build)
4. ✅ Uploading build output
5. ✅ Deploying to Production
```

**예상 시간:** 2-5분

### 3-3. 배포 성공 확인

**Success!** 화면이 나타나면:
```
✅ Your project has been successfully deployed!

Domain: https://mokoji-abc123.vercel.app
```

**Visit** 버튼 클릭하여 배포된 앱 확인

---

## 4. 배포 후 테스트

### 4-1. 기본 기능 테스트

- [ ] 앱이 정상적으로 로드됨
- [ ] 로그인 페이지 표시
- [ ] Firebase 인증 작동 (회원가입/로그인)
- [ ] 이미지 업로드 작동 (AWS S3 연결)
- [ ] 카카오 지도 표시 (Kakao Map API)

### 4-2. 채팅 기능 테스트

- [ ] 일정 생성 가능
- [ ] 채팅 섹션 표시
- [ ] 메시지 전송/수신 작동
- [ ] 시스템 메시지 자동 생성 (RSVP 변경 시)

### 4-3. Feature Flag 확인

브라우저 개발자 도구 → Console에서:
```
🎯 Feature Flags Status:
├─ SCHEDULE_CHAT:
│  ├─ enabled: true
│  └─ rollout: 100%
```

### 4-4. 성능 확인

Vercel Dashboard → **Analytics** 탭에서:
- **Real Experience Score (RES)**: 80+ 권장
- **Largest Contentful Paint (LCP)**: 2.5초 이하
- **First Input Delay (FID)**: 100ms 이하
- **Cumulative Layout Shift (CLS)**: 0.1 이하

---

## 5. 도메인 연결 (선택 사항)

### 5-1. 커스텀 도메인 추가

Vercel Dashboard → **Settings** → **Domains**:

1. **Add Domain** 클릭
2. 도메인 입력 (예: `mokoji.com`)
3. **Add** 클릭
4. DNS 설정 지시 따르기

### 5-2. DNS 설정

도메인 등록 업체 (가비아, 호스팅케이알 등)에서:

**A 레코드 추가:**
```
Type: A
Name: @
Value: 76.76.21.21
```

**CNAME 레코드 추가:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com.
```

**전파 시간:** 최대 48시간 (보통 5-10분)

### 5-3. HTTPS 자동 설정

Vercel이 자동으로 SSL 인증서 발급 (Let's Encrypt)
- ✅ `https://mokoji.com` 자동 활성화
- ✅ `https://www.mokoji.com` 자동 리다이렉트

---

## 6. 지속적 배포 (CI/CD)

### 6-1. 자동 배포 설정

Vercel은 Git 연동 시 **자동으로 배포**됩니다:

```bash
# 코드 변경 후
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# → Vercel이 자동으로 감지하여 배포 시작
```

### 6-2. 배포 알림

Vercel Dashboard → **Settings** → **Notifications**:
- ✅ **Deployment Succeeded** 알림 활성화
- ✅ **Deployment Failed** 알림 활성화
- ✅ 이메일 또는 Slack 연동 가능

### 6-3. Preview Deployments

브랜치별 미리보기 배포:
```bash
# feature 브랜치 생성
git checkout -b feature/new-ui
git push origin feature/new-ui

# → Vercel이 자동으로 미리보기 배포 생성
# https://mokoji-git-feature-new-ui.vercel.app
```

---

## 7. 모니터링

### 7-1. Vercel Analytics

Dashboard → **Analytics** 탭:
- **Real User Monitoring (RUM)**: 실제 사용자 경험 측정
- **Web Vitals**: Core Web Vitals 점수
- **Top Pages**: 가장 많이 방문한 페이지
- **Top Referrers**: 유입 경로

### 7-2. Deployment Logs

Dashboard → **Deployments** → 특정 배포 클릭:
- **Build Logs**: 빌드 과정 로그
- **Runtime Logs**: 서버 실행 로그 (API Routes)
- **Error Logs**: 에러 발생 시 스택 트레이스

### 7-3. Firebase Monitoring

Firebase Console → **Functions** → **Logs**:
```bash
# 또는 터미널에서
npm run functions:logs
```

- **onRSVPChange** 실행 횟수 및 에러
- **onScheduleUpdate** 실행 횟수 및 에러
- **onChatMessage** 실행 횟수 및 에러

---

## 🚨 트러블슈팅

### 문제 1: 빌드 실패 (Build Failed)

**에러 메시지:**
```
Error: Command "next build" exited with 1
```

**해결 방법:**

**A. TypeScript 에러 확인**
```bash
# 로컬에서 빌드 테스트
npm run build

# TypeScript 에러가 있다면 수정 후
git add .
git commit -m "fix: TypeScript errors"
git push origin main
```

**B. 환경 변수 누락 확인**
- Vercel Dashboard → **Settings** → **Environment Variables**
- 15개 변수 모두 설정되었는지 확인
- 누락된 변수 추가 후 **Redeploy** 클릭

**C. 의존성 문제**
```bash
# package-lock.json 재생성
rm package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerate package-lock.json"
git push origin main
```

---

### 문제 2: 환경 변수 작동 안 함

**증상:**
- Firebase 연결 실패
- AWS S3 업로드 실패
- Kakao Map 표시 안 됨

**해결 방법:**

**A. 환경 변수 재확인**
```bash
# Vercel Dashboard → Settings → Environment Variables
# 모든 변수가 Production에 설정되었는지 확인
```

**B. 변수 이름 확인**
- ✅ `NEXT_PUBLIC_` 접두사 포함 (클라이언트에서 접근 가능)
- ❌ 오타 없음 (예: `NEXT_PUBLC_` 같은 실수)

**C. Redeploy 필요**
환경 변수 변경 후:
1. Vercel Dashboard → **Deployments**
2. 최신 배포 우측 **...** 메뉴
3. **Redeploy** 클릭

---

### 문제 3: 채팅 기능 작동 안 함

**증상:**
- 채팅 섹션이 보이지 않음
- 메시지 전송 실패
- 시스템 메시지 생성 안 됨

**해결 방법:**

**A. Feature Flag 확인**
```bash
# Vercel Dashboard → Settings → Environment Variables
NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
```

**B. Firestore Rules 배포 확인**
```bash
# 로컬에서
firebase deploy --only firestore:rules
```

Firebase Console에서:
- **Firestore Database** → **Rules** 탭
- `schedule_chats` 규칙 존재 확인

**C. Cloud Functions 배포 확인**
Firebase Console → **Functions**:
- ✅ `onRSVPChange` 활성화
- ✅ `onScheduleUpdate` 활성화
- ✅ `onChatMessage` 활성화

Functions 로그 확인:
```bash
npm run functions:logs
```

---

### 문제 4: Domain Not Working

**증상:**
- 커스텀 도메인 접속 안 됨
- DNS 오류 메시지

**해결 방법:**

**A. DNS 전파 확인**
```bash
# 터미널에서
nslookup mokoji.com

# 결과에 Vercel IP (76.76.21.21)가 나와야 함
```

**B. DNS 설정 재확인**
도메인 등록 업체에서:
- A 레코드: `@` → `76.76.21.21`
- CNAME 레코드: `www` → `cname.vercel-dns.com.`

**C. Vercel에서 도메인 상태 확인**
Dashboard → **Settings** → **Domains**:
- ✅ **Valid Configuration** 표시 확인
- ❌ **Invalid Configuration** 시 DNS 재설정

---

### 문제 5: 서버 에러 (500 Error)

**증상:**
- 페이지 로드 시 500 에러
- API 요청 실패

**해결 방법:**

**A. Runtime Logs 확인**
Vercel Dashboard → **Deployments** → 최신 배포 → **Runtime Logs**

**B. Firebase 연결 확인**
- Firebase API 키 유효한지 확인
- Firebase 프로젝트 활성화 상태 확인

**C. Rollback**
문제가 지속되면:
1. Vercel Dashboard → **Deployments**
2. 이전 정상 배포 찾기
3. **...** 메뉴 → **Promote to Production**

---

## ✅ 배포 완료 체크리스트

### Vercel 설정

- [ ] Vercel 프로젝트 생성 완료
- [ ] 환경 변수 15개 모두 설정
- [ ] Production 배포 성공
- [ ] 커스텀 도메인 연결 (선택)
- [ ] HTTPS 활성화 확인

### 기능 테스트

- [ ] 로그인/회원가입 작동
- [ ] 크루 생성/가입 작동
- [ ] 일정 생성/수정 작동
- [ ] 채팅 메시지 전송/수신
- [ ] 시스템 메시지 자동 생성
- [ ] 이미지 업로드 (AWS S3)
- [ ] 카카오 지도 표시

### 모니터링 설정

- [ ] Vercel Analytics 활성화
- [ ] 배포 알림 설정
- [ ] Firebase Functions 로그 확인
- [ ] Firestore 사용량 모니터링

---

## 📊 배포 후 권장 사항

### 1. 성능 최적화

**이미지 최적화:**
```typescript
// next.config.ts
module.exports = {
  images: {
    domains: ['its-campers.s3.ap-northeast-2.amazonaws.com'],
    formats: ['image/avif', 'image/webp'],
  },
};
```

**코드 스플리팅:**
```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
});
```

### 2. 모니터링 도구 추가 (향후)

**Google Analytics:**
```bash
# .env.production
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

**Sentry (에러 추적):**
```bash
# .env.production
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 3. 백업 전략

**Firestore 자동 백업:**
Firebase Console → **Firestore Database** → **Backups**

**정기 데이터베이스 Export:**
```bash
# Cloud Scheduler로 자동화 (향후)
gcloud firestore export gs://its-campers-backups
```

---

## 📞 추가 지원

**Vercel 문서:**
- https://vercel.com/docs

**Firebase 문서:**
- https://firebase.google.com/docs

**프로젝트 문서:**
- [Git 설정 가이드](./GIT_SETUP.md)
- [환경변수 체크리스트](./ENV_CHECKLIST.md)
- [빠른 배포 가이드](../DEPLOY_NOW.md)

---

완료! ✅

**배포 성공 URL:** https://mokoji.vercel.app (또는 your-domain.com)

다음 단계: **모니터링 및 최적화** 시작
