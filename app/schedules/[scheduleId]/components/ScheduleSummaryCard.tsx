'use client';

import { OrgSchedule } from '@/types/firestore';
import { Card, Badge, DDayBadge } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, MapPin, Users } from 'lucide-react'

interface ScheduleSummaryCardProps {
  schedule: OrgSchedule;
}

/**
 * 일정 정보 요약 카드
 *
 * 일정의 기본 정보를 표시합니다:
 * - D-Day 배지 / 상태 배지
 * - 날짜/시간
 * - 장소
 * - 참가 요약 (참석/미정/불참)
 * - 설명
 */
export function ScheduleSummaryCard({ schedule }: ScheduleSummaryCardProps) {
  // D-day 계산
  const today = new Date();
  const startDate = schedule.startDate.toDate();
  const daysRemaining = Math.ceil(
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 참가 요약 계산
  const going = schedule.participants.filter((p) => p.status === 'going').length;
  const waiting = schedule.participants.filter((p) => p.status === 'waiting').length;
  const declined = schedule.participants.filter((p) => p.status === 'declined').length;

  // 날짜 포맷
  const dateFormat = schedule.isAllDay ? 'M월 d일 (E)' : 'M월 d일 (E) · HH:mm';
  const formattedDate = format(startDate, dateFormat, { locale: ko });

  // 종료 시간 (종일이 아닐 때만)
  const endTime = schedule.endDate && !schedule.isAllDay
    ? ` ~ ${format(schedule.endDate.toDate(), 'HH:mm')}`
    : '';

  return (
    <Card variant="elevated" className="space-y-3">
      {/* 상태 배지 */}
      <div className="flex items-center gap-2">
        {schedule.status === 'scheduled' && daysRemaining >= 0 && (
          <DDayBadge daysRemaining={daysRemaining} />
        )}
        {schedule.status === 'ongoing' && (
          <Badge variant="ongoing" dot>
            진행중
          </Badge>
        )}
        {schedule.status === 'completed' && (
          <Badge variant="completed">종료</Badge>
        )}
        {schedule.status === 'cancelled' && (
          <Badge variant="cancelled">취소됨</Badge>
        )}
      </div>

      {/* 제목 */}
      <h2 className="text-2xl font-bold text-foreground">{schedule.title}</h2>

      {/* 날짜/시간 */}
      <div className="flex items-center gap-2 text-foreground">
        <span className="text-2xl" aria-hidden="true">
          <Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
        </span>
        <span className="font-semibold">
          {formattedDate}
          {endTime}
        </span>
      </div>

      {/* 장소 */}
      {schedule.location && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-2xl" aria-hidden="true">
            <MapPin className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
          </span>
          <span>{schedule.location.name || schedule.location.address}</span>
        </div>
      )}

      {/* 참가 요약 */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">참석</span>
          <strong className="text-green-600 dark:text-green-400">{going}</strong>
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">대기</span>
          <strong className="text-amber-600 dark:text-amber-400">{waiting}</strong>
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">불참</span>
          <strong className="text-red-600 dark:text-red-400">{declined}</strong>
        </div>
      </div>

      {/* 설명 */}
      {schedule.description && (
        <p className="text-sm text-muted-foreground pt-2 border-t border-border">
          {schedule.description}
        </p>
      )}

      {/* 최대 인원 */}
      {schedule.maxParticipants && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
          <span>
            최대 {schedule.maxParticipants}명 (현재 {going}명)
          </span>
        </div>
      )}
    </Card>
  );
}
