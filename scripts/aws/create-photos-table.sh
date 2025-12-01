#!/bin/bash

# DynamoDB Photos 테이블 생성 스크립트

echo "📸 Creating mokoji-photos DynamoDB table..."

aws dynamodb create-table \
    --table-name mokoji-photos \
    --attribute-definitions \
        AttributeName=photoId,AttributeType=S \
        AttributeName=organizationId,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=photoId,KeyType=HASH \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"organizationId-createdAt-index\",
                \"KeySchema\": [
                    {\"AttributeName\":\"organizationId\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\":{
                    \"ProjectionType\":\"ALL\"
                }
            }
        ]" \
    --billing-mode PAY_PER_REQUEST \
    --region ap-northeast-2

echo "✅ Photos table creation initiated!"
echo "⏳ Waiting for table to be active..."

aws dynamodb wait table-exists --table-name mokoji-photos --region ap-northeast-2

echo "🎉 Photos table is now active!"
