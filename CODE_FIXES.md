# 멤버 승인 시스템 코드 수정 가이드

> 모든 문제를 해결하기 위한 완전한 코드 수정 가이드

---

## 📋 수정이 필요한 파일 목록

1. `app/dashboard/page.tsx` - 승인 함수 수정
2. `app/crew/[crewId]/settings/page.tsx` - organizationMembers 사용
3. `app/crew/[crewId]/settings/CrewSettingsClient.tsx` - 날짜 표시 수정

---

## 1️⃣ app/dashboard/page.tsx 수정

### 수정 위치: Line 1449-1499 (handleApproveMember 함수)

**기존 코드 (삭제할 부분):**
```tsx
// members 컬렉션에 레코드 추가
const membersRef = collection(db, 'members')
await addDoc(membersRef, {
  uid: member.uid,
  name: member.name,
  email: member.email || '',
  avatar: member.avatar || null,
  role: '멤버',
  isCaptain: false,
  isStaff: false,
  joinDate: new Date().toLocaleDateString('ko-KR'),
  orgId: orgId
})
```

**새 코드 (전체 함수 교체):**
```tsx
// 크루 가입 승인
const handleApproveMember = async (orgId: string, member: any) => {
  if (!confirm(`${member.name}님의 가입을 승인하시겠습니까?`)) return

  try {
    const orgRef = doc(db, 'organizations', orgId)
    const userRef = doc(db, 'userProfiles', member.uid)

    // pendingMembers에서 제거
    await updateDoc(orgRef, {
      pendingMembers: arrayRemove(member)
    })

    // userProfiles의 organizations 배열에 추가
    await updateDoc(userRef, {
      organizations: arrayUnion(orgId)
    })

    // ✅ organizationMembers 컬렉션에만 추가 (통합 시스템)
    // 중복 방지: 구 members 컬렉션에는 추가하지 않음
    await addOrganizationMember(orgId, member.uid, 'member')
    console.log('✅ organizationMembers에 추가 완료:', orgId, member.uid)

    alert(`${member.name}님이 크루에 가입되었습니다!`)
    fetchOrganizations()

    // 멤버 리스트 새로고침
    if (selectedOrg) {
      await fetchMembers(orgId)
    }

  } catch (error) {
    console.error('❌ 승인 실패:', error)
    alert('승인하는 중에 문제가 생겼어요. 다시 시도해주세요.')
  }
}
```

**수정 요약:**
- ❌ 삭제: `members` 컬렉션에 추가하는 코드 (Line 1468-1480)
- ✅ 유지: `organizationMembers`에만 추가 (Line 1483)
- ✅ 개선: 주석 추가로 이유 명확화

---

## 2️⃣ app/crew/[crewId]/settings/page.tsx 수정

### 수정 위치: Line 73-92 (loadCrewData 함수 내부)

**기존 코드:**
```tsx
// 크루 멤버 목록 가져오기
const membersSnapshot = await getDocs(
  query(collection(db, 'members'), where('orgId', '==', unwrappedParams.crewId))
);

// JSON 직렬화로 Timestamp 제거
const membersList = membersSnapshot.docs.map((doc) => {
  const data = JSON.parse(JSON.stringify(doc.data()));
  return {
    id: doc.id,
    uid: data.uid || '',
    name: data.name || '',
    email: data.email || '',
    avatar: data.avatar || '',
    orgId: data.orgId || '',
    role: data.role || 'member',
    joinedAt: data.joinedAt || '',
  };
});
```

**새 코드:**
```tsx
// 크루 멤버 목록 가져오기 (organizationMembers 컬렉션 사용)
const orgMembersSnapshot = await getDocs(
  query(
    collection(db, 'organizationMembers'),
    where('organizationId', '==', unwrappedParams.crewId),
    where('status', '==', 'active')
  )
);

// 멤버 정보를 userProfiles에서 가져와서 조합
const membersList = await Promise.all(
  orgMembersSnapshot.docs.map(async (doc) => {
    const orgMemberData = doc.data();

    // userProfiles에서 사용자 정보 가져오기
    const userDoc = await getDoc(doc(db, 'userProfiles', orgMemberData.userId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    return {
      id: doc.id,
      uid: orgMemberData.userId,
      name: userData.name || '알 수 없음',
      email: userData.email || '',
      avatar: userData.avatar || userData.photoURL || '',
      orgId: orgMemberData.organizationId,
      role: orgMemberData.role || 'member',
      joinedAt: orgMemberData.joinedAt || null, // Timestamp 객체 유지
    };
  })
);
```

