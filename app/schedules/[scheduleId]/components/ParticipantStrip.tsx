'use client';

import { Avatar, AvatarGroup, Badge, RSVPBadge } from '@/components/ui';
import type { ScheduleParticipant } from '@/types/firestore';

interface ParticipantStripProps {
  participants: ScheduleParticipant[];
  maxDisplay?: number;
}

/**
 * 참여자 리스트 (가로 스크롤)
 *
 * 참석/미정/불참 상태별로 그룹화하여 표시합니다.
 */
export function ParticipantStrip({ participants, maxDisplay = 10 }: ParticipantStripProps) {
  // 상태별로 그룹화
  const going = participants.filter((p) => p.status === 'going');
  const maybe = participants.filter((p) => p.status === 'maybe');
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
            {going.slice(0, maxDisplay).map((participant) => (
              <ParticipantItem key={participant.userId} participant={participant} />
            ))}
            {going.length > maxDisplay && (
              <div className="flex items-center justify-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-lg whitespace-nowrap">
                +{going.length - maxDisplay}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 미정 */}
      {maybe.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RSVPBadge status="maybe" size="sm" />
            <span className="text-sm font-medium text-foreground">
              {maybe.length}명
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {maybe.slice(0, maxDisplay).map((participant) => (
              <ParticipantItem key={participant.userId} participant={participant} />
            ))}
            {maybe.length > maxDisplay && (
              <div className="flex items-center justify-center px-3 py-2 text-sm text-muted-foreground bg-muted rounded-lg whitespace-nowrap">
                +{maybe.length - maxDisplay}
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
            {declined.slice(0, maxDisplay).map((participant) => (
              <ParticipantItem
                key={participant.userId}
                participant={participant}
                dimmed
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
}: {
  participant: ScheduleParticipant;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 min-w-[60px] ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <Avatar
        src={participant.userAvatar}
        alt={participant.userName}
        fallback={participant.userName}
        size="md"
      />
      <span className="text-xs text-center text-foreground truncate w-full px-1">
        {participant.userName}
      </span>
    </div>
  );
}
