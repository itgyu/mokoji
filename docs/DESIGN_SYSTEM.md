# 모꼬지 디자인 시스템 v2.0

플랫폼 출시를 위한 전문적이고 일관된 디자인 시스템

---

## 📐 타이포그래피 (Typography)

### 3단계 시스템 + 캡션

명확한 정보 위계를 위해 폰트 크기를 3가지로 단순화했습니다.

#### 1. 타이틀 (Title) - `.text-title`
```tsx
// 사용처: 페이지 제목, 섹션 헤더
<h1 className="text-title">모꼬지</h1>

// 크기:
// - Mobile: 24px (text-2xl)
// - Desktop: 30px (text-3xl)
// - 굵기: Bold (font-bold)
```

#### 2. 서브타이틀 (Subtitle) - `.text-subtitle`
```tsx
// 사용처: 카드 제목, 중요한 강조 텍스트
<h2 className="text-subtitle">다가오는 일정</h2>

// 크기:
// - Mobile: 18px (text-lg)
// - Desktop: 20px (text-xl)
// - 굵기: Semi-bold (font-semibold)
```

#### 3. 본문 (Body) - `.text-body`
```tsx
// 사용처: 일반 텍스트, 설명, 리스트
<p className="text-body">모임 장소와 시간을 확인하세요</p>

// 크기:
// - Mobile: 14px (text-sm)
// - Desktop: 16px (text-base)
// - 굵기: Normal (font-normal)
```

#### 4. 캡션 (Caption) - `.text-caption`
```tsx
// 사용처: 작은 설명, 날짜, 메타 정보
<span className="text-caption">2시간 전</span>

// 크기:
// - Mobile: 12px (text-xs)
// - Desktop: 14px (text-sm)
// - 굵기: Normal (font-normal)
// - 색상: 연한 회색 (text-tertiary)
```

---

## 🎨 컬러 시스템 (Colors)

### Primary (메인 컬러)
- **#FF9B50** - 따뜻한 오렌지, 브랜드 아이덴티티
- 사용처: 버튼, 링크, 강조 요소

### Neutral (중성 컬러)
- **#292524** - 제목 (foreground)
- **#44403C** - 본문
- **#78716C** - 부가 정보 (muted-foreground)
- **#A8A29E** - 비활성 (text-tertiary)
- **#E7E5E4** - 테두리 (border)
- **#F5F5F4** - 배경 (surface)

### Semantic (의미 전달)
- **Success**: #10B981 (초록)
- **Warning**: #F59E0B (노랑)
- **Error**: #EF4444 (빨강)
- **Info**: #3B82F6 (파랑)

---

## 🔷 아이콘 시스템

### 이모티콘 금지!
플랫폼 출시를 위해 이모티콘 사용을 지양하고, 전문적인 아이콘을 사용합니다.

### lucide-react 아이콘 사용
```tsx
import { Calendar, MapPin, MessageCircle, User } from 'lucide-react'

// 기본 사용
<Calendar className="w-5 h-5 text-[#FF9B50]" />

// 크기
<Calendar className="w-4 h-4" />  // 작음
<Calendar className="w-5 h-5" />  // 기본
<Calendar className="w-6 h-6" />  // 중간
<Calendar className="w-8 h-8" />  // 큼
```

### 커스텀 아이콘 컴포넌트
```tsx
import { IconCalendar, IconLocation, IconChat, IconUser } from '@/components/icons'

<IconCalendar size="md" />
<IconLocation size="lg" />
```

### 아이콘 교체 가이드

| 이모티콘 | 아이콘 | 사용처 |
|---------|--------|--------|
| 📅 | `<Calendar />` | 일정, 날짜 |
| 📍 | `<MapPin />` | 장소, 위치 |
| 💬 | `<MessageCircle />` | 채팅, 메시지 |
| 👤 | `<User />` | 사용자, 프로필 |
| ⚙️ | `<Settings />` | 설정 |
| 🔍 | `<Search />` | 검색 |
| ➕ | `<Plus />` | 추가, 생성 |
| ✓ | `<Check />` | 완료, 확인 |

---

## 📦 컨테이너 & 카드

### 카드 스타일
```tsx
// 기본 카드
<div className="bg-white rounded-2xl border border-[#E7E5E4] p-4 md:p-6">
  <h3 className="text-subtitle">제목</h3>
  <p className="text-body">내용</p>
</div>

// 섹션 컨테이너
<section className="bg-white rounded-3xl border border-[#E7E5E4] p-6 md:p-8">
  {/* 큰 섹션 콘텐츠 */}
</section>
```

---

## 🎯 버튼 스타일

### Primary Button
```tsx
<button className="inline-flex items-center justify-center px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-semibold bg-gradient-to-r from-[#FF9B50] to-[#FF8A3D] text-white rounded-xl hover:shadow-lg active:scale-95 transition-all">
  확인
</button>
```

### Secondary Button
```tsx
<button className="inline-flex items-center justify-center px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-semibold bg-white text-[#292524] border-2 border-[#E7E5E4] rounded-xl hover:bg-[#F5F5F4] active:scale-95 transition-all">
  취소
</button>
```

---

## ✅ 체크리스트

### 디자인 시스템 적용 시
- [ ] 타이포그래피 3단계 사용 (title, subtitle, body)
- [ ] 이모티콘 대신 lucide-react 아이콘 사용
- [ ] 컬러 시스템 변수 사용 (hardcoded 색상 금지)
- [ ] 반응형 크기 지정 (md: 브레이크포인트 활용)
- [ ] 간격은 8pt 그리드 시스템 사용 (space-2, space-4, space-6...)

### 코드 리뷰 포인트
- 이모티콘이 남아있지 않은가?
- 폰트 크기가 일관되게 사용되었는가?
- 색상이 하드코딩되지 않았는가?
- 모바일/데스크톱 반응형이 적용되었는가?

---

## 🚀 다음 단계

1. ✅ 디자인 시스템 문서 완성
2. ⏳ 기존 컴포넌트에 적용
3. ⏳ 이모티콘 → 아이콘 전환
4. ⏳ 스토리북 구축 (선택)
5. ⏳ 디자인 토큰 자동화 (선택)

---

**Last Updated**: 2025-11-19
**Version**: 2.0
**Status**: Production Ready
