# 캐시 버스팅 시스템 가이드

## 개요
배포 후 사용자들이 자동으로 최신 버전을 보도록 하는 버전 체크 시스템입니다.

## 작동 원리

### 1. 빌드 시 버전 생성
- `npm run build` 실행 시 자동으로 `prebuild` 스크립트가 실행됩니다
- `scripts/generate-version.js`가 현재 타임스탬프로 `/public/version.json` 파일을 생성합니다
- 매 배포마다 고유한 버전 번호가 생성됩니다

### 2. 클라이언트 버전 체크
- `components/VersionChecker.tsx` 컴포넌트가 모든 페이지에서 실행됩니다
- 3분마다 `/version.json`을 확인하여 새 버전 여부를 체크합니다
- localStorage에 저장된 버전과 서버 버전을 비교합니다

### 3. 새 버전 감지 시
- 화면 상단에 예쁜 배너가 표시됩니다
- "새로고침" 버튼 클릭 시 페이지를 새로고침하여 최신 버전을 로드합니다
- 사용자가 원하면 배너를 닫을 수도 있습니다

### 4. 캐시 제어
- `next.config.mjs`에서 `/version.json`은 절대 캐시하지 않도록 설정
- 항상 최신 버전 정보를 가져올 수 있습니다

## 배포 워크플로우

```bash
# 1. 코드 수정
# 2. 빌드 (자동으로 version.json 생성됨)
npm run build

# 3. Vercel에 배포
vercel --prod

# 또는 git push로 자동 배포
git add .
git commit -m "새 기능 추가"
git push
```

## 테스트 방법

### 로컬 테스트
1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 http://localhost:3000 접속
3. 콘솔에서 버전 체크 로그 확인 가능

### 배포 후 테스트
1. 첫 번째 배포 후 사이트 접속하여 localStorage 확인:
   ```javascript
   localStorage.getItem('app-version')
   ```

2. 코드 수정 후 다시 배포

3. 기존 탭을 열어둔 상태로 3분 대기 (또는 개발자 도구에서 수동으로 version.json 확인)

4. 새 버전 배너가 자동으로 표시되는지 확인

5. "새로고침" 버튼 클릭 시 최신 버전으로 업데이트되는지 확인

## 생성된 파일들

- `/components/VersionChecker.tsx` - 버전 체크 React 컴포넌트
- `/scripts/generate-version.js` - 빌드 시 버전 파일 생성 스크립트
- `/public/version.json` - 현재 배포 버전 정보 (자동 생성)
- `/app/layout.tsx` - VersionChecker 컴포넌트 통합
- `/next.config.mjs` - 캐시 헤더 설정

## 주의사항

- `public/version.json`은 빌드 시 자동 생성되므로 git에 커밋할 필요 없습니다
- 개발 환경에서는 버전 체크가 작동하지만 배너가 자주 표시될 수 있습니다
- 배포 후 최대 3분 이내에 사용자들에게 업데이트 알림이 전달됩니다

## 설정 커스터마이징

### 체크 주기 변경
`components/VersionChecker.tsx`의 `setInterval` 값 수정:
```typescript
const interval = setInterval(checkVersion, 3 * 60 * 1000) // 3분
```

### 자동 새로고침 활성화
`handleReload` 함수 호출을 자동으로 실행하도록 변경:
```typescript
if (data.version !== currentVersion) {
  // 자동 새로고침 (배너 없이)
  setTimeout(() => window.location.reload(), 1000)
}
```

## 문제 해결

### 버전 체크가 작동하지 않는 경우
1. 브라우저 콘솔에서 에러 확인
2. `/version.json`이 접근 가능한지 확인: `https://your-domain.com/version.json`
3. localStorage에 버전이 저장되어 있는지 확인

### 배너가 계속 표시되는 경우
1. localStorage 초기화: `localStorage.removeItem('app-version')`
2. 페이지 새로고침

## 향후 개선 사항

- [ ] Service Worker를 사용한 더 정교한 캐시 관리
- [ ] 버전별 변경사항 표시 (changelog)
- [ ] 선택적 자동 업데이트 설정
- [ ] 업데이트 진행 상태 표시
