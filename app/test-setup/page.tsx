'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui';

/**
 * 테스트 설정 페이지
 *
 * Phase 4-1 로컬 테스트를 위한 페이지
 * - 테스트 일정 생성
 * - 테스트 데이터 초기화
 */
export default function TestSetupPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createTestSchedule = async () => {
    setIsCreating(true);
    setError(null);

    try {
      console.log('[TestSetup] 테스트 일정 생성 시작...');

      // 1. 일정 생성 (org_schedules)
      const scheduleRef = await addDoc(collection(db, 'org_schedules'), {
        title: '🏔️ 테스트 등산 모임',
        description: '채팅 기능 테스트를 위한 일정입니다. 자유롭게 테스트해주세요!',
        organizationId: 'test-org-1',
        organizationName: '테스트 산악회',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // +4시간
        isAllDay: false,
        location: {
          name: '북한산 입구',
          address: '서울시 강북구 우이동',
        },
        maxParticipants: 10,
        participants: [
          {
            userId: 'test-user-1',
            userName: '김테스트',
            status: 'going',
            respondedAt: new Date(),
          },
          {
            userId: 'test-user-2',
            userName: '이실험',
            status: 'maybe',
            respondedAt: new Date(),
          },
        ],
        participantCount: 2,
        createdBy: 'test-user-1',
        creatorInfo: {
          name: '김테스트',
        },
        status: 'scheduled',
        hasChat: true, // ⭐ 채팅 활성화
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });

      console.log('[TestSetup] 일정 생성 완료:', scheduleRef.id);

      // 2. 환영 시스템 메시지 생성 (schedule_chats)
      await addDoc(collection(db, 'schedule_chats'), {
        scheduleId: scheduleRef.id,
        senderId: null, // 시스템 메시지
        senderName: null,
        senderAvatar: null,
        content: '🎉 채팅이 시작되었습니다. 자유롭게 대화해주세요!',
        type: 'system',
        systemType: 'info',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });

      console.log('[TestSetup] 환영 메시지 생성 완료');

      setScheduleId(scheduleRef.id);
      console.log('[TestSetup] 모든 설정 완료!');
    } catch (err: any) {
      console.error('[TestSetup] 생성 실패:', err);
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* 헤더 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">🧪 테스트 설정</h1>
          <p className="text-muted-foreground">
            Phase 4-1: 로컬 테스트 및 버그 수정을 위한 페이지입니다.
          </p>
        </div>

        {/* 테스트 일정 생성 */}
        <div className="space-y-4 p-6 bg-card rounded-2xl border border-border shadow-sm">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              1️⃣ 테스트 일정 생성
            </h2>
            <p className="text-sm text-muted-foreground">
              채팅 기능을 테스트할 수 있는 일정을 Firestore에 생성합니다.
            </p>
          </div>

          <Button
            onClick={createTestSchedule}
            isLoading={isCreating}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {isCreating ? '생성 중...' : '🚀 테스트 일정 생성하기'}
          </Button>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-xl">
              <p className="text-sm text-destructive font-medium">❌ 오류 발생</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          )}

          {/* 성공 메시지 */}
          {scheduleId && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl space-y-3">
              <div>
                <p className="font-semibold text-green-700 dark:text-green-300">
                  ✅ 생성 완료!
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  일정 ID: <code className="font-mono">{scheduleId}</code>
                </p>
              </div>

              <Button
                variant="secondary"
                size="md"
                onClick={() => (window.location.href = `/schedules/${scheduleId}`)}
                className="w-full"
              >
                일정 페이지로 이동 →
              </Button>
            </div>
          )}
        </div>

        {/* 테스트 시나리오 */}
        <div className="space-y-4 p-6 bg-muted/50 rounded-2xl">
          <h2 className="text-xl font-semibold text-foreground">
            📝 테스트 시나리오
          </h2>

          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">✅ 기본 기능 테스트</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground pl-2">
                <li>위 버튼으로 테스트 일정 생성</li>
                <li>일정 페이지로 이동</li>
                <li>채팅 메시지 입력 및 전송</li>
                <li>전송 중/성공/실패 상태 확인</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">
                ✅ RSVP 및 시스템 메시지
              </h3>
              <ol
                className="text-sm space-y-1 list-decimal list-inside text-muted-foreground pl-2"
                start={5}
              >
                <li>RSVP 버튼 클릭 (참석/미정/불참)</li>
                <li>시스템 메시지 자동 생성 확인</li>
                <li>시스템 메시지 스타일 확인 (색상, 이모지)</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">✅ 알림 설정</h3>
              <ol
                className="text-sm space-y-1 list-decimal list-inside text-muted-foreground pl-2"
                start={8}
              >
                <li>🔔 버튼으로 알림 설정 바텀시트 열기</li>
                <li>알림 on/off 토글</li>
                <li>Firestore에서 저장 확인</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">✅ 실시간 테스트</h3>
              <ol
                className="text-sm space-y-1 list-decimal list-inside text-muted-foreground pl-2"
                start={11}
              >
                <li>다른 브라우저(시크릿 모드)에서 같은 페이지 접속</li>
                <li>한쪽에서 메시지 전송</li>
                <li>다른 쪽에서 실시간 수신 확인</li>
                <li>자동 스크롤 확인</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">✅ 오류 처리</h3>
              <ol
                className="text-sm space-y-1 list-decimal list-inside text-muted-foreground pl-2"
                start={15}
              >
                <li>네트워크 끊기 (개발자 도구 → Network → Offline)</li>
                <li>메시지 전송 시도 → 실패 상태 확인</li>
                <li>재전송 버튼 클릭</li>
                <li>네트워크 복구 후 전송 성공 확인</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Firebase Console 링크 */}
        <div className="space-y-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-300">
            🔗 유용한 링크
          </h2>

          <div className="space-y-2">
            <a
              href="https://console.firebase.google.com/project/it-s-campers-95640/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Firestore Database
                </span>
                <span className="text-xs text-muted-foreground">↗</span>
              </div>
            </a>

            <a
              href="https://console.firebase.google.com/project/it-s-campers-95640/authentication/users"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Authentication
                </span>
                <span className="text-xs text-muted-foreground">↗</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
