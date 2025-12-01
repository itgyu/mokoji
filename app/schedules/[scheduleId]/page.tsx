'use client';

/**
 * CONVERSION NOTE: Firebase → DynamoDB Migration
 *
 * This file has been converted from Firebase/Firestore to AWS DynamoDB.
 *
 * Major changes:
 * 1. Imports: Removed Firebase imports, added DynamoDB library imports
 * 2. Auth: Uses Cognito context instead of Firebase Auth
 * 3. Database operations: getDoc() → schedulesDB.get()
 * 4. Timestamps: Firestore Timestamp → milliseconds (Date.now())
 * 5. Real-time listeners: Removed onAuthStateChanged listener (not applicable to DynamoDB)
 *
 * Known limitations:
 * - No real-time auth state changes (needs manual refresh if auth state changes)
 * - userProfiles now read from DynamoDB users table
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { schedulesDB, usersDB } from '@/lib/dynamodb';
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
  const { user: currentUser } = useAuth();
  const [schedule, setSchedule] = useState<OrgSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // 사용자 프로필 가져오기 (Cognito 사용)
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser?.userId) {
        try {
          const profile = await usersDB.get(currentUser.userId);
          if (profile) {
            setUserProfile(profile);
          }
        } catch (error) {
          console.error('[ScheduleDetailPage] 프로필 가져오기 실패:', error);
        }
      }
    };

    fetchUserProfile();
  }, [currentUser?.userId]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        console.log('[ScheduleDetailPage] 일정 데이터 가져오기:', scheduleId);

        const scheduleData = await schedulesDB.get(scheduleId);

        if (!scheduleData) {
          console.error('[ScheduleDetailPage] 일정을 찾을 수 없음');
          setError('일정을 찾을 수 없습니다.');
          return;
        }

        // isDeleted 확인
        if (scheduleData.isDeleted) {
          console.error('[ScheduleDetailPage] 삭제된 일정');
          setError('삭제된 일정입니다.');
          return;
        }

        // DynamoDB 데이터를 OrgSchedule 형식으로 변환
        // date + time을 조합하여 startDate 생성
        const dateISO = scheduleData.dateISO || scheduleData.date;
        const time = scheduleData.time || '00:00';
        const startDateTime = new Date(`${dateISO}T${time}`);

        console.log('[ScheduleDetailPage] 원본 participants:', scheduleData.participants);

        const scheduleWithDates = {
          ...scheduleData,
          id: scheduleId,
          organizationId: scheduleData.orgId,
          startDate: { toDate: () => startDateTime }, // Firestore Timestamp 형식 모방
          endDate: { toDate: () => startDateTime },
          createdAt: scheduleData.createdAt,
          updatedAt: scheduleData.updatedAt || scheduleData.createdAt,
          participants: (scheduleData.participants || [])
            .filter((p: any) => typeof p === 'object' && p !== null && p.userId) // 객체만 필터링
            .map((p: any) => {
              // respondedAt을 Timestamp 형식으로 변환
              const respondedDate = p.respondedAt
                ? (typeof p.respondedAt === 'number' ? new Date(p.respondedAt) : new Date(p.respondedAt))
                : new Date();

              return {
                ...p,
                respondedAt: { toDate: () => respondedDate },
              };
            }),
        } as OrgSchedule;

        console.log('[ScheduleDetailPage] 변환된 participants:', scheduleWithDates.participants);
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

  if (isLoading || !currentUser) {
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
        currentUserId={currentUser.userId}
        currentUserName={userProfile?.name || currentUser.userName || '익명'}
        currentUserAvatar={userProfile?.avatar || userProfile?.photoURL}
      />
    </div>
  );
}
