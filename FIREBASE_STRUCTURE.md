# Firebase Firestore 컬렉션 구조

## 사용 중인 컬렉션

### 1. `userProfiles` (사용자 프로필)
- **용도**: 사용자 상세 프로필 및 크루 멤버십 관리
- **주요 필드**:
  - `name`: 이름
  - `email`: 이메일
  - `gender`: 성별
  - `birthdate`: 생년월일
  - `location`: 지역
  - `mbti`: MBTI
  - `avatar`: 프로필 사진 URL
  - `organizations`: 가입한 크루 ID 배열 **[중요: 멤버십 관리]**
  - `createdAt`: 생성일

### 2. `members` (회원 정보)
- **용도**: 서비스 전체 회원 기본 정보
- **주요 필드**:
  - `uid`: Firebase Auth UID
  - `name`: 이름
  - `email`: 이메일
  - `avatar`: 프로필 사진 URL
  - `joinDate`: 가입일 (중요!)
  - `isCaptain`: 크루장 여부
  - `isStaff`: 운영진 여부
  - `role`: 역할 (크루장/운영진/멤버)
  - `createdAt`: 생성일

### 3. `organizations` (크루/조직)
- **용도**: 크루 정보
- **주요 필드**:
  - `name`: 크루 이름
  - `description`: 설명
  - `category`: 카테고리
  - `avatar`: 크루 프로필 사진
  - `createdAt`: 생성일

### 4. `org_schedules` (크루 일정)
- **용도**: 각 크루의 일정 관리
- **주요 필드**:
  - `orgId`: 크루 ID
  - `title`: 일정 제목
  - `date`: 날짜
  - `time`: 시간
  - `location`: 장소
  - `type`: 일정 타입
  - `participants`: 참여자 이름 배열
  - `maxParticipants`: 최대 참여 인원
  - `createdBy`: 생성자 UID

## ❌ 사용하지 않는 컬렉션 (삭제 권장)

### `org_members`
- **문제점**:
  - 데이터가 제대로 업데이트되지 않음
  - 추방된 멤버나 새로 가입한 멤버 정보가 누락
  - 현재 코드에서 사용하지 않음
- **대체**: `userProfiles.organizations` 배열로 멤버십 관리

## 데이터 흐름

### 크루 멤버 조회
1. `userProfiles` 컬렉션에서 `organizations` 배열에 해당 orgId가 포함된 사용자 찾기
2. 해당 사용자들의 UID로 `members` 컬렉션에서 상세 정보 가져오기

### 멤버 추방
- `userProfiles.organizations` 배열에서 해당 orgId 제거

### 역할 변경
- `members` 컬렉션의 `isCaptain`, `isStaff`, `role` 필드 업데이트

### 멤버 정보 수정
- `userProfiles`: 상세 프로필 정보 업데이트
- `members`: 이름 등 기본 정보 업데이트

## 정리 작업

### 1. Firebase Console에서 수동 삭제
Firebase Console → Firestore Database → `org_members` 컬렉션 → 우클릭 → Delete collection

### 2. 백업 (선택사항)
혹시 모를 데이터를 위해 백업 후 삭제 권장

### 3. 향후 멤버 추가 시
회원가입 시 다음 작업 필요:
1. `members` 컬렉션에 문서 생성
2. `userProfiles` 컬렉션에 문서 생성
3. 크루 가입 시 `userProfiles.organizations` 배열에 orgId 추가
