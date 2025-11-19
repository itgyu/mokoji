/**
 * 채팅 관련 헬퍼 함수
 *
 * Cloud Functions 배포 전까지 사용할 수 있는 임시 함수들
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/firestore';
import type { SystemMessageType } from '@/types/firestore';

/**
 * 시스템 메시지를 수동으로 생성합니다.
 *
 * ⚠️ 주의: 이 함수는 Cloud Functions 배포 전 테스트용입니다.
 * 실제 배포 환경에서는 Cloud Functions가 자동으로 시스템 메시지를 생성합니다.
 *
 * @param scheduleId - 일정 ID
 * @param content - 메시지 내용
 * @param systemType - 시스템 메시지 타입
 * @param systemPayload - 추가 데이터 (선택)
 *
 * @example
 * ```typescript
 * await createSystemMessage(
 *   'schedule123',
 *   '김철수님이 참석으로 변경했습니다.',
 *   'rsvp_change'
 * );
 * ```
 */
export async function createSystemMessage(
  scheduleId: string,
  content: string,
  systemType: SystemMessageType = 'rsvp_change',
  systemPayload?: Record<string, any>
): Promise<void> {
  try {
    console.log('[createSystemMessage] 시스템 메시지 생성 시작:', {
      scheduleId,
      content: content.substring(0, 50),
      systemType,
    });

    const messagesRef = collection(db, COLLECTIONS.SCHEDULE_CHATS);

    await addDoc(messagesRef, {
      scheduleId,
      senderId: null, // 시스템 메시지는 senderId가 null
      senderName: null,
      senderAvatar: null,
      content,
      type: 'system',
      systemType,
      systemPayload: systemPayload || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });

    console.log('[createSystemMessage] 시스템 메시지 생성 완료');
  } catch (error) {
    console.error('[createSystemMessage] 시스템 메시지 생성 실패:', error);
    throw error;
  }
}

/**
 * RSVP 변경 시스템 메시지 생성 (헬퍼)
 *
 * @param scheduleId - 일정 ID
 * @param userName - 사용자 이름
 * @param userId - 사용자 ID
 * @param newStatus - 새로운 RSVP 상태
 * @param oldStatus - 이전 RSVP 상태 (선택)
 */
export async function createRSVPSystemMessage(
  scheduleId: string,
  userName: string,
  userId: string,
  newStatus: 'going' | 'waiting' | 'declined',
  oldStatus?: string
): Promise<void> {
  const statusText = {
    going: '참석',
    waiting: '대기',
    declined: '불참',
  }[newStatus];

  const content = `${userName}님이 ${statusText}으로 변경했습니다.`;

  // systemPayload 객체 생성 (undefined 값 제외)
  const systemPayload: any = {
    userId,
    userName,
    newStatus,
  };

  // oldStatus가 있을 때만 추가
  if (oldStatus !== undefined) {
    systemPayload.oldStatus = oldStatus;
  }

  await createSystemMessage(scheduleId, content, 'rsvp_change', systemPayload);
}

/**
 * 일정 정보 변경 시스템 메시지 생성 (헬퍼)
 *
 * @param scheduleId - 일정 ID
 * @param changeType - 변경 타입 ('title' | 'time' | 'location')
 * @param newValue - 새로운 값
 */
export async function createScheduleUpdateSystemMessage(
  scheduleId: string,
  changeType: 'title' | 'time' | 'location',
  newValue: string
): Promise<void> {
  let content = '';

  switch (changeType) {
    case 'title':
      content = `일정 제목이 "${newValue}"(으)로 변경되었습니다.`;
      break;
    case 'time':
      content = `일정 시간이 ${newValue}(으)로 변경되었습니다.`;
      break;
    case 'location':
      content = `장소가 "${newValue}"(으)로 변경되었습니다.`;
      break;
  }

  await createSystemMessage(scheduleId, content, 'schedule_update', {
    changeType,
    newValue,
  });
}

/**
 * 일정 취소 시스템 메시지 생성 (헬퍼)
 *
 * @param scheduleId - 일정 ID
 */
export async function createScheduleCancelSystemMessage(
  scheduleId: string
): Promise<void> {
  await createSystemMessage(
    scheduleId,
    '⚠️ 이 일정이 취소되었습니다.',
    'schedule_cancel'
  );
}

/**
 * 일정 완료 시스템 메시지 생성 (헬퍼)
 *
 * @param scheduleId - 일정 ID
 */
export async function createScheduleCompleteSystemMessage(
  scheduleId: string
): Promise<void> {
  await createSystemMessage(
    scheduleId,
    '✅ 이 일정이 완료되었습니다.',
    'schedule_complete'
  );
}
