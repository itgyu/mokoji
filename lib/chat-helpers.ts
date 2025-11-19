/**
 * 채팅 관련 헬퍼 함수
 */

import type { MessageAttachment } from '@/types/firestore';

/**
 * 파일을 AWS S3에 업로드하고 URL을 반환 (API Route 사용)
 *
 * @param file - 업로드할 파일
 * @param scheduleId - 일정 ID
 * @param messageId - 메시지 ID
 * @returns MessageAttachment 객체
 */
export async function uploadChatMedia(
  file: File,
  scheduleId: string,
  messageId: string
): Promise<MessageAttachment> {
  try {
    console.log('[uploadChatMedia] 업로드 시작:', file.name, file.type);

    // 이미지 크기 추출 (클라이언트에서)
    let width: number | undefined;
    let height: number | undefined;

    if (file.type.startsWith('image/')) {
      try {
        const dimensions = await getImageDimensions(file);
        width = dimensions.width;
        height = dimensions.height;
      } catch (error) {
        console.warn('[uploadChatMedia] 이미지 크기 추출 실패:', error);
      }
    }

    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scheduleId', scheduleId);
    formData.append('messageId', messageId);

    // API Route로 업로드
    const response = await fetch('/api/upload-chat-media', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '업로드 실패');
    }

    const data = await response.json();

    // MessageAttachment 객체 생성
    const attachment: MessageAttachment = {
      type: data.type,
      url: data.url,
      fileName: data.fileName,
      size: data.size,
      mimeType: data.mimeType,
      width,
      height,
    };

    console.log('[uploadChatMedia] 업로드 완료:', attachment);

    return attachment;
  } catch (error) {
    console.error('[uploadChatMedia] 업로드 실패:', error);
    throw error;
  }
}

/**
 * 이미지 크기 추출
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일이 아닙니다.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로드 실패'));
    };

    img.src = url;
  });
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * MIME 타입으로부터 파일 타입 아이콘 이름 추출
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  return '📎';
}
