'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

/**
 * MOKKOJI Button - Kurly-inspired Design System
 *
 * Font sizes: text-sm (14px) only
 * Colors: Primary purple (#5f0080), Gray scale
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'text-sm font-medium rounded-lg',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[#5f0080] focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'min-h-[44px]', // Touch target
  ].join(' '),
  {
    variants: {
      variant: {
        // Primary - Purple
        primary: [
          'bg-[#5f0080] text-white',
          'hover:bg-[#4a0066]',
        ].join(' '),

        // Secondary - White with border
        secondary: [
          'bg-white text-gray-700',
          'border border-gray-200',
          'hover:bg-gray-50',
        ].join(' '),

        // Ghost - Transparent
        ghost: [
          'bg-transparent text-gray-700',
          'hover:bg-gray-100',
        ].join(' '),

        // Danger - Red
        danger: [
          'bg-red-500 text-white',
          'hover:bg-red-600',
        ].join(' '),

        // Text - Purple text only
        text: [
          'bg-transparent text-[#5f0080]',
          'hover:text-[#4a0066]',
          'min-h-0 p-0',
        ].join(' '),
      },

      size: {
        sm: 'h-9 px-3',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
      },

      fullWidth: {
        true: 'w-full',
      },
    },

    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

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
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
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

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
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
