'use client';

import React from 'react';
import { Drawer } from 'vaul';
import { clsx } from 'clsx';

export interface BottomSheetProps {
  /**
   * 열림/닫힘 상태
   */
  open?: boolean;
  /**
   * 상태 변경 핸들러
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * 트리거 버튼 (제공하지 않으면 controlled로 동작)
   */
  trigger?: React.ReactNode;
  /**
   * 바텀시트 제목
   */
  title?: string;
  /**
   * 바텀시트 설명
   */
  description?: string;
  /**
   * 바텀시트 내용
   */
  children: React.ReactNode;
  /**
   * 바깥 클릭 시 닫기 비활성화
   */
  disableOutsideClick?: boolean;
  /**
   * 스냅 포인트 (예: ['148px', 0.5, 1])
   */
  snapPoints?: (string | number)[];
  /**
   * 추가 클래스명
   */
  className?: string;
}

/**
 * 모꼬지 BottomSheet 컴포넌트
 *
 * 모바일 친화적인 바텀시트/드로어
 * 드래그로 닫기 가능
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * <BottomSheet trigger={<Button>열기</Button>} title="설정">
 *   <div>바텀시트 내용</div>
 * </BottomSheet>
 *
 * // Controlled
 * const [open, setOpen] = useState(false);
 * <BottomSheet open={open} onOpenChange={setOpen} title="알림">
 *   <NotificationSettings />
 * </BottomSheet>
 * ```
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  disableOutsideClick = false,
  snapPoints,
  className,
}) => {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      modal={!disableOutsideClick}
    >
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />

        <Drawer.Content
          className={clsx(
            'fixed bottom-0 left-0 right-0 z-50',
            'flex flex-col',
            'bg-background',
            'rounded-t-3xl',
            'max-h-[96vh]',
            'outline-none',
            className
          )}
        >
          {/* 드래그 핸들 */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 bg-muted rounded-full" aria-hidden="true" />
          </div>

          {/* 헤더 */}
          {(title || description) && (
            <div className="px-6 pb-4 space-y-2">
              {title && (
                <Drawer.Title className="text-xl font-semibold text-foreground">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="text-sm text-muted-foreground">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}

          {/* 내용 */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

/**
 * BottomSheetHeader 컴포넌트
 *
 * 바텀시트 헤더 섹션 (타이틀 외에 추가 콘텐츠 필요할 때)
 */
export const BottomSheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('px-6 pb-4 space-y-2', className)}
    {...props}
  />
);

/**
 * BottomSheetTitle 컴포넌트
 */
export const BottomSheetTitle = Drawer.Title;

/**
 * BottomSheetDescription 컴포넌트
 */
export const BottomSheetDescription = Drawer.Description;

/**
 * BottomSheetBody 컴포넌트
 *
 * 바텀시트 본문 섹션
 */
export const BottomSheetBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('px-6 pb-6', className)}
    {...props}
  />
);

/**
 * BottomSheetFooter 컴포넌트
 *
 * 바텀시트 하단 액션 버튼 영역
 */
export const BottomSheetFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx(
      'sticky bottom-0',
      'px-6 py-4',
      'bg-background',
      'border-t border-border',
      'flex items-center gap-2',
      className
    )}
    {...props}
  />
);

/**
 * BottomSheet Close 트리거
 *
 * 바텀시트를 닫는 버튼/요소
 */
export const BottomSheetClose = Drawer.Close;
