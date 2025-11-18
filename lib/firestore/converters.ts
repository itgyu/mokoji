/**
 * 모꼬지 Firestore 컨버터
 *
 * TypeScript 타입과 Firestore 데이터 간의 안전한 변환을 제공합니다.
 *
 * 사용 예시:
 * ```typescript
 * const scheduleRef = doc(db, 'org_schedules', scheduleId)
 *   .withConverter(scheduleConverter);
 *
 * const schedule = await getDoc(scheduleRef);
 * // schedule.data()는 OrgSchedule 타입!
 * ```
 */

import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  SnapshotOptions,
} from 'firebase/firestore';
import {
  OrgSchedule,
  ScheduleChatMessage,
  ScheduleChatMetadata,
  ScheduleChatState,
  OrganizationMember,
} from '@/types/firestore';

// ============================================
// OrgSchedule (일정) 컨버터
// ============================================

/**
 * OrgSchedule 컨버터
 *
 * Firestore ↔ OrgSchedule 타입 변환
 */
export const scheduleConverter: FirestoreDataConverter<OrgSchedule> = {
  toFirestore: (schedule: any): DocumentData => {
    const data: DocumentData = { ...schedule };

    // Timestamp 변환
    if (schedule.startDate && schedule.startDate instanceof Date) {
      data.startDate = Timestamp.fromDate(schedule.startDate);
    }
    if (schedule.endDate && schedule.endDate instanceof Date) {
      data.endDate = Timestamp.fromDate(schedule.endDate);
    }
    if (schedule.createdAt && schedule.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(schedule.createdAt);
    }

    // id 필드는 문서 ID로 사용되므로 데이터에서 제거
    delete data.id;

    return data;
  },

  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): OrgSchedule => {
    const data = snapshot.data(options);

    return {
      id: snapshot.id,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      startDate: data.startDate,
      endDate: data.endDate,
      isAllDay: data.isAllDay ?? false,
      location: data.location,
      maxParticipants: data.maxParticipants,
      participants: data.participants ?? [],
      participantCount: data.participantCount ?? 0,
      createdBy: data.createdBy,
      creatorInfo: data.creatorInfo,
      status: data.status ?? 'scheduled',
      hasChat: data.hasChat ?? false,
      lastChatMessageAt: data.lastChatMessageAt,
      lastChatMessagePreview: data.lastChatMessagePreview,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy,
      deleteReason: data.deleteReason,
    } as OrgSchedule;
  },
};

// ============================================
// ScheduleChatMessage (채팅 메시지) 컨버터
// ============================================

/**
 * ScheduleChatMessage 컨버터
 *
 * Firestore ↔ ScheduleChatMessage 타입 변환
 */
export const chatMessageConverter: FirestoreDataConverter<ScheduleChatMessage> = {
  toFirestore: (message: any): DocumentData => {
    const data: DocumentData = { ...message };

    // Timestamp 변환
    if (message.createdAt && message.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(message.createdAt);
    }

    // 클라이언트 전용 필드 제거
    delete data.id;
    delete data._status;

    return data;
  },

  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): ScheduleChatMessage => {
    const data = snapshot.data(options);

    return {
      id: snapshot.id,
      scheduleId: data.scheduleId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      content: data.content,
      type: data.type ?? 'text',
      systemType: data.systemType,
      systemPayload: data.systemPayload,
      readBy: data.readBy ?? [],
      replyToMessageId: data.replyToMessageId,
      replyToContent: data.replyToContent,
      attachments: data.attachments,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy,
      deleteReason: data.deleteReason,
    } as ScheduleChatMessage;
  },
};

// ============================================
// ScheduleChatMetadata (채팅 메타데이터) 컨버터
// ============================================

/**
 * ScheduleChatMetadata 컨버터
 *
 * Firestore ↔ ScheduleChatMetadata 타입 변환
 */
export const chatMetadataConverter: FirestoreDataConverter<ScheduleChatMetadata> = {
  toFirestore: (metadata: Partial<ScheduleChatMetadata>): DocumentData => {
    const data: DocumentData = { ...metadata };

    // Timestamp 변환
    if (metadata.lastMessageAt && metadata.lastMessageAt instanceof Date) {
      data.lastMessageAt = Timestamp.fromDate(metadata.lastMessageAt);
    }
    if (metadata.createdAt && metadata.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(metadata.createdAt);
    }
    if (metadata.updatedAt && metadata.updatedAt instanceof Date) {
      data.updatedAt = Timestamp.fromDate(metadata.updatedAt);
    }

    return data;
  },

  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): ScheduleChatMetadata => {
    const data = snapshot.data(options);

    return {
      scheduleId: data.scheduleId,
      lastMessageAt: data.lastMessageAt,
      lastMessagePreview: data.lastMessagePreview,
      lastMessageSenderId: data.lastMessageSenderId,
      lastMessageSenderName: data.lastMessageSenderName,
      messageCount: data.messageCount ?? 0,
      participantIds: data.participantIds ?? [],
      participantCount: data.participantCount ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as ScheduleChatMetadata;
  },
};

