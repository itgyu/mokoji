# 🚀 모꼬지 배포 빠른 시작 가이드

> 이 가이드를 따라하면 **30분 내**에 프로덕션 배포를 완료할 수 있습니다.

---

## ⏱️ 전체 프로세스 (예상 시간: 30분)

```
1. 환경 변수 준비      [5분]
2. Git 설정           [5분]
3. Firestore Rules    [3분]
4. Cloud Functions    [7분]
5. Vercel 배포        [10분]
-----------------------------------
총 소요 시간: 약 30분
```

---

## 📋 사전 체크리스트

배포를 시작하기 전에 다음을 확인하세요:

- [ ] **GitHub 계정** 있음
- [ ] **Vercel 계정** 있음 (없으면 GitHub으로 가입)
- [ ] **Firebase Blaze 플랜** 활성화 (Cloud Functions 사용)
- [ ] **환경 변수 15개** 준비 완료 ([체크리스트 보기](./docs/ENV_CHECKLIST.md))

---

## 🎯 Step 1: 환경 변수 준비 (5분)

### 1-1. 환경 변수 파일 생성

```bash
# Production 환경 변수 파일 생성
cp .env.production.example .env.production
```

### 1-2. 필수 값 입력

`.env.production` 파일을 열고 **15개 변수**에 실제 값을 입력하세요:

**빠른 확인:**
```bash
# 환경 변수 개수 확인 (15개여야 함)
grep -c "NEXT_PUBLIC_" .env.production

# 누락된 값 확인 (YOUR_로 시작하는 값이 있으면 안 됨)
grep "YOUR_" .env.production
```

**상세 가이드:** [환경 변수 체크리스트](./docs/ENV_CHECKLIST.md)

---

## 🎯 Step 2: Git 원격 저장소 설정 (5분)

### 2-1. GitHub 저장소 생성

1. 브라우저에서 https://github.com/new 접속
2. **Repository name**: `mokoji` (또는 원하는 이름)
3. **Private** 선택
4. **Create repository** 클릭

### 2-2. 로컬과 연결

```bash
# 원격 저장소 연결
git remote add origin https://github.com/your-username/mokoji.git

# 브랜치 이름 확인
git branch -M main

# 푸시
git push -u origin main
```

**문제가 생겼나요?** [Git 설정 가이드](./docs/GIT_SETUP.md)

---

## 🎯 Step 3: Firestore Security Rules 배포 (3분)

### 3-1. Rules 배포

```bash
# Firestore Rules 배포
firebase deploy --only firestore:rules
```

**예상 결과:**
```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

### 3-2. Firebase Console에서 확인

1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택 (`it-s-campers-95640`)
3. **Firestore Database** → **Rules** 탭
4. 규칙이 업데이트되었는지 확인

---

## 🎯 Step 4: Cloud Functions 배포 (7분)

### 4-1. Firebase Blaze 플랜 확인

**중요**: Cloud Functions는 Blaze(종량제) 플랜이 필요합니다.

Firebase Console → **Spark** 클릭 → **Blaze 플랜으로 업그레이드**

### 4-2. Functions 빌드

```bash
# Functions TypeScript 컴파일
npm run functions:build
```

**예상 결과:**
```
functions/lib/index.js
functions/lib/triggers/onRSVPChange.js
functions/lib/triggers/onScheduleUpdate.js
functions/lib/triggers/onChatMessage.js
```

### 4-3. Functions 배포

```bash
# 모든 Functions 배포
npm run functions:deploy
```

**예상 시간:** 3-5분

**예상 결과:**
```
✔  functions[onRSVPChange(us-central1)]: Successful create operation.
✔  functions[onScheduleUpdate(us-central1)]: Successful create operation.
✔  functions[onChatMessage(us-central1)]: Successful create operation.
```

### 4-4. Functions 확인

Firebase Console → **Functions** 탭:
- ✅ `onRSVPChange` 활성화
- ✅ `onScheduleUpdate` 활성화
- ✅ `onChatMessage` 활성화

---

## 🎯 Step 5: Vercel 배포 (10분)

### 5-1. Vercel 프로젝트 생성

1. https://vercel.com/login 접속
2. **Continue with GitHub** 클릭
3. **Add New...** → **Project** 클릭
4. GitHub 저장소 (`mokoji`) 선택
5. **Import** 클릭

### 5-2. 환경 변수 설정

**Configure Project** 화면에서:

**방법 A: 파일에서 붙여넣기 (추천)**
1. **Paste .env** 버튼 클릭
2. `.env.production` 내용 전체 복사
3. 붙여넣기 → **Add Variables** 클릭

**방법 B: 하나씩 입력**
- [환경 변수 체크리스트](./docs/ENV_CHECKLIST.md) 보면서 15개 입력

### 5-3. 배포 시작

**Configure Project** 화면 하단:
- **Deploy** 버튼 클릭

**예상 시간:** 2-5분

### 5-4. 배포 완료

**Success!** 화면이 나타나면:
```
✅ Your project has been successfully deployed!

