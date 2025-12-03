/**
 * API Client 헬퍼 함수
 *
 * 클라이언트 컴포넌트에서 API Routes를 쉽게 호출하기 위한 래퍼 함수들
 * 자동으로 Authorization 헤더를 추가하고 에러 처리를 수행합니다.
 */

import { getIdToken } from './cognito';

/**
 * API 호출 기본 함수
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // ID 토큰 가져오기
    const idToken = await getIdToken();
    if (!idToken) {
      throw new Error('Not authenticated');
    }

    // Authorization 헤더 추가
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      ...options.headers,
    };

    // API 호출 (캐시 비활성화)
    const response = await fetch(endpoint, {
      ...options,
      headers,
      cache: 'no-store',
    });

    // 에러 처리
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // 응답 반환
    return await response.json();
  } catch (error: any) {
    console.error(`❌ API call failed [${endpoint}]:`, error.message);
    throw error;
  }
}

// ============================================
// Users API
// ============================================

export const usersAPI = {
  /**
   * 사용자 조회 (by userId)
   */
  async get(userId: string) {
    return apiCall<any>(`/api/users/${userId}`);
  },

  /**
   * 사용자 조회 (by email)
   */
  async getByEmail(email: string) {
    return apiCall<any>(`/api/users/email/${encodeURIComponent(email)}`);
  },

  /**
   * 사용자 생성
   */
  async create(user: any) {
    return apiCall<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  /**
   * 사용자 프로필 수정
   */
  async update(userId: string, updates: any) {
    return apiCall<any>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

// ============================================
// Organizations API
// ============================================

export const organizationsAPI = {
  /**
   * 전체 조직 목록 조회
   */
  async getAll(limit = 100) {
    return apiCall<any[]>(`/api/organizations?limit=${limit}`);
  },

  /**
   * 조직 조회 (by organizationId)
   */
  async get(organizationId: string) {
    return apiCall<any>(`/api/organizations/${organizationId}`);
  },

  /**
   * 소유자별 조직 조회
   */
  async getByOwner(ownerUid: string) {
    return apiCall<any[]>(`/api/organizations/owner/${ownerUid}`);
  },

  /**
   * 조직 생성
   */
  async create(organization: any) {
    return apiCall<any>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(organization),
    });
  },

  /**
   * 조직 수정
   */
  async update(organizationId: string, updates: any) {
    return apiCall<any>(`/api/organizations/${organizationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 조직 삭제
   */
  async delete(organizationId: string) {
    return apiCall<any>(`/api/organizations/${organizationId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Members API
// ============================================

export const membersAPI = {
  /**
   * 조직의 멤버 목록 조회
   */
  async getByOrganization(organizationId: string) {
    return apiCall<any[]>(`/api/members/organization/${organizationId}`);
  },

  /**
   * 사용자의 멤버십 목록 조회
   */
  async getByUser(userId: string) {
    return apiCall<any[]>(`/api/members/user/${userId}`);
  },

  /**
   * 멤버 추가
   */
  async create(member: any) {
    return apiCall<any>('/api/members', {
      method: 'POST',
      body: JSON.stringify(member),
    });
  },

  /**
   * 멤버 정보 수정
   */
  async update(memberId: string, updates: any) {
    return apiCall<any>(`/api/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 멤버 제거
   */
  async delete(memberId: string) {
    return apiCall<any>(`/api/members/${memberId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Schedules API
// ============================================

export const schedulesAPI = {
  /**
   * 조직의 일정 목록 조회
   */
  async getByOrganization(
    organizationId: string,
    options?: { startDate?: string; endDate?: string }
  ) {
    let url = `/api/schedules/organization/${organizationId}`;
    if (options?.startDate && options?.endDate) {
      url += `?startDate=${options.startDate}&endDate=${options.endDate}`;
    }
    return apiCall<any[]>(url);
  },

  /**
   * 일정 조회 (by scheduleId)
   */
  async get(scheduleId: string) {
    return apiCall<any>(`/api/schedules/${scheduleId}`);
  },

  /**
   * 일정 생성
   */
  async create(schedule: any) {
    return apiCall<any>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  },

  /**
   * 일정 수정
   */
  async update(scheduleId: string, updates: any) {
    return apiCall<any>(`/api/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 일정 삭제
   */
  async delete(scheduleId: string) {
    return apiCall<any>(`/api/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Photos API
// ============================================

export const photosAPI = {
  /**
   * 조직의 사진 목록 조회
   */
  async getByOrganization(organizationId: string, limit = 50) {
    return apiCall<any[]>(`/api/photos/organization/${organizationId}?limit=${limit}`);
  },

  /**
   * 사진 메타데이터 생성
   */
  async create(photo: any) {
    return apiCall<any>('/api/photos', {
      method: 'POST',
      body: JSON.stringify(photo),
    });
  },

  /**
   * 사진 삭제
   */
  async delete(photoId: string) {
    return apiCall<any>(`/api/photos/${photoId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Activity Logs API
// ============================================

export const activityLogsAPI = {
  /**
   * 조직의 활동 로그 조회
   */
  async getByOrganization(organizationId: string, limit = 50) {
    return apiCall<any[]>(`/api/activity-logs/organization/${organizationId}?limit=${limit}`);
  },

  /**
   * 활동 로그 생성
   */
  async create(log: any) {
    return apiCall<any>('/api/activity-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },
};

// ============================================
// Backward Compatibility Exports
// (기존 코드와의 호환성을 위한 별칭)
// ============================================

export const usersDB = usersAPI;
export const organizationsDB = organizationsAPI;
export const membersDB = membersAPI;
export const schedulesDB = schedulesAPI;
export const photosDB = photosAPI;
export const activityLogsDB = activityLogsAPI;
