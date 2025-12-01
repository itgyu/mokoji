# 🛡️ 데이터 보호 가이드

## 개요

**중요한 데이터(특히 joinedAt)가 3번이나 유실되는 문제가 발생했습니다.**

이 가이드는 앞으로 이런 일이 절대 다시 발생하지 않도록 하기 위한 완전한 보호 시스템입니다.

---

## 🔒 1. 데이터베이스 레벨 보호 (이미 구현됨)

### Firestore Security Rules

`firestore.rules` 파일에 다음 보호 규칙이 적용되었습니다:

```javascript
match /organizationMembers/{memberId} {
  // 읽기는 인증된 사용자 모두 허용
  allow read: if isAuthenticated();

  // 생성: joinedAt 필드 필수
  allow create: if isAuthenticated()
                && request.resource.data.keys().hasAll(['joinedAt', 'userId', 'organizationId']);

  // 수정: joinedAt 필드는 절대 변경 불가 (기존 값 유지 필수)
  allow update: if isAuthenticated()
                && (!request.resource.data.keys().hasAny(['joinedAt'])
                    || request.resource.data.joinedAt == resource.data.joinedAt);

  // 삭제는 허용
  allow delete: if isAuthenticated();
}
```

### 보호 메커니즘

1. **생성 시**: `joinedAt` 필드가 필수로 포함되어야 함
2. **수정 시**:
   - `joinedAt` 필드를 업데이트 요청에 포함하지 않으면 → 허용 (다른 필드만 수정)
   - `joinedAt` 필드를 포함하되 기존 값과 동일하면 → 허용
   - `joinedAt` 필드를 다른 값으로 변경하려 하면 → **차단 (PERMISSION_DENIED)**

### 배포 상태

✅ **2025-12-01 배포 완료**
- 프로젝트: mokojiya
- 상태: 활성화됨

---

## 💾 2. 백업 시스템 (이미 구현됨)

### 백업 명령어

```bash
# 전체 organizationMembers 백업
npm run backup:members
```

### 백업 파일

- **위치**: `/backups/organizationMembers_<타임스탬프>.json`
- **내용**:
  - docId (문서 ID)
  - 모든 원본 데이터
  - joinedAt_backup (원본 Timestamp)
  - joinedAt_readable (사람이 읽을 수 있는 ISO 형식)

### 첫 백업 완료

✅ **2025-12-01 04:28:51 백업 완료**
- 파일: `organizationMembers_2025-12-01T04-28-51.json`
- 멤버 수: 38명
- joinedAt 데이터: 38명 모두 보유

---

## 🔄 3. 복구 시스템 (이미 구현됨)

### 복구 명령어

```bash
# 백업 파일 목록 확인
npm run restore:members

# 특정 백업으로 복구
npm run restore:members organizationMembers_2025-12-01T04-28-51.json
```

### 복구 프로세스

1. 백업 파일 로드
2. 10초 대기 (취소 가능)
3. 각 문서의 joinedAt을 백업 값으로 복구
4. 결과 보고 (성공/건너뜀/실패)

### ⚠️ 주의사항

복구 시 Firestore Rules가 joinedAt 수정을 차단할 수 있습니다. 이 경우:

1. **옵션 1**: Rules를 임시로 비활성화 (권장하지 않음)
2. **옵션 2**: Admin SDK 사용 (현재 구현됨) - Rules 우회 가능

---

## 📋 4. 마이그레이션 체크리스트

**앞으로 모든 마이그레이션 스크립트는 이 체크리스트를 따라야 합니다:**

### 마이그레이션 전 (필수)

- [ ] **백업 실행**: `npm run backup:members`
- [ ] 백업 파일 확인 (파일 크기, 멤버 수)
- [ ] 마이그레이션 스크립트 검토:
  - [ ] `joinedAt` 필드를 수정하는가?
  - [ ] `serverTimestamp()`를 사용하는가?
  - [ ] 기존 값을 보존하는가?

### 마이그레이션 중 (권장)

- [ ] 로컬/테스트 환경에서 먼저 테스트
- [ ] 소수의 문서로 먼저 테스트 (예: 1-2개)
- [ ] 진행 상황 로깅
- [ ] 에러 처리 구현

### 마이그레이션 후 (필수)

- [ ] 데이터 검증
- [ ] `joinedAt` 필드 확인
- [ ] 백업과 비교
- [ ] 문제 발견 시 즉시 복구

---

## 🚨 5. 과거 문제 분석

### 문제 발생 이력

1. **1차 유실**: (날짜 미상)
2. **2차 유실**: (날짜 미상)
3. **3차 유실**: 2025-12-01 12:23:18-21
   - 원인: `fix-member-approval-issues.ts` Phase 3
   - 잘못된 코드: `joinedAt: serverTimestamp()`
   - 결과: 38명 모두 같은 시간으로 덮어씀

