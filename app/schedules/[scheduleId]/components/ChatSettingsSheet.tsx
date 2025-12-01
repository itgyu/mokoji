'use client';

import { useState, useEffect } from 'react';
import { docClient, TABLES } from '@/lib/dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MessageCircle } from 'lucide-react';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
} from '@/components/ui/BottomSheet';

interface ChatSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  currentUserId: string;
}

/**
 * 채팅 알림 설정 바텀시트
 *
 * 기능:
 * - 채팅 알림 on/off 토글
 * - Firestore users/{userId}/schedule_chat_states/{scheduleId}에 저장
 * - 실시간 동기화
 */
export function ChatSettingsSheet({
  isOpen,
  onClose,
  scheduleId,
  currentUserId,
}: ChatSettingsSheetProps) {
  const [mute, setMute] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 현재 설정 불러오기
  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      setIsLoading(true);

      try {
        console.log('[ChatSettingsSheet] 설정 불러오기:', {
          userId: currentUserId,
          scheduleId,
        });

        // DynamoDB에서 사용자의 채팅 상태 조회
        // Key는 userId#scheduleId 형식으로 구성되거나 별도 테이블 사용
        const stateResult = await docClient.send(
          new GetCommand({
            TableName: TABLES.USERS,
            Key: {
              userId: `${currentUserId}#chat_state#${scheduleId}`
            },
          })
        );

        if (stateResult.Item) {
          const data = stateResult.Item;
          setMute(data?.mute || false);
          console.log('[ChatSettingsSheet] 설정 불러오기 완료:', data);
        } else {
          // 문서가 없으면 기본값 (알림 켜짐)
          setMute(false);
          console.log('[ChatSettingsSheet] 문서 없음, 기본값 사용');
        }
      } catch (error) {
        console.error('[ChatSettingsSheet] 설정 불러오기 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen, scheduleId, currentUserId]);

  // 알림 설정 토글
  const handleToggleMute = async (newValue: boolean) => {
    if (isSaving) return;

    setIsSaving(true);
    const previousValue = mute;

    // Optimistic UI: 즉시 상태 업데이트
    setMute(newValue);

    try {
      console.log('[ChatSettingsSheet] 알림 설정 변경:', {
        userId: currentUserId,
        scheduleId,
        newValue,
      });

      // DynamoDB에 사용자의 채팅 상태 저장
      const stateId = `${currentUserId}#chat_state#${scheduleId}`;

      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: stateId,
            scheduleId,
            userIdPrimary: currentUserId,
            mute: newValue,
            updatedAt: Date.now(),
          },
        })
      );

      console.log('[ChatSettingsSheet] 알림 설정 저장 완료');
    } catch (error) {
      console.error('[ChatSettingsSheet] 알림 설정 실패:', error);

      // 실패 시 이전 값으로 복원
      setMute(previousValue);
      alert('알림 설정 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetHeader>
        <BottomSheetTitle>채팅 알림 설정</BottomSheetTitle>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-4">
        {isLoading ? (
          // 로딩 상태
          <div className="py-8 text-center text-muted-foreground">
            <div className="animate-pulse">로딩 중...</div>
          </div>
        ) : (
          <>
            {/* 알림 on/off 토글 */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <h3 className="font-medium text-foreground">이 일정 채팅 알림</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {mute
                    ? '알림이 꺼져 있습니다'
                    : '새 메시지 푸시 알림을 받습니다'}
                </p>
              </div>

              {/* 토글 스위치 */}
              <button
                onClick={() => handleToggleMute(!mute)}
                disabled={isSaving}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  transition-colors focus:outline-none focus:ring-2 focus:ring-primary
                  focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                  ${mute ? 'bg-muted' : 'bg-primary'}
                `}
                aria-label={mute ? '알림 켜기' : '알림 끄기'}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full
                    bg-white shadow transition-transform
                    ${mute ? 'translate-x-1' : 'translate-x-6'}
                  `}
                />
              </button>
            </div>

            {/* 구분선 */}
            <div className="border-t border-border" />

            {/* 안내 메시지 */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">
                <MessageCircle className="w-4 h-4 text-[#FF9B50] inline-block" /> 일정 자체 알림(D-1, 시간 변경)은 계속 받습니다.
              </p>
              <p className="text-xs text-muted-foreground">
                이 설정은 채팅 메시지 알림만 제어합니다.
              </p>
            </div>

            {/* 추가 옵션 (미래 기능) */}
            <div className="space-y-3 opacity-50 pointer-events-none">
              <div className="flex items-center justify-between py-2">
                <div>
                  <h3 className="font-medium text-foreground text-sm">
                    특정 시간 동안 알림 끄기
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    준비 중
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </BottomSheetBody>
    </BottomSheet>
  );
}
