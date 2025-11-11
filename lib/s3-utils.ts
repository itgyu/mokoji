import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client, getBucketName, getS3Url } from './aws-config'

/**
 * S3에 파일 업로드
 * @param file - 업로드할 File 또는 Blob 객체
 * @param path - S3 저장 경로 (예: 'avatars/user123' 또는 'organizations/org456')
 * @returns S3에 저장된 파일의 공개 URL
 */
export async function uploadToS3(
  file: File | Blob,
  path: string
): Promise<string> {
  try {
    console.log('📤 S3 업로드 시작:', path)

    // File 또는 Blob을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Content-Type 결정
    const contentType = file instanceof File
      ? file.type
      : 'image/jpeg' // Blob의 경우 기본값 (이미지 크롭 결과는 jpeg)

    console.log('📦 파일 정보:', {
      name: file instanceof File ? file.name : 'blob',
      type: contentType,
      size: buffer.length,
      key: path
    })

    // S3에 업로드 (ACL 제거 - 버킷 정책으로 public-read 설정됨)
    const command = new PutObjectCommand({
      Bucket: getBucketName(),
      Key: path,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000' // 1년 캐시
    })

    await getS3Client().send(command)

    // 업로드된 파일의 공개 URL 반환
    const publicUrl = getS3Url(path)
    console.log(`✅ S3 업로드 성공: ${publicUrl}`)

    return publicUrl
  } catch (error: any) {
    console.error('❌ S3 업로드 실패:', {
      message: error.message,
      code: error.Code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      path: path
    })
    throw new Error(`파일 업로드에 실패했습니다: ${error.message}`)
  }
}

/**
 * S3에서 파일 삭제
 * @param url - 삭제할 파일의 S3 URL
 */
export async function deleteFromS3(url: string): Promise<void> {
  try {
    if (!url || !url.includes('s3.amazonaws.com')) {
      console.warn('⚠️ S3 URL이 아님, 삭제 스킵:', url)
      return
    }

    // URL에서 S3 키 추출
    // 예: https://bucket.s3.region.amazonaws.com/avatars/user123 → avatars/user123
    const urlObj = new URL(url)
    const key = urlObj.pathname.substring(1) // 맨 앞 '/' 제거

    console.log('🗑️ S3 삭제 시작:', key)

    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })

    await getS3Client().send(command)
    console.log(`✅ S3 삭제 성공: ${key}`)
  } catch (error: any) {
    console.error('❌ S3 삭제 실패:', {
      message: error.message,
      url: url
    })
    // 삭제 실패는 치명적이지 않으므로 에러를 던지지 않음
  }
}

/**
 * 파일 확장자 추출
 * @param filename - 원본 파일명
 * @returns 확장자 (예: 'jpg', 'png')
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : 'jpg'
}

/**
 * 고유한 S3 키 생성 (파일명 중복 방지)
 * @param originalName - 원본 파일명
 * @param prefix - 경로 prefix (예: 'avatars', 'organizations')
 * @returns 고유한 S3 키
 */
export function generateS3Key(originalName: string, prefix: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 8)
  const extension = getFileExtension(originalName)

  return `${prefix}/${timestamp}-${randomString}.${extension}`
}
