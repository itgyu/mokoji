import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const badgeVariants = cva(
  // Base styles
  [
    'inline-flex items-center justify-center',
    'font-semibold',
    'rounded-full',
    'transition-colors duration-200',
    'whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary/10',
          'text-primary',
          'border border-primary/20',
        ],
        secondary: [
          'bg-secondary/10',
          'text-secondary',
          'border border-secondary/20',
        ],
        accent: [
          'bg-accent/10',
          'text-accent',
          'border border-accent/20',
        ],
        success: [
          'bg-green-50',
          'text-green-700',
          'border border-green-200',
        ],
        warning: [
          'bg-amber-50',
          'text-amber-700',
          'border border-amber-200',
        ],
        error: [
          'bg-red-50',
          'text-red-700',
          'border border-red-200',
        ],
        info: [
          'bg-blue-50',
          'text-blue-700',
          'border border-blue-200',
        ],
        neutral: [
          'bg-muted',
          'text-muted-foreground',
          'border border-border',
        ],
        // 일정 상태용 특별 variant
        scheduled: [
          'bg-primary/10',
          'text-primary',
          'border border-primary/20',
        ],
        ongoing: [
          'bg-green-50',
          'text-green-700',
          'border border-green-200',
        ],
        completed: [
          'bg-muted',
          'text-muted-foreground',
          'border border-border',
        ],
        cancelled: [
          'bg-red-50',
          'text-red-700',
          'border border-red-200',
        ],
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * 배지에 점(dot) 표시
   */
  dot?: boolean;
  /**
   * 아이콘 요소
   */
  icon?: React.ReactNode;
}

/**
 * 모꼬지 Badge 컴포넌트
 *
 * 상태, 카테고리, 알림 등을 표시하는 배지
 *
 * @example
 * ```tsx
 * <Badge variant="primary">D-3</Badge>
 * <Badge variant="success">참석</Badge>
 * <Badge variant="ongoing" dot>진행중</Badge>
 * <Badge variant="neutral" icon={<CalendarIcon />}>11월 23일</Badge>
 * ```
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      dot = false,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={clsx(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
        )}
        {icon && (
          <span className="mr-1.5 inline-flex" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * 상태별 배지를 쉽게 사용하기 위한 헬퍼 컴포넌트
 */
export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, ...props }) => {
  const statusLabels = {
    scheduled: '예정',
    ongoing: '진행중',
    completed: '종료',
    cancelled: '취소됨',
  };

  return (
    <Badge variant={status} dot={status === 'ongoing'} {...props}>
      {children || statusLabels[status]}
    </Badge>
  );
};

/**
 * D-Day 배지
 */
export interface DDayBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  daysRemaining: number;
}

export const DDayBadge: React.FC<DDayBadgeProps> = ({ daysRemaining, ...props }) => {
  if (daysRemaining < 0) {
    return (
      <Badge variant="completed" {...props}>
        종료
      </Badge>
    );
  }

  if (daysRemaining === 0) {
    return (
      <Badge variant="ongoing" dot {...props}>
        D-Day
      </Badge>
    );
  }

  const variant = daysRemaining <= 3 ? 'error' : daysRemaining <= 7 ? 'warning' : 'primary';

  return (
    <Badge variant={variant} {...props}>
      D-{daysRemaining}
    </Badge>
  );
};

/**
 * RSVP 상태 배지
 */
export interface RSVPBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  status: 'attending' | 'not_attending' | 'maybe';
}

export const RSVPBadge: React.FC<RSVPBadgeProps> = ({ status, ...props }) => {
  const config = {
    attending: { variant: 'success' as const, label: '참석' },
    not_attending: { variant: 'error' as const, label: '불참' },
    maybe: { variant: 'neutral' as const, label: '미정' },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} {...props}>
      {label}
    </Badge>
  );
};
