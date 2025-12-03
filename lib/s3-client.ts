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
    const fileSize = file.size;
    const fileType = file.type || 'unknown';
    console.log('📤 S3 업로드 시작:', path, `(${fileSize} bytes, ${fileType})`);

    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    // API Route로 업로드
    console.log('📤 API 호출 시작...');
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    console.log('📤 API 응답 상태:', response.status);

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // JSON 파싱 실패 시 텍스트로 시도
        try {
          errorMsg = await response.text();
        } catch (e2) {
          // ignore
        }
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log(`✅ S3 업로드 성공: ${data.url}`);

    return data.url;
  } catch (error: any) {
    console.error('❌ S3 업로드 실패:', error);
    // 네트워크 에러인 경우
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('네트워크 연결을 확인해주세요');
    }
    throw new Error(error.message || '알 수 없는 업로드 오류');
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
