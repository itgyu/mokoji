/**
 * AWS S3 파일 업로드 유틸리티
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { MessageAttachment } from '@/types/firestore';

// S3 클라이언트 초기화
const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
  },
});

interface UploadResult {
  url: string;
  key: string;
}

/**
 * S3에 파일 업로드
 */
export async function uploadToS3(
  file: File,
  folder: string = 'chat-media'
): Promise<UploadResult> {
  // 파일 검증
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error('파일 크기는 50MB 이하여야 합니다.');
  }

  // 허용된 파일 타입
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  // 고유 파일명 생성
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = file.name.split('.').pop() || 'bin';
  const key = `${folder}/${timestamp}_${randomStr}.${extension}`;

  try {
    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // S3 업로드
    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // 공개 읽기 권한
    });

    await s3Client.send(command);

    // 업로드된 파일 URL
    const url = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;

    console.log('[uploadToS3] 업로드 성공:', url);

    return { url, key };
  } catch (error) {
    console.error('[uploadToS3] 업로드 실패:', error);
    throw new Error('파일 업로드에 실패했습니다.');
  }
}

/**
 * 여러 파일 동시 업로드
 */
export async function uploadMultipleToS3(
  files: File[],
  folder: string = 'chat-media'
): Promise<UploadResult[]> {
  const uploadPromises = files.map((file) => uploadToS3(file, folder));
  return Promise.all(uploadPromises);
}

/**
 * 이미지인지 영상인지 판단
 */
export function getMediaType(file: File): 'image' | 'file' {
  return file.type.startsWith('image/') ? 'image' : 'file';
}

/**
 * 이미지 크기 추출
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
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
 * 채팅 미디어 업로드 (S3 사용)
 */
export async function uploadChatMedia(
  file: File,
  scheduleId: string,
  messageId: string
): Promise<MessageAttachment> {
  try {
    console.log('[uploadChatMedia] 업로드 시작:', file.name, file.type);

    // S3 업로드
    const folder = `schedule_chats/${scheduleId}/media`;
    const { url } = await uploadToS3(file, folder);

    // 이미지인 경우 width/height 정보 추출
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

    console.log('[uploadChatMedia] 업로드 완료:', attachment);

    return attachment;
  } catch (error) {
    console.error('[uploadChatMedia] 업로드 실패:', error);
    throw error;
  }
}
