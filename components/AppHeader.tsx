'use client';

import { Logo } from './Logo';
import { Bell, Settings } from 'lucide-react';

interface AppHeaderProps {
  showNotification?: boolean;
  showSettings?: boolean;
  onNotificationClick?: () => void;
  onSettingsClick?: () => void;
  rightContent?: React.ReactNode;
}

/**
 * 공통 앱 헤더
 *
 * 디자인 시스템:
 * - bg-white border-b border-gray-200
 * - h-14 (56px)
 * - sticky top-0 z-50
 * - 왼쪽: MOKKOJI 로고
 */
export function AppHeader({
  showNotification = false,
  showSettings = false,
  onNotificationClick,
  onSettingsClick,
  rightContent,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 h-14 sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* 왼쪽: 로고 */}
        <Logo size="md" color="primary" />

        {/* 오른쪽: 액션 버튼들 */}
        <div className="flex items-center gap-1">
          {showNotification && (
            <button
              onClick={onNotificationClick}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="알림"
            >
              <Bell className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
            </button>
          )}
          {showSettings && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="설정"
            >
              <Settings className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
            </button>
          )}
          {rightContent}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
