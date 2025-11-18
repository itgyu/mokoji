'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

/**
 * 모꼬지 Card 스타일 정의
 * 당근마켓 스타일 - 둥근 모서리
 */
const cardVariants = cva(
  'transition-all',
  {
    variants: {
      variant: {
        default: [
          'bg-card border border-border',
          'shadow-sm hover:shadow-md',
        ].join(' '),

        elevated: [
          'bg-card',
          'shadow-md hover:shadow-lg',
        ].join(' '),

        flat: [
          'bg-card border border-border',
        ].join(' '),

        ghost: [
          'bg-transparent',
        ].join(' '),
      },

      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },

      interactive: {
        true: [
          'cursor-pointer',
          'hover:border-border-strong',
          'active:scale-[0.98]',
        ].join(' '),
      },

      radius: {
        sm: 'rounded-lg',      // 8px
        md: 'rounded-xl',      // 12px
        lg: 'rounded-2xl',     // 16px
        xl: 'rounded-3xl',     // 20px
      },
    },

    defaultVariants: {
      variant: 'default',
      padding: 'md',
      radius: 'lg',
    },

    compoundVariants: [
      {
        interactive: true,
        variant: 'default',
        className: 'hover:shadow-lg',
      },
    ],
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * 모꼬지 Card 컴포넌트
 *
 * 당근마켓 스타일의 부드러운 카드
 * 일정 정보, 채팅 메시지 등을 담는 컨테이너
 *
 * @example
 * ```tsx
 * <Card variant="default">
 *   <CardHeader>
 *     <CardTitle>일정 제목</CardTitle>
 *     <CardDescription>일정 설명</CardDescription>
 *   </CardHeader>
 *   <CardBody>
 *     <p>일정 내용</p>
 *   </CardBody>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      interactive,
      radius,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          cardVariants({ variant, padding, interactive, radius }),
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header 컴포넌트
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('space-y-1.5', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

/**
 * Card Title 컴포넌트
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={clsx('text-heading-3', className)}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

/**
 * Card Description 컴포넌트
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={clsx('text-body-2 text-muted-foreground', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

/**
 * Card Body 컴포넌트 (메인 콘텐츠)
 */
export const CardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('', className)}
    {...props}
  />
));

CardBody.displayName = 'CardBody';

// Legacy alias for CardBody
export const CardContent = CardBody;

/**
 * Card Footer 컴포넌트
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('flex items-center gap-2 pt-4', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';
