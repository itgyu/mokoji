'use client';

import { Home, Search, Users, Calendar, User } from 'lucide-react';
import { clsx } from 'clsx';

type NavItem = 'home' | 'category' | 'mycrew' | 'schedules' | 'myprofile';

interface BottomNavigationProps {
  currentPage: NavItem;
  onNavigate: (page: NavItem) => void;
}

/**
 * 하단 네비게이션 바
 *
 * 디자인 시스템:
 * - 아이콘: strokeWidth={1.5}
 * - 활성: text-[#5f0080]
 * - 비활성: text-gray-400
 * - 라벨: text-xs
 */
export function BottomNavigation({ currentPage, onNavigate }: BottomNavigationProps) {
  const navItems: { id: NavItem; label: string; icon: typeof Home }[] = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'category', label: '둘러보기', icon: Search },
    { id: 'mycrew', label: '내 크루', icon: Users },
    { id: 'schedules', label: '일정', icon: Calendar },
    { id: 'myprofile', label: '프로필', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[64px]',
                'transition-colors touch-target'
              )}
            >
              <Icon
                className={clsx(
                  'w-5 h-5',
                  isActive ? 'text-[#5f0080]' : 'text-gray-400'
                )}
                strokeWidth={1.5}
              />
              <span
                className={clsx(
                  'text-xs',
                  isActive ? 'text-[#5f0080] font-medium' : 'text-gray-400'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
