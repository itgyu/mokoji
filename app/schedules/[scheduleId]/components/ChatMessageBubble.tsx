'use client';

import { Avatar } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { ScheduleChatMessage } from '@/types/firestore';
import { clsx } from 'clsx';

interface ChatMessageBubbleProps {
  message: ScheduleChatMessage;
  isMyMessage: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  onRetry?: (message: ScheduleChatMessage) => void;
}

/**
 * 채팅 메시지 버블 컴포넌트
 *
 * 3가지 타입의 메시지를 표시합니다:
 * 1. 시스템 메시지 - 가운데 정렬, 회색
 * 2. 내 메시지 - 우측 정렬, primary 배경
 * 3. 타인 메시지 - 좌측 정렬, surface 배경
 */
export function ChatMessageBubble({
  message,
  isMyMessage,
  showAvatar = true,
  showSenderName = true,
  onRetry,
}: ChatMessageBubbleProps) {
  // 시스템 메시지
  if (message.type === 'system') {
    return <SystemMessage message={message} />;
  }

  // 내 메시지
  if (isMyMessage) {
    return <MyMessage message={message} onRetry={onRetry} />;
  }

  // 타인 메시지
  return (
    <OtherMessage
      message={message}
      showAvatar={showAvatar}
      showSenderName={showSenderName}
    />
  );
}

/**
 * 시스템 메시지
 */
function SystemMessage({ message }: { message: ScheduleChatMessage }) {
  // 시스템 메시지 타입별 이모지와 스타일
  const getSystemStyle = () => {
    switch (message.systemType) {
      case 'rsvp_change':
        return {
          emoji: '✅',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
        };
      case 'schedule_update':
        return {
          emoji: '📝',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-700 dark:text-blue-300',
        };
      case 'schedule_cancel':
        return {
          emoji: '⚠️',
          bgColor: 'bg-destructive/10',
          textColor: 'text-destructive',
        };
      case 'schedule_start':
        return {
          emoji: '🎉',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          textColor: 'text-purple-700 dark:text-purple-300',
        };
      case 'schedule_complete':
        return {
          emoji: '✅',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
        };
      default:
        return {
          emoji: 'ℹ️',
          bgColor: 'bg-muted',
          textColor: 'text-muted-foreground',
        };
    }
  };

  const style = getSystemStyle();

  return (
    <div className="flex justify-center py-1">
      <div
        className={clsx(
          'flex items-center gap-1 px-2.5 py-1 rounded-full',
          style.bgColor
        )}
      >
        <span className="text-xs" aria-hidden="true">
          {style.emoji}
        </span>
        <span className={clsx('text-[11px] font-medium', style.textColor)}>
          {message.content}
        </span>
      </div>
    </div>
  );
}

/**
 * 내 메시지
 */
function MyMessage({
  message,
  onRetry,
}: {
  message: ScheduleChatMessage;
  onRetry?: (message: ScheduleChatMessage) => void;
}) {
  const formattedTime = format(message.createdAt.toDate(), 'HH:mm');
  const status = (message as any)._status; // 'sending' | 'sent' | 'failed'

  return (
    <div className="flex justify-end items-end gap-1.5">
      <div className="max-w-[75%] space-y-0.5">
        {/* 메시지 버블 */}
        <div
          className={clsx(
            'rounded-2xl rounded-tr-sm px-3 py-2',
            status === 'failed'
              ? 'bg-destructive/10 text-foreground border border-destructive'
              : 'bg-primary text-primary-foreground'
          )}
        >
          <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* 시간 및 상태 표시 */}
        <div className="flex items-center justify-end gap-1 px-1">
          {/* 상태 아이콘 */}
          {status === 'sending' && (
            <span className="text-[11px] text-muted-foreground">전송 중...</span>
          )}
          {status === 'failed' && (
            <span className="text-[11px] text-destructive font-medium">전송 실패</span>
          )}
          {status === 'sent' && message.readBy && message.readBy.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              읽음 {message.readBy.length}
            </span>
          )}
          {!status && message.readBy && message.readBy.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              읽음 {message.readBy.length}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{formattedTime}</span>
        </div>
      </div>

      {/* 재전송 버튼 (실패 시만 표시) */}
      {status === 'failed' && onRetry && (
        <button
          onClick={() => onRetry(message)}
          className="flex-shrink-0 p-1.5 hover:bg-muted rounded-lg transition-colors mb-1"
          aria-label="메시지 재전송"
          title="재전송"
        >
          <svg
            className="w-4 h-4 text-muted-foreground hover:text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * 타인 메시지
 */
function OtherMessage({
  message,
  showAvatar,
  showSenderName,
}: {
  message: ScheduleChatMessage;
  showAvatar: boolean;
  showSenderName: boolean;
}) {
  const formattedTime = format(message.createdAt.toDate(), 'HH:mm');

  return (
    <div className="flex justify-start gap-1.5">
      {/* 아바타 */}
      {showAvatar ? (
        <Avatar
          src={message.senderAvatar}
          alt={message.senderName || '익명'}
          fallback={message.senderName || '?'}
          size="sm"
          className="mt-0.5"
        />
      ) : (
        <div className="w-8" /> // 아바타 공간 유지
      )}

      {/* 메시지 내용 */}
      <div className="max-w-[75%] space-y-0.5">
        {/* 발신자 이름 */}
        {showSenderName && message.senderName && (
          <span className="text-[11px] text-muted-foreground px-1.5">
            {message.senderName}
          </span>
        )}

        {/* 메시지 버블 */}
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
          <p className="text-[13px] leading-snug text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* 시간 */}
        <span className="text-[11px] text-muted-foreground px-1.5">{formattedTime}</span>
      </div>
    </div>
  );
}

/**
 * 날짜 구분선
 */
export function DateDivider({ date }: { date: Date }) {
  const formattedDate = format(date, 'M월 d일 (E)', { locale: ko });

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground font-medium">{formattedDate}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
