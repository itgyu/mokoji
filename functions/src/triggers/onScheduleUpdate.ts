import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 일정 정보가 변경될 때 시스템 메시지 생성
 *
 * Cloud Function Trigger:
 * - Collection: org_schedules
 * - Event: onUpdate
 * - Purpose: 일정 제목, 시간, 장소, 상태 변경 시 시스템 메시지 자동 생성
 */
export const onScheduleUpdate = onDocumentUpdated(
  'org_schedules/{scheduleId}',
  async (event) => {
    const scheduleId = event.params.scheduleId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      return;
    }

    console.log('[onScheduleUpdate] 트리거 시작:', scheduleId);

    // 채팅이 활성화되지 않았으면 무시
    if (!after.hasChat) {
      console.log('[onScheduleUpdate] 채팅 비활성 상태, 무시');
      return;
    }

    const messages: Array<{
      content: string;
      systemType: string;
    }> = [];

    // 1. 제목 변경
    if (before.title !== after.title) {
      messages.push({
        content: `일정 제목이 "${after.title}"(으)로 변경되었습니다.`,
        systemType: 'schedule_update',
      });
      console.log('[onScheduleUpdate] 제목 변경 감지:', after.title);
    }

    // 2. 시간 변경
    const beforeStartTime = before.startDate?.toMillis?.() || 0;
    const afterStartTime = after.startDate?.toMillis?.() || 0;

    if (beforeStartTime !== afterStartTime && afterStartTime > 0) {
      const newTime = format(new Date(afterStartTime), 'M월 d일 (E) a h:mm', {
        locale: ko,
      });
      messages.push({
        content: `일정 시간이 ${newTime}(으)로 변경되었습니다.`,
        systemType: 'schedule_update',
      });
      console.log('[onScheduleUpdate] 시간 변경 감지:', newTime);
    }

    // 3. 장소 변경
    if (before.location?.name !== after.location?.name && after.location?.name) {
      messages.push({
        content: `장소가 "${after.location.name}"(으)로 변경되었습니다.`,
        systemType: 'schedule_update',
      });
      console.log('[onScheduleUpdate] 장소 변경 감지:', after.location.name);
    }

    // 4. 상태 변경 (취소)
    if (before.status !== after.status) {
      if (after.status === 'cancelled') {
        messages.push({
          content: '⚠️ 이 일정이 취소되었습니다.',
          systemType: 'schedule_cancel',
        });
        console.log('[onScheduleUpdate] 일정 취소 감지');
      } else if (after.status === 'completed') {
        messages.push({
          content: '✅ 이 일정이 완료되었습니다.',
          systemType: 'schedule_complete',
        });
        console.log('[onScheduleUpdate] 일정 완료 감지');
      }
    }

    // 시스템 메시지 저장
    if (messages.length > 0) {
      const db = admin.firestore();
      const messagesRef = db.collection('schedule_chats');

      const batch = db.batch();

      for (const msg of messages) {
        const messageRef = messagesRef.doc();
        batch.set(messageRef, {
          scheduleId,
          senderId: null, // 시스템 메시지
          senderName: null,
          senderAvatar: null,
          content: msg.content,
          type: 'system',
          systemType: msg.systemType,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isDeleted: false,
        });
      }

      await batch.commit();
      console.log('[onScheduleUpdate] 시스템 메시지 생성 완료:', messages.length, '건');
    } else {
      console.log('[onScheduleUpdate] 변경 사항 없음');
    }
  }
);
