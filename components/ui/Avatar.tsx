import React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const avatarVariants = cva(
  [
    'relative flex shrink-0 overflow-hidden rounded-full',
    'select-none',
  ],
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-sm',
        md: 'h-10 w-10 text-base',
        lg: 'h-12 w-12 text-lg',
        xl: 'h-16 w-16 text-xl',
        '2xl': 'h-20 w-20 text-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const avatarImageVariants = cva('aspect-square h-full w-full object-cover');

const avatarFallbackVariants = cva([
  'flex h-full w-full items-center justify-center',
  'bg-muted text-muted-foreground',
  'font-semibold uppercase',
]);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  /**
   * 이미지 URL
   */
  src?: string;
  /**
   * 이미지 alt 텍스트
   */
  alt?: string;
  /**
   * 이미지 로드 실패 시 표시할 fallback (보통 이름 이니셜)
   */
  fallback?: string;
  /**
   * 온라인 상태 표시
   */
  status?: 'online' | 'offline' | 'away';
}

/**
 * 모꼬지 Avatar 컴포넌트
 *
 * 사용자 프로필 이미지 표시
 * 이미지 없을 때 이니셜 fallback 제공
 *
 * @example
 * ```tsx
 * <Avatar src="/user.jpg" alt="홍길동" fallback="홍" />
 * <Avatar fallback="김" size="lg" status="online" />
 * <Avatar src="/profile.jpg" size="xl" />
 * ```
 */
export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(
  (
    {
      className,
      size,
      src,
      alt,
      fallback,
      status,
      ...props
    },
    ref
  ) => {
    // 유효한 이미지 URL인지 확인 (이모지 필터링)
    const getValidSrc = (url: string | undefined): string | undefined => {
      if (!url || url.trim() === '') return undefined;

      // 이모지나 특수문자만 있는지 확인 (한글, 영문, 숫자가 없으면 유효하지 않음)
      const hasValidChars = /[\p{L}\p{N}]/u.test(url);

      // URL 형식인지 확인 (http, https, data:, / 로 시작)
      const isUrlFormat = url.startsWith('http') || url.startsWith('/') || url.startsWith('data:');

      // URL 형식이 아니거나, 유효한 문자가 없으면 undefined 반환
      if (!isUrlFormat || !hasValidChars) {
        return undefined;
      }

      return url;
    };

    const validSrc = getValidSrc(src);

    return (
      <div className="relative inline-block">
        <AvatarPrimitive.Root
          ref={ref}
          className={clsx(avatarVariants({ size }), className)}
          {...props}
        >
          {validSrc && (
            <AvatarPrimitive.Image
              src={validSrc}
              alt={alt || '사용자 프로필'}
              className={avatarImageVariants()}
            />
          )}
          <AvatarPrimitive.Fallback
            className={avatarFallbackVariants()}
            delayMs={validSrc ? 600 : 0}
          >
            {fallback || getInitials(alt || '')}
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>

        {status && (
          <span
            className={clsx(
              'absolute bottom-0 right-0',
              'block rounded-full ring-2 ring-background',
              size === 'xs' && 'h-1.5 w-1.5',
              size === 'sm' && 'h-2 w-2',
              size === 'md' && 'h-2.5 w-2.5',
              size === 'lg' && 'h-3 w-3',
              size === 'xl' && 'h-3.5 w-3.5',
              size === '2xl' && 'h-4 w-4',
              status === 'online' && 'bg-green-500',
              status === 'offline' && 'bg-gray-400',
              status === 'away' && 'bg-amber-500'
            )}
            aria-label={`상태: ${status === 'online' ? '온라인' : status === 'away' ? '자리 비움' : '오프라인'}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/**
 * 이름에서 이니셜 추출 (한글/영문 모두 지원)
 * Emoji는 제거하고 텍스트만 사용
 */
function getInitials(name: string): string {
  if (!name) return '?';

  // Emoji와 특수 문자 제거 (한글, 영문, 숫자만 남김)
  const cleanName = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();

  if (!cleanName) return '?';

  // 공백으로 구분된 이름 처리 (예: "홍 길동" → "홍길")
  const parts = cleanName.split(/\s+/);

  if (parts.length >= 2) {
    // 이름이 여러 부분으로 구성된 경우 (예: "홍 길동" → "홍길")
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  // 단일 이름의 경우 첫 글자만 (예: "홍길동" → "홍")
  return cleanName[0].toUpperCase();
}

/**
 * 여러 아바타를 겹쳐서 표시하는 그룹 컴포넌트
 */
export interface AvatarGroupProps {
  /**
   * 아바타 배열
   */
  avatars: Array<{
    src?: string;
    alt?: string;
    fallback?: string;
  }>;
  /**
   * 최대 표시 개수 (나머지는 "+N" 형태로 표시)
   */
  max?: number;
  /**
   * 아바타 크기
   */
  size?: VariantProps<typeof avatarVariants>['size'];
  /**
   * 추가 클래스명
   */
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 3,
  size = 'md',
  className,
}) => {
  const displayedAvatars = avatars.slice(0, max);
  const remainingCount = Math.max(0, avatars.length - max);

  return (
    <div className={clsx('flex -space-x-2', className)}>
      {displayedAvatars.map((avatar, index) => (
        <div
          key={index}
          className="ring-2 ring-background rounded-full"
          style={{ zIndex: displayedAvatars.length - index }}
        >
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            fallback={avatar.fallback}
            size={size}
          />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={clsx(
            avatarVariants({ size }),
            avatarFallbackVariants(),
            'ring-2 ring-background',
            'bg-muted text-muted-foreground'
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
