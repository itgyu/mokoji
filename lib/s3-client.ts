/**
 * S3 업로드 클라이언트 헬퍼 (API Route 사용)
 */

/**
 * S3에 파일 업로드 (API Route 사용)
 * @param file - 업로드할 File 또는 Blob 객체
 * @param path - S3 저장 경로 (예: 'avatars/user123')
 * @returns S3에 저장된 파일의 공개 URL
 */
export async function uploadToS3(
  file: File | Blob,
  path: string
): Promise<string> {
  try {
    console.log('📤 S3 업로드 시작:', path);

    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    // API Route로 업로드
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '업로드 실패');
    }

    const data = await response.json();
    console.log(`✅ S3 업로드 성공: ${data.url}`);

    return data.url;
  } catch (error: any) {
    console.error('❌ S3 업로드 실패:', error);
    throw new Error(`파일 업로드에 실패했습니다: ${error.message}`);
  }
}

/**
 * 고유한 S3 키 생성 (파일명 중복 방지)
 * @param originalName - 원본 파일명
 * @param prefix - 경로 prefix (예: 'avatars', 'organizations')
 * @returns 고유한 S3 키
 */
export function generateS3Key(originalName: string, prefix: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = getFileExtension(originalName);

  return `${prefix}/${timestamp}-${randomString}.${extension}`;
}

/**
 * 파일 확장자 추출
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : 'jpg';
}
