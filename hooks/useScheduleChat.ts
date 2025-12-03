import { useState, useEffect, useCallback, useRef } from 'react';
import { getIdToken } from '@/lib/cognito';
import type { ScheduleChatMessage } from '@/types/firestore';
import { uploadChatMedia } from '@/lib/chat-helpers';

/**
 * 일정 채팅을 위한 실시간 Hook
 *
 * 주요 기능:
 * 1. 실시간 메시지 수신 (API 폴링)
 * 2. Optimistic UI를 통한 즉각적인 메시지 전송
 * 3. 실패한 메시지 재전송
 * 4. 자동 메모리 정리 (unsubscribe)
 *
 * 변경 사항:
 * - DynamoDB 직접 호출 → API 라우트 호출로 변경
 * - 보안 개선: AWS 자격 증명이 클라이언트에 노출되지 않음
 */
export function useScheduleChat(
  scheduleId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserAvatar?: string
) {
  const [messages, setMessages] = useState<ScheduleChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);

  // 임시 메시지 ID 추적 (Optimistic UI)
  const tempMessageIds = useRef(new Set<string>());

  /**
   * API 호출을 위한 헬퍼 함수
   */
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API 오류: ${response.status}`);
    }

    return response.json();
  }, []);

  /**
   * 읽음 처리 API 호출
   */
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    try {
      await fetchWithAuth(`/api/schedules/${scheduleId}/messages`, {
        method: 'PATCH',
        body: JSON.stringify({ messageIds }),
      });
    } catch (err) {
      // 읽음 처리 실패는 무시 (사용자 경험에 영향 없음)
      console.warn('[useScheduleChat] 읽음 처리 실패:', err);
    }
  }, [scheduleId, fetchWithAuth]);

  /**
   * 메시지 폴링 설정 (API 라우트 사용)
   */
  useEffect(() => {
    console.log('[useScheduleChat] 메시지 폴링 시작:', scheduleId);

    let pollingInterval: NodeJS.Timeout;
    let isMounted = true;
    const markedMessageIds = new Set<string>(); // 이미 읽음 처리한 메시지 ID 추적

    const fetchMessages = async () => {
      try {
        // API 라우트를 통해 메시지 조회
        const data = await fetchWithAuth(`/api/schedules/${scheduleId}/messages`);

        if (!isMounted) return;

        // 기존 메시지 ID 추적 (중복 방지)
        const existingIds = new Set<string>();
        const unreadMessageIds: string[] = []; // 읽음 처리할 메시지 ID

        // 메시지 배열 처리
        const newMessages = (data.messages || [])
          .map((msg: any) => {
            // messageId 또는 id 사용 (별도 테이블은 messageId 사용)
            const msgId = msg.messageId || msg.id;
            existingIds.add(msgId);

            // 아직 읽음 처리하지 않은 메시지이고, 내가 아닌 사람이 보낸 메시지인 경우
            if (!markedMessageIds.has(msgId) &&
                msg.senderId !== currentUserId &&
                (!msg.readBy || !msg.readBy.includes(currentUserId))) {
              unreadMessageIds.push(msgId);
              markedMessageIds.add(msgId);
            }

            // createdAt을 타임스탬프로 정규화
            return {
              ...msg,
              id: msgId, // 일관된 id 필드 사용
              createdAt: typeof msg.createdAt === 'number'
                ? { toDate: () => new Date(msg.createdAt) }
                : msg.createdAt,
              updatedAt: typeof msg.updatedAt === 'number'
                ? { toDate: () => new Date(msg.updatedAt) }
                : msg.updatedAt,
            };
          });

        // 임시 메시지 중 실제로 저장된 메시지 제거
        tempMessageIds.current.forEach((tempId) => {
          if (existingIds.has(tempId)) {
            // 임시 ID가 실제 메시지에 있으면 제거
            tempMessageIds.current.delete(tempId);
          }
        });

        setMessages(newMessages);
        setIsLoading(false);
        setError(null);

        // 읽음 처리 (백그라운드에서 실행)
        if (unreadMessageIds.length > 0) {
          markMessagesAsRead(unreadMessageIds);
        }
      } catch (err) {
        console.error('[useScheduleChat] 폴링 에러:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    // 초기 메시지 로드
    fetchMessages();

    // 2초마다 폴링 (원하면 조정 가능)
    pollingInterval = setInterval(fetchMessages, 2000);

    // 컴포넌트 언마운트 시 폴링 정리
    return () => {
      console.log('[useScheduleChat] 메시지 폴링 정리:', scheduleId);
      isMounted = false;
      clearInterval(pollingInterval);
    };
  }, [scheduleId, currentUserId, fetchWithAuth, markMessagesAsRead]);

  /**
   * 메시지 전송 (Optimistic UI)
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      setIsSending(true);

      // 임시 ID 생성
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      tempMessageIds.current.add(tempId);

      // Optimistic UI: 즉시 로컬 상태에 추가
      const createdAtTime = Date.now();
      const optimisticMessage: ScheduleChatMessage = {
        id: tempId,
        scheduleId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        content: content.trim(),
        type: 'text',
        createdAt: { toDate: () => new Date(createdAtTime) } as any,
        updatedAt: { toDate: () => new Date(createdAtTime) } as any,
        isDeleted: false,
        _status: 'sending', // 전송 중 표시
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        console.log('[useScheduleChat] 메시지 전송 시작:', content.substring(0, 20));

        // API 라우트를 통해 메시지 저장
        const data = await fetchWithAuth(`/api/schedules/${scheduleId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: content.trim(),
            type: 'text',
            senderName: currentUserName,
            senderAvatar: currentUserAvatar,
          }),
        });

        const messageId = data.message.messageId || data.message.id;
        console.log('[useScheduleChat] 메시지 전송 성공:', messageId);

        // Optimistic 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? { ...msg, id: messageId, _status: 'sent' }
              : msg
          )
        );

        tempMessageIds.current.delete(tempId);
        setIsSending(false);
      } catch (err) {
        console.error('[useScheduleChat] 메시지 전송 실패:', err);

        // 실패 상태로 업데이트
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, _status: 'failed' } : msg
          )
        );

        tempMessageIds.current.delete(tempId);
        setIsSending(false);

        // 에러는 던지지 않고 상태로만 표시
      }
    },
    [scheduleId, currentUserId, currentUserName, currentUserAvatar, isSending, fetchWithAuth]
  );

  /**
   * 미디어 메시지 전송 (이미지/동영상)
   */
  const sendMedia = useCallback(
    async (file: File, caption?: string) => {
      if (isSending) return;

      setIsSending(true);

      // 임시 ID 생성
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      tempMessageIds.current.add(tempId);

      // Optimistic UI: 즉시 로컬 상태에 추가
      const createdAtTime = Date.now();
      const tempUrl = URL.createObjectURL(file);
      const optimisticMessage: ScheduleChatMessage = {
        id: tempId,
        scheduleId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        content: caption || '',
        type: file.type.startsWith('image/') ? 'image' : 'file',
        attachments: [
          {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url: tempUrl, // 임시 미리보기 URL
            fileName: file.name,
            size: file.size,
            mimeType: file.type,
          },
        ],
        createdAt: { toDate: () => new Date(createdAtTime) } as any,
        updatedAt: { toDate: () => new Date(createdAtTime) } as any,
        isDeleted: false,
        _status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        console.log('[useScheduleChat] 미디어 전송 시작:', file.name);

        // 파일 업로드 및 첨부파일 정보 생성
        const attachment = await uploadChatMedia(file, scheduleId, tempId);

        // API 라우트를 통해 메시지 저장
        const data = await fetchWithAuth(`/api/schedules/${scheduleId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: caption || '',
            type: file.type.startsWith('image/') ? 'image' : 'file',
            senderName: currentUserName,
            senderAvatar: currentUserAvatar,
            attachments: [attachment],
          }),
        });

        const messageId = data.message.messageId || data.message.id;
        console.log('[useScheduleChat] 미디어 전송 성공:', messageId);

        // Optimistic 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: messageId,
                  attachments: [attachment],
                  _status: 'sent',
                }
              : msg
          )
        );

        // 임시 URL 정리
        URL.revokeObjectURL(tempUrl);

        tempMessageIds.current.delete(tempId);
        setIsSending(false);
      } catch (err) {
        console.error('[useScheduleChat] 미디어 전송 실패:', err);

        // 실패 상태로 업데이트
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, _status: 'failed' } : msg
          )
        );

        // 임시 URL 정리
        URL.revokeObjectURL(tempUrl);

        tempMessageIds.current.delete(tempId);
        setIsSending(false);
      }
    },
    [scheduleId, currentUserId, currentUserName, currentUserAvatar, isSending, fetchWithAuth]
  );

  /**
   * 실패한 메시지 재전송
   */
  const retryFailedMessage = useCallback(
    async (failedMessage: ScheduleChatMessage) => {
      console.log('[useScheduleChat] 메시지 재전송:', failedMessage.id);

      // 실패한 메시지를 목록에서 제거
      setMessages((prev) => prev.filter((msg) => msg.id !== failedMessage.id));

      // 다시 전송
      await sendMessage(failedMessage.content);
    },
    [sendMessage]
  );

  return {
    messages,
    isLoading,
    error,
    isSending,
    sendMessage,
    sendMedia,
    retryFailedMessage,
  };
}
