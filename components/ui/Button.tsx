'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

/**
 * 모꼬지 Button 스타일 정의
 * 프리미엄 디자인 시스템 적용
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-xl',
    'transition-all duration-300',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-primary focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    'min-h-[44px] min-w-[44px]', // Touch target optimization
  ].join(' '),
  {
  variants: {
    variant: {
      primary: [
        'text-primary-foreground',
        'hover:opacity-90',
        'active:opacity-80',
      ].join(' '),

      secondary: [
        'text-secondary-foreground',
        'hover:opacity-90',
        'active:brightness-90',
      ].join(' '),

      outline: [
        'border-2 bg-transparent',
        'text-foreground',
        'hover:bg-muted',
        'active:bg-muted-hover',
      ].join(' '),

      ghost: [
        'bg-transparent text-foreground',
        'hover:bg-muted',
        'active:bg-muted-hover',
      ].join(' '),

      danger: [
        'text-destructive-foreground',
        'hover:opacity-90',
        'active:opacity-80',
      ].join(' '),

      // Premium variants
      'premium-black': [
        'bg-mokkoji-black text-white',
        'hover:bg-mokkoji-black-hover',
        'tracking-wider uppercase text-xs md:text-sm',
      ].join(' '),

      'premium-primary': [
        'bg-mokkoji-primary text-white',
        'hover:bg-mokkoji-primary-hover',
        'tracking-wider uppercase text-xs md:text-sm',
      ].join(' '),

      'premium-accent': [
        'bg-mokkoji-accent text-white',
        'hover:bg-mokkoji-accent-hover',
        'tracking-wider uppercase text-xs md:text-sm',
      ].join(' '),

      'premium-outline': [
        'border-2 border-mokkoji-primary bg-transparent',
        'text-mokkoji-primary',
        'hover:bg-mokkoji-primary-light',
        'tracking-wider uppercase text-xs md:text-sm',
      ].join(' '),
    },

    size: {
      xs: 'h-8 px-3 text-xs',
      sm: 'h-9 px-4 text-sm',
      md: 'h-11 px-6 text-base',
      lg: 'h-13 px-8 text-lg',
      xl: 'h-16 px-10 text-xl',
    },

    fullWidth: {
      true: 'w-full',
    },
  },

  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },

  // Compound variants for special color combinations
  compoundVariants: [
    {
      variant: 'primary',
      className: 'bg-primary shadow-[var(--shadow-primary)]',
    },
    {
      variant: 'secondary',
      className: 'bg-secondary',
    },
    {
      variant: 'outline',
      className: 'border-border-strong',
    },
    {
      variant: 'danger',
      className: 'bg-destructive shadow-[var(--shadow-error)]',
    },
  ],
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * 로딩 상태 표시
   */
  isLoading?: boolean;
  /**
   * 왼쪽 아이콘
   */
  leftIcon?: React.ReactNode;
  /**
   * 오른쪽 아이콘
   */
  rightIcon?: React.ReactNode;
  /**
   * 아이콘만 표시하는 버튼 (텍스트 없음)
   */
  iconOnly?: boolean;
}

/**
 * 모꼬지 Button 컴포넌트
 *
 * 당근마켓 + 토스 스타일의 부드러운 인터랙션
 * 완벽한 접근성과 모바일 터치 최적화
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md">확인</Button>
 * <Button variant="secondary" isLoading>저장 중...</Button>
 * <Button variant="ghost" leftIcon={<Icon />}>취소</Button>
 * <Button variant="danger">삭제</Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      iconOnly,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size={size === 'xs' ? 'sm' : size === 'lg' || size === 'xl' ? 'lg' : 'md'} />
            <span>처리 중...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * 로딩 스피너 컴포넌트
 */
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <svg
      className={clsx('animate-spin', sizeClasses[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