### 근본 원인

```typescript
// ❌ 잘못된 예시 (절대 이렇게 하지 마세요!)
await updateDoc(memberRef, {
  joinedAt: serverTimestamp()  // 기존 값 덮어쓰기
})

// ✅ 올바른 예시
const existingData = await getDoc(memberRef)
await updateDoc(memberRef, {
  joinedAt: existingData.data()?.joinedAt || serverTimestamp()
})

// ✅ 더 좋은 예시 (필드 제외)
await updateDoc(memberRef, {
  // joinedAt 필드를 아예 업데이트하지 않음
  role: newRole,
  updatedAt: serverTimestamp()
})
```

---

## 📝 6. 코딩 가이드라인

### DO: 이렇게 하세요 ✅

1. **기존 데이터 확인 후 업데이트**
   ```typescript
   const doc = await getDoc(docRef)
   const existingJoinedAt = doc.data()?.joinedAt

   await updateDoc(docRef, {
     otherField: newValue,
     joinedAt: existingJoinedAt  // 기존 값 유지
   })
   ```

2. **joinedAt 필드 제외**
   ```typescript
   await updateDoc(docRef, {
     role: 'admin',
     // joinedAt은 포함하지 않음
   })
   ```

3. **생성 시에만 설정**
   ```typescript
   await addDoc(collection(db, 'organizationMembers'), {
     userId: user.uid,
     organizationId: orgId,
     joinedAt: serverTimestamp(),  // 생성 시에만 OK
     role: 'member'
   })
   ```

### DON'T: 절대 이렇게 하지 마세요 ❌

1. **기존 joinedAt 덮어쓰기**
   ```typescript
   ❌ joinedAt: serverTimestamp()  // 기존 데이터 손실!
   ```

2. **일괄 업데이트 시 joinedAt 포함**
   ```typescript
   ❌ members.forEach(m => {
     updateDoc(m.ref, {
       joinedAt: serverTimestamp(),  // 모든 데이터 손실!
       ...otherFields
     })
   })
   ```

3. **데이터 마이그레이션 시 타임스탬프 리셋**
   ```typescript
   ❌ const newDoc = {
     ...oldDoc.data(),
     joinedAt: serverTimestamp()  // 리셋하지 마세요!
   }
   ```

---

## 🔍 7. 데이터 검증

### 정기 검증 명령어

현재 joinedAt 데이터 상태를 확인하려면:

```bash
npx tsx scripts/check-join-dates.ts
```

### 예상 결과

✅ **정상**: 각 멤버마다 다른 가입일
❌ **비정상**: 모든 멤버가 같은 날짜

---

## 📞 8. 문제 발생 시 대응

### 즉시 조치

1. **작업 중단**: 추가 손상 방지
2. **백업 확인**: `backups/` 디렉토리 확인
3. **복구 실행**:
   ```bash
   npm run restore:members <최신_백업_파일>
   ```
4. **검증**: 복구 후 데이터 확인

### 보고

문제 발생 시 다음 정보 수집:
- 실행한 스크립트/명령어
- 에러 메시지
- 영향받은 멤버 수
- 백업 파일 목록

---

## 📅 9. 정기 작업

### 매주 (권장)

```bash
npm run backup:members
```

### 마이그레이션 전 (필수)

```bash
npm run backup:members
```

### 매월 (권장)

- 오래된 백업 파일 정리 (3개월 이상)
- Firestore Rules 검토
- 데이터 무결성 검증

---

## ✅ 10. 현재 보호 상태

| 보호 수단 | 상태 | 날짜 |
|---------|------|------|
| Firestore Security Rules | ✅ 배포됨 | 2025-12-01 |
| 백업 스크립트 | ✅ 구현됨 | 2025-12-01 |
| 복구 스크립트 | ✅ 구현됨 | 2025-12-01 |
| 첫 백업 | ✅ 완료 | 2025-12-01 04:28:51 |
| 문서화 | ✅ 완료 | 2025-12-01 |

**결론**: joinedAt 데이터는 이제 다중 레이어 보호를 받고 있습니다.

---

## 🎯 요약

### 3가지 보호 레이어

1. **데이터베이스 레벨**: Firestore Rules로 수정 차단
2. **백업 시스템**: 정기적 백업으로 복구 가능
3. **코딩 가이드라인**: 개발자 실수 방지

### 핵심 원칙

> **joinedAt 필드는 생성 시 한 번만 설정하고, 이후에는 절대 수정하지 않는다.**

---

문의사항이나 문제가 있으면 이 문서를 참고하거나 백업을 먼저 실행하세요.