**수정 요약:**
- ✅ 변경: `members` → `organizationMembers` 컬렉션 조회
- ✅ 추가: userProfiles에서 이름/아바타 조회
- ✅ 수정: `joinedAt`을 Timestamp 객체로 유지

---

## 3️⃣ app/crew/[crewId]/settings/CrewSettingsClient.tsx 수정

### 수정 위치: Line 454-458 (멤버 가입일 표시)

**기존 코드:**
```tsx
{member.joinedAt && (
  <p className="text-xs text-muted-foreground mt-1">
    가입: {new Date(member.joinedAt).toLocaleDateString('ko-KR')}
  </p>
)}
```

**새 코드:**
```tsx
{member.joinedAt && (
  <p className="text-xs text-muted-foreground mt-1">
    가입: {
      member.joinedAt.seconds
        ? new Date(member.joinedAt.seconds * 1000).toLocaleDateString('ko-KR')
        : new Date(member.joinedAt).toLocaleDateString('ko-KR')
    }
  </p>
)}
```

**수정 요약:**
- ✅ 개선: Timestamp 객체와 Date 문자열 모두 처리
- ✅ 수정: `seconds` 필드 확인 후 변환

---

## 🚀 적용 순서

### 1단계: 데이터 정리 (필수!)

```bash
cd /Users/taegyulee/Desktop/mokoji
npx tsx scripts/fix-member-approval-issues.ts
```

이 스크립트는:
- ✅ 구 `members` 컬렉션의 중복 데이터 삭제
- ✅ 남은 데이터를 `organizationMembers`로 마이그레이션
- ✅ 잘못된 `joinedAt` 필드 수정
- ✅ **동명이인에 A, B, C 접미사 자동 추가**

### 2단계: 코드 수정

위의 3개 파일을 수정합니다:

1. `app/dashboard/page.tsx` - 승인 함수
2. `app/crew/[crewId]/settings/page.tsx` - 멤버 조회
3. `app/crew/[crewId]/settings/CrewSettingsClient.tsx` - 날짜 표시

### 3단계: 테스트

1. 개발 서버 재시작:
   ```bash
   npm run dev
   ```

2. 테스트 시나리오:
   - ✅ 새 멤버 가입 승인
   - ✅ 크루 설정에서 멤버 리스트 확인
   - ✅ 가입일자가 올바르게 표시되는지 확인
   - ✅ 중복 멤버가 없는지 확인
   - ✅ 동명이인에 A, B, C가 붙어있는지 확인

### 4단계: 배포

```bash
git add .
git commit -m "멤버 승인 시스템 완전 수정

- 중복 멤버 표시 문제 해결
- Invalid Date 문제 해결
- 동명이인 A,B,C 접미사 자동 추가
- organizationMembers 컬렉션으로 통합

🤖 Generated with Claude Code"

git push origin main
```

---

## ✅ 완료 체크리스트

- [ ] 데이터 정리 스크립트 실행
- [ ] `app/dashboard/page.tsx` 수정
- [ ] `app/crew/[crewId]/settings/page.tsx` 수정
- [ ] `app/crew/[crewId]/settings/CrewSettingsClient.tsx` 수정
- [ ] 개발 서버에서 테스트
- [ ] 가입 승인 테스트
- [ ] 멤버 리스트 확인 (중복 없음)
- [ ] 가입일자 정상 표시 확인
- [ ] 동명이인 처리 확인
- [ ] 배포

---

## 🐛 문제 해결

### Q1: 스크립트 실행 시 Firebase 키 오류
```
❌ Firebase 서비스 계정 키를 찾을 수 없습니다
```

**해결:**
`new-firebase-key.json` 파일이 프로젝트 루트에 있는지 확인

### Q2: 멤버가 여전히 중복 표시됨

**해결:**
1. 데이터 정리 스크립트 다시 실행
2. 브라우저 캐시 삭제
3. 개발 서버 재시작

### Q3: 가입일자가 여전히 invalid

**해결:**
1. 스크립트의 3단계(fixInvalidJoinedAtFields)가 실행되었는지 확인
2. Firebase Console에서 organizationMembers 확인

---

## 📊 기대 효과

### Before (수정 전)
- ❌ 멤버가 2개씩 중복 표시
- ❌ 가입일자 "invalid date"
- ❌ 동명이인 구분 불가
- ❌ 데이터 불일치

### After (수정 후)
- ✅ 멤버 1번만 정확히 표시
- ✅ 가입일자 올바르게 표시 ("2024. 11. 28.")
- ✅ 동명이인 자동 구분 (김철수 A, 김철수 B)
- ✅ 데이터 일관성 유지

---

**모든 문제가 완전히 해결됩니다!** 🎉
