/**
 * 모든 사용자 프로필 확인 및 복원 스크립트
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
});
const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = 'mokoji-users';

interface User {
  userId: string;
  email: string;
  name: string;
  birthdate?: string;
  location?: string;
  gender?: string;
  mbti?: string;
  avatar?: string;
  interestCategories?: string[];
}

async function checkAndRestoreAllProfiles() {
  const result = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
  }));

  const users = (result.Items || []) as User[];

  // Cognito UUID 형식 (하이픈 포함) vs Firebase UID 형식 (영숫자만)
  const cognitoUsers = users.filter(u => u.userId.includes('-'));
  const firebaseUsers = users.filter(u => u.userId.includes('-') === false);

  console.log('=== 전체 사용자 현황 ===');
  console.log('총 사용자:', users.length);
  console.log('Cognito UUID 형식:', cognitoUsers.length);
  console.log('Firebase UID 형식:', firebaseUsers.length);

  console.log('\n=== 프로필 상태 확인 및 복원 ===\n');

  let restoredCount = 0;
  let incompleteNoBackup = 0;
  let alreadyComplete = 0;

  for (const user of cognitoUsers) {
    const isIncomplete =
      !user.birthdate || user.birthdate === '-' || user.birthdate === '1990-01-01' ||
      !user.location || user.location === '서울' || (user.location && user.location.includes(' ') === false) ||
      !user.gender || user.gender === '-';

    if (!isIncomplete) {
      alreadyComplete++;
      continue;
    }

    // 같은 이메일로 Firebase UID 버전이 있는지 확인
    const firebaseVersion = firebaseUsers.find(f => f.email === user.email);

    console.log('👤', user.name, '(' + user.email + ')');
    console.log('   현재: birthdate=' + (user.birthdate || '없음') + ', location=' + (user.location || '없음') + ', gender=' + (user.gender || '없음'));

    if (firebaseVersion) {
      const updates: Record<string, any> = {};

      // birthdate 복원
      if ((!user.birthdate || user.birthdate === '-' || user.birthdate === '1990-01-01') &&
          firebaseVersion.birthdate && firebaseVersion.birthdate !== '-' && firebaseVersion.birthdate !== '1990-01-01') {
        updates.birthdate = firebaseVersion.birthdate;
      }

      // location 복원
      if ((!user.location || user.location === '서울' || (user.location && user.location.includes(' ') === false)) &&
          firebaseVersion.location && firebaseVersion.location.includes(' ')) {
        updates.location = firebaseVersion.location;
      }

      // gender 복원
      if ((!user.gender || user.gender === '-') &&
          firebaseVersion.gender && firebaseVersion.gender !== '-') {
        updates.gender = firebaseVersion.gender;
      }

      // mbti 복원
      if ((!user.mbti || user.mbti === '-') &&
          firebaseVersion.mbti && firebaseVersion.mbti !== '-') {
        updates.mbti = firebaseVersion.mbti;
      }

      // avatar 복원
      if (!user.avatar && firebaseVersion.avatar) {
        updates.avatar = firebaseVersion.avatar;
      }

      // interestCategories 복원
      if ((!user.interestCategories || user.interestCategories.length === 0) &&
          firebaseVersion.interestCategories && firebaseVersion.interestCategories.length > 0) {
        updates.interestCategories = firebaseVersion.interestCategories;
      }

      if (Object.keys(updates).length > 0) {
        // DynamoDB 업데이트
        const updateParts: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = { ':updatedAt': Date.now() };

        Object.keys(updates).forEach(key => {
          updateParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updates[key];
        });

        const updateExpression = 'SET ' + updateParts.join(', ') + ', updatedAt = :updatedAt';

        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: user.userId },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues
        }));

        console.log('   ✅ 복원 완료:', Object.keys(updates).join(', '));
        Object.entries(updates).forEach(([key, value]) => {
          if (key === 'avatar') {
            console.log(`      ${key}: (있음)`);
          } else {
            console.log(`      ${key}: ${value}`);
          }
        });
        restoredCount++;
      } else {
        console.log('   ⚠️ Firebase 버전도 불완전, 복원할 데이터 없음');
        incompleteNoBackup++;
      }
    } else {
      console.log('   ❌ Firebase 버전 없음 (복원 불가)');
      incompleteNoBackup++;
    }

    console.log('');
  }

  console.log('\n=== 결과 요약 ===');
  console.log('이미 완전한 프로필:', alreadyComplete);
  console.log('복원 완료:', restoredCount);
  console.log('복원 불가 (백업 없음):', incompleteNoBackup);
}

checkAndRestoreAllProfiles()
  .then(() => {
    console.log('\n✅ 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
  });
