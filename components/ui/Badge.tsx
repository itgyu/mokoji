'use client';

import React from 'react';
import { clsx } from 'clsx';

/**
 * MOKKOJI Badge - Kurly-inspired Design System
 *
 * Font: text-xs (12px)
 * Colors: Purple primary, Gray neutral
 */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', dot = false, icon, children, ...props }, ref) => {
    const variantClasses = {
      primary: 'text-[#5f0080] bg-[#f3e8f7]',
      secondary: 'text-gray-700 bg-gray-100',
      success: 'text-green-700 bg-green-50',
      warning: 'text-amber-700 bg-amber-50',
      error: 'text-red-700 bg-red-50',
      neutral: 'text-gray-700 bg-gray-100',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1',
          'px-2 py-1 text-xs font-medium rounded-md',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        )}
        {icon && <span className="inline-flex" aria-hidden="true">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, ...props }) => {
  const config = {
    scheduled: { variant: 'primary' as const, label: '예정' },
    ongoing: { variant: 'success' as const, label: '진행중' },
    completed: { variant: 'neutral' as const, label: '종료' },
    cancelled: { variant: 'error' as const, label: '취소됨' },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} dot={status === 'ongoing'} {...props}>
      {children || label}
    </Badge>
  );
};

export interface DDayBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  daysRemaining: number;
}

export const DDayBadge: React.FC<DDayBadgeProps> = ({ daysRemaining, ...props }) => {
  if (daysRemaining < 0) {
    return <Badge variant="neutral" {...props}>종료</Badge>;
  }

  if (daysRemaining === 0) {
    return <Badge variant="success" dot {...props}>D-Day</Badge>;
  }

  const variant = daysRemaining <= 3 ? 'error' : daysRemaining <= 7 ? 'warning' : 'primary';

  return <Badge variant={variant} {...props}>D-{daysRemaining}</Badge>;
};

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

  return <Badge variant={variant} {...props}>{label}</Badge>;
};
