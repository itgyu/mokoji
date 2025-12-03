'use client';

import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';

/**
 * MOKKOJI Input - Kurly-inspired Design System
 *
 * Font: text-sm (14px)
 * Border: gray-200, focus: purple
 */

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: boolean;
  label?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, label, helperText, leftElement, rightElement, id, ...props }, ref) => {
    const inputId = id || `input-${React.useId()}`;
    const helperTextId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-900">
            {label}
          </label>
        )}

        <div className="relative">
          {leftElement && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full px-4 py-3 text-sm bg-white',
              'border border-gray-200 rounded-lg',
              'placeholder:text-gray-400',
              'focus:outline-none focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080]',
              'transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              leftElement && 'pl-11',
              rightElement && 'pr-11',
              className
            )}
            aria-invalid={error}
            aria-describedby={helperTextId}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {rightElement}
            </div>
          )}
        </div>

        {helperText && (
          <p
            id={helperTextId}
            className={clsx('text-xs', error ? 'text-red-500' : 'text-gray-500')}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  error?: boolean;
  label?: string;
  helperText?: string;
  autoResize?: boolean;
  maxHeight?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, label, helperText, autoResize = false, maxHeight = 200, id, onChange, value, ...props }, ref) => {
    const textareaId = id || `textarea-${React.useId()}`;
    const helperTextId = helperText ? `${textareaId}-helper` : undefined;
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

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
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-900">
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
            'w-full px-4 py-3 text-sm bg-white',
            'border border-gray-200 rounded-lg',
            'placeholder:text-gray-400',
            'focus:outline-none focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080]',
            'transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-h-[80px] resize-none',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
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
            className={clsx('text-xs', error ? 'text-red-500' : 'text-gray-500')}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
