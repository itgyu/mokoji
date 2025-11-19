'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/firestore';
import { createRSVPSystemMessage, createSystemMessage } from '@/lib/firestore/chat-helpers';
import type { RSVPStatus, ScheduleParticipant } from '@/types/firestore';

interface RSVPButtonsProps {
  scheduleId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  currentStatus?: RSVPStatus;
  maxParticipants?: number;
  currentGoingCount: number;
  onStatusChange?: (newStatus: RSVPStatus) => void;
}

/**
 * 참석 응답 버튼 컴포넌트 (대기열 시스템)
 *
 * 3개의 버튼으로 참석 상태를 변경합니다:
 * - 참석 (going) - 선착순 마감
 * - 대기 (waiting) - 정원 초과 시 대기열
 * - 불참 (declined)
 */
export function RSVPButtons({
  scheduleId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentStatus,
  maxParticipants,
  currentGoingCount,
  onStatusChange,
}: RSVPButtonsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);

  // 정원 체크
  const isFull = maxParticipants ? currentGoingCount >= maxParticipants : false;
  const canJoin = !isFull || localStatus === 'going'; // 이미 참석 중이면 상태 변경 가능

  const handleRSVP = async (newStatus: RSVPStatus) => {
    if (isUpdating) return;

    // 같은 버튼을 다시 누르면 취소 (토글)
    const isCanceling = newStatus === localStatus;

    setIsUpdating(true);

    try {
      const scheduleRef = doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleId);

      // Transaction을 사용하여 원자적으로 업데이트
      await runTransaction(db, async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);

        if (!scheduleDoc.exists()) {
          throw new Error('일정을 찾을 수 없습니다.');
        }

        const scheduleData = scheduleDoc.data();
        const participants = (scheduleData.participants || [])
          .filter((p: any) => typeof p === 'object' && p !== null && p.userId); // 객체만 필터링

        // 기존 참여자 중에서 현재 사용자를 제외한 목록
        const otherParticipants = participants.filter(
          (p: any) => p.userId !== currentUserId
        );

        let updatedParticipants;

        if (isCanceling) {
          // 취소: 현재 사용자를 participants에서 제거
          updatedParticipants = otherParticipants;
        } else {
          // 정원 체크 (참석으로 변경하려는 경우에만)
          if (newStatus === 'going') {
            const currentGoingCount = otherParticipants.filter(
              (p: any) => p.status === 'going'
            ).length;

            if (
              scheduleData.maxParticipants &&
              currentGoingCount >= scheduleData.maxParticipants
            ) {
              throw new Error('정원이 마감되었습니다. 대기를 선택해주세요.');
            }
          }

          // 새로운 참여자 데이터
          const newParticipant: any = {
            userId: currentUserId,
            userName: currentUserName,
            status: newStatus,
            respondedAt: new Date(),
          };

          // userAvatar가 있을 때만 추가
          if (currentUserAvatar) {
            newParticipant.userAvatar = currentUserAvatar;
          }

          // 업데이트된 participants 배열
          updatedParticipants = [...otherParticipants, newParticipant];
        }

        // Firestore 업데이트
        transaction.update(scheduleRef, {
          participants: updatedParticipants,
          updatedAt: serverTimestamp(),
        });
      });

      console.log('[RSVPButtons] RSVP 업데이트 성공:', {
        scheduleId,
        userId: currentUserId,
        newStatus: isCanceling ? 'canceled' : newStatus,
      });

      // 로컬 상태 업데이트
      const updatedStatus = isCanceling ? undefined : newStatus;
      setLocalStatus(updatedStatus);
      onStatusChange?.(updatedStatus as RSVPStatus);

      // 시스템 메시지 생성
      try {
        if (isCanceling) {
          // 취소 메시지
          const statusText = {
            going: '참석',
            waiting: '대기',
            declined: '불참',
          }[localStatus as RSVPStatus];

          await createSystemMessage(
            scheduleId,
            `${currentUserName || '사용자'}님이 ${statusText}을(를) 취소했습니다.`,
            'rsvp_change'
          );
        } else {
          await createRSVPSystemMessage(
            scheduleId,
            currentUserName || '사용자',
            currentUserId,
            newStatus,
            localStatus
          );
        }
        console.log('[RSVPButtons] 시스템 메시지 생성 완료');
      } catch (systemMessageError) {
        console.error('[RSVPButtons] 시스템 메시지 생성 실패:', systemMessageError);
      }
    } catch (error: any) {
      console.error('[RSVPButtons] RSVP 업데이트 실패:', error);
      alert(error.message || '참석 응답 업데이트에 실패했습니다. 다시 시도해주세요.');
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
        disabled={isUpdating || !canJoin}
        className="flex-1"
        title={isFull && localStatus !== 'going' ? '정원이 마감되었습니다' : ''}
      >
        <span className="mr-1">✅</span>
        참석 {isFull && localStatus !== 'going' && '(마감)'}
      </Button>

      <Button
        variant={localStatus === 'waiting' ? 'primary' : 'ghost'}
        size="md"
        onClick={() => handleRSVP('waiting' as RSVPStatus)}
        disabled={isUpdating}
        className="flex-1"
      >
        <span className="mr-1">⏳</span>
        대기
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
