# 모꼬지 채팅 기능 개발 완료 보고서

## 📌 프로젝트 개요

**목표:** 일정별 실시간 채팅 기능 개발 및 배포
**기간:** 2025년 11월
**상태:** ✅ 개발 완료 (배포 준비 완료)

## 🎯 완성된 기능

### 1. 실시간 채팅

- ✅ 일정별 채팅방 생성
- ✅ 실시간 메시지 전송/수신
- ✅ 참여자 아바타 표시
- ✅ 시간 표시 (상대 시간 + 절대 시간)
- ✅ 메시지 전송 실패 처리 및 재시도
- ✅ 낙관적 UI 업데이트 (Optimistic UI)

### 2. 시스템 메시지 자동 생성

**Cloud Functions 트리거:**

#### a) RSVP 변경 시 (`onRSVPChange`)
```typescript
// 예시: "홍길동님이 참석으로 변경했습니다."
Trigger: org_schedules/{scheduleId} onUpdate
Action: participants 배열 변경 감지 → 시스템 메시지 생성
```

#### b) 일정 정보 변경 시 (`onScheduleUpdate`)
```typescript
// 예시: "일정 시간이 11월 20일 (수) 오후 3:00으로 변경되었습니다."
Trigger: org_schedules/{scheduleId} onUpdate
Action: 제목/시간/장소/상태 변경 감지 → 시스템 메시지 생성
```

#### c) 채팅 메시지 생성 시 (`onChatMessage`)
```typescript
// 일정 문서의 lastChatMessage 업데이트
Trigger: schedule_chats/{messageId} onCreate
Action: 일정 문서의 lastChatMessageAt, lastChatMessagePreview 업데이트
```

### 3. Feature Flag 시스템

**점진적 롤아웃:**
```typescript
// lib/feature-flags.ts
canUseScheduleChat(userId, organizationId)
- 테스트 사용자 우선 활성화
- 테스트 크루 우선 활성화
- 퍼센트 기반 점진적 배포 (0-100%)
```

**환경 변수:**
```bash
NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT=true
NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE=100
NEXT_PUBLIC_CHAT_TEST_USERS=user1,user2
NEXT_PUBLIC_CHAT_TEST_ORGS=org1,org2
```

### 4. 보안 (Firestore Security Rules)

**주요 보안 원칙:**
- ✅ 인증된 사용자만 데이터 접근
- ✅ 크루 멤버만 크루 데이터 접근
- ✅ 채팅은 일정 참가자만 접근
- ✅ 본인 메시지만 수정/삭제 (5분 이내)
- ✅ 소프트 삭제 패턴

**채팅 관련 규칙:**
```javascript
// firestore.rules
match /schedule_chats/{messageId} {
  // 읽기: 일정 참가자만
  allow read: if isScheduleParticipant();

  // 생성: 일정 참가자만 (또는 시스템 메시지)
  allow create: if canAccessChat();

  // 수정: 본인 메시지만 (5분 이내)
  allow update: if isOwner() && within5Minutes();
}
```

## 🏗️ 아키텍처

### Frontend (Next.js 16 + React 19)

```
app/schedules/[scheduleId]/
├── page.tsx (Server Component)
├── ScheduleDetailClient.tsx (Client Component)
└── components/
    ├── InlineChatSection.tsx     # 채팅 UI
    ├── ChatMessage.tsx            # 메시지 컴포넌트
    ├── ChatInput.tsx              # 입력 필드
    └── ParticipantStrip.tsx       # 참여자 리스트
```

**주요 Hook:**
```typescript
// hooks/useScheduleChat.ts
useScheduleChat(scheduleId, userId, userName, userAvatar)
- 실시간 메시지 구독 (Firestore onSnapshot)
- 메시지 전송 (낙관적 UI)
- 실패 메시지 재시도
- 로딩/에러 상태 관리
```

### Backend (Firebase)

**Firestore Collections:**
```
schedule_chats/
├── {messageId}
    ├── scheduleId: string
    ├── senderId: string | null
    ├── senderName: string | null
    ├── content: string
    ├── type: 'user' | 'system'
    ├── systemType?: 'rsvp_change' | 'schedule_update' | 'info'
    ├── createdAt: Timestamp
    └── isDeleted: boolean
```

**Cloud Functions (v2 API):**
```typescript
functions/src/
├── index.ts                      # Entry point
└── triggers/
    ├── onRSVPChange.ts          # RSVP 변경 트리거
    ├── onScheduleUpdate.ts       # 일정 변경 트리거
    └── onChatMessage.ts          # 채팅 메시지 트리거
```

