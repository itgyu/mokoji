/**
 * Health Check API
 * 환경 변수 확인용
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const env = {
    AWS_REGION: process.env.AWS_REGION ? '✅ SET' : '❌ NOT SET',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅ SET' : '❌ NOT SET',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅ SET' : '❌ NOT SET',
    AWS_COGNITO_USER_POOL_ID: process.env.AWS_COGNITO_USER_POOL_ID ? '✅ SET' : '❌ NOT SET',
    AWS_COGNITO_CLIENT_ID: process.env.AWS_COGNITO_CLIENT_ID ? '✅ SET' : '❌ NOT SET',
    DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE ? '✅ SET' : '❌ NOT SET',
    DYNAMODB_ORGANIZATIONS_TABLE: process.env.DYNAMODB_ORGANIZATIONS_TABLE ? '✅ SET' : '❌ NOT SET',
    DYNAMODB_MEMBERS_TABLE: process.env.DYNAMODB_MEMBERS_TABLE ? '✅ SET' : '❌ NOT SET',
    DYNAMODB_SCHEDULES_TABLE: process.env.DYNAMODB_SCHEDULES_TABLE ? '✅ SET' : '❌ NOT SET',
    DYNAMODB_PHOTOS_TABLE: process.env.DYNAMODB_PHOTOS_TABLE ? '✅ SET' : '❌ NOT SET',
  };

  return NextResponse.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: env,
  });
}
