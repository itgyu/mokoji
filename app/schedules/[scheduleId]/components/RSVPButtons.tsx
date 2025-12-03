'use client';

import { useState, useEffect } from 'react';
import { schedulesAPI } from '@/lib/api-client';
import type { RSVPStatus, ScheduleParticipant } from '@/types/firestore';

interface RSVPButtonsProps {
  scheduleId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  currentStatus?: RSVPStatus;
  participants: ScheduleParticipant[];
  maxParticipants?: number;
  currentGoingCount: number;
  onStatusChange?: (newStatus: RSVPStatus | undefined) => void;
}

/**
 * 참석 응답 버튼 컴포넌트 (Optimistic UI 적용)
 *
 * 버튼 클릭 즉시 UI 업데이트 → 백그라운드에서 API 호출 → 실패 시 롤백
 */
export function RSVPButtons({
  scheduleId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentStatus,
  participants,
  maxParticipants,
  currentGoingCount,
  onStatusChange,
}: RSVPButtonsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);

  // props 변경 시 로컬 상태도 동기화
  useEffect(() => {
    setLocalStatus(currentStatus);
  }, [currentStatus]);

  // 정원 체크
  const isFull = maxParticipants ? currentGoingCount >= maxParticipants : false;
  const canJoin = !isFull || localStatus === 'going';

  const handleRSVP = async (newStatus: RSVPStatus) => {
    if (isUpdating) return;

    // 같은 버튼을 다시 누르면 취소 (토글)
    const isCanceling = newStatus === localStatus;
    const updatedStatus = isCanceling ? undefined : newStatus;

    // 정원 체크 (참석으로 변경하려는 경우에만)
    if (!isCanceling && newStatus === 'going') {
      // 현재 going 상태인 참가자 수 (나를 제외)
      const otherGoingCount = participants.filter(
        (p) => p.userId !== currentUserId && p.status === 'going'
      ).length;

      if (maxParticipants && otherGoingCount >= maxParticipants) {
        alert('정원이 마감되었습니다. 대기를 선택해주세요.');
        return;
      }
    }

    // 이전 상태 저장 (롤백용)
    const prevStatus = localStatus;

    // 🚀 Optimistic UI: 즉시 로컬 상태 업데이트
    setLocalStatus(updatedStatus);
    onStatusChange?.(updatedStatus);
    setIsUpdating(true);

    try {
      // 기존 참여자 중에서 현재 사용자를 제외한 목록
      const otherParticipants = participants.filter(
        (p) => p.userId !== currentUserId
      );

      let updatedParticipants;

      if (isCanceling) {
        // 취소: 현재 사용자를 participants에서 제거
        updatedParticipants = otherParticipants;
      } else {
        // 새로운 참여자 데이터
        const newParticipant: any = {
          userId: currentUserId,
          userName: currentUserName,
          status: newStatus,
          respondedAt: Date.now(),
        };

        // userAvatar가 있을 때만 추가
        if (currentUserAvatar) {
          newParticipant.userAvatar = currentUserAvatar;
        }

        // 업데이트된 participants 배열
        updatedParticipants = [...otherParticipants, newParticipant];
      }

      // 백그라운드에서 API 호출
      await schedulesAPI.update(scheduleId, {
        participants: updatedParticipants,
      });

    } catch (error: any) {
      console.error('[RSVPButtons] RSVP 업데이트 실패:', error);

      // ❌ 실패 시 롤백
      setLocalStatus(prevStatus);
      onStatusChange?.(prevStatus);

      alert(error.message || '참석 응답 업데이트에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsUpdating(false);
    }
  };

  const buttons = [
    { status: 'going' as RSVPStatus, label: '참석', disabled: !canJoin },
    { status: 'waiting' as RSVPStatus, label: '대기', disabled: false },
    { status: 'declined' as RSVPStatus, label: '불참', disabled: false },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <p className="text-xs text-gray-500 mb-3">내 참석 상태</p>
      <div className="flex gap-2">
        {buttons.map(({ status, label, disabled }) => {
          const isSelected = localStatus === status;
          return (
            <button
              key={status}
              onClick={() => handleRSVP(status)}
              disabled={disabled}
              className={`
                flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${isSelected
                  ? 'bg-[#5f0080] text-white'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isUpdating ? 'pointer-events-none' : ''}
              `}
            >
              {label}
              {status === 'going' && isFull && !isSelected && ' (마감)'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
