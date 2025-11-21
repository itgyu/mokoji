/**
 * Firestore 컬렉션 구조 정의
 *
 * ⚠️ 중요: 모든 컬렉션 참조는 이 파일의 상수를 사용해야 합니다.
 * 직접 문자열로 컬렉션 이름을 사용하지 마세요!
 */

export const COLLECTIONS = {
  // 최상위 컬렉션
  ORGANIZATIONS: 'organizations',
  ORG_SCHEDULES: 'org_schedules',
  MEMBERS: 'members',
  USER_PROFILES: 'userProfiles',
  PROFILES: 'profiles',

  // 서브컬렉션 헬퍼 함수
  ORG_ACTIVITY_LOGS: (orgId: string) => `organizations/${orgId}/activity_logs`,
  SCHEDULE_MESSAGES: (scheduleId: string) => `org_schedules/${scheduleId}/messages`,
} as const

// 컬렉션 이름 타입
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS]

/**
 * 📊 현재 데이터베이스 구조 (mokojiya 프로젝트):
 *
 * ✅ organizations/                           # 크루 정보
 *    └── {orgId}/
 *        └── activity_logs/                  # 활동 로그 (서브컬렉션)
 *            └── {logId}
 *                - type: string              # 활동 타입 (schedule_created, member_joined 등)
 *                - userId: string
 *                - userName: string
 *                - timestamp: Timestamp
 *                - orgId: string
 *
 * ✅ org_schedules/                           # 일정 정보
 *    └── {scheduleId}/
 *        - title: string
 *        - date: string
 *        - dateISO: string
 *        - time: string
 *        - location: string
 *        - orgId: string                     # ⚠️ 필수: 크루 ID
 *        - createdBy: string
 *        - createdAt: Timestamp
 *        └── messages/                       # 채팅 메시지 (서브컬렉션)
 *            └── {messageId}
 *                - text: string
 *                - userId: string
 *                - userName: string
 *                - timestamp: Timestamp
 *
 * ✅ members/                                 # 크루 멤버 정보
 *    └── {memberId}
 *        - uid: string                       # Auth UID
 *        - email: string
 *        - name: string
 *        - avatar: string
 *        - joinDate: string
 *        - orgId: string                     # 소속 크루 ID
 *        - role: string
 *        - isStaff: boolean
 *        - isCaptain: boolean
 *
 * ✅ userProfiles/                            # 사용자 프로필
 *    └── {userId}
 *        - email: string
 *        - name: string
 *        - avatar: string
 *        - interestCategories: string[]
 *
 * ❌ 사용 금지 컬렉션 (구 버전):
 *    - schedules                             # → org_schedules로 대체됨
 *    - activityLogs                          # → organizations/{orgId}/activity_logs로 대체됨
 *    - schedule_chats                        # → org_schedules/{scheduleId}/messages로 대체됨
 *    - organization_members                  # → members로 통합됨
 */
