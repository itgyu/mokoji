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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    console.log('[upload] file:', file ? `${file.name} (${file.size} bytes)` : 'null');
    console.log('[upload] path:', path);

    if (!file || !path) {
      return NextResponse.json(
        { error: 'Missing required fields: file, path' },
        { status: 400 }
      );
    }

    // 파일 검증
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 50MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
        { error: 'S3 설정이 올바르지 않습니다.' },
        { status: 500 }
      );
    }

    if (!hasAccessKey || !hasSecretKey) {
      console.error('[upload] AWS 자격증명 누락');
      return NextResponse.json(
        { error: 'AWS 자격증명이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // S3 업로드
    console.log('[upload] S3 업로드 시작...');
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: file.type || 'image/jpeg',
      CacheControl: 'max-age=31536000', // 1년 캐시
    });

    await s3Client.send(command);

    // 업로드된 파일 URL
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${path}`;

    console.log('[upload] 업로드 성공:', url);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[upload] 업로드 실패:', error);
    console.error('[upload] 에러 메시지:', error.message);
    console.error('[upload] 에러 코드:', error.Code || error.code);
    return NextResponse.json(
      { error: `파일 업로드에 실패했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}
