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
import { isSameDay } from 'date-fns';
import { Bell } from 'lucide-react';

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
 * 인라인 채팅 섹션 (Kurly-inspired 디자인)
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
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 초기 로드 시 맨 아래로 스크롤 (딱 한 번만)
  useEffect(() => {
    if (messages.length > 0 && !hasInitiallyScrolled && !isLoading) {
      setTimeout(() => {
        scrollToBottom(false);
        setHasInitiallyScrolled(true);
        setLastMessageCount(messages.length);
      }, 100);
    }
  }, [messages.length, isLoading, hasInitiallyScrolled]);

  // 새 메시지 추가 시 (내가 보낸 메시지거나 맨 아래에 있을 때만 자동 스크롤)
  useEffect(() => {
    if (!containerRef.current || !hasInitiallyScrolled) return;

    if (messages.length <= lastMessageCount) {
      setLastMessageCount(messages.length);
      return;
    }

    setLastMessageCount(messages.length);

    const lastMessage = messages[messages.length - 1];
    const isMyNewMessage = lastMessage?.senderId === currentUserId;

    const container = containerRef.current;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isMyNewMessage || isAtBottom) {
      scrollToBottom();
    } else {
      setShowNewMessageIndicator(true);
    }
  }, [messages.length, hasInitiallyScrolled, currentUserId]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
    setShowNewMessageIndicator(false);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (isAtBottom) {
      setShowNewMessageIndicator(false);
    }
  };

  const groupedMessages = groupMessagesByDate(messages);

  const handleQuickAction = async (action: string) => {
    await onSendMessage(action);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.SCHEDULES,
          Key: { scheduleId, messageId },
        })
      );
    } catch (error) {
      console.error('메시지 삭제 실패:', error);
      alert('메시지를 삭제하는 중에 문제가 생겼어요');
    }
  };

  return (
    <>
      <div className="flex flex-col bg-white">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-900">채팅</span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1"
            aria-label="채팅 알림 설정"
          >
            <Bell className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>

        {/* 메시지 리스트 */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 min-h-[300px] max-h-[50vh]"
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonChatMessage key={i} isMyMessage={i % 2 === 0} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyChatState
              scheduleTitle={scheduleTitle}
              onQuickAction={handleQuickAction}
            />
          ) : (
            <>
              {groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <DateDivider date={group.date} />
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
            className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#5f0080] text-white rounded-full shadow-lg text-sm font-medium"
          >
            새 메시지
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
    if (!message.createdAt) {
      return;
    }

    let messageDate: Date;
    if (typeof message.createdAt === 'number') {
      messageDate = new Date(message.createdAt);
    } else if (message.createdAt instanceof Date) {
      messageDate = message.createdAt;
    } else if (typeof (message.createdAt as any).toDate === 'function') {
      messageDate = (message.createdAt as any).toDate();
    } else {
      messageDate = new Date(message.createdAt as any);
    }

    if (isNaN(messageDate.getTime())) {
      return;
    }

    const lastGroup = groups[groups.length - 1];

    if (lastGroup && isSameDay(lastGroup.date, messageDate)) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        date: messageDate,
        messages: [message],
      });
    }
  });

  return groups;
}
