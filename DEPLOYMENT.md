# 모꼬지 배포 가이드

## 📋 배포 전 체크리스트

### 1. 환경 변수 설정

```bash
# Production 환경 변수 파일 생성
cp .env.production.example .env.production

# 필수 값 입력:
# - Firebase API Keys
# - AWS S3 Credentials
# - Kakao Map API Key
# - Feature Flags 설정
```

### 2. Firestore Security Rules 배포

```bash
# Security Rules 검증
firebase deploy --only firestore:rules

# 배포 후 Firebase Console에서 규칙 확인:
# https://console.firebase.google.com/project/it-s-campers-95640/firestore/rules
```

### 3. Cloud Functions 배포

```bash
# Functions 빌드 및 배포
npm run functions:build
npm run functions:deploy

# 특정 함수만 배포:
firebase deploy --only functions:onChatMessage
firebase deploy --only functions:onRSVPChange
firebase deploy --only functions:onScheduleUpdate
```

### 4. Next.js 앱 배포 (Vercel)

```bash
# Vercel에 배포
vercel --prod

# 또는 GitHub 연동 시 자동 배포
git push origin main
```

## 🔐 보안 체크리스트

### Firestore Security Rules

- ✅ 모든 읽기/쓰기에 인증 필요
- ✅ 크루 멤버만 크루 데이터 접근 가능
- ✅ 채팅은 일정 참가자만 접근 가능
- ✅ 사용자는 자신의 데이터만 수정 가능
- ✅ 소프트 삭제 패턴 적용

### Cloud Functions

- ✅ Firebase Admin SDK 초기화
- ✅ 에러 핸들링 구현
- ✅ 로깅 추가
- ✅ TypeScript 컴파일 성공

### 환경 변수

- ✅ `.env.production` 파일 생성
- ✅ 모든 API 키 설정
- ✅ Feature Flags 설정
- ⚠️ `.env.production`을 Git에 커밋하지 않았는지 확인

## 📊 배포 후 확인 사항

### 1. Firebase Console 확인

**Firestore:**
- Security Rules 활성화 확인
- 인덱스 생성 완료 확인

**Functions:**
- 3개 함수 배포 완료 확인:
  - onRSVPChange
  - onScheduleUpdate
  - onChatMessage
- 함수 로그 확인 (에러 없음)

### 2. 앱 기능 테스트

**기본 기능:**
- [ ] 로그인/회원가입
- [ ] 크루 생성/가입
- [ ] 일정 생성/수정/삭제
- [ ] 참석 응답 변경

**채팅 기능:**
- [ ] 채팅 메시지 전송
- [ ] 실시간 메시지 수신
- [ ] 시스템 메시지 자동 생성 (RSVP 변경 시)
- [ ] 시스템 메시지 자동 생성 (일정 변경 시)

**Feature Flag:**
- [ ] Feature Flag에 따라 채팅 활성화/비활성화
- [ ] 테스트 사용자/크루 우선 활성화
- [ ] 점진적 롤아웃 작동

### 3. 성능 모니터링

**Next.js:**
- Vercel Analytics 확인
- 페이지 로딩 속도 확인
- API 응답 시간 확인

**Firebase:**
- Firestore 읽기/쓰기 횟수 모니터링
- Functions 실행 횟수 및 에러율 확인

## 🚨 롤백 절차

### Firestore Rules 롤백

```bash
# 이전 버전으로 복원
firebase deploy --only firestore:rules

# 또는 Firebase Console에서 수동 복원
```

### Cloud Functions 롤백

```bash
# 특정 함수 비활성화
firebase functions:delete FUNCTION_NAME

# 이전 버전으로 재배포
git checkout HEAD~1 functions/
npm run functions:deploy
```

### Next.js 앱 롤백

```bash
# Vercel Dashboard에서 이전 배포 버전으로 롤백
# 또는 Git에서 revert
git revert HEAD
git push origin main
```

## 📈 점진적 배포 전략

### 1단계: 테스트 사용자 (10%)

```env
NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=10
NEXT_PUBLIC_CHAT_TEST_USERS=test_user_1,test_user_2
```

### 2단계: 일부 사용자 (50%)

```env
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=50
```

### 3단계: 전체 배포 (100%)

```env
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
```

## 🔧 트러블슈팅

### Firestore Permission Denied

**원인:** Security Rules 설정 오류

**해결:**
1. Firebase Console에서 Rules 확인
2. 사용자가 크루 멤버인지 확인
3. `isDeleted` 플래그 확인

### Cloud Functions 타임아웃

**원인:** 함수 실행 시간 초과

**해결:**
1. Functions 로그 확인
2. Firestore 인덱스 생성
3. 함수 최적화 (batch 처리)

### Feature Flag 작동 안 함

**원인:** 환경 변수 미설정

**해결:**
1. `.env.production` 파일 확인
2. Vercel 환경 변수 확인
3. 빌드 후 재배포

## 📞 문의

배포 중 문제 발생 시:
1. GitHub Issues 확인
2. Firebase Console 로그 확인
3. Vercel 배포 로그 확인
