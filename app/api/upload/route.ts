/**
 * 범용 파일 업로드 API Route
 *
 * POST /api/upload
 * Body: FormData with 'file', 'path'
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// S3 클라이언트 초기화 (서버 사이드에서만 실행)
// 환경 변수 이름: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (서버 전용)
// NEXT_PUBLIC_ 접두사가 붙은 버전도 fallback으로 지원
const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    console.log('[upload] 업로드 요청 시작');

    let formData;
    try {
      formData = await request.formData();
    } catch (formError: any) {
      console.error('[upload] FormData 파싱 실패:', formError);
      return NextResponse.json(
        { error: `FormData 파싱 실패: ${formError.message}` },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    console.log('[upload] file:', file ? `${file.name} (${file.size} bytes, type: ${file.type})` : 'null');
    console.log('[upload] path:', path);

    if (!file || !path) {
      return NextResponse.json(
        { error: `필수 필드 누락 (file: ${!!file}, path: ${!!path})` },
        { status: 400 }
      );
    }

    // 파일 검증
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `파일 크기 초과: ${(file.size / 1024 / 1024).toFixed(1)}MB (최대 50MB)` },
        { status: 400 }
      );
    }

    // 파일 크기가 0인 경우
    if (file.size === 0) {
      return NextResponse.json(
        { error: '파일이 비어있습니다' },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    let buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log('[upload] Buffer 변환 완료:', buffer.length, 'bytes');
    } catch (bufferError: any) {
      console.error('[upload] Buffer 변환 실패:', bufferError);
      return NextResponse.json(
        { error: `파일 읽기 실패: ${bufferError.message}` },
        { status: 500 }
      );
    }

    // S3 버킷 이름 가져오기
    const bucket = process.env.AWS_S3_BUCKET || process.env.NEXT_PUBLIC_AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2';
    const hasAccessKey = !!(process.env.AWS_ACCESS_KEY_ID || process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID);
    const hasSecretKey = !!(process.env.AWS_SECRET_ACCESS_KEY || process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY);

    console.log('[upload] bucket:', bucket);
    console.log('[upload] region:', region);
    console.log('[upload] hasAccessKey:', hasAccessKey);
    console.log('[upload] hasSecretKey:', hasSecretKey);

    if (!bucket) {
      console.error('[upload] S3 버킷 환경변수 누락');
      return NextResponse.json(
        { error: 'S3 버킷 설정 누락' },
        { status: 500 }
      );
    }

    if (!hasAccessKey || !hasSecretKey) {
      console.error('[upload] AWS 자격증명 누락');
      return NextResponse.json(
        { error: 'AWS 자격증명 누락' },
        { status: 500 }
      );
    }

    // S3 업로드
    console.log('[upload] S3 업로드 시작...');

    // 파일 경로에서 한글 제거하고 안전한 문자만 사용
    const safePath = path
      .split('/')
      .map(segment => segment.replace(/[^a-zA-Z0-9._-]/g, '_'))
      .join('/');
    console.log('[upload] safePath:', safePath);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: safePath,
      Body: buffer,
      ContentType: file.type || 'image/jpeg',
      CacheControl: 'max-age=31536000', // 1년 캐시
    });

    try {
      await s3Client.send(command);
    } catch (s3Error: any) {
      console.error('[upload] S3 전송 실패:', s3Error);
      return NextResponse.json(
        { error: `S3 업로드 실패: ${s3Error.Code || s3Error.code || s3Error.message || 'Unknown'}` },
        { status: 500 }
      );
    }

    // 업로드된 파일 URL
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${safePath}`;

    console.log('[upload] 업로드 성공:', url);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[upload] 예상치 못한 오류:', error);
    console.error('[upload] 에러 이름:', error.name);
    console.error('[upload] 에러 메시지:', error.message);
    console.error('[upload] 에러 스택:', error.stack);
    return NextResponse.json(
      { error: `업로드 오류: ${error.name || 'Error'} - ${error.message || 'Unknown'}` },
      { status: 500 }
    );
  }
}
