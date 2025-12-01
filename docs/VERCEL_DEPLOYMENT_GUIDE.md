# Vercel 배포 가이드

## 📋 배포 전 체크리스트

- [ ] 모든 코드 변경사항이 Git에 커밋되었는가?
- [ ] 로컬에서 빌드가 성공하는가? (`npm run build`)
- [ ] AWS 자격 증명이 준비되었는가?
- [ ] DynamoDB 테이블이 생성되었는가?
- [ ] Cognito User Pool이 생성되었는가?

---

## 🚀 1단계: Vercel 프로젝트 생성

### 1.1 Vercel에 로그인
```bash
vercel login
```

### 1.2 프로젝트 연결
```bash
vercel
```

또는 Vercel 웹사이트에서:
1. https://vercel.com/new 접속
2. GitHub 리포지토리 선택
3. "Import" 클릭

---

## 🔐 2단계: 환경 변수 설정

Vercel Dashboard → 프로젝트 → Settings → Environment Variables

### 2.1 서버 전용 환경 변수 (필수 ✅)

**AWS 자격 증명:**
```
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=AKIA******************
AWS_SECRET_ACCESS_KEY=****************************************
AWS_S3_BUCKET=mokoji
```

**AWS Cognito (JWT 검증용):**
```
AWS_COGNITO_USER_POOL_ID=ap-northeast-2_2F6sdouGR
AWS_COGNITO_CLIENT_ID=5vl7s1q093kpelmk8oa72krp4g
```

**DynamoDB 테이블:**
```
DYNAMODB_USERS_TABLE=mokoji-users
DYNAMODB_ORGANIZATIONS_TABLE=mokoji-organizations
DYNAMODB_MEMBERS_TABLE=mokoji-organization-members
DYNAMODB_SCHEDULES_TABLE=mokoji-schedules
DYNAMODB_ACTIVITY_LOGS_TABLE=mokoji-activity-logs
DYNAMODB_PHOTOS_TABLE=mokoji-photos
```

### 2.2 클라이언트 공개 환경 변수 (필수 ✅)

**AWS Cognito (로그인/회원가입용):**
```
NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=ap-northeast-2_2F6sdouGR
NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=5vl7s1q093kpelmk8oa72krp4g
```

**Kakao Map API:**
```
NEXT_PUBLIC_KAKAO_MAP_API_KEY=ff364c3f44129afc87e31935ac353ba2
```

**Feature Flags:**
```
NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
NEXT_PUBLIC_CHAT_TEST_USERS=
NEXT_PUBLIC_CHAT_TEST_ORGS=
```

### 2.3 Firebase (선택 사항 - 레거시)

