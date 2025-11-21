'use client';

import { useState, useRef } from 'react';
import { Avatar } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import type { ScheduleChatMessage } from '@/types/firestore';
import { clsx } from 'clsx';

interface ChatMessageBubbleProps {
  message: ScheduleChatMessage;
  isMyMessage: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  onRetry?: (message: ScheduleChatMessage) => void;
  onDelete?: (messageId: string) => void;
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
  onDelete,
}: ChatMessageBubbleProps) {
  // 시스템 메시지
  if (message.type === 'system') {
    return <SystemMessage message={message} />;
  }

  // 내 메시지
  if (isMyMessage) {
    return <MyMessage message={message} onRetry={onRetry} onDelete={onDelete} />;
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
  onDelete,
}: {
  message: ScheduleChatMessage;
  onRetry?: (message: ScheduleChatMessage) => void;
  onDelete?: (messageId: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const formattedTime = format(message.createdAt.toDate(), 'HH:mm');
  const status = (message as any)._status; // 'sending' | 'sent' | 'failed'

  // 롱프레스 시작
  const handleTouchStart = () => {
    if (!onDelete) return;
    longPressTimerRef.current = setTimeout(() => {
      setShowActionMenu(true);
      // 햅틱 피드백 (iOS/Android)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms 길게 누르기
  };

  // 롱프레스 취소
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 롱프레스 취소 (손가락 이동 시)
  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      <div className="flex justify-end items-end gap-1.5">
        <div className="max-w-[75%] space-y-0.5">
          {/* 메시지 버블 */}
          <div
            className={clsx(
              'rounded-2xl rounded-tr-sm px-3 py-2 relative group',
              status === 'failed'
                ? 'bg-destructive/10 text-foreground border border-destructive'
                : 'bg-primary text-primary-foreground'
            )}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => {
              // 데스크탑에서 우클릭 방지 및 액션 메뉴 표시
              if (onDelete) {
                e.preventDefault();
                setShowActionMenu(true);
              }
            }}
          >
          {/* 첨부 파일 (이미지/동영상) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-1 mb-2">
              {message.attachments.map((attachment, index) => (
                <div key={index} className="rounded-lg overflow-hidden">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.url}
                      alt={attachment.fileName || '이미지'}
                      className="max-w-full rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                  ) : attachment.mimeType?.startsWith('video/') ? (
                    <video
                      src={attachment.url}
                      controls
                      className="max-w-full rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                  ) : (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-background/10 rounded-lg hover:bg-background/20"
                    >
                      <span>📎</span>
                      <span className="text-[13px] truncate">{attachment.fileName}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 텍스트 내용 */}
          {message.content && (
            <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{message.content}</p>
          )}
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

    {/* 액션 메뉴 (카카오톡 스타일) */}
    {showActionMenu && (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4"
        onClick={() => setShowActionMenu(false)}
      >
        <div
          className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 메시지 미리보기 */}
          <div className="p-4 border-b border-border bg-muted/30">
            <p className="text-sm text-foreground line-clamp-2">
              {message.content || '이미지 메시지'}
            </p>
          </div>

          {/* 액션 버튼들 */}
          <div className="divide-y divide-border">
            <button
              onClick={() => {
                setShowActionMenu(false);
                setShowDeleteConfirm(true);
              }}
              className="w-full px-6 py-4 flex items-center gap-3 hover:bg-muted transition-colors text-left"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
              <span className="text-base font-medium text-red-500">메시지 삭제</span>
            </button>
          </div>

          {/* 취소 버튼 */}
          <div className="p-3 bg-muted/30">
            <button
              onClick={() => setShowActionMenu(false)}
              className="w-full py-3 bg-white dark:bg-card hover:bg-muted rounded-xl font-semibold text-foreground transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 삭제 확인 다이얼로그 */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 className="text-lg font-bold mb-2 text-foreground">메시지를 삭제할까요?</h3>
          <p className="text-sm text-muted-foreground mb-6">삭제한 메시지는 복구할 수 없어요</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 bg-muted hover:bg-muted-dark rounded-xl font-semibold text-foreground transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                onDelete?.(message.id);
                setShowDeleteConfirm(false);
              }}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    )}
  </>
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
          {/* 첨부 파일 (이미지/동영상) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-1 mb-2">
              {message.attachments.map((attachment, index) => (
                <div key={index} className="rounded-lg overflow-hidden">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.url}
                      alt={attachment.fileName || '이미지'}
                      className="max-w-full rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                  ) : attachment.mimeType?.startsWith('video/') ? (
                    <video
                      src={attachment.url}
                      controls
                      className="max-w-full rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                  ) : (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted-dark"
                    >
                      <span>📎</span>
                      <span className="text-[13px] truncate">{attachment.fileName}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 텍스트 내용 */}
          {message.content && (
            <p className="text-[13px] leading-snug text-foreground whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
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
