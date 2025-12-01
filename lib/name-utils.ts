/**
 * 동명이인 처리 유틸리티
 * 같은 이름을 가진 멤버들에게 가입일 순서대로 A, B, C... 접미사 추가
 */

interface MemberWithJoinDate {
  name: string
  joinedAt?: any  // Timestamp or Date
  [key: string]: any
}

/**
 * 멤버 목록에 동명이인 접미사 추가
 * @param members 멤버 배열
 * @returns 접미사가 추가된 displayName을 포함하는 멤버 배열
 */
export function addDuplicateNameSuffixes<T extends MemberWithJoinDate>(members: T[]): (T & { displayName: string })[] {
  // 이름별로 그룹화
  const nameGroups = new Map<string, T[]>()

  members.forEach(member => {
    const name = member.name || '알 수 없음'
    if (!nameGroups.has(name)) {
      nameGroups.set(name, [])
    }
    nameGroups.get(name)!.push(member)
  })

  // 결과 배열
  const result: (T & { displayName: string })[] = []

  // 각 이름 그룹 처리
  nameGroups.forEach((group, name) => {
    if (group.length === 1) {
      // 중복이 없으면 그대로
      result.push({
        ...group[0],
        displayName: name
      })
    } else {
      // 중복이 있으면 가입일 순으로 정렬 후 접미사 추가
      const sorted = [...group].sort((a, b) => {
        const aDate = getJoinDate(a.joinedAt)
        const bDate = getJoinDate(b.joinedAt)
        return aDate.getTime() - bDate.getTime()
      })

      sorted.forEach((member, index) => {
        const suffix = String.fromCharCode(65 + index) // A, B, C, D...
        result.push({
          ...member,
          displayName: `${name} ${suffix}`
        })
      })
    }
  })

  return result
}

/**
 * joinedAt을 Date 객체로 변환
 */
function getJoinDate(joinedAt: any): Date {
  if (!joinedAt) {
    return new Date(0) // 가입일이 없으면 가장 오래된 것으로 처리
  }

  // Firestore Timestamp with seconds
  if (typeof joinedAt === 'object' && 'seconds' in joinedAt) {
    return new Date(joinedAt.seconds * 1000)
  }

  // Firestore Timestamp with _seconds
  if (typeof joinedAt === 'object' && '_seconds' in joinedAt) {
    return new Date(joinedAt._seconds * 1000)
  }

  // Timestamp with toDate method
  if (typeof joinedAt === 'object' && typeof joinedAt.toDate === 'function') {
    return joinedAt.toDate()
  }

  // Already a Date
  if (joinedAt instanceof Date) {
    return joinedAt
  }

  // String or number
  return new Date(joinedAt)
}