더 이상 사용하지 않지만 호환성을 위해 추가 가능:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAxNhznk06xHqhuAB9qAW99LiQayRtzS-I
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mokojiya.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mokojiya
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mokojiya.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1091904586656
NEXT_PUBLIC_FIREBASE_APP_ID=1:1091904586656:web:11a0607cebee015f0c5ac5
```

---

## 📸 2단계 상세 가이드 (스크린샷)

### Vercel 환경 변수 설정 방법:

1. **Vercel Dashboard 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택

2. **Settings 탭 클릭**
   - 상단 메뉴에서 "Settings" 클릭

3. **Environment Variables 선택**
   - 왼쪽 사이드바에서 "Environment Variables" 클릭

4. **변수 추가**
   - "Key" 필드에 변수 이름 입력 (예: `AWS_REGION`)
   - "Value" 필드에 값 입력 (예: `ap-northeast-2`)
   - Environment 선택:
     - **Production** ✅ 필수
     - Preview (선택 사항)
     - Development (선택 사항)
   - "Save" 버튼 클릭

5. **모든 변수 추가**
   - 위의 2.1, 2.2 섹션의 모든 변수를 추가

---

## ⚠️ 중요 보안 주의사항

### ✅ DO (해야 할 것)

1. **서버 전용 변수는 `NEXT_PUBLIC_` 없이**
   ```
   AWS_ACCESS_KEY_ID=...      ✅ 올바름 (서버 전용)
   AWS_SECRET_ACCESS_KEY=...  ✅ 올바름 (서버 전용)
   ```

2. **클라이언트 공개 변수만 `NEXT_PUBLIC_` 사용**
   ```
   NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=...  ✅ 올바름 (클라이언트 사용)
   NEXT_PUBLIC_KAKAO_MAP_API_KEY=...         ✅ 올바름 (클라이언트 사용)
   ```

### ❌ DON'T (하지 말아야 할 것)

1. **AWS 자격 증명에 `NEXT_PUBLIC_` 사용 금지**
   ```
   NEXT_PUBLIC_AWS_ACCESS_KEY_ID=...      ❌ 위험! 브라우저 노출
   NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=...  ❌ 위험! 브라우저 노출
   ```

2. **DynamoDB 테이블 이름에 `NEXT_PUBLIC_` 사용 금지**
   ```
   NEXT_PUBLIC_DYNAMODB_USERS_TABLE=...  ❌ 불필요 (서버 전용)
   ```

---

## 🏗️ 3단계: 배포

### 3.1 Git Push로 자동 배포

```bash
git add .
git commit -m "Add API Routes architecture"
git push origin main
```

Vercel이 자동으로 감지하고 배포합니다.

### 3.2 수동 배포

```bash
vercel --prod
```

---

## ✅ 4단계: 배포 확인

### 4.1 배포 상태 확인

Vercel Dashboard에서:
- 배포 진행 상황 확인
- 빌드 로그 확인
- 에러 발생 시 로그 확인

### 4.2 배포된 앱 테스트

1. **로그인 테스트**
   - 배포된 URL 접속
   - 로그인 시도
   - 브라우저 콘솔에서 에러 확인

2. **데이터 로딩 테스트**
   - 대시보드 접속
   - 크루 목록 표시 확인
   - 멤버 리스트 표시 확인
   - 일정 목록 표시 확인

3. **API 호출 테스트**
   - 브라우저 개발자 도구 → Network 탭
   - `/api/users/...` 호출 확인
   - `/api/organizations/...` 호출 확인
   - 응답 상태 코드 확인 (200 OK)

### 4.3 문제 해결

**증상: 401 Unauthorized 에러**
- 원인: JWT 토큰 검증 실패
- 해결: Cognito 환경 변수 확인

**증상: 500 Internal Server Error**
- 원인: AWS 자격 증명 누락 또는 잘못됨
- 해결: Vercel 환경 변수 재확인

**증상: 데이터가 표시되지 않음**
- 원인: DynamoDB 테이블 이름 불일치
- 해결: 테이블 이름 환경 변수 확인

---

## 🔄 5단계: 재배포 (환경 변수 변경 시)

환경 변수를 변경한 경우:

### 방법 1: Vercel Dashboard에서
1. Settings → Environment Variables → 변수 수정
2. Deployments 탭 → 최신 배포 → "Redeploy" 버튼 클릭

### 방법 2: CLI에서
```bash
vercel --prod --force
```

---

## 📊 배포 후 모니터링

### 6.1 Vercel Analytics

Vercel Dashboard → Analytics 탭에서 확인:
- 페이지 로딩 시간
- 에러 발생률
- API 응답 시간

### 6.2 AWS CloudWatch (선택 사항)

DynamoDB 및 Cognito 사용량 모니터링:
- AWS Console → CloudWatch → Logs
- DynamoDB 읽기/쓰기 용량 확인
- Cognito 로그인 횟수 확인

---

## 💰 비용 예상

### Vercel
- **Hobby 플랜**: 무료
  - 100GB 대역폭
  - 무제한 요청
  - 100GB-hours 함수 실행 시간

- **Pro 플랜**: $20/월
  - 1TB 대역폭
  - 무제한 요청
  - 1000GB-hours 함수 실행 시간

### AWS
- **Cognito**: 처음 50,000 MAU 무료
- **DynamoDB**: On-Demand 모드
  - 읽기: $0.25/백만 요청
  - 쓰기: $1.25/백만 요청
  - 예상: $5-10/월 (중소규모)
- **S3**: $0.023/GB/월 + 요청 비용
  - 예상: $1-3/월

**총 예상 비용**: **$6-13/월** (중소규모 앱 기준)

---

## 🐛 문제 해결 가이드

### 문제 1: "Module not found" 에러

**증상:**
```
Module not found: Can't resolve '@/lib/dynamodb-server'
```

**원인:** 파일 경로 오타 또는 누락

**해결:**
```bash
# 파일 존재 확인
ls -la lib/dynamodb-server.ts
ls -la lib/api-auth.ts
ls -la lib/api-client.ts
```

---

### 문제 2: "Unauthorized" 에러 (401)

**증상:** API 호출 시 401 에러

**원인:**
1. Cognito User Pool ID 불일치
2. JWT 토큰 검증 실패
3. `aws-jwt-verify` 패키지 누락

**해결:**
```bash
# 1. 패키지 확인
npm list aws-jwt-verify

# 2. 없으면 설치
npm install aws-jwt-verify

# 3. 환경 변수 확인
echo $AWS_COGNITO_USER_POOL_ID
echo $AWS_COGNITO_CLIENT_ID
```

---

### 문제 3: DynamoDB 접근 불가 (500 에러)

**증상:** API 호출 시 500 에러, 로그에 DynamoDB 에러

**원인:**
1. AWS 자격 증명 누락
2. IAM 권한 부족
3. 테이블 이름 불일치

**해결:**
```bash
# AWS CLI로 테이블 확인
aws dynamodb list-tables --region ap-northeast-2

# IAM 권한 확인
aws iam get-user

# 환경 변수 확인
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $DYNAMODB_USERS_TABLE
```

---

### 문제 4: CORS 에러

**증상:** 브라우저 콘솔에 CORS 에러

**원인:** API Routes는 CORS 문제가 없어야 하지만, 외부 API 호출 시 발생 가능

**해결:** S3 CORS 설정 확인
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

---

## 📚 참고 자료

### Vercel 문서
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://vercel.com/docs/frameworks/nextjs)
- [Troubleshooting](https://vercel.com/docs/troubleshooting)

### AWS 문서
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Cognito JWT Tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
- [IAM Policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)

### 프로젝트 문서
- [API Routes Architecture](./API_ROUTES_ARCHITECTURE.md)
- [AWS Implementation Guide](./AWS_IMPLEMENTATION_GUIDE.md)
- [Vercel Deployment Issue Analysis](./VERCEL_DEPLOYMENT_ISSUE_ANALYSIS.md)

---

## 🎉 배포 완료!

모든 단계를 완료하면 Vercel에서 안전하게 작동하는 애플리케이션이 준비됩니다!

**배포 URL 예시:**
```
https://mokoji.vercel.app
https://mokoji-your-team.vercel.app
```

문제가 발생하면 Vercel Dashboard의 로그를 확인하거나, 위의 문제 해결 가이드를 참고하세요.

---

**작성일**: 2025-12-01
**최종 업데이트**: 2025-12-01
**상태**: ✅ Production Ready