// ============================================
// ScheduleChatState (사용자별 채팅 상태) 컨버터
// ============================================

/**
 * ScheduleChatState 컨버터
 *
 * Firestore ↔ ScheduleChatState 타입 변환
 */
export const chatStateConverter: FirestoreDataConverter<ScheduleChatState> = {
  toFirestore: (state: Partial<ScheduleChatState>): DocumentData => {
    const data: DocumentData = { ...state };

    // Timestamp 변환
    if (state.lastReadAt && state.lastReadAt instanceof Date) {
      data.lastReadAt = Timestamp.fromDate(state.lastReadAt);
    }
    if (state.muteUntil && state.muteUntil instanceof Date) {
      data.muteUntil = Timestamp.fromDate(state.muteUntil);
    }
    if (state.createdAt && state.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(state.createdAt);
    }
    if (state.updatedAt && state.updatedAt instanceof Date) {
      data.updatedAt = Timestamp.fromDate(state.updatedAt);
    }

    return data;
  },

  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): ScheduleChatState => {
    const data = snapshot.data(options);

    return {
      scheduleId: data.scheduleId,
      userId: data.userId,
      lastReadAt: data.lastReadAt,
      lastReadMessageId: data.lastReadMessageId,
      unreadCount: data.unreadCount ?? 0,
      mute: data.mute ?? false,
      muteUntil: data.muteUntil,
      pinned: data.pinned ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as ScheduleChatState;
  },
};

// ============================================
// OrganizationMember (조직 멤버) 컨버터
// ============================================

/**
 * OrganizationMember 컨버터
 *
 * Firestore ↔ OrganizationMember 타입 변환
 */
export const organizationMemberConverter: FirestoreDataConverter<OrganizationMember> = {
  toFirestore: (member: Partial<OrganizationMember>): DocumentData => {
    const data: DocumentData = { ...member };

    // Timestamp 변환
    if (member.joinedAt && member.joinedAt instanceof Date) {
      data.joinedAt = Timestamp.fromDate(member.joinedAt);
    }
    if (member.leftAt && member.leftAt instanceof Date) {
      data.leftAt = Timestamp.fromDate(member.leftAt);
    }
    if (member.lastActivityAt && member.lastActivityAt instanceof Date) {
      data.lastActivityAt = Timestamp.fromDate(member.lastActivityAt);
    }
    if (member.createdAt && member.createdAt instanceof Date) {
      data.createdAt = Timestamp.fromDate(member.createdAt);
    }

    // id 필드 제거
    delete data.id;

    return data;
  },

  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): OrganizationMember => {
    const data = snapshot.data(options);

    return {
      id: snapshot.id,
      organizationId: data.organizationId,
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar,
      userEmail: data.userEmail,
      role: data.role ?? 'member',
      permissions: data.permissions ?? [],
      status: data.status ?? 'active',
      eventsAttended: data.eventsAttended ?? 0,
      postsCreated: data.postsCreated ?? 0,
      lastActivityAt: data.lastActivityAt,
      joinedAt: data.joinedAt,
      leftAt: data.leftAt,
      suspendedAt: data.suspendedAt,
      suspendedBy: data.suspendedBy,
      suspensionReason: data.suspensionReason,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy,
      deleteReason: data.deleteReason,
    } as OrganizationMember;
  },
};

// ============================================
// 컨버터 사용 예시
// ============================================

/**
 * 사용 예시:
 *
 * ```typescript
 * import { db } from '@/lib/firebase';
 * import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
 * import { scheduleConverter } from '@/lib/firestore/converters';
 *
 * // 읽기
 * const scheduleRef = doc(db, 'org_schedules', scheduleId)
 *   .withConverter(scheduleConverter);
 * const scheduleSnap = await getDoc(scheduleRef);
 * const schedule = scheduleSnap.data(); // OrgSchedule 타입!
 *
 * // 쓰기
 * await setDoc(scheduleRef, {
 *   title: '등산 모임',
 *   // ... 다른 필드들
 * });
 *
 * // 업데이트
 * await updateDoc(scheduleRef, {
 *   status: 'cancelled',
 * });
 * ```
 *
 * 채팅 메시지 예시:
 * ```typescript
 * import { chatMessageConverter } from '@/lib/firestore/converters';
 * import { COLLECTIONS } from '@/types/firestore';
 *
 * const messageRef = doc(
 *   db,
 *   COLLECTIONS.SCHEDULE_CHAT_MESSAGES(scheduleId),
 *   messageId
 * ).withConverter(chatMessageConverter);
 *
 * const message = await getDoc(messageRef);
 * const messageData = message.data(); // ScheduleChatMessage 타입!
 * ```
 */
