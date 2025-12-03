'use client';

import { useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/firestore';
import { Button, Card, CardHeader, CardTitle, CardBody } from '@/components/ui';

interface MigrationStatus {
  phase: 'idle' | 'scanning' | 'migrating' | 'complete' | 'error';
  total: number;
  current: number;
  errors: string[];
  logs: string[];
}

/**
 * 채팅 기능 마이그레이션 관리 페이지
 *
 * 기존 일정에 채팅 기능을 안전하게 추가
 */
export default function MigrateChatPage() {
  const [status, setStatus] = useState<MigrationStatus>({
    phase: 'idle',
    total: 0,
    current: 0,
    errors: [],
    logs: [],
  });

  const addLog = (message: string) => {
    setStatus((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
    console.log(message);
  };

  const addError = (message: string) => {
    setStatus((prev) => ({
      ...prev,
      errors: [...prev.errors, message],
    }));
    console.error(message);
  };

  /**
   * 1단계: 기존 일정 스캔
   */
  const scanSchedules = async () => {
    setStatus((prev) => ({ ...prev, phase: 'scanning', logs: [], errors: [] }));
    addLog('일정 스캔 시작...');

    try {
      const schedulesRef = collection(db, COLLECTIONS.ORG_SCHEDULES);
      const snapshot = await getDocs(schedulesRef);

      addLog(`총 ${snapshot.size}개 일정 발견`);

      let needsMigration = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.hasChat) {
          needsMigration++;
        }
      });

      addLog(`마이그레이션 필요: ${needsMigration}개`);

      setStatus((prev) => ({
        ...prev,
        phase: 'idle',
        total: needsMigration,
      }));
    } catch (error) {
      addError(`스캔 실패: ${error}`);
      setStatus((prev) => ({ ...prev, phase: 'error' }));
    }
  };

  /**
   * 2단계: 일정별 채팅 활성화
   */
  const migrateSchedules = async () => {
    if (status.total === 0) {
      alert('마이그레이션할 일정이 없습니다. 먼저 스캔을 실행하세요.');
      return;
    }

    const confirmed = window.confirm(
      `${status.total}개 일정에 채팅 기능을 활성화합니다. 계속하시겠습니까?`
    );

    if (!confirmed) return;

    setStatus((prev) => ({ ...prev, phase: 'migrating', current: 0 }));
    addLog('마이그레이션 시작...');

    try {
      const schedulesRef = collection(db, COLLECTIONS.ORG_SCHEDULES);
      const q = query(schedulesRef, where('isDeleted', '==', false));
      const snapshot = await getDocs(q);

      let migrated = 0;

      for (const scheduleDoc of snapshot.docs) {
        const data = scheduleDoc.data();

        // 이미 채팅이 활성화된 경우 스킵
        if (data.hasChat) {
          continue;
        }

        try {
          // 1. org_schedules에 hasChat 필드 추가
          await updateDoc(doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleDoc.id), {
            hasChat: true,
            lastChatMessageAt: null,
            lastChatMessagePreview: null,
          });

          // 2. 환영 시스템 메시지 생성
          const chatRef = collection(db, 'schedule_chats');
          await setDoc(doc(chatRef, `${scheduleDoc.id}_welcome_${Date.now()}`), {
            scheduleId: scheduleDoc.id,
            senderId: null,
            senderName: null,
            senderAvatar: null,
            content: '🎉 채팅이 시작되었습니다! 일정 준비를 여기서 함께 해보세요.',
            type: 'system',
            systemType: 'info',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isDeleted: false,
          });

          migrated++;
          setStatus((prev) => ({ ...prev, current: migrated }));
          addLog(`✅ ${data.title} - 완료`);
        } catch (error) {
          addError(`❌ ${data.title} - 실패: ${error}`);
        }
      }

      addLog(`\n✨ 마이그레이션 완료! ${migrated}개 일정 활성화`);
      setStatus((prev) => ({ ...prev, phase: 'complete' }));
    } catch (error) {
      addError(`마이그레이션 실패: ${error}`);
      setStatus((prev) => ({ ...prev, phase: 'error' }));
    }
  };

  /**
   * 3단계: 롤백 (긴급 상황용)
   */
  const rollbackMigration = async () => {
    const confirmed = window.confirm(
      '⚠️ 모든 채팅 기능을 비활성화합니다. 정말 진행하시겠습니까?'
    );

    if (!confirmed) return;

    setStatus((prev) => ({ ...prev, phase: 'migrating', logs: [], errors: [] }));
    addLog('롤백 시작...');

    try {
      const schedulesRef = collection(db, COLLECTIONS.ORG_SCHEDULES);
      const snapshot = await getDocs(schedulesRef);

      let rolled = 0;

      for (const scheduleDoc of snapshot.docs) {
        await updateDoc(doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleDoc.id), {
          hasChat: false,
          lastChatMessageAt: null,
          lastChatMessagePreview: null,
        });

        rolled++;
        setStatus((prev) => ({ ...prev, current: rolled }));
      }

      addLog(`롤백 완료: ${rolled}개 일정`);
      setStatus((prev) => ({ ...prev, phase: 'complete' }));
    } catch (error) {
      addError(`롤백 실패: ${error}`);
      setStatus((prev) => ({ ...prev, phase: 'error' }));
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <Card>
          <CardHeader>
            <CardTitle>채팅 기능 마이그레이션 관리</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              기존 일정에 채팅 기능을 안전하게 추가합니다
            </p>
          </CardHeader>
        </Card>

        {/* 현재 상태 */}
        <Card>
          <CardBody>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">상태</span>
                <StatusBadge phase={status.phase} />
              </div>

              {status.total > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      마이그레이션 대상
                    </span>
                    <span className="text-sm font-semibold">
                      {status.total}개
                    </span>
                  </div>

                  {status.phase === 'migrating' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          진행률
                        </span>
                        <span className="text-sm font-semibold">
                          {status.current} / {status.total}
                        </span>
                      </div>

                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${(status.current / status.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={scanSchedules}
            disabled={status.phase === 'scanning' || status.phase === 'migrating'}
            fullWidth
          >
            1️⃣ 일정 스캔
          </Button>

          <Button
            variant="primary"
            onClick={migrateSchedules}
            disabled={
              status.total === 0 ||
              status.phase === 'scanning' ||
              status.phase === 'migrating'
            }
            fullWidth
          >
            2️⃣ 마이그레이션 실행
          </Button>

          <Button
            variant="danger"
            onClick={rollbackMigration}
            disabled={status.phase === 'migrating'}
            fullWidth
          >
            🔄 롤백
          </Button>
        </div>

        {/* 로그 */}
        <Card>
          <CardHeader>
            <CardTitle>실행 로그</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1">
              {status.logs.length === 0 ? (
                <p className="text-muted-foreground">로그가 표시됩니다...</p>
              ) : (
                status.logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        {/* 에러 */}
        {status.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">⚠️ 에러</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {status.errors.map((error, i) => (
                  <div
                    key={i}
                    className="text-sm text-destructive bg-error-light rounded p-2"
                  >
                    {error}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * 상태 배지 컴포넌트
 */
function StatusBadge({ phase }: { phase: MigrationStatus['phase'] }) {
  const config = {
    idle: { label: '대기 중', color: 'bg-muted text-muted-foreground' },
    scanning: { label: '스캔 중...', color: 'bg-info-light text-info' },
    migrating: { label: '진행 중...', color: 'bg-warning-light text-warning' },
    complete: { label: '완료', color: 'bg-success-light text-success' },
    error: { label: '에러', color: 'bg-error-light text-destructive' },
  };

  const { label, color } = config[phase];

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
