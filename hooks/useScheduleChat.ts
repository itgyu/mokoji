import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScheduleChatMessage } from '@/types/firestore';
import { chatMessageConverter } from '@/lib/firestore/converters';
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
   * 실시간 메시지 리스너 설정
   */
  useEffect(() => {
    console.log('[useScheduleChat] 실시간 리스너 시작:', scheduleId);

    const messagesRef = collection(db, 'org_schedules', scheduleId, 'messages');

    // 임시: 인덱스 생성 전까지 가장 단순한 쿼리 사용
    // TODO: 인덱스 생성 후 orderBy와 isDeleted 필터 추가
    const q = query(
      messagesRef,
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q.withConverter(chatMessageConverter),
      (snapshot) => {
        console.log('[useScheduleChat] 메시지 업데이트:', snapshot.size, '개');

        // 기존 메시지 ID 추적 (중복 방지)
        const existingIds = new Set<string>();

        // 클라이언트 측에서 필터링 및 정렬
        const newMessages = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            existingIds.add(data.id);
            return data;
          })
          .filter((msg) => !msg.isDeleted) // 삭제된 메시지 제외
          .sort((a, b) => {
            // createdAt으로 정렬 (오름차순)
            const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
            const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
            return timeA - timeB;
          });

        // 임시 메시지 중 실제로 저장된 메시지 제거
        tempMessageIds.current.forEach((tempId) => {
          if (!existingIds.has(tempId)) {
            // 임시 ID가 실제 메시지에 없으면 아직 저장 안 됨
          } else {
            // 임시 ID가 실제 메시지에 있으면 제거
            tempMessageIds.current.delete(tempId);
          }
        });

        setMessages(newMessages);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useScheduleChat] 리스너 에러:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    // 컴포넌트 언마운트 시 리스너 정리
    return () => {
      console.log('[useScheduleChat] 실시간 리스너 정리:', scheduleId);
      unsubscribe();
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
      const optimisticMessage: ScheduleChatMessage = {
        id: tempId,
        scheduleId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        content: content.trim(),
        type: 'text',
        createdAt: { toDate: () => new Date() } as Timestamp,
        updatedAt: { toDate: () => new Date() } as Timestamp,
        isDeleted: false,
        _status: 'sending', // 전송 중 표시
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        console.log('[useScheduleChat] 메시지 전송 시작:', content.substring(0, 20));

        // Firestore에 실제 저장
        const messagesRef = collection(db, 'org_schedules', scheduleId, 'messages');
        const docRef = await addDoc(messagesRef, {
          scheduleId,
          senderId: currentUserId,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar || null,
          content: content.trim(),
          type: 'text',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false,
          readBy: [currentUserId],
        });

        console.log('[useScheduleChat] 메시지 전송 성공:', docRef.id);

        // Optimistic 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? { ...msg, id: docRef.id, _status: 'sent' }
              : msg
          )
        );

        tempMessageIds.current.delete(tempId);

        // TODO: 일정의 lastMessage 업데이트
        // await updateScheduleLastMessage(scheduleId, content, currentUserName);

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
            url: URL.createObjectURL(file), // 임시 미리보기 URL
            fileName: file.name,
            size: file.size,
            mimeType: file.type,
          },
        ],
        createdAt: { toDate: () => new Date() } as Timestamp,
        updatedAt: { toDate: () => new Date() } as Timestamp,
        isDeleted: false,
        _status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        console.log('[useScheduleChat] 미디어 전송 시작:', file.name);

        // Firebase Storage에 파일 업로드
        const attachment = await uploadChatMedia(file, scheduleId, tempId);

        // Firestore에 메시지 저장
        const messagesRef = collection(db, 'org_schedules', scheduleId, 'messages');
        const docRef = await addDoc(messagesRef, {
          scheduleId,
          senderId: currentUserId,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar || null,
          content: caption || '',
          type: file.type.startsWith('image/') ? 'image' : 'file',
          attachments: [attachment],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false,
          readBy: [currentUserId],
        });

        console.log('[useScheduleChat] 미디어 전송 성공:', docRef.id);

        // Optimistic 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: docRef.id,
                  attachments: [attachment],
                  _status: 'sent',
                }
              : msg
          )
        );

        // 임시 URL 정리
        if (optimisticMessage.attachments?.[0]?.url) {
          URL.revokeObjectURL(optimisticMessage.attachments[0].url);
        }

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
    const scheduleRef = doc(db, 'org_schedules', scheduleId);
    await updateDoc(scheduleRef, {
      lastMessage: {
        content: content.substring(0, 100), // 최대 100자
        senderName,
        sentAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[updateScheduleLastMessage] 실패:', err);
    // lastMessage 업데이트 실패는 치명적이지 않으므로 무시
  }
}