## 🎨 디자인 시스템

**Architecture 1: 당근마켓 + 토스 스타일**

```css
/* globals.css */
:root {
  --primary: oklch(0.70 0.15 40);        /* 따뜻한 오렌지 */
  --radius: 0.75rem;                      /* 둥근 모서리 */
  --shadow-sm: 0 1px 3px oklch(0 0 0 / 0.08);
}
```

**컴포넌트:**
- Button (5 variants: primary, secondary, outline, ghost, danger)
- Card (4 variants: default, elevated, flat, ghost)
- Avatar, Badge, Input, Textarea
- BottomSheet, EmptyState, Skeleton

## 📦 설치 및 실행

### 1. 의존성 설치

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions && npm install
```

### 2. 환경 변수 설정

```bash
# Development
cp .env.local.example .env.local

# Production
cp .env.production.example .env.production
```

### 3. 로컬 개발 서버

```bash
# Next.js dev server
npm run dev

# Firebase emulators (optional)
npm run emulators
```

### 4. Functions 빌드

```bash
# Build Cloud Functions
npm run functions:build

# Test locally with emulators
npm run functions:serve
```

## 🚀 배포

### 1. Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Cloud Functions

```bash
npm run functions:deploy

# 또는 특정 함수만
firebase deploy --only functions:onChatMessage
```

### 3. Next.js App (Vercel)

```bash
vercel --prod

# 또는 Git push로 자동 배포
git push origin main
```

## 📊 성능 최적화

### Frontend

- ✅ React 19 최신 기능 활용
- ✅ Server Components + Client Components 분리
- ✅ Optimistic UI로 즉각적인 피드백
- ✅ useMemo로 불필요한 재계산 방지
- ✅ Skeleton UI로 로딩 UX 개선

### Backend

- ✅ Firestore 인덱스 최적화
- ✅ Cloud Functions v2 (성능 향상)
- ✅ Batch 처리로 쓰기 최적화
- ✅ 불필요한 트리거 방지 (hasChat 체크)

## 🧪 테스트

### 수동 테스트 체크리스트

**채팅 기능:**
- [ ] 메시지 전송 및 실시간 수신
- [ ] 아바타 및 이름 표시
- [ ] 시간 표시 (상대 시간)
- [ ] 실패 메시지 재시도
- [ ] 시스템 메시지 자동 생성

**Feature Flag:**
- [ ] 활성화/비활성화 전환
- [ ] 점진적 롤아웃 작동
- [ ] 테스트 사용자 우선 활성화

**보안:**
- [ ] 비인증 사용자 접근 차단
- [ ] 크루 외부 사용자 접근 차단
- [ ] 본인 메시지만 수정/삭제

## 📈 모니터링

### Firebase Console

**Firestore:**
- 읽기/쓰기 횟수 모니터링
- Security Rules 위반 로그

**Functions:**
- 실행 횟수 및 성공률
- 에러 로그 및 스택 트레이스
- 실행 시간 및 메모리 사용량

**명령어:**
```bash
# Functions 로그 확인
npm run functions:logs

# 특정 함수 로그
firebase functions:log --only onChatMessage
```

## 🐛 알려진 이슈 및 제한사항

### 현재 제한사항

1. **푸시 알림 미구현**
   - onChatMessage 함수에 주석 처리됨
   - FCM 토큰 관리 필요

2. **이미지 업로드 미지원**
   - 텍스트 메시지만 지원
   - CHAT_IMAGE_UPLOAD Feature Flag 준비됨

3. **읽음 표시 미구현**
   - 읽은 사용자 추적 미구현
   - 향후 확장 가능

### 향후 개선 사항

- [ ] 푸시 알림 (FCM)
- [ ] 이미지/파일 업로드
- [ ] 읽음 표시
- [ ] 메시지 검색
- [ ] 메시지 고정
- [ ] 답장 기능

## 📚 참고 자료

### 기술 문서

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Firebase Functions v2](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)

### 프로젝트 문서

- `DEPLOYMENT.md` - 배포 가이드
- `firestore.rules` - 보안 규칙
- `functions/src/index.ts` - Cloud Functions

## 🎉 완료 현황

```
✅ Architecture 1: Design System Enhancement
✅ Architecture 2: Feature Flags & Migration
✅ Architecture 3: Cloud Functions
✅ Architecture 4: Permission & Security
✅ Architecture 5: Optimization & Documentation
```

**개발 완료 일자:** 2025년 11월 18일
**배포 준비:** ✅ 완료
**다음 단계:** Production 배포 및 모니터링
