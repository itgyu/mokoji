/**
 * 채팅 관련 헬퍼 함수
 */

import type { MessageAttachment } from '@/types/firestore';
import { uploadChatMedia as s3UploadChatMedia } from '@/lib/aws/s3-upload';

/**
 * 파일을 AWS S3에 업로드하고 URL을 반환
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
  // AWS S3 업로드 함수 사용
  return await s3UploadChatMedia(file, scheduleId, messageId);
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
