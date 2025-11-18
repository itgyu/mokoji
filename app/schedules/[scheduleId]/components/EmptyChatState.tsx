'use client';

import { Button } from '@/components/ui';

interface EmptyChatStateProps {
  scheduleTitle: string;
  onQuickAction?: (message: string) => void;
}

/**
 * 빈 채팅 상태 컴포넌트
 *
 * 채팅이 비어있을 때 표시되는 UI
 * 퀵 액션 버튼으로 대화를 시작할 수 있습니다.
 */
export function EmptyChatState({ scheduleTitle, onQuickAction }: EmptyChatStateProps) {
  const quickActions = [
    '🕐 집합 시간 확인하기',
    '🚗 카풀/탑승자 모집하기',
    '🎒 준비물 리스트 공유하기',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 space-y-6">
      {/* 메인 메시지 */}
      <div className="text-center space-y-3">
        <div className="text-5xl animate-bounce-slow" aria-hidden="true">
          💬
        </div>
        <h3 className="font-semibold text-lg text-foreground">첫 대화를 시작해보세요</h3>
        <p className="text-sm text-muted-foreground max-w-md px-4">
          <strong className="text-foreground">{scheduleTitle}</strong> 일정에 대해
          <br />
          집합 장소, 준비물, 카풀 등을 여기서만 정리하면
          <br />
          카카오톡 단톡이 필요 없습니다.
        </p>
      </div>

      {/* 퀵 액션 버튼 */}
      <div className="flex flex-col gap-2 w-full max-w-sm px-4">
        <p className="text-xs text-muted-foreground text-center mb-1">
          💡 이런 주제로 대화를 시작해보세요
        </p>
        {quickActions.map((action) => (
          <Button
            key={action}
            variant="outline"
            size="md"
            onClick={() => onQuickAction?.(action)}
            className="w-full justify-start"
          >
            {action}
          </Button>
        ))}
      </div>

      {/* 추가 안내 */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-xs text-muted-foreground px-4">
          💡 Tip: 메시지는 일정 참여자만 볼 수 있습니다
        </p>
      </div>
    </div>
  );
}
