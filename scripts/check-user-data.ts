/**
 * 사용자 데이터 확인 스크립트
 * DynamoDB에 저장된 사용자 데이터를 확인합니다.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';

// .env.local 파일 로드
dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: (process.env.AWS_REGION || 'ap-northeast-2').trim(),
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = (process.env.DYNAMODB_USERS_TABLE || 'mokoji-users').trim();

async function checkUserData() {
  console.log('🔍 DynamoDB 사용자 데이터 확인...');
  console.log('테이블:', USERS_TABLE);

  try {
    // 이태규 사용자 조회
    const specificUser = await docClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': 'itgyu@kakao.com',
        },
      })
    );

    if (specificUser.Items && specificUser.Items.length > 0) {
      console.log('\n🎯 이태규 사용자 데이터:');
      console.log(JSON.stringify(specificUser.Items[0], null, 2));
    } else {
      console.log('이태규 사용자를 찾을 수 없습니다.');
    }

    // 전체 사용자 스캔
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 10, // 처음 10명만
      })
    );

    console.log('\n📊 사용자 목록:');
    console.log('총 사용자 수:', result.Items?.length || 0);
    console.log('---');

    if (result.Items) {
      for (const user of result.Items) {
        console.log('\n👤 사용자:', user.name || user.email);
        console.log('   - userId:', user.userId);
        console.log('   - email:', user.email);
        console.log('   - avatar:', user.avatar || '(없음)');
        console.log('   - birthdate:', user.birthdate || '(없음)');
        console.log('   - location:', user.location || '(없음)');
        console.log('   - gender:', user.gender || '(없음)');
        console.log('   - mbti:', user.mbti || '(없음)');
        console.log('   - interestCategories:', user.interestCategories || '(없음)');
        console.log('   - 전체 데이터:', JSON.stringify(user, null, 2));
        console.log('---');
      }
    }

  } catch (error) {
    console.error('❌ 에러:', error);
  }
}

checkUserData();
