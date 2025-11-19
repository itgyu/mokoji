/**
 * 채팅 관련 헬퍼 함수
 */

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { MessageAttachment } from '@/types/firestore';

/**
 * 파일을 Firebase Storage에 업로드하고 URL을 반환
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
    // 파일 확장자 추출
    const extension = file.name.split('.').pop() || 'bin';
    const fileName = `${messageId}_${Date.now()}.${extension}`;

    // Storage 경로: schedule_chats/{scheduleId}/media/{fileName}
    const storageRef = ref(storage, `schedule_chats/${scheduleId}/media/${fileName}`);

    // 메타데이터 설정
    const metadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    };

    // 파일 업로드
    const snapshot = await uploadBytes(storageRef, file, metadata);

    // 다운로드 URL 가져오기
    const url = await getDownloadURL(snapshot.ref);

    // 이미지인 경우 width/height 정보 추출
    let width: number | undefined;
    let height: number | undefined;

    if (file.type.startsWith('image/')) {
      try {
        const dimensions = await getImageDimensions(file);
        width = dimensions.width;
        height = dimensions.height;
      } catch (error) {
        console.warn('이미지 크기 추출 실패:', error);
      }
    }

    // MessageAttachment 객체 생성
    const attachment: MessageAttachment = {
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      width,
      height,
    };

    // 동영상인 경우 썸네일 생성 (선택적)
    if (file.type.startsWith('video/')) {
      try {
        const thumbnail = await generateVideoThumbnail(file);
        if (thumbnail) {
          const thumbnailUrl = await uploadVideoThumbnail(
            thumbnail,
            scheduleId,
            messageId
          );
          attachment.thumbnailUrl = thumbnailUrl;
        }
      } catch (error) {
        console.warn('동영상 썸네일 생성 실패:', error);
      }
    }

    return attachment;
  } catch (error) {
    console.error('파일 업로드 실패:', error);
    throw new Error('파일 업로드에 실패했습니다.');
  }
}

/**
 * 이미지 파일의 크기(width, height) 추출
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
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
 * 동영상 썸네일 생성
 */
function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    video.src = url;
    video.currentTime = 1; // 1초 지점의 썸네일 추출

    video.addEventListener('loadeddata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        },
        'image/jpeg',
        0.8
      );
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
  });
}

/**
 * 동영상 썸네일 업로드
 */
async function uploadVideoThumbnail(
  thumbnail: Blob,
  scheduleId: string,
  messageId: string
): Promise<string> {
  const fileName = `${messageId}_thumb_${Date.now()}.jpg`;
  const storageRef = ref(
    storage,
    `schedule_chats/${scheduleId}/thumbnails/${fileName}`
  );

  const snapshot = await uploadBytes(storageRef, thumbnail, {
    contentType: 'image/jpeg',
  });

  return await getDownloadURL(snapshot.ref);
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
