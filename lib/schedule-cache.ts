/**
 * 일정 데이터 캐시 스토어
 *
 * 대시보드에서 로드한 일정 데이터를 캐시하여
 * 상세 페이지 진입 시 즉시 표시할 수 있도록 함
 */

interface CachedSchedule {
  data: any;
  timestamp: number;
}

// 메모리 캐시 (5분 TTL)
const CACHE_TTL = 5 * 60 * 1000; // 5분
const scheduleCache = new Map<string, CachedSchedule>();

/**
 * 일정 데이터 캐시에 저장
 */
export function cacheSchedule(scheduleId: string, data: any): void {
  scheduleCache.set(scheduleId, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 여러 일정 데이터를 한번에 캐시
 */
export function cacheSchedules(schedules: any[]): void {
  schedules.forEach((schedule) => {
    const id = schedule.scheduleId || schedule.id;
    if (id) {
      cacheSchedule(id, schedule);
    }
  });
}

/**
 * 캐시에서 일정 데이터 가져오기
 * TTL이 지났으면 null 반환
 */
export function getCachedSchedule(scheduleId: string): any | null {
  const cached = scheduleCache.get(scheduleId);
  if (!cached) return null;

  // TTL 체크
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    scheduleCache.delete(scheduleId);
    return null;
  }

  return cached.data;
}

/**
 * 캐시 무효화
 */
export function invalidateSchedule(scheduleId: string): void {
  scheduleCache.delete(scheduleId);
}

/**
 * 전체 캐시 초기화
 */
export function clearScheduleCache(): void {
  scheduleCache.clear();
}
