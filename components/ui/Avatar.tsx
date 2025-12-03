'use client';

import React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { clsx } from 'clsx';

/**
 * MOKKOJI Avatar - Kurly-inspired Design System
 *
 * Clean, minimal avatar with gray fallback
 */

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away';
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

const statusSizeClasses = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
};

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size = 'md', src, alt, fallback, status, ...props }, ref) => {
  // Validate image URL
  const getValidSrc = (url: string | undefined): string | undefined => {
    if (!url || url.trim() === '') return undefined;
    const hasValidChars = /[\p{L}\p{N}]/u.test(url);
    const isUrlFormat = url.startsWith('http') || url.startsWith('/') || url.startsWith('data:');
    if (!isUrlFormat || !hasValidChars) return undefined;
    return url;
  };

  const validSrc = getValidSrc(src);

  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        ref={ref}
        className={clsx(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {validSrc && (
          <AvatarPrimitive.Image
            src={validSrc}
            alt={alt || 'avatar'}
            className="aspect-square h-full w-full object-cover"
          />
        )}
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400"
          delayMs={validSrc ? 600 : 0}
        >
          {/* 기본 사람 아이콘 */}
          <svg
            className="w-[60%] h-[60%]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
            statusSizeClasses[size],
            status === 'online' && 'bg-green-500',
            status === 'offline' && 'bg-gray-400',
            status === 'away' && 'bg-amber-500'
          )}
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

function getInitials(name: string): string {
  if (!name) return '?';
  const cleanName = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!cleanName) return '?';
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2) {
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
  return cleanName[0].toUpperCase();
}

export interface AvatarGroupProps {
  avatars: Array<{ src?: string; alt?: string; fallback?: string }>;
  max?: number;
  size?: AvatarProps['size'];
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
          className="ring-2 ring-white rounded-full"
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
            'flex items-center justify-center rounded-full ring-2 ring-white',
            'bg-gray-100 text-gray-500 text-xs font-medium',
            sizeClasses[size]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
