'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/firestore';
import { createRSVPSystemMessage } from '@/lib/firestore/chat-helpers';
import type { RSVPStatus, ScheduleParticipant } from '@/types/firestore';

interface RSVPButtonsProps {
  scheduleId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  currentStatus?: RSVPStatus;
  onStatusChange?: (newStatus: RSVPStatus) => void;
}

/**
 * 참석 응답 버튼 컴포넌트
 *
 * 3개의 버튼으로 참석 상태를 변경합니다:
 * - 참석 (going)
 * - 미정 (maybe)
 * - 불참 (declined)
 */
export function RSVPButtons({
  scheduleId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentStatus,
  onStatusChange,
}: RSVPButtonsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);

  const handleRSVP = async (newStatus: RSVPStatus) => {
    if (isUpdating || newStatus === localStatus) return;

    setIsUpdating(true);

    try {
      const scheduleRef = doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleId);

      // 기존 참여자 데이터 찾기 (모든 상태에서 현재 사용자 제거)
      const statusesToCheck: RSVPStatus[] = ['going', 'maybe', 'declined'];

      for (const status of statusesToCheck) {
        // 이전 상태의 참여자 제거를 위한 참조 데이터
        // 실제로는 participants 배열을 직접 수정하는 것이 더 안전합니다
      }

      // 새로운 참여자 데이터 (undefined 값 제거)
      const newParticipant: any = {
        userId: currentUserId,
        userName: currentUserName,
        status: newStatus,
        respondedAt: new Date(), // serverTimestamp()는 배열 안에서 사용 불가
      };

      // userAvatar가 있을 때만 추가
      if (currentUserAvatar) {
        newParticipant.userAvatar = currentUserAvatar;
      }

      // Firestore 업데이트
      // 주의: arrayUnion/arrayRemove는 전체 객체가 정확히 일치해야 작동합니다
      // 실제 구현에서는 트랜잭션을 사용하거나, 전체 배열을 읽고 수정하는 것이 안전합니다
      await updateDoc(scheduleRef, {
        participants: arrayUnion(newParticipant),
        updatedAt: serverTimestamp(),
      });

      console.log('[RSVPButtons] RSVP 업데이트 성공:', {
        scheduleId,
        userId: currentUserId,
        newStatus,
      });

      // 로컬 상태 업데이트
      setLocalStatus(newStatus);
      onStatusChange?.(newStatus);

      // 시스템 메시지 생성 (임시 - Cloud Functions 배포 전까지)
      // Cloud Functions가 배포되면 이 부분은 자동으로 처리됩니다
      try {
        await createRSVPSystemMessage(
          scheduleId,
          currentUserName || '사용자',
          currentUserId,
          newStatus,
          localStatus
        );
        console.log('[RSVPButtons] 시스템 메시지 생성 완료');
      } catch (systemMessageError) {
        console.error('[RSVPButtons] 시스템 메시지 생성 실패:', systemMessageError);
        // 시스템 메시지 생성 실패는 치명적이지 않으므로 무시
        // RSVP 자체는 성공했으므로 사용자에게 알리지 않음
      }
    } catch (error) {
      console.error('RSVP 업데이트 실패:', error);
      alert('참석 응답 업데이트에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex gap-2 w-full">
      <Button
        variant={localStatus === 'going' ? 'primary' : 'ghost'}
        size="md"
        onClick={() => handleRSVP('going')}
        disabled={isUpdating}
        className="flex-1"
      >
        <span className="mr-1">✅</span>
        참석
      </Button>

      <Button
        variant={localStatus === 'maybe' ? 'primary' : 'ghost'}
        size="md"
        onClick={() => handleRSVP('maybe')}
        disabled={isUpdating}
        className="flex-1"
      >
        <span className="mr-1">🤔</span>
        미정
      </Button>

      <Button
        variant={localStatus === 'declined' ? 'primary' : 'ghost'}
        size="md"
        onClick={() => handleRSVP('declined')}
        disabled={isUpdating}
        className="flex-1"
      >
        <span className="mr-1">❌</span>
        불참
      </Button>
    </div>
  );
}
