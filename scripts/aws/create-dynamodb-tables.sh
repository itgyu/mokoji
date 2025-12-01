#!/bin/bash

# DynamoDB 테이블 생성 스크립트
# 사용법: ./scripts/aws/create-dynamodb-tables.sh

set -e

echo "🚀 DynamoDB 테이블 생성 시작..."
echo "리전: ap-northeast-2 (서울)"
echo ""

# 1. Users 테이블
echo "📋 1/5: Users 테이블 생성 중..."
aws dynamodb create-table \
    --table-name mokoji-users \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=email,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=email-index,\
KeySchema=[{AttributeName=email,KeyType=HASH}],\
Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ Users 테이블 생성 완료"
echo ""

# 2. Organizations 테이블
echo "📋 2/5: Organizations 테이블 생성 중..."
aws dynamodb create-table \
    --table-name mokoji-organizations \
    --attribute-definitions \
        AttributeName=organizationId,AttributeType=S \
        AttributeName=ownerUid,AttributeType=S \
    --key-schema \
        AttributeName=organizationId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=ownerUid-index,\
KeySchema=[{AttributeName=ownerUid,KeyType=HASH}],\
Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ Organizations 테이블 생성 완료"
echo ""

# 3. OrganizationMembers 테이블 (가장 중요 - joinedAt 보호!)
echo "📋 3/5: OrganizationMembers 테이블 생성 중..."
aws dynamodb create-table \
    --table-name mokoji-organization-members \
    --attribute-definitions \
        AttributeName=memberId,AttributeType=S \
        AttributeName=organizationId,AttributeType=S \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=memberId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=organizationId-index,\
KeySchema=[{AttributeName=organizationId,KeyType=HASH}],\
Projection={ProjectionType=ALL}" \
        "IndexName=userId-index,\
KeySchema=[{AttributeName=userId,KeyType=HASH}],\
Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ OrganizationMembers 테이블 생성 완료"
echo ""

# 4. Schedules 테이블
echo "📋 4/5: Schedules 테이블 생성 중..."
aws dynamodb create-table \
    --table-name mokoji-schedules \
    --attribute-definitions \
        AttributeName=scheduleId,AttributeType=S \
        AttributeName=organizationId,AttributeType=S \
        AttributeName=date,AttributeType=S \
    --key-schema \
        AttributeName=scheduleId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=organizationId-date-index,\
KeySchema=[{AttributeName=organizationId,KeyType=HASH},{AttributeName=date,KeyType=RANGE}],\
Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ Schedules 테이블 생성 완료"
echo ""

# 5. ActivityLogs 테이블
echo "📋 5/5: ActivityLogs 테이블 생성 중..."
aws dynamodb create-table \
    --table-name mokoji-activity-logs \
    --attribute-definitions \
        AttributeName=logId,AttributeType=S \
        AttributeName=organizationId,AttributeType=S \
        AttributeName=timestamp,AttributeType=N \
    --key-schema \
        AttributeName=logId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=organizationId-timestamp-index,\
KeySchema=[{AttributeName=organizationId,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],\
Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ ActivityLogs 테이블 생성 완료"
echo ""

echo "🎉 모든 DynamoDB 테이블 생성 완료!"
echo ""
echo "📊 생성된 테이블:"
echo "  1. mokoji-users"
echo "  2. mokoji-organizations"
echo "  3. mokoji-organization-members ⚠️  joinedAt 보호 필요!"
echo "  4. mokoji-schedules"
echo "  5. mokoji-activity-logs"
echo ""
echo "⏳ 테이블이 ACTIVE 상태가 될 때까지 기다리는 중..."

# 모든 테이블이 ACTIVE 상태가 될 때까지 대기
aws dynamodb wait table-exists --table-name mokoji-users --region ap-northeast-2
aws dynamodb wait table-exists --table-name mokoji-organizations --region ap-northeast-2
aws dynamodb wait table-exists --table-name mokoji-organization-members --region ap-northeast-2
aws dynamodb wait table-exists --table-name mokoji-schedules --region ap-northeast-2
aws dynamodb wait table-exists --table-name mokoji-activity-logs --region ap-northeast-2

echo "✅ 모든 테이블이 ACTIVE 상태입니다!"
echo ""
echo "다음 단계:"
echo "1. Cognito User Pool 생성: ./scripts/aws/create-cognito-user-pool.sh"
echo "2. Lambda Functions 배포: ./scripts/aws/deploy-lambda-functions.sh"
