'use client';

import { Avatar, AvatarGroup, Badge, RSVPBadge } from '@/components/ui';
import type { ScheduleParticipant } from '@/types/firestore';
import { X } from 'lucide-react';

interface ParticipantStripProps {
  participants: ScheduleParticipant[];
  maxDisplay?: number;
  currentUserId?: string;
  scheduleOwnerId?: string;
  crewOwnerId?: string;
  onRemoveParticipant?: (userId: string) => void;
}

/**
 * 참여자 리스트 (가로 스크롤)
 *
 * 참석/미정/불참 상태별로 그룹화하여 표시합니다.
 */
export function ParticipantStrip({
  participants,
  maxDisplay = 10,
  currentUserId,
  scheduleOwnerId,
  crewOwnerId,
  onRemoveParticipant
}: ParticipantStripProps) {
  // 호스트 권한 체크 (벙주 또는 크루장)
  const isHost = currentUserId && (currentUserId === scheduleOwnerId || currentUserId === crewOwnerId);

  // 상태별로 그룹화
  const going = participants.filter((p) => p.status === 'going');
  const waiting = participants.filter((p) => p.status === 'waiting');
  const declined = participants.filter((p) => p.status === 'declined');

  if (participants.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        아직 참석 응답이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 참석 */}
      {going.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RSVPBadge status="attending" size="sm" />
            <span className="text-sm font-medium text-foreground">
              {going.length}명
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {going.slice(0, maxDisplay).map((participant, index) => (
              <ParticipantItem
                key={`${participant.userId}-${index}`}
                participant={participant}
                isHost={isHost}
                currentUserId={currentUserId}
                onRemoveParticipant={onRemoveParticipant}
              />
            ))}
            {going.length > maxDisplay && (
              <div className="flex items-center justify-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-lg whitespace-nowrap">
                +{going.length - maxDisplay}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 대기 */}
      {waiting.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RSVPBadge status="maybe" size="sm" />
            <span className="text-sm font-medium text-foreground">
              {waiting.length}명
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {waiting.slice(0, maxDisplay).map((participant, index) => (
              <ParticipantItem
                key={`${participant.userId}-${index}`}
                participant={participant}
                isHost={isHost}
                currentUserId={currentUserId}
                onRemoveParticipant={onRemoveParticipant}
              />
            ))}
            {waiting.length > maxDisplay && (
              <div className="flex items-center justify-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-lg whitespace-nowrap">
                +{waiting.length - maxDisplay}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 불참 */}
      {declined.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RSVPBadge status="not_attending" size="sm" />
            <span className="text-sm font-medium text-foreground">
              {declined.length}명
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {declined.slice(0, maxDisplay).map((participant, index) => (
              <ParticipantItem
                key={`${participant.userId}-${index}`}
                participant={participant}
                dimmed
                isHost={isHost}
                currentUserId={currentUserId}
                onRemoveParticipant={onRemoveParticipant}
              />
            ))}
            {declined.length > maxDisplay && (
              <div className="flex items-center justify-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-lg whitespace-nowrap">
                +{declined.length - maxDisplay}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 개별 참여자 아이템
 */
function ParticipantItem({
  participant,
  dimmed = false,
  isHost = false,
  currentUserId,
  onRemoveParticipant,
}: {
  participant: ScheduleParticipant;
  dimmed?: boolean;
  isHost?: boolean;
  currentUserId?: string;
  onRemoveParticipant?: (userId: string) => void;
}) {
  return (
    <div
      className={`relative group flex flex-col items-center gap-1 min-w-[60px] ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <div className="relative">
        <Avatar
          src={participant.userAvatar}
          alt={participant.userName}
          fallback={participant.userName}
          size="md"
        />
        {/* 제거 버튼 (호스트만 표시, 자기 자신은 제거 불가) - 항상 표시 */}
        {isHost && participant.userId !== currentUserId && onRemoveParticipant && (
          <button
            onClick={() => {
              if (confirm(`${participant.userName}님을 참석자에서 제외할까요?`)) {
                onRemoveParticipant(participant.userId)
              }
            }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors active:scale-95"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
      <span className="text-xs text-center text-foreground truncate w-full px-1">
        {participant.userName}
      </span>
    </div>
  );
}
