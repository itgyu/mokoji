#!/bin/bash

# Vercel 환경 변수 자동 설정 스크립트
# Usage: ./scripts/setup-vercel-env.sh

echo "🚀 Vercel 환경 변수 설정 시작..."
echo ""

# 서버 전용 환경 변수 (Production)
echo "📝 서버 전용 환경 변수 추가 중..."

vercel env add AWS_REGION production <<< "ap-northeast-2"
vercel env add AWS_ACCESS_KEY_ID production <<< "AKIA******************"
vercel env add AWS_SECRET_ACCESS_KEY production <<< "****************************************"
vercel env add AWS_S3_BUCKET production <<< "mokoji"
vercel env add AWS_COGNITO_USER_POOL_ID production <<< "ap-northeast-2_2F6sdouGR"
vercel env add AWS_COGNITO_CLIENT_ID production <<< "5vl7s1q093kpelmk8oa72krp4g"
vercel env add DYNAMODB_USERS_TABLE production <<< "mokoji-users"
vercel env add DYNAMODB_ORGANIZATIONS_TABLE production <<< "mokoji-organizations"
vercel env add DYNAMODB_MEMBERS_TABLE production <<< "mokoji-organization-members"
vercel env add DYNAMODB_SCHEDULES_TABLE production <<< "mokoji-schedules"
vercel env add DYNAMODB_ACTIVITY_LOGS_TABLE production <<< "mokoji-activity-logs"
vercel env add DYNAMODB_PHOTOS_TABLE production <<< "mokoji-photos"

echo ""
echo "📝 클라이언트 공개 환경 변수 추가 중..."

vercel env add NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID production <<< "ap-northeast-2_2F6sdouGR"
vercel env add NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID production <<< "5vl7s1q093kpelmk8oa72krp4g"
vercel env add NEXT_PUBLIC_KAKAO_MAP_API_KEY production <<< "ff364c3f44129afc87e31935ac353ba2"
vercel env add NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT production <<< "true"
vercel env add NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE production <<< "100"

echo ""
echo "✅ 모든 환경 변수 추가 완료!"
echo ""
echo "🔄 재배포를 위해 다음 명령어를 실행하세요:"
echo "   vercel --prod"
