'use client';

import React from 'react';
import { clsx } from 'clsx';

/**
 * MOKKOJI EmptyState - Kurly-inspired Design System
 *
 * Clean, text-focused empty states
 * No emojis - use Lucide icons sparingly
 */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  compact = false,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className
      )}
    >
      {icon && (
        <div className="text-gray-300 mb-3" aria-hidden="true">
          {icon}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-1">{title}</p>

      {description && (
        <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="text-sm font-medium text-[#5f0080] hover:text-[#4a0066]"
            >
              {actionLabel}
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export interface EmptySearchResultProps {
  searchQuery?: string;
  onClear?: () => void;
  className?: string;
}

export const EmptySearchResult: React.FC<EmptySearchResultProps> = ({
  searchQuery,
  onClear,
  className,
}) => {
  return (
    <EmptyState
      title="검색 결과가 없습니다"
      description={searchQuery ? `"${searchQuery}"에 대한 결과를 찾을 수 없습니다` : undefined}
      actionLabel={onClear ? '검색 초기화' : undefined}
      onAction={onClear}
      className={className}
    />
  );
};

export interface EmptyEventsProps {
  onCreateEvent?: () => void;
  className?: string;
}

export const EmptyEvents: React.FC<EmptyEventsProps> = ({
  onCreateEvent,
  className,
}) => {
  return (
    <EmptyState
      title="예정된 일정이 없습니다"
      description="새로운 일정을 만들어보세요"
      actionLabel={onCreateEvent ? '일정 만들기' : undefined}
      onAction={onCreateEvent}
      className={className}
    />
  );
};

export interface EmptyChatProps {
  eventTitle?: string;
  className?: string;
}

export const EmptyChat: React.FC<EmptyChatProps> = ({
  eventTitle,
  className,
}) => {
  return (
    <EmptyState
      title="아직 메시지가 없습니다"
      description={eventTitle ? `${eventTitle} 일정에 대해 첫 메시지를 남겨보세요` : undefined}
      compact
      className={className}
    />
  );
};

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = '문제가 발생했습니다',
  description = '잠시 후 다시 시도해주세요',
  onRetry,
  className,
}) => {
  return (
    <EmptyState
      title={title}
      description={description}
      actionLabel={onRetry ? '다시 시도' : undefined}
      onAction={onRetry}
      className={className}
    />
  );
};
