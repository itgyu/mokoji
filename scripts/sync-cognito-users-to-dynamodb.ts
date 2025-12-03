/**
 * Cognito 사용자들을 DynamoDB users 테이블과 동기화
 * - Cognito UUID 형식의 레코드가 없으면 생성
 * - Firebase UID 레코드에서 프로필 데이터 복사
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
});

const USER_POOL_ID = 'ap-northeast-2_2F6sdouGR';
const USERS_TABLE = 'mokoji-users';

async function syncCognitoUsers() {
  console.log('=== Cognito 사용자 → DynamoDB 동기화 ===\n');

  // 1. Cognito에서 모든 사용자 가져오기
  let cognitoUsers: any[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
      PaginationToken: paginationToken,
    }));

    for (const user of response.Users || []) {
      const attrs: Record<string, string> = {};
      for (const attr of user.Attributes || []) {
        if (attr.Name && attr.Value) {
          attrs[attr.Name] = attr.Value;
        }
      }
      cognitoUsers.push({
        sub: attrs['sub'],
        email: attrs['email'],
        name: attrs['name'] || attrs['email']?.split('@')[0],
      });
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  console.log('Cognito 사용자 수:', cognitoUsers.length);

  // 2. DynamoDB users 테이블 전체 가져오기
  const usersResult = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
  }));
  const existingUsers = usersResult.Items || [];

  // userId -> user 매핑
  const userById = new Map<string, any>();
  for (const u of existingUsers) {
    userById.set(u.userId, u);
  }

  // email -> user 매핑 (Firebase UID 레코드용)
  const firebaseUserByEmail = new Map<string, any>();
  for (const u of existingUsers) {
    const isFirebaseUid = u.userId && u.userId.includes('-') === false;
    if (u.email && isFirebaseUid) {
      // Firebase UID 형식
      firebaseUserByEmail.set(u.email, u);
    }
  }

  // Cognito UUID set (이미 존재하는 것들)
  const existingCognitoIds = new Set<string>();
  for (const u of existingUsers) {
    if (u.userId && u.userId.includes('-')) {
      existingCognitoIds.add(u.userId);
    }
  }

  console.log('DynamoDB 사용자 수:', existingUsers.length);
  console.log('Firebase UID 레코드 수:', firebaseUserByEmail.size);

  // 3. 각 Cognito 사용자에 대해 DynamoDB에 레코드가 있는지 확인
  let created = 0;
  let updated = 0;
  let alreadyExists = 0;

  for (const cognitoUser of cognitoUsers) {
    const { sub, email, name } = cognitoUser;

    // Cognito UUID로 이미 존재하는지 확인
    if (existingCognitoIds.has(sub)) {
      alreadyExists++;
      continue;
    }

    // Firebase UID 레코드가 있는지 확인
    const firebaseRecord = firebaseUserByEmail.get(email);

    if (firebaseRecord) {
      // Firebase 레코드에서 프로필 데이터 복사
      console.log(`✅ ${name} (${email})`);
      console.log(`   Firebase 레코드에서 복사`);

      const newRecord = {
        userId: sub,
        email: email,
        name: firebaseRecord.name || name,
        gender: firebaseRecord.gender || '-',
        birthdate: firebaseRecord.birthdate || '-',
        location: firebaseRecord.location || '서울',
        mbti: firebaseRecord.mbti || '-',
        avatar: firebaseRecord.avatar || '',
        interestCategories: firebaseRecord.interestCategories || [],
        createdAt: firebaseRecord.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await docClient.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: newRecord,
      }));

      created++;
    } else {
      // 새 레코드 생성 (기본값)
      console.log(`➕ ${name} (${email})`);
      console.log(`   새 레코드 생성 (기본값)`);

      const newRecord = {
        userId: sub,
        email: email,
        name: name,
        gender: '-',
        birthdate: '-',
        location: '서울',
        mbti: '-',
        avatar: '',
        interestCategories: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await docClient.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: newRecord,
      }));

      created++;
    }
  }

  console.log('\n=== 결과 ===');
  console.log('이미 존재:', alreadyExists);
  console.log('새로 생성:', created);
  console.log('업데이트:', updated);
}

syncCognitoUsers()
  .then(() => {
    console.log('\n✅ 동기화 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
  });
