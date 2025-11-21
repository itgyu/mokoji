/**
 * 모꼬지 Firestore 타입 정의
 *
 * 데이터 보호 원칙:
 * 1. 모든 문서는 BaseDocument를 extends
 * 2. isDeleted 필드 필수 (Soft Delete)
 * 3. 물리 삭제 금지
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// 공통 Base 타입
// ============================================

/**
 * 모든 Firestore 문서의 기본 인터페이스
 *
 * 데이터 보호 원칙: Soft Delete 필수
 */
export interface BaseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // Soft Delete 필드 (필수!)
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deleteReason?: string;
}

/**
 * 상태를 가진 문서의 공통 필드
 */
export interface StatusDocument extends BaseDocument {
  status: 'active' | 'inactive' | 'blocked' | 'archived';
}

// ============================================
// 일정 관련 타입 (org_schedules)
// ============================================

/**
 * 일정 상태
 */
export type ScheduleStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

/**
 * 참석 응답 상태
 * - going: 참석 (선착순 마감)
 * - waiting: 대기 (정원 초과 시)
 * - declined: 불참
 */
export type RSVPStatus = 'going' | 'waiting' | 'declined';

/**
 * 일정 참여자
 */
export interface ScheduleParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  status: RSVPStatus;
  respondedAt: Timestamp;
}

/**
 * 일정 장소
 */
export interface ScheduleLocation {
  name: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * 일정 (org_schedules 컬렉션)
 *
 * 기존 컬렉션이므로 기존 필드 유지 + 채팅 필드 추가
 */
export interface OrgSchedule extends BaseDocument {
  organizationId: string;
  organizationName?: string;

  title: string;
  description?: string;
  imageUrl?: string;

  startDate: Timestamp;
  endDate: Timestamp;
  isAllDay: boolean;

  location?: ScheduleLocation;

  maxParticipants?: number;
  participants: ScheduleParticipant[];
  participantCount: number;

  createdBy: string;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };

  status: ScheduleStatus;

  // 채팅 기능 추가 필드 (신규!)
  hasChat: boolean;
  lastChatMessageAt?: Timestamp;
  lastChatMessagePreview?: string;
}

// ============================================
// 채팅 관련 타입 (org_schedules/{scheduleId}/messages) - 신규!
// ============================================

/**
 * 메시지 타입
 */
export type MessageType = 'text' | 'image' | 'file' | 'system';

/**
 * 시스템 메시지 타입
 */
export type SystemMessageType =
  | 'rsvp_change'         // RSVP 변경 (참석 → 불참 등)
  | 'schedule_update'     // 일정 수정 (시간, 장소 변경)
  | 'schedule_cancel'     // 일정 취소
  | 'schedule_start'      // 일정 시작
  | 'schedule_complete'   // 일정 종료
  | 'info';               // 일반 정보

/**
 * 첨부 파일
 */
export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
  fileName?: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

/**
 * 시스템 메시지 페이로드
 */
export interface SystemMessagePayload {
  userId?: string;
  userName?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
}

/**
 * 채팅 메시지 (org_schedules/{scheduleId}/messages/{messageId})
 */
export interface ScheduleChatMessage extends BaseDocument {
  scheduleId: string;

  // 발신자 정보 (null = 시스템 메시지)
  senderId: string | null;
  senderName?: string;
  senderAvatar?: string;

  // 메시지 내용
  content: string;
  type: MessageType;

  // 시스템 메시지 추가 정보
  systemType?: SystemMessageType;
  systemPayload?: SystemMessagePayload;

  // 읽음 처리
  readBy?: string[];

  // 답장 기능
  replyToMessageId?: string;
  replyToContent?: string;

  // 첨부 파일
  attachments?: MessageAttachment[];

  // 메시지 상태 (전송 중, 전송 완료, 실패 등 - 클라이언트에서만 사용)
  // Firestore에는 저장하지 않음
  _status?: 'sending' | 'sent' | 'failed';
}

/**
 * 채팅 메타데이터 (schedule_chats/{scheduleId}/metadata/info)
 *
 * 채팅방의 전체 정보를 담는 문서
 */
export interface ScheduleChatMetadata {
  scheduleId: string;

  // 최근 메시지 정보
  lastMessageAt: Timestamp | null;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;

  // 통계
  messageCount: number;
  participantIds: string[];
  participantCount: number;

  // 생성/수정 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 사용자별 채팅 상태 (users/{userId}/schedule_chat_states/{scheduleId})
 *
 * 각 사용자가 각 채팅방에 대해 가지는 상태
 */
export interface ScheduleChatState {
  scheduleId: string;
  userId: string;

  // 읽음 처리
  lastReadAt: Timestamp | null;
  lastReadMessageId?: string;
  unreadCount: number;

  // 알림 설정
  mute: boolean;
  muteUntil?: Timestamp;

  // 즐겨찾기 (선택적)
  pinned: boolean;

  // 생성/수정 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// 조직 멤버 관련 타입
// ============================================

/**
 * 멤버 역할
 */
export type MemberRole = 'owner' | 'admin' | 'member';

/**
 * 멤버 상태
 */
export type MemberStatus = 'active' | 'suspended' | 'left';

/**
 * 조직 멤버 (organization_members/{orgId_userId})
 */
export interface OrganizationMember extends BaseDocument {
  organizationId: string;
  userId: string;

  // 사용자 정보 (캐시)
  userName: string;
  userAvatar?: string;
  userEmail?: string;

  // 역할 및 권한
  role: MemberRole;
  permissions: string[];
  status: MemberStatus;

  // 통계
  eventsAttended: number;
  postsCreated: number;
  lastActivityAt: Timestamp;

  // 가입/탈퇴 시간
  joinedAt: Timestamp;
  leftAt?: Timestamp;
  suspendedAt?: Timestamp;
  suspendedBy?: string;
  suspensionReason?: string;
}

// ============================================
// 헬퍼 타입들
// ============================================

/**
 * 문서 상태 타입
 */
export type DocumentStatus = 'active' | 'inactive' | 'blocked' | 'archived';

/**
 * 컬렉션 경로 상수
 */
export const COLLECTIONS = {
  // 기존 컬렉션
  USERS: 'users',
  USER_PROFILES: 'userProfiles',
  ORGANIZATIONS: 'organizations',
  ORGANIZATION_MEMBERS: 'organization_members',
  ORG_SCHEDULES: 'org_schedules',
  POSTS: 'posts',
  COMMENTS: 'comments',
  NOTIFICATIONS: 'notifications',

  // 채팅 관련 신규 컬렉션 (서브컬렉션)
  SCHEDULE_CHAT_MESSAGES: (scheduleId: string) => `org_schedules/${scheduleId}/messages`,
  SCHEDULE_CHAT_METADATA: (scheduleId: string) => `org_schedules/${scheduleId}/metadata`,
  USER_CHAT_STATES: (userId: string) => `users/${userId}/schedule_chat_states`,
} as const;

/**
 * 문서 필드 이름 상수
 */
export const FIELDS = {
  IS_DELETED: 'isDeleted',
  STATUS: 'status',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  DELETED_AT: 'deletedAt',
  DELETED_BY: 'deletedBy',
} as const;

/**
 * 쿼리 필터 기본값
 */
export const QUERY_DEFAULTS = {
  ACTIVE_ONLY: { isDeleted: false, status: 'active' },
  NOT_DELETED: { isDeleted: false },
  RECENT_LIMIT: 50,
  PAGINATION_LIMIT: 20,
} as const;
