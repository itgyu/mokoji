import { useState, useEffect, useCallback, useRef } from 'react';
import { schedulesDB } from '@/lib/dynamodb';
import type { ScheduleChatMessage } from '@/types/firestore';
import { uploadChatMedia } from '@/lib/chat-helpers';

/**
 * 일정 채팅을 위한 실시간 Hook
 *
 * 주요 기능:
 * 1. 실시간 메시지 수신 (onSnapshot)
 * 2. Optimistic UI를 통한 즉각적인 메시지 전송
 * 3. 실패한 메시지 재전송
 * 4. 자동 메모리 정리 (unsubscribe)
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
   * 메시지 폴링 설정 (DynamoDB는 실시간 리스너를 지원하지 않으므로 폴링 사용)
   */
  useEffect(() => {
    console.log('[useScheduleChat] 메시지 폴링 시작:', scheduleId);

    let pollingInterval: NodeJS.Timeout;
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        // DynamoDB에서 일정 정보 및 메시지 조회
        const scheduleData = await schedulesDB.get(scheduleId);

        if (!scheduleData || !isMounted) return;

        // 기존 메시지 ID 추적 (중복 방지)
        const existingIds = new Set<string>();

        // 메시지 배열 처리 (DynamoDB에 저장된 메시지 배열)
        const newMessages = (scheduleData.messages || [])
          .map((msg: any) => {
            existingIds.add(msg.id);
            // createdAt을 타임스탬프로 정규화
            return {
              ...msg,
              createdAt: typeof msg.createdAt === 'number'
                ? { toDate: () => new Date(msg.createdAt) }
                : msg.createdAt,
              updatedAt: typeof msg.updatedAt === 'number'
                ? { toDate: () => new Date(msg.updatedAt) }
                : msg.updatedAt,
            };
          })
          .filter((msg: any) => !msg.isDeleted) // 삭제된 메시지 제외
          .sort((a: any, b: any) => {
            // createdAt으로 정렬 (오름차순)
            const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
            const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
            return timeA - timeB;
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
  }, [scheduleId]);

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

        // DynamoDB에 메시지 저장
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        // 기존 메시지 배열을 가져와서 새 메시지 추가
        const scheduleData = await schedulesDB.get(scheduleId);
        const existingMessages = scheduleData?.messages || [];

        const newMessage = {
          id: messageId,
          scheduleId,
          senderId: currentUserId,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar || null,
          content: content.trim(),
          type: 'text',
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          readBy: [currentUserId],
        };

        // 새 메시지를 배열에 추가
        const updatedMessages = [...existingMessages, newMessage];

        // DynamoDB에 업데이트
        await schedulesDB.update(scheduleId, {
          messages: updatedMessages,
          updatedAt: now,
        });

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

        // 일정의 lastMessage 업데이트
        await updateScheduleLastMessage(scheduleId, content, currentUserName);

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
    [scheduleId, currentUserId, currentUserName, currentUserAvatar, isSending]
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

        // DynamoDB에 메시지 저장
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        // 기존 메시지 배열을 가져와서 새 메시지 추가
        const scheduleData = await schedulesDB.get(scheduleId);
        const existingMessages = scheduleData?.messages || [];

        const newMessage = {
          id: messageId,
          scheduleId,
          senderId: currentUserId,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar || null,
          content: caption || '',
          type: file.type.startsWith('image/') ? 'image' : 'file',
          attachments: [attachment],
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          readBy: [currentUserId],
        };

        // 새 메시지를 배열에 추가
        const updatedMessages = [...existingMessages, newMessage];

        // DynamoDB에 업데이트
        await schedulesDB.update(scheduleId, {
          messages: updatedMessages,
          updatedAt: now,
        });

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
    [scheduleId, currentUserId, currentUserName, currentUserAvatar, isSending]
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

/**
 * 일정의 lastMessage 업데이트 (헬퍼 함수)
 */
async function updateScheduleLastMessage(
  scheduleId: string,
  content: string,
  senderName: string
): Promise<void> {
  try {
    const now = Date.now();
    await schedulesDB.update(scheduleId, {
      lastMessage: {
        content: content.substring(0, 100), // 최대 100자
        senderName,
        sentAt: now,
      },
      updatedAt: now,
    });
  } catch (err) {
    console.error('[updateScheduleLastMessage] 실패:', err);
    // lastMessage 업데이트 실패는 치명적이지 않으므로 무시
  }
}
