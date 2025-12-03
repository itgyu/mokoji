/**
 * Feature Flag 관리 시스템
 *
 * 기능별로 점진적 롤아웃 가능
 */

export interface FeatureFlags {
  // 일정별 채팅 기능
  SCHEDULE_CHAT: {
    enabled: boolean;
    rolloutPercentage: number;
    testUserIds: string[];
    testOrgIds: string[];
  };

  // 이미지 업로드 (향후)
  CHAT_IMAGE_UPLOAD: {
    enabled: boolean;
  };

  // 푸시 알림 (향후)
  PUSH_NOTIFICATIONS: {
    enabled: boolean;
  };
}

/**
 * 환경변수 기반 Feature Flag 설정
 */
export const FEATURE_FLAGS: FeatureFlags = {
  SCHEDULE_CHAT: {
    enabled: true, // 모든 사용자에게 활성화
    rolloutPercentage: 100, // 100% 롤아웃
    testUserIds: [],
    testOrgIds: [],
  },

  CHAT_IMAGE_UPLOAD: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_CHAT_IMAGES === 'true',
  },

  PUSH_NOTIFICATIONS: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_PUSH === 'true',
  },
};

/**
 * 특정 사용자가 채팅 기능을 사용할 수 있는지 확인
 *
 * @param userId - 사용자 ID
 * @param organizationId - 크루 ID (선택)
 * @returns 채팅 기능 사용 가능 여부
 */
export function canUseScheduleChat(
  userId: string | undefined | null,
  organizationId?: string
): boolean {
  const config = FEATURE_FLAGS.SCHEDULE_CHAT;

  // Feature flag가 비활성화면 false
  if (!config.enabled) {
    return false;
  }

  // userId가 없으면 false
  if (!userId) {
    return false;
  }

  // 테스트 사용자는 항상 true
  if (config.testUserIds.includes(userId)) {
    return true;
  }

  // 테스트 크루는 항상 true
  if (organizationId && config.testOrgIds.includes(organizationId)) {
    return true;
  }

  // 점진적 롤아웃 (userId 해시값 기반)
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  const userPercentage = hash % 100;

  return userPercentage < config.rolloutPercentage;
}

/**
 * Feature Flag 상태 로깅 (디버깅용)
 */
export function logFeatureFlags(userId?: string, orgId?: string) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('[FeatureFlags] Current Configuration:', {
    userId,
    orgId,
    scheduleChat: {
      enabled: FEATURE_FLAGS.SCHEDULE_CHAT.enabled,
      rollout: `${FEATURE_FLAGS.SCHEDULE_CHAT.rolloutPercentage}%`,
      canUse: userId ? canUseScheduleChat(userId, orgId) : 'N/A',
    },
    chatImages: FEATURE_FLAGS.CHAT_IMAGE_UPLOAD.enabled,
    pushNotifications: FEATURE_FLAGS.PUSH_NOTIFICATIONS.enabled,
  });
}
