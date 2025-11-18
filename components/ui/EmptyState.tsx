import React from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface EmptyStateProps {
  /**
   * 아이콘 또는 일러스트레이션
   */
  icon?: React.ReactNode;
  /**
   * 제목
   */
  title: string;
  /**
   * 설명
   */
  description?: string;
  /**
   * 액션 버튼 레이블
   */
  actionLabel?: string;
  /**
   * 액션 버튼 클릭 핸들러
   */
  onAction?: () => void;
  /**
   * 보조 액션 버튼 레이블
   */
  secondaryActionLabel?: string;
  /**
   * 보조 액션 버튼 클릭 핸들러
   */
  onSecondaryAction?: () => void;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 컴팩트 모드 (작은 공간에서 사용)
   */
  compact?: boolean;
}

/**
 * 모꼬지 EmptyState 컴포넌트
 *
 * 데이터가 없을 때 표시하는 빈 상태 UI
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<CalendarIcon className="w-16 h-16" />}
 *   title="일정이 없습니다"
 *   description="새로운 일정을 만들어보세요!"
 *   actionLabel="일정 만들기"
 *   onAction={handleCreateEvent}
 * />
 *
 * <EmptyState
 *   title="검색 결과가 없습니다"
 *   description="다른 키워드로 검색해보세요"
 *   compact
 * />
 * ```
 */
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
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* 아이콘 */}
      {icon && (
        <div
          className={clsx(
            'text-muted-foreground mb-4',
            compact ? 'opacity-60' : 'opacity-40'
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* 제목 */}
      <h3
        className={clsx(
          'font-semibold text-foreground',
          compact ? 'text-base mb-1' : 'text-xl mb-2'
        )}
      >
        {title}
      </h3>

      {/* 설명 */}
      {description && (
        <p
          className={clsx(
            'text-muted-foreground max-w-md',
            compact ? 'text-sm mb-4' : 'text-base mb-6'
          )}
        >
          {description}
        </p>
      )}

      {/* 액션 버튼 */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {actionLabel && onAction && (
            <Button
              variant="primary"
              size={compact ? 'sm' : 'md'}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="ghost"
              size={compact ? 'sm' : 'md'}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 검색 결과 없음
 */
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
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      title="검색 결과가 없습니다"
      description={
        searchQuery
          ? `"${searchQuery}"에 대한 결과를 찾을 수 없습니다`
          : '다른 키워드로 검색해보세요'
      }
      actionLabel={onClear ? '검색 초기화' : undefined}
      onAction={onClear}
      className={className}
    />
  );
};

/**
 * 일정 없음
 */
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
      icon={
        <svg
          className="w-20 h-20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      }
      title="예정된 일정이 없습니다"
      description="새로운 일정을 만들어 크루원들과 함께 즐거운 시간을 보내세요!"
      actionLabel={onCreateEvent ? '일정 만들기' : undefined}
      onAction={onCreateEvent}
      className={className}
    />
  );
};

/**
 * 채팅 메시지 없음
 */
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
      icon={
        <svg
          className="w-20 h-20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      }
      title="아직 메시지가 없습니다"
      description={
        eventTitle
          ? `${eventTitle} 일정에 대해 첫 메시지를 남겨보세요!`
          : '첫 메시지를 남겨보세요!'
      }
      compact
      className={className}
    />
  );
};

/**
 * 에러 상태
 */
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
      icon={
        <svg
          className="w-20 h-20 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      }
      title={title}
      description={description}
      actionLabel={onRetry ? '다시 시도' : undefined}
      onAction={onRetry}
      className={className}
    />
  );
};
