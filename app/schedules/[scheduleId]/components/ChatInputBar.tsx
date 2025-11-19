'use client';

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';

interface ChatInputBarProps {
  onSend: (content: string) => Promise<void>;
  onSendMedia?: (file: File, caption?: string) => Promise<void>;
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
 * - 이미지/동영상 업로드
 * - 전송 중 상태 표시
 */
export function ChatInputBar({
  onSend,
  onSendMedia,
  disabled = false,
  placeholder = '메시지 입력...',
}: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 자동 높이 조절
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const maxHeight = 72; // 약 3줄
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSend = async () => {
    if (isSending || disabled) return;

    // 파일이 선택된 경우
    if (selectedFile) {
      if (!onSendMedia) return;

      setIsSending(true);
      try {
        await onSendMedia(selectedFile, value.trim() || undefined);
        setValue('');
        setSelectedFile(null);
        setPreviewUrl(null);
        textareaRef.current?.focus();
      } catch (error) {
        console.error('미디어 전송 실패:', error);
      } finally {
        setIsSending(false);
      }
      return;
    }

    // 텍스트 메시지 전송
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    setIsSending(true);
    try {
      await onSend(trimmedValue);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      textareaRef.current?.focus();
    } catch (error) {
      console.error('메시지 전송 실패:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증 (이미지 또는 동영상)
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('이미지 또는 동영상 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 검증 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('파일 크기는 50MB 이하여야 합니다.');
      return;
    }

    setSelectedFile(file);

    // 미리보기 URL 생성
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSend = (value.trim().length > 0 || selectedFile) && !isSending && !disabled;

  return (
    <div className="border-t border-border bg-background">
      {/* 파일 미리보기 */}
      {previewUrl && selectedFile && (
        <div className="p-2 border-b border-border">
          <div className="relative inline-block">
            {selectedFile.type.startsWith('image/') ? (
              <img
                src={previewUrl}
                alt="미리보기"
                className="h-20 rounded-lg object-cover"
              />
            ) : (
              <video
                src={previewUrl}
                className="h-20 rounded-lg object-cover"
              />
            )}
            <button
              onClick={handleRemoveFile}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/90"
              aria-label="파일 제거"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex items-end gap-1.5 p-2">
        {/* 파일 첨부 버튼 */}
        {onSendMedia && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending || !!selectedFile}
              className={clsx(
                'flex-shrink-0 p-2 rounded-lg transition-colors',
                disabled || isSending || selectedFile
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'text-foreground hover:bg-muted'
              )}
              aria-label="이미지/동영상 첨부"
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
          </>
        )}

        {/* 텍스트 입력 */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          className={clsx(
            'flex-1 px-3 py-2 text-sm',
            'bg-muted rounded-lg',
            'border-0 outline-none focus:ring-2 focus:ring-primary/20',
            'resize-none overflow-y-auto',
            'placeholder:text-muted-foreground',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={{ minHeight: '36px', maxHeight: '72px' }}
        />

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
    </div>
  );
}
