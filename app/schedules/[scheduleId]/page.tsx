'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScheduleDetailClient } from './ScheduleDetailClient';
import type { OrgSchedule } from '@/types/firestore';

interface ScheduleDetailPageProps {
  params: Promise<{
    scheduleId: string;
  }>;
}

/**
 * 일정 상세 페이지 (Client Component)
 *
 * 책임:
 * - 일정 데이터 fetch
 * - 권한 체크
 * - 클라이언트 컴포넌트에 데이터 전달
 */
export default function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { scheduleId } = use(params);
  const router = useRouter();
  const [schedule, setSchedule] = useState<OrgSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        console.log('[ScheduleDetailPage] 일정 데이터 가져오기:', scheduleId);

        const scheduleRef = doc(db, 'org_schedules', scheduleId);
        const scheduleSnap = await getDoc(scheduleRef);

        if (!scheduleSnap.exists()) {
          console.error('[ScheduleDetailPage] 일정을 찾을 수 없음');
          setError('일정을 찾을 수 없습니다.');
          return;
        }

        const scheduleData = scheduleSnap.data();

        // isDeleted 확인
        if (scheduleData.isDeleted) {
          console.error('[ScheduleDetailPage] 삭제된 일정');
          setError('삭제된 일정입니다.');
          return;
        }

        // Timestamp를 Date로 변환
        const scheduleWithDates = {
          ...scheduleData,
          id: scheduleSnap.id,
          startDate: scheduleData.startDate,
          endDate: scheduleData.endDate,
          createdAt: scheduleData.createdAt,
          updatedAt: scheduleData.updatedAt || scheduleData.createdAt,
          participants: scheduleData.participants.map((p: any) => ({
            ...p,
            respondedAt: p.respondedAt || new Date(),
          })),
        } as OrgSchedule;

        console.log('[ScheduleDetailPage] 일정 데이터 로드 완료');
        setSchedule(scheduleWithDates);
      } catch (err: any) {
        console.error('[ScheduleDetailPage] 데이터 가져오기 실패:', err);
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [scheduleId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-6xl">😕</div>
          <h1 className="text-2xl font-bold text-foreground">{error || '오류 발생'}</h1>
          <button
            onClick={() => router.back()}
            className="text-primary hover:underline"
          >
            ← 뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ScheduleDetailClient
        schedule={schedule}
        scheduleId={scheduleId}
        // currentUserId는 실제로는 auth context나 session에서 가져옴
        currentUserId="current-user-id"
        currentUserName="나"
      />
    </div>
  );
}
