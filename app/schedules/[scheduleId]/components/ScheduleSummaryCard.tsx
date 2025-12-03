'use client';

import { OrgSchedule } from '@/types/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, MapPin, Users } from 'lucide-react';

interface ScheduleSummaryCardProps {
  schedule: OrgSchedule;
}

/**
 * 일정 정보 요약 카드 (Kurly-inspired 디자인)
 *
 * 깔끔하고 미니멀한 디자인으로 일정 정보를 표시합니다.
 */
export function ScheduleSummaryCard({ schedule }: ScheduleSummaryCardProps) {
  // 참가 요약 계산
  const going = schedule.participants.filter((p) => p.status === 'going').length;
  const waiting = schedule.participants.filter((p) => p.status === 'waiting').length;
  const declined = schedule.participants.filter((p) => p.status === 'declined').length;

  // 날짜 포맷
  const startDate = schedule.startDate.toDate();
  const dateFormat = schedule.isAllDay ? 'M월 d일 (E)' : 'M월 d일 (E) · HH:mm';
  const formattedDate = format(startDate, dateFormat, { locale: ko });

  // 종료 시간 (종일이 아닐 때만)
  const endTime = schedule.endDate && !schedule.isAllDay
    ? ` ~ ${format(schedule.endDate.toDate(), 'HH:mm')}`
    : '';

  // 장소 텍스트
  const locationText = schedule.location
    ? (typeof schedule.location === 'string'
        ? schedule.location
        : schedule.location.name || schedule.location.address)
    : '장소 미정';

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-5">
      {/* 제목 */}
      <h1 className="text-lg font-semibold text-gray-900 mb-3">
        {schedule.title}
      </h1>

      {/* 정보 목록 */}
      <div className="space-y-2">
        {/* 날짜/시간 */}
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          <span>{formattedDate}{endTime}</span>
        </div>

        {/* 장소 */}
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          <span>{locationText}</span>
        </div>

        {/* 참가 요약 */}
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Users className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          <span>
            참석 {going} · 대기 {waiting} · 불참 {declined}
          </span>
          {schedule.maxParticipants && (
            <span className="text-xs text-gray-500">(최대 {schedule.maxParticipants}명)</span>
          )}
        </div>
      </div>

      {/* 설명 */}
      {schedule.description && (
        <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
          {schedule.description}
        </p>
      )}
    </div>
  );
}
