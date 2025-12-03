'use client';

import React, { useEffect, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const inputVariants = cva(
  [
    'w-full',
    'rounded-xl',
    'border border-input',
    'bg-background',
    'px-4 py-3',
    'text-base',
    'transition-all duration-200',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      error: {
        true: 'border-red-500 focus-visible:ring-red-500',
        false: '',
      },
    },
    defaultVariants: {
      error: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * 에러 상태
   */
  error?: boolean;
  /**
   * 레이블
   */
  label?: string;
  /**
   * 헬퍼 텍스트 또는 에러 메시지
   */
  helperText?: string;
  /**
   * 좌측 아이콘/요소
   */
  leftElement?: React.ReactNode;
  /**
   * 우측 아이콘/요소
   */
  rightElement?: React.ReactNode;
}

/**
 * 모꼬지 Input 컴포넌트
 *
 * 텍스트 입력 필드
 *
 * @example
 * ```tsx
 * <Input
 *   label="이름"
 *   placeholder="이름을 입력하세요"
 *   helperText="실명을 입력해주세요"
 * />
 *
 * <Input
 *   error
 *   helperText="이메일 형식이 올바르지 않습니다"
 * />
 * ```
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error = false,
      label,
      helperText,
      leftElement,
      rightElement,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${React.useId()}`;
    const helperTextId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftElement && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={clsx(
              inputVariants({ error }),
              leftElement && 'pl-10',
              rightElement && 'pr-10',
              className
            )}
            aria-invalid={error}
            aria-describedby={helperTextId}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightElement}
            </div>
          )}
        </div>

        {helperText && (
          <p
            id={helperTextId}
            className={clsx(
              'text-sm',
              error ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea Props
 */
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /**
   * 에러 상태
   */
  error?: boolean;
  /**
   * 레이블
   */
  label?: string;
  /**
   * 헬퍼 텍스트 또는 에러 메시지
   */
  helperText?: string;
  /**
   * 자동 높이 조절 (내용에 맞춰 높이 증가)
   */
  autoResize?: boolean;
  /**
   * 최대 높이 (autoResize 사용 시)
   */
  maxHeight?: number;
}

/**
 * 모꼬지 Textarea 컴포넌트
 *
 * 멀티라인 텍스트 입력
 * 채팅 입력창 등에 사용
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="메시지"
 *   placeholder="메시지를 입력하세요"
 *   autoResize
 *   maxHeight={200}
 * />
 * ```
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      error = false,
      label,
      helperText,
      autoResize = false,
      maxHeight = 200,
      id,
      onChange,
      value,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${React.useId()}`;
    const helperTextId = helperText ? `${textareaId}-helper` : undefined;
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    // autoResize 기능 구현
    useEffect(() => {
      if (!autoResize) return;

      const textarea = internalRef.current;
      if (!textarea) return;

      const adjustHeight = () => {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
      };

      adjustHeight();
    }, [value, autoResize, maxHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
      }

      onChange?.(e);
    };

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}

        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          id={textareaId}
          className={clsx(
            inputVariants({ error }),
            'min-h-[80px] resize-none',
            autoResize && 'overflow-hidden',
            className
          )}
          aria-invalid={error}
          aria-describedby={helperTextId}
          value={value}
          onChange={handleChange}
          {...props}
        />

        {helperText && (
          <p
            id={helperTextId}
            className={clsx(
              'text-sm',
              error ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
