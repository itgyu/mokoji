'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Textarea, Button } from '@/components/ui';

interface ChatInputBarProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 채팅 입력 바 컴포넌트
 *
 * 기능:
 * - Enter: 전송
 * - Shift+Enter: 줄바꿈
 * - 자동 높이 조절 (최대 3줄)
 * - 전송 중 상태 표시
 */
export function ChatInputBar({
  onSend,
  disabled = false,
  placeholder = '메시지 입력...',
}: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmedValue = value.trim();

    if (!trimmedValue || isSending || disabled) return;

    setIsSending(true);

    try {
      await onSend(trimmedValue);

      // 전송 성공 시 입력창 초기화
      setValue('');

      // 포커스 유지
      textareaRef.current?.focus();
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      // 에러 시 입력 내용 유지
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 키로 전송 (Shift+Enter는 줄바꿈)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isSending && !disabled;

  return (
    <div className="flex items-end gap-2 p-2.5 border-t border-border bg-background">
      {/* 메시지 입력 필드 */}
      <div className="flex-1">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          autoResize
          maxHeight={100}
          className="min-h-[36px] resize-none text-sm"
          rows={1}
        />
      </div>

      {/* 전송 버튼 */}
      <Button
        variant="primary"
        size="sm"
        onClick={handleSend}
        disabled={!canSend}
        isLoading={isSending}
        iconOnly
        className="flex-shrink-0"
        aria-label="메시지 전송"
      >
        {!isSending && (
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
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        )}
      </Button>
    </div>
  );
}
