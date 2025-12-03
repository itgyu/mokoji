/**
 * Firebase Firestore에서 아바타 데이터 복원
 * mokojiya 프로젝트의 userProfiles 컬렉션에서 가져옴
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// Service account 파일 경로
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'mokojiya-service-account.json');

// DynamoDB 클라이언트
const dynamoClient = new DynamoDBClient({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function restoreAvatars() {
  // 1. Service account 파일 확인
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Firebase 서비스 계정 키가 필요합니다.');
    console.error('');
    console.error('다운로드 방법:');
    console.error('1. https://console.firebase.google.com/u/1/project/mokojiya/settings/serviceaccounts/adminsdk');
    console.error('2. "새 비공개 키 생성" 클릭');
    console.error('3. 다운로드한 파일을 scripts/mokojiya-service-account.json 으로 저장');
    process.exit(1);
  }

  // 2. Firebase Admin 초기화
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'mokojiya',
  });
  const firestore = getFirestore();

  console.log('=== Firebase Firestore에서 아바타 복원 ===\n');

  // 3. DynamoDB에서 아바타 없는 Cognito 사용자 목록 가져오기
  const allUsers: any[] = [];
  let lastKey: any;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'mokoji-users',
      ExclusiveStartKey: lastKey,
    }));
    allUsers.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const cognitoUsersWithoutAvatar = allUsers.filter(u =>
    u.userId &&
    u.userId.includes('-') &&
    (!u.avatar || u.avatar.length === 0)
  );

  console.log('아바타 없는 Cognito 사용자:', cognitoUsersWithoutAvatar.length, '명\n');

  // 4. Firebase에서 userProfiles 전체 가져오기
  console.log('Firebase userProfiles 컬렉션 조회 중...');
  const profilesSnapshot = await firestore.collection('userProfiles').get();

  // email -> profile 매핑
  const firebaseProfiles = new Map<string, any>();
  profilesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.email) {
      firebaseProfiles.set(data.email, { id: doc.id, ...data });
    }
  });

  console.log('Firebase 프로필 수:', firebaseProfiles.size, '\n');

  // 5. 아바타 복원
  let restored = 0;
  let notFound = 0;

  for (const user of cognitoUsersWithoutAvatar) {
    const firebaseProfile = firebaseProfiles.get(user.email);

    if (firebaseProfile && firebaseProfile.avatar && firebaseProfile.avatar.length > 0) {
      console.log('✅ 복원:', user.name, '(' + user.email + ')');

      await docClient.send(new UpdateCommand({
        TableName: 'mokoji-users',
        Key: { userId: user.userId },
        UpdateExpression: 'SET avatar = :avatar, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':avatar': firebaseProfile.avatar,
          ':updatedAt': Date.now(),
        },
      }));

      restored++;
    } else {
      console.log('❌ Firebase에 없음:', user.name, '(' + user.email + ')');
      notFound++;
    }
  }

  console.log('\n=== 결과 ===');
  console.log('복원 완료:', restored, '명');
  console.log('Firebase에 없음:', notFound, '명');
}

restoreAvatars()
  .then(() => {
    console.log('\n✅ 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
  });