Domain: https://mokoji-abc123.vercel.app
```

**Visit** 버튼 클릭하여 확인

**상세 가이드:** [Vercel 배포 가이드](./docs/VERCEL_DEPLOY.md)

---

## ✅ 배포 후 테스트

### 기본 기능 (3분)

브라우저에서 배포된 앱 접속:

- [ ] 로그인/회원가입 작동
- [ ] 크루 생성 가능
- [ ] 일정 생성 가능
- [ ] 이미지 업로드 작동 (AWS S3)
- [ ] 지도 표시 (Kakao Map)

### 채팅 기능 (2분)

- [ ] 일정에 채팅 섹션 보임
- [ ] 메시지 전송 가능
- [ ] 참석 응답 변경 시 시스템 메시지 생성
- [ ] 일정 수정 시 시스템 메시지 생성

---

## 🎉 배포 완료!

축하합니다! 모꼬지 앱이 성공적으로 배포되었습니다.

**배포된 URL:**
```
https://mokoji-abc123.vercel.app
```

---

## 📊 다음 단계

### 1. 도메인 연결 (선택)

커스텀 도메인을 사용하고 싶다면:
1. Vercel Dashboard → **Settings** → **Domains**
2. **Add Domain** 클릭
3. DNS 설정 (A 레코드, CNAME 레코드)

**상세 가이드:** [Vercel 배포 가이드](./docs/VERCEL_DEPLOY.md#5-도메인-연결-선택-사항)

### 2. 모니터링 설정

**Vercel Analytics:**
- Dashboard → **Analytics** 탭
- 실시간 사용자 모니터링
- Web Vitals 점수 확인

**Firebase Functions Logs:**
```bash
# Functions 로그 확인
npm run functions:logs

# 특정 함수 로그
firebase functions:log --only onChatMessage
```

### 3. Feature Flag 조정

점진적 배포를 원한다면:

**1단계: 10% 사용자**
```bash
# Vercel Dashboard → Settings → Environment Variables
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=10

# Redeploy 필요
```

**2단계: 50% 사용자**
```bash
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=50
```

**3단계: 전체 배포**
```bash
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
```

---

## 🚨 트러블슈팅

### 빌드 실패 (Build Failed)

**원인:** TypeScript 에러, 환경 변수 누락

**해결:**
```bash
# 로컬에서 빌드 테스트
npm run build

# 에러 확인 후 수정
git add .
git commit -m "fix: build errors"
git push origin main
```

### 채팅 작동 안 함

**체크리스트:**
- [ ] Firestore Rules 배포 완료
- [ ] Cloud Functions 3개 모두 배포 완료
- [ ] Feature Flags 환경 변수 설정 (`ENABLE_SCHEDULE_CHAT=true`)
- [ ] Vercel Redeploy 완료

### Firebase Functions 에러

**확인 방법:**
```bash
# Functions 로그 확인
firebase functions:log

# 에러 메시지 확인
# 필요 시 Functions 재배포
npm run functions:deploy
```

---

## 📚 상세 가이드

배포 과정에서 문제가 생기면 상세 가이드를 참고하세요:

- **환경 변수**: [ENV_CHECKLIST.md](./docs/ENV_CHECKLIST.md)
- **Git 설정**: [GIT_SETUP.md](./docs/GIT_SETUP.md)
- **Vercel 배포**: [VERCEL_DEPLOY.md](./docs/VERCEL_DEPLOY.md)
- **전체 배포**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **채팅 기능**: [CHAT_FEATURE.md](./CHAT_FEATURE.md)

---

## 📞 도움이 필요하신가요?

**Firebase 관련:**
- [Firebase 문서](https://firebase.google.com/docs)
- Firebase Console → Support

**Vercel 관련:**
- [Vercel 문서](https://vercel.com/docs)
- Vercel Dashboard → Help

**프로젝트 관련:**
- GitHub Issues
- 프로젝트 문서 참고

---

## 🎊 배포 완료 체크리스트

- [ ] GitHub 저장소 생성 및 푸시 완료
- [ ] Firestore Rules 배포 완료
- [ ] Cloud Functions 3개 배포 완료
- [ ] Vercel 배포 완료
- [ ] 기본 기능 테스트 완료
- [ ] 채팅 기능 테스트 완료
- [ ] 모니터링 설정 완료

---

## 🚀 지속적 배포 (CI/CD)

이제부터는 코드를 푸시하면 **자동으로 배포**됩니다:

```bash
# 코드 수정 후
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# → GitHub이 Vercel에 알림
# → Vercel이 자동으로 빌드 및 배포
# → 2-5분 후 배포 완료!
```

**배포 상태 확인:**
- Vercel Dashboard → **Deployments** 탭
- 각 커밋별 배포 상태 확인
- 실패 시 Build Logs 확인

---

**배포 성공을 축하합니다!** 🎉

이제 모꼬지 앱이 전 세계 어디서나 접속 가능합니다.

**배포 URL:** https://mokoji-abc123.vercel.app
