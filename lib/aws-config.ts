import { S3Client } from '@aws-sdk/client-s3'

// S3 클라이언트를 lazy하게 생성하는 함수
const getS3ClientInstance = () => {
  const region = process.env.NEXT_PUBLIC_AWS_REGION
  const accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing AWS credentials. Please check your .env.local file.'
    )
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
}

// Lazy initialization - 실제 사용 시점에 생성
let s3ClientCache: S3Client | null = null

export const getS3Client = (): S3Client => {
  if (!s3ClientCache) {
    s3ClientCache = getS3ClientInstance()
  }
  return s3ClientCache
}

// S3 버킷 이름
export const getBucketName = (): string => {
  const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET
  if (!bucket) {
    throw new Error('NEXT_PUBLIC_AWS_S3_BUCKET is not defined')
  }
  return bucket
}

// S3 리전
export const getAwsRegion = (): string => {
  const region = process.env.NEXT_PUBLIC_AWS_REGION
  if (!region) {
    throw new Error('NEXT_PUBLIC_AWS_REGION is not defined')
  }
  return region
}

// S3 URL 생성 헬퍼 함수
export const getS3Url = (key: string): string => {
  const bucket = getBucketName()
  const region = getAwsRegion()
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}
