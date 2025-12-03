/**
 * 일정 데이터 캐시 스토어
 *
 * 대시보드에서 로드한 일정 데이터를 캐시하여
 * 상세 페이지 진입 시 즉시 표시할 수 있도록 함
 *
 * localStorage를 사용하여 페이지 새로고침 후에도 캐시 유지
 */

interface CachedSchedule {
  data: any;
  timestamp: number;
}

interface OrgScheduleCache {
  schedules: any[];
  timestamp: number;
}

// 메모리 캐시 (5분 TTL)
const CACHE_TTL = 5 * 60 * 1000; // 5분
const scheduleCache = new Map<string, CachedSchedule>();

// localStorage 키
const LS_SCHEDULE_KEY = 'mokoji_schedules_cache';
const LS_ORG_SCHEDULE_KEY = 'mokoji_org_schedules_';

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
 * 조직별 일정 캐시에 저장 (localStorage)
 */
export function cacheOrgSchedules(orgId: string, schedules: any[]): void {
  if (typeof window === 'undefined') return;

  try {
    const cache: OrgScheduleCache = {
      schedules,
      timestamp: Date.now(),
    };
    localStorage.setItem(LS_ORG_SCHEDULE_KEY + orgId, JSON.stringify(cache));
  } catch (e) {
    // localStorage 용량 초과 등 에러 무시
  }
}

/**
 * 조직별 일정 캐시에서 가져오기 (localStorage)
 * TTL이 지나도 반환하되, isStale 플래그로 구분
 */
export function getCachedOrgSchedules(orgId: string): { schedules: any[]; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(LS_ORG_SCHEDULE_KEY + orgId);
    if (!cached) return null;

    const parsed: OrgScheduleCache = JSON.parse(cached);
    const isStale = Date.now() - parsed.timestamp > CACHE_TTL;

    return {
      schedules: parsed.schedules,
      isStale,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 모든 크루 일정 캐시 저장 (홈 화면용)
 */
export function cacheAllSchedules(schedules: any[]): void {
  if (typeof window === 'undefined') return;

  try {
    const cache: OrgScheduleCache = {
      schedules,
      timestamp: Date.now(),
    };
    localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(cache));
  } catch (e) {
    // localStorage 용량 초과 등 에러 무시
  }
}

/**
 * 모든 크루 일정 캐시 가져오기 (홈 화면용)
 */
export function getCachedAllSchedules(): { schedules: any[]; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(LS_SCHEDULE_KEY);
    if (!cached) return null;

    const parsed: OrgScheduleCache = JSON.parse(cached);
    const isStale = Date.now() - parsed.timestamp > CACHE_TTL;

    return {
      schedules: parsed.schedules,
      isStale,
    };
  } catch (e) {
    return null;
  }
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
 * 조직 일정 캐시 무효화
 */
export function invalidateOrgSchedules(orgId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_ORG_SCHEDULE_KEY + orgId);
}

/**
 * 전체 캐시 초기화
 */
export function clearScheduleCache(): void {
  scheduleCache.clear();
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_SCHEDULE_KEY);
  // org별 캐시도 모두 삭제
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_ORG_SCHEDULE_KEY)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
