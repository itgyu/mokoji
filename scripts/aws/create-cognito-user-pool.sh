#!/bin/bash

# Cognito User Pool 생성 스크립트
# 사용법: ./scripts/aws/create-cognito-user-pool.sh

set -e

echo "🔐 Cognito User Pool 생성 시작..."
echo "리전: ap-northeast-2 (서울)"
echo ""

# User Pool 생성
echo "📋 User Pool 생성 중..."
USER_POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name mokoji-user-pool \
    --policies '{
        "PasswordPolicy": {
            "MinimumLength": 8,
            "RequireUppercase": true,
            "RequireLowercase": true,
            "RequireNumbers": true,
            "RequireSymbols": false
        }
    }' \
    --auto-verified-attributes email \
    --username-attributes email \
    --schema \
        Name=email,AttributeDataType=String,Required=true,Mutable=false \
        Name=name,AttributeDataType=String,Required=true,Mutable=true \
    --region ap-northeast-2 \
    --query 'UserPool.Id' \
    --output text)

echo "✅ User Pool 생성 완료"
echo "   User Pool ID: $USER_POOL_ID"
echo ""

# User Pool Client 생성
echo "📋 User Pool Client 생성 중..."
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-name mokoji-web-client \
    --generate-secret \
    --explicit-auth-flows \
        ALLOW_USER_PASSWORD_AUTH \
        ALLOW_REFRESH_TOKEN_AUTH \
        ALLOW_USER_SRP_AUTH \
    --region ap-northeast-2 \
    --query 'UserPoolClient.ClientId' \
    --output text)

echo "✅ User Pool Client 생성 완료"
echo "   Client ID: $CLIENT_ID"
echo ""

# Client Secret 가져오기
CLIENT_SECRET=$(aws cognito-idp describe-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-id $CLIENT_ID \
    --region ap-northeast-2 \
    --query 'UserPoolClient.ClientSecret' \
    --output text)

echo "✅ Client Secret 생성 완료"
echo ""

# 환경변수 파일 생성
echo "📝 환경변수 파일 생성 중..."
cat > .env.aws << EOF
# AWS Cognito Configuration
AWS_REGION=ap-northeast-2
AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID
AWS_COGNITO_CLIENT_ID=$CLIENT_ID
AWS_COGNITO_CLIENT_SECRET=$CLIENT_SECRET

# DynamoDB Tables
DYNAMODB_USERS_TABLE=mokoji-users
DYNAMODB_ORGANIZATIONS_TABLE=mokoji-organizations
DYNAMODB_MEMBERS_TABLE=mokoji-organization-members
DYNAMODB_SCHEDULES_TABLE=mokoji-schedules
DYNAMODB_ACTIVITY_LOGS_TABLE=mokoji-activity-logs
EOF

echo "✅ 환경변수 파일 생성 완료: .env.aws"
echo ""

echo "🎉 Cognito User Pool 설정 완료!"
echo ""
echo "📊 생성된 리소스:"
echo "  - User Pool ID: $USER_POOL_ID"
echo "  - Client ID: $CLIENT_ID"
echo "  - Region: ap-northeast-2"
echo ""
echo "⚠️  중요: .env.aws 파일을 .env.local에 복사하거나 병합하세요"
echo ""
echo "다음 단계:"
echo "1. Firebase users → Cognito 마이그레이션: npm run migrate:users-to-cognito"
echo "2. Lambda Functions 배포: ./scripts/aws/deploy-lambda-functions.sh"
