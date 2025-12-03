'use client';

/**
 * 일정 상세 페이지 (최적화 버전)
 *
 * 최적화:
 * 1. 캐시에서 즉시 데이터 로드 (로딩 없음!)
 * 2. 백그라운드에서 최신 데이터 갱신
 * 3. AuthContext의 캐시된 프로필 사용
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { schedulesAPI } from '@/lib/api-client';
import { ScheduleDetailClient } from './ScheduleDetailClient';
import { getCachedSchedule } from '@/lib/schedule-cache';
import type { OrgSchedule } from '@/types/firestore';

interface ScheduleDetailPageProps {
  params: Promise<{
    scheduleId: string;
  }>;
}

// DynamoDB 데이터를 OrgSchedule 형식으로 변환하는 함수
function convertToOrgSchedule(scheduleData: any, scheduleId: string): OrgSchedule {
  const dateISO = scheduleData.dateISO || scheduleData.date;
  const time = scheduleData.time || '00:00';
  const startDateTime = new Date(`${dateISO}T${time}`);

  return {
    ...scheduleData,
    id: scheduleId,
    organizationId: scheduleData.organizationId || scheduleData.orgId,
    startDate: { toDate: () => startDateTime },
    endDate: { toDate: () => startDateTime },
    createdAt: scheduleData.createdAt,
    updatedAt: scheduleData.updatedAt || scheduleData.createdAt,
    participants: (scheduleData.participants || [])
      .filter((p: any) => typeof p === 'object' && p !== null && p.userId)
      .map((p: any) => {
        const respondedDate = p.respondedAt
          ? (typeof p.respondedAt === 'number' ? new Date(p.respondedAt) : new Date(p.respondedAt))
          : new Date();
        return {
          ...p,
          respondedAt: { toDate: () => respondedDate },
        };
      }),
  } as OrgSchedule;
}

// 스켈레톤 UI 컴포넌트
function ScheduleSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 스켈레톤 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
      </div>

      {/* 콘텐츠 스켈레톤 */}
      <div className="p-4 space-y-4">
        {/* 제목 */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
        </div>

        {/* RSVP 버튼 */}
        <div className="bg-white rounded-xl p-4">
          <div className="h-4 bg-gray-200 rounded w-20 mb-3 animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* 참석자 */}
        <div className="bg-white rounded-xl p-4">
          <div className="h-4 bg-gray-200 rounded w-24 mb-3 animate-pulse" />
          <div className="flex gap-2">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { scheduleId } = use(params);
  const router = useRouter();
  const { user: currentUser, userProfile: authUserProfile } = useAuth();

  // 캐시에서 즉시 데이터 로드 시도 (메모리 캐시 + localStorage)
  const getCachedData = () => {
    // 1. 메모리 캐시 확인
    const memCached = getCachedSchedule(scheduleId);
    if (memCached) return memCached;

    // 2. localStorage에서 모든 일정 캐시 확인
    if (typeof window !== 'undefined') {
      try {
        const allCached = localStorage.getItem('mokoji_schedules_cache');
        if (allCached) {
          const parsed = JSON.parse(allCached);
          const found = parsed.schedules?.find((s: any) =>
            s.scheduleId === scheduleId || s.id === scheduleId
          );
          if (found) return found;
        }
        // 조직별 캐시도 확인
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('mokoji_org_schedules_')) {
            const orgCached = localStorage.getItem(key);
            if (orgCached) {
              const parsed = JSON.parse(orgCached);
              const found = parsed.schedules?.find((s: any) =>
                s.scheduleId === scheduleId || s.id === scheduleId
              );
              if (found) return found;
            }
          }
        }
      } catch (e) {}
    }
    return null;
  };
  const cachedData = getCachedData();
  const initialSchedule = cachedData ? convertToOrgSchedule(cachedData, scheduleId) : null;

  const [schedule, setSchedule] = useState<OrgSchedule | null>(initialSchedule);
  const [isLoading, setIsLoading] = useState(!initialSchedule); // 캐시 있으면 로딩 false
  const [error, setError] = useState<string | null>(null);

  // 백그라운드에서 최신 데이터 갱신 (캐시 유무 상관없이)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await schedulesAPI.get(scheduleId);
        const scheduleData = response?.schedule || response;

        if (!scheduleData) {
          // 캐시 데이터가 없을 때만 에러 표시
          if (!schedule) {
            setError('일정을 찾을 수 없습니다.');
          }
          return;
        }

        if (scheduleData.isDeleted) {
          setError('삭제된 일정입니다.');
          setSchedule(null);
          return;
        }

        const scheduleWithDates = convertToOrgSchedule(scheduleData, scheduleId);
        setSchedule(scheduleWithDates);
      } catch (err: any) {
        console.error('[ScheduleDetailPage] 데이터 가져오기 실패:', err);
        // 캐시 데이터가 없을 때만 에러 표시
        if (!schedule) {
          setError(err.message || '데이터를 불러오는데 실패했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser?.sub) {
      fetchData();
    }
  }, [scheduleId, currentUser?.sub]);

  // 유저 없으면 스켈레톤 표시
  if (!currentUser) {
    return <ScheduleSkeleton />;
  }

  // 캐시 없고 로딩 중이면 스켈레톤 표시
  if (isLoading && !schedule) {
    return <ScheduleSkeleton />;
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-foreground">{error || '오류 발생'}</h1>
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
        currentUserId={currentUser.sub}
        currentUserName={authUserProfile?.name || currentUser.name || '익명'}
        currentUserAvatar={authUserProfile?.avatar || authUserProfile?.photoURL}
      />
    </div>
  );
}
