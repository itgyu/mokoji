'use client';

import { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui';
import { usersAPI } from '@/lib/api-client';
import type { ScheduleParticipant } from '@/types/firestore';

interface ParticipantStripProps {
  participants: ScheduleParticipant[];
  maxDisplay?: number;
  currentUserId?: string;
  scheduleOwnerId?: string;
  crewOwnerId?: string;
  onRemoveParticipant?: (userId: string) => void;
  onManageClick?: () => void;
}

type TabType = 'going' | 'waiting' | 'declined';

// 참석자 + 프로필 정보
interface ParticipantWithProfile extends ScheduleParticipant {
  avatarUrl?: string;
}

/**
 * 참여자 리스트 (Kurly-inspired 디자인)
 *
 * 보라색/회색 톤으로 통일된 깔끔한 탭 UI
 */
export function ParticipantStrip({
  participants,
  maxDisplay = 20,
  currentUserId,
  scheduleOwnerId,
  crewOwnerId,
  onRemoveParticipant,
  onManageClick
}: ParticipantStripProps) {
  const [activeTab, setActiveTab] = useState<TabType>('going');
  const [participantsWithAvatars, setParticipantsWithAvatars] = useState<ParticipantWithProfile[]>([]);

  // 아바타 URL 검증 함수 (이모티콘이나 잘못된 URL 필터링)
  const getValidAvatarUrl = (avatar: string | undefined | null): string | undefined => {
    if (!avatar || avatar.trim() === '') {
      return undefined;
    }
    const hasValidChars = /[\p{L}\p{N}]/u.test(avatar);
    const isUrlFormat = avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('data:');
    if (!isUrlFormat || !hasValidChars) {
      return undefined;
    }
    return avatar;
  };

  // 참석자들의 프로필 사진 가져오기
  useEffect(() => {
    const fetchAvatars = async () => {
      const updatedParticipants = await Promise.all(
        participants.map(async (p) => {
          try {
            const response = await usersAPI.get(p.userId);
            const user = response?.user || response;
            const rawAvatar = user?.avatar || user?.photoURL || '';
            return { ...p, avatarUrl: getValidAvatarUrl(rawAvatar) };
          } catch {
            return { ...p, avatarUrl: undefined };
          }
        })
      );
      setParticipantsWithAvatars(updatedParticipants);
    };

    if (participants.length > 0) {
      fetchAvatars();
    } else {
      setParticipantsWithAvatars([]);
    }
  }, [participants]);

  // 상태별로 그룹화
  const going = participantsWithAvatars.filter((p) => p.status === 'going');
  const waiting = participantsWithAvatars.filter((p) => p.status === 'waiting');
  const declined = participantsWithAvatars.filter((p) => p.status === 'declined');

  const tabs = [
    { key: 'going' as TabType, label: '참석', count: going.length },
    { key: 'waiting' as TabType, label: '대기', count: waiting.length },
    { key: 'declined' as TabType, label: '불참', count: declined.length },
  ];

  const currentParticipants =
    activeTab === 'going' ? going :
    activeTab === 'waiting' ? waiting :
    declined;

  if (participants.length === 0) {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-900">참석자</span>
          {onManageClick && (
            <button
              onClick={onManageClick}
              className="text-xs text-[#5f0080] font-medium"
            >
              관리
            </button>
          )}
        </div>
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">아직 참석 응답이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-900">참석자</span>
        {onManageClick && (
          <button
            onClick={onManageClick}
            className="text-xs text-[#5f0080] font-medium"
          >
            관리
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 py-3 text-sm font-medium transition-colors
                ${isActive
                  ? 'text-[#5f0080] border-b-2 border-[#5f0080]'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.label} {tab.count}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {currentParticipants.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {currentParticipants.slice(0, maxDisplay).map((participant) => (
            <div
              key={participant.userId}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar
                src={participant.avatarUrl}
                alt={participant.userName}
                size="md"
              />
              <span className="text-sm text-gray-900">{participant.userName}</span>
            </div>
          ))}
          {currentParticipants.length > maxDisplay && (
            <div className="px-4 py-3 text-center">
              <span className="text-xs text-gray-500">
                +{currentParticipants.length - maxDisplay}명 더
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">
            {activeTab === 'going' && '참석자가 없습니다'}
            {activeTab === 'waiting' && '대기 중인 멤버가 없습니다'}
            {activeTab === 'declined' && '불참 멤버가 없습니다'}
          </p>
        </div>
      )}
    </div>
  );
}
