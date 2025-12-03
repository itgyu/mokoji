'use client';

import { MessageCircle } from 'lucide-react';

interface EmptyChatStateProps {
  scheduleTitle: string;
  onQuickAction?: (message: string) => void;
}

/**
 * 빈 채팅 상태 컴포넌트 (Kurly-inspired 디자인)
 *
 * 깔끔하고 미니멀한 빈 상태 UI
 */
export function EmptyChatState({ scheduleTitle, onQuickAction }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <MessageCircle className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-gray-500 mb-1">첫 대화를 시작해보세요</p>
      <p className="text-xs text-gray-400 text-center px-4">
        일정에 대해 집합 장소, 준비물, 카풀 등을<br />
        여기서만 정리하면 됩니다
      </p>
    </div>
  );
}
