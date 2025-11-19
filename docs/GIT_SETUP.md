# Git 원격 저장소 설정 가이드

모꼬지 프로젝트를 GitHub에 푸시하는 방법입니다.

---

## 1. GitHub 저장소 생성

### 1-1. GitHub 접속

브라우저에서:
```
https://github.com/new
```

### 1-2. 저장소 설정

다음과 같이 입력:

- **Repository name**: `mokoji`
- **Description**: Mokoji (모꼬지) - Multi-crew Management Platform
- **Visibility**: **Private** 선택 ✅
- **Initialize this repository**: **체크 안 함** (이미 로컬에 코드 있음)
- **Create repository** 클릭

### 1-3. 생성 완료 후 표시되는 URL 복사

예시:
```
https://github.com/your-username/mokoji.git
```

---

## 2. 로컬 Git 원격 연결

### 2-1. 터미널에서 실행

프로젝트 디렉토리에서:

```bash
# 원격 저장소 연결
git remote add origin https://github.com/your-username/mokoji.git

# 브랜치 이름 확인/변경
git branch -M main

# 원격 저장소에 푸시
git push -u origin main
```

### 2-2. 푸시 성공 확인

**기대 결과:**
```
Enumerating objects: 18913, done.
Counting objects: 100% (18913/18913), done.
Delta compression using up to 8 threads
Compressing objects: 100% (18000/18000), done.
Writing objects: 100% (18913/18913), 2.5 MiB | 1.2 MiB/s, done.
Total 18913 (delta 500), reused 0 (delta 0)
remote: Resolving deltas: 100% (500/500), done.
To https://github.com/your-username/mokoji.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

### 2-3. GitHub에서 확인

브라우저에서:
```
https://github.com/your-username/mokoji
```

다음 파일들이 보여야 합니다:
- ✅ `app/` 디렉토리
- ✅ `components/` 디렉토리
- ✅ `functions/` 디렉토리
- ✅ `README.md`
- ✅ `package.json`
- ✅ `firebase.json`
- 기타 파일들...

---

## 3. 향후 코드 업데이트 시

### 3-1. 변경사항 확인
```bash
git status
```

### 3-2. 파일 추가
```bash
# 모든 변경사항 추가
git add .

# 특정 파일만 추가
git add app/specific-file.tsx
```

### 3-3. 커밋
```bash
git commit -m "feat: 새로운 기능 추가"
```

### 3-4. 푸시
```bash
git push origin main
```

---

## 🚨 문제 해결

### 문제 1: Git 인증 실패

**에러 메시지:**
```
remote: Support for password authentication was removed on August 13, 2021.
fatal: Authentication failed
```

**해결 방법:**

1. GitHub Personal Access Token 생성:
   ```
   https://github.com/settings/tokens
   ```

2. **Generate new token (classic)** 클릭

3. 권한 설정:
   - **repo** 전체 체크 ✅
   - 만료 기간 설정 (90일 권장)
   - **Generate token** 클릭

4. 생성된 토큰 복사 (한 번만 보임!)

5. Git 푸시 시 토큰을 비밀번호로 사용:
   ```bash
   Username: your-github-username
   Password: ghp_xxxxxxxxxxxxxxxxxxxx (토큰 붙여넣기)
   ```

---

### 문제 2: 원격 저장소가 이미 있음

**에러 메시지:**
```
error: remote origin already exists.
```

**해결 방법:**

```bash
# 기존 원격 제거
git remote remove origin

# 다시 추가
git remote add origin https://github.com/your-username/mokoji.git
```

---

### 문제 3: 브랜치 충돌

**에러 메시지:**
```
! [rejected]        main -> main (fetch first)
error: failed to push some refs
```

**해결 방법 A: 원격 변경사항 가져오기 (권장)**
```bash
# 원격 변경사항 가져오기
git pull origin main --rebase

# 충돌 해결 후 푸시
git push origin main
```

**해결 방법 B: 강제 푸시 (⚠️ 주의: 원격 데이터 덮어씀)**
```bash
git push -u origin main --force
```

---

### 문제 4: 파일 크기 제한 초과

**에러 메시지:**
```
remote: error: File functions/node_modules/... is 100.00 MB; this exceeds GitHub's file size limit of 100 MB
```

**해결 방법:**

`.gitignore` 파일 확인:
```bash
cat .gitignore
```

다음 항목들이 포함되어 있어야 합니다:
```
node_modules/
functions/node_modules/
.next/
.env.local
.env.production
```

만약 이미 커밋되었다면:
```bash
# node_modules 제거
git rm -r --cached functions/node_modules
git commit -m "chore: remove node_modules from git"
git push origin main
```

---

## ✅ 완료 체크리스트

- [ ] GitHub 저장소 생성 완료
- [ ] 원격 저장소 연결 완료
- [ ] `git push` 성공
- [ ] GitHub에서 파일 확인 완료
- [ ] Personal Access Token 생성 (필요 시)
- [ ] 향후 업데이트 방법 숙지

---

## 📖 관련 문서

- [Vercel 배포 가이드](./VERCEL_DEPLOY.md)
- [환경변수 체크리스트](./ENV_CHECKLIST.md)
- [빠른 배포 가이드](../DEPLOY_NOW.md)

---

완료! ✅

다음 단계: **Vercel 배포** ([가이드 보기](./VERCEL_DEPLOY.md))
