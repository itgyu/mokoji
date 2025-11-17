import { Timestamp } from 'firebase/firestore'

/**
 * Firestore Timestamp를 읽기 쉬운 날짜 문자열로 변환
 */
export function formatTimestamp(timestamp: Timestamp | Date | string | null | undefined): string {
  if (!timestamp) return '-'

  try {
    let date: Date

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp)
    } else {
      return '-'
    }

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (error) {
    console.error('날짜 변환 오류:', error)
    return '-'
  }
}

/**
 * 상대 시간 표시 (예: "3일 전", "방금 전")
 */
export function formatRelativeTime(timestamp: Timestamp | Date | string | null | undefined): string {
  if (!timestamp) return '-'

  try {
    let date: Date

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp)
    } else {
      return '-'
    }

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) return '방금 전'
    if (diffMin < 60) return `${diffMin}분 전`
    if (diffHour < 24) return `${diffHour}시간 전`
    if (diffDay < 30) return `${diffDay}일 전`
    if (diffMonth < 12) return `${diffMonth}개월 전`
    return `${diffYear}년 전`
  } catch (error) {
    console.error('상대 시간 변환 오류:', error)
    return '-'
  }
}

/**
 * YYYY-MM-DD 형식
 */
export function formatDateShort(timestamp: Timestamp | Date | string | null | undefined): string {
  if (!timestamp) return '-'

  try {
    let date: Date

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp)
    } else {
      return '-'
    }

    return date.toISOString().split('T')[0]
  } catch (error) {
    console.error('날짜 변환 오류:', error)
    return '-'
  }
}
