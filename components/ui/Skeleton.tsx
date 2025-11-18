import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const skeletonVariants = cva(
  [
    'animate-pulse bg-muted',
    'relative overflow-hidden',
  ],
  {
    variants: {
      variant: {
        default: 'rounded-md',
        text: 'rounded h-4',
        circle: 'rounded-full',
        button: 'rounded-xl h-11',
        card: 'rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /**
   * 너비
   */
  width?: string | number;
  /**
   * 높이
   */
  height?: string | number;
  /**
   * Shimmer 애니메이션 (더 세련된 효과)
   */
  shimmer?: boolean;
}

/**
 * 모꼬지 Skeleton 컴포넌트
 *
 * 로딩 상태를 표시하는 플레이스홀더
 *
 * @example
 * ```tsx
 * <Skeleton width={100} height={20} />
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="text" className="w-full" />
 * <Skeleton variant="card" className="w-full h-32" shimmer />
 * ```
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant,
      width,
      height,
      shimmer = false,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          skeletonVariants({ variant }),
          shimmer && 'skeleton-shimmer',
          className
        )}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        aria-busy="true"
        aria-live="polite"
        {...props}
      >
        {shimmer && (
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </div>
    );
  }
);

Skeleton.displayName = 'Skeleton';

/**
 * 텍스트 라인 스켈레톤
 */
export interface SkeletonTextProps {
  /**
   * 라인 수
   */
  lines?: number;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          className={clsx(
            'w-full',
            // 마지막 라인은 짧게
            index === lines - 1 && 'w-3/4'
          )}
        />
      ))}
    </div>
  );
};

/**
 * 아바타 스켈레톤
 */
export interface SkeletonAvatarProps {
  /**
   * 크기
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  };

  return (
    <Skeleton
      variant="circle"
      className={clsx(sizeClasses[size], className)}
    />
  );
};

/**
 * 카드 스켈레톤
 */
export interface SkeletonCardProps {
  /**
   * 이미지 포함 여부
   */
  withImage?: boolean;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  withImage = false,
  className,
}) => {
  return (
    <div className={clsx('space-y-4 p-6 border border-border rounded-2xl', className)}>
      {withImage && (
        <Skeleton variant="default" className="w-full h-48 rounded-xl" shimmer />
      )}
      <div className="space-y-3">
        <Skeleton variant="text" className="w-2/3 h-6" />
        <SkeletonText lines={2} />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonAvatar size="sm" />
        <Skeleton variant="text" className="w-24" />
      </div>
    </div>
  );
};

/**
 * 리스트 아이템 스켈레톤
 */
export interface SkeletonListItemProps {
  /**
   * 아바타 포함 여부
   */
  withAvatar?: boolean;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
  withAvatar = false,
  className,
}) => {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      {withAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/2" />
        <Skeleton variant="text" className="w-full" />
      </div>
    </div>
  );
};

/**
 * 채팅 메시지 스켈레톤
 */
export interface SkeletonChatMessageProps {
  /**
   * 내 메시지 여부
   */
  isMyMessage?: boolean;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const SkeletonChatMessage: React.FC<SkeletonChatMessageProps> = ({
  isMyMessage = false,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex items-start gap-2',
        isMyMessage && 'flex-row-reverse',
        className
      )}
    >
      {!isMyMessage && <SkeletonAvatar size="sm" />}
      <div className={clsx('space-y-1', isMyMessage ? 'items-end' : 'items-start')}>
        {!isMyMessage && <Skeleton variant="text" className="w-16 h-3" />}
        <Skeleton
          variant="default"
          className={clsx(
            'rounded-2xl',
            isMyMessage ? 'w-40 h-12' : 'w-48 h-16'
          )}
        />
      </div>
    </div>
  );
};
