'use client';

import { useState, useEffect } from 'react';
import { ScheduleSummaryCard } from './components/ScheduleSummaryCard';
import { RSVPButtons } from './components/RSVPButtons';
import { ParticipantStrip } from './components/ParticipantStrip';
import { InlineChatSection } from './components/InlineChatSection';
import { useScheduleChat } from '@/hooks/useScheduleChat';
import { canUseScheduleChat, logFeatureFlags } from '@/lib/feature-flags';
import { Card, CardBody } from '@/components/ui/Card';
import type { OrgSchedule } from '@/types/firestore';

interface ScheduleDetailClientProps {
  schedule: OrgSchedule;
  scheduleId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
}

/**
 * 일정 상세 클라이언트 컴포넌트
 *
 * 모든 인터랙티브한 기능을 담당:
 * - 참석 응답 변경
 * - 채팅 메시지 전송/수신
 * - 실시간 업데이트
 */
export function ScheduleDetailClient({
  schedule,
  scheduleId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: ScheduleDetailClientProps) {
  const [localSchedule, setLocalSchedule] = useState(schedule);

  // 현재 사용자의 참석 상태 찾기
  const myParticipation = localSchedule.participants.find(
    (p) => p.userId === currentUserId
  );
  const currentStatus = myParticipation?.status;

  // Feature Flag: 채팅 기능 사용 가능 여부
  const canAccessChat = canUseScheduleChat(currentUserId, localSchedule.organizationId);

  // 개발 환경에서 Feature Flag 상태 로깅
  useEffect(() => {
    logFeatureFlags(currentUserId, localSchedule.organizationId);
  }, [currentUserId, localSchedule.organizationId]);

  // 실시간 채팅 Hook
  const {
    messages,
    isLoading: isLoadingMessages,
    error: chatError,
    isSending,
    sendMessage,
    retryFailedMessage,
  } = useScheduleChat(
    scheduleId,
    currentUserId,
    currentUserName,
    currentUserAvatar
  );

  // 참석 응답 변경 핸들러
  const handleStatusChange = (newStatus: any) => {
    // 로컬 상태 업데이트 (Optimistic UI)
    setLocalSchedule((prev) => {
      const updatedParticipants = prev.participants.filter(
        (p) => p.userId !== currentUserId
      );

      updatedParticipants.push({
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        status: newStatus,
        respondedAt: { toDate: () => new Date() } as any,
      });

      return {
        ...prev,
        participants: updatedParticipants,
        participantCount: updatedParticipants.length,
      };
    });
  };


  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* 뒤로 가기 버튼 */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="text-sm font-medium">뒤로</span>
      </button>

      {/* 일정 정보 */}
      <ScheduleSummaryCard schedule={localSchedule} />

      {/* 참석 응답 버튼 */}
      <RSVPButtons
        scheduleId={scheduleId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        currentStatus={currentStatus}
        onStatusChange={handleStatusChange}
      />

      {/* 참여자 리스트 */}
      <ParticipantStrip participants={localSchedule.participants} />

      {/* 채팅 섹션 - Feature Flag 적용 */}
      {localSchedule.hasChat && canAccessChat && (
        <InlineChatSection
          scheduleId={scheduleId}
          scheduleTitle={localSchedule.title}
          messages={messages}
          isLoading={isLoadingMessages}
          currentUserId={currentUserId}
          onSendMessage={sendMessage}
          onRetryMessage={retryFailedMessage}
        />
      )}

      {/* 채팅 기능 준비 중 안내 */}
      {localSchedule.hasChat && !canAccessChat && (
        <Card variant="elevated" padding="lg">
          <CardBody className="text-center space-y-3">
            <div className="text-4xl">💬</div>
            <h3 className="text-heading-3">채팅 기능 준비 중</h3>
            <p className="text-body-2 text-muted-foreground">
              일정별 채팅 기능이 곧 제공될 예정입니다.
              <br />
              조금만 기다려주세요!
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light text-primary rounded-full text-sm font-medium">
              <span>🚀</span>
              <span>베타 준비 중</span>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
