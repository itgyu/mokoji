'use client';

import { useState, useRef, useEffect } from 'react';
import { docClient, TABLES } from '@/lib/dynamodb';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SkeletonChatMessage } from '@/components/ui';
import { ChatMessageBubble, DateDivider } from './ChatMessageBubble';
import { ChatInputBar } from './ChatInputBar';
import { EmptyChatState } from './EmptyChatState';
import { ChatSettingsSheet } from './ChatSettingsSheet';
import type { ScheduleChatMessage } from '@/types/firestore';
import { format, isSameDay } from 'date-fns';

interface InlineChatSectionProps {
  scheduleId: string;
  scheduleTitle: string;
  messages: ScheduleChatMessage[];
  isLoading: boolean;
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
  onSendMedia?: (file: File, caption?: string) => Promise<void>;
  onRetryMessage?: (message: ScheduleChatMessage) => Promise<void>;
  onViewAll?: () => void;
  onToggleNotifications?: () => void;
}

/**
 * 인라인 채팅 섹션
 *
 * 일정 상세 페이지의 하단 40~50%를 차지하는 채팅 UI
 *
 * 기능:
 * - 메시지 리스트 (날짜별 구분)
 * - 자동 스크롤
 * - 새 메시지 인디케이터
 * - 메시지 입력
 */
export function InlineChatSection({
  scheduleId,
  scheduleTitle,
  messages,
  isLoading,
  currentUserId,
  onSendMessage,
  onSendMedia,
  onRetryMessage,
  onViewAll,
  onToggleNotifications,
}: InlineChatSectionProps) {
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 초기 로드 시 맨 아래로 스크롤
  useEffect(() => {
    if (messages.length > 0 && !hasInitiallyScrolled && !isLoading) {
      setTimeout(() => {
        scrollToBottom(false);
        setHasInitiallyScrolled(true);
      }, 100);
    }
  }, [messages.length, isLoading, hasInitiallyScrolled]);

  // 새 메시지 추가 시 자동 스크롤 (맨 아래에 있을 때만)
  useEffect(() => {
    if (!containerRef.current || !hasInitiallyScrolled) return;

    const container = containerRef.current;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom) {
      scrollToBottom();
    } else {
      // 스크롤이 위에 있으면 새 메시지 인디케이터 표시
      setShowNewMessageIndicator(true);
    }
  }, [messages, hasInitiallyScrolled]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
    setShowNewMessageIndicator(false);
  };

  // 스크롤 이벤트 핸들러
  const handleScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (isAtBottom) {
      setShowNewMessageIndicator(false);
    }
  };

  // 날짜별로 메시지 그룹화
  const groupedMessages = groupMessagesByDate(messages);

  // 퀵 액션 핸들러
  const handleQuickAction = async (action: string) => {
    await onSendMessage(action);
  };

  // 메시지 삭제 핸들러
  const handleDeleteMessage = async (messageId: string) => {
    try {
      // DynamoDB에서 메시지 삭제
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.SCHEDULES,
          Key: { scheduleId, messageId },
        })
      );

      // UI 업데이트는 컴포넌트 부모에서 처리됨
    } catch (error) {
      console.error('메시지 삭제 실패:', error);
      alert('메시지를 삭제하는 중에 문제가 생겼어요');
    }
  };

  return (
    <>
      <div className="flex flex-col h-[65vh] bg-card rounded-2xl overflow-hidden shadow-sm border border-border">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">채팅</span>
          {messages.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {messages.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm text-primary hover:underline font-medium"
            >
              전체 보기
            </button>
          )}

          {/* 알림 설정 버튼 */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="채팅 알림 설정"
            title="채팅 알림 설정"
          >
            <span className="text-lg">🔔</span>
          </button>
        </div>
      </div>

      {/* 메시지 리스트 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth"
      >
        {isLoading ? (
          // 로딩 스켈레톤
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonChatMessage key={i} isMyMessage={i % 2 === 0} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          // 빈 상태
          <EmptyChatState
            scheduleTitle={scheduleTitle}
            onQuickAction={handleQuickAction}
          />
        ) : (
          // 메시지 리스트
          <>
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* 날짜 구분선 */}
                <DateDivider date={group.date} />

                {/* 해당 날짜의 메시지들 */}
                <div className="space-y-2">
                  {group.messages.map((message, messageIndex) => {
                    const isMyMessage = message.senderId === currentUserId;
                    const prevMessage = messageIndex > 0 ? group.messages[messageIndex - 1] : null;
                    const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;
                    const showSenderName = !isMyMessage && showAvatar;

                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        isMyMessage={isMyMessage}
                        showAvatar={showAvatar}
                        showSenderName={showSenderName}
                        onRetry={onRetryMessage}
                        onDelete={isMyMessage ? handleDeleteMessage : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 새 메시지 인디케이터 */}
      {showNewMessageIndicator && !isLoading && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-6 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all animate-slideUp"
        >
          <span className="text-sm font-medium">새 메시지 ↓</span>
        </button>
      )}

      {/* 입력 바 */}
      <ChatInputBar
        onSend={onSendMessage}
        onSendMedia={onSendMedia}
        disabled={isLoading}
      />
      </div>

      {/* 채팅 알림 설정 바텀시트 */}
      <ChatSettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        scheduleId={scheduleId}
        currentUserId={currentUserId}
      />
    </>
  );
}

/**
 * 메시지를 날짜별로 그룹화
 */
function groupMessagesByDate(messages: ScheduleChatMessage[]): Array<{
  date: Date;
  messages: ScheduleChatMessage[];
}> {
  const groups: Array<{ date: Date; messages: ScheduleChatMessage[] }> = [];

  messages.forEach((message) => {
    // createdAt이 null이거나 유효하지 않은 경우 처리
    if (!message.createdAt) {
      console.warn('[groupMessagesByDate] Invalid createdAt for message:', message.id);
      return; // 이 메시지는 건너뛰기
    }

    // DynamoDB에서는 timestamp가 number (Unix timestamp in milliseconds)
    const messageDate = typeof message.createdAt === 'number'
      ? new Date(message.createdAt)
      : (message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt));

    // 마지막 그룹과 같은 날짜인지 확인
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && isSameDay(lastGroup.date, messageDate)) {
      // 같은 날짜면 기존 그룹에 추가
      lastGroup.messages.push(message);
    } else {
      // 다른 날짜면 새 그룹 생성
      groups.push({
        date: messageDate,
        messages: [message],
      });
    }
  });

  return groups;
}
