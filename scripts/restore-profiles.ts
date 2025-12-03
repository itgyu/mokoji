import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// Firebase ID -> Cognito ID 매핑 + 백업에서 추출한 프로필 데이터
const PROFILE_DATA: Record<string, { name: string; location: string; gender: string; mbti: string; birthdate: string }> = {
  // 김시윤: 3BG36fSW5vhm2d2lLzKf36JLYoM2 -> 54f8bdfc-0021-7032-e200-21e14fd70cd2
  '54f8bdfc-0021-7032-e200-21e14fd70cd2': {
    name: '김시윤',
    location: '경기도 안양시',
    gender: '여',
    mbti: 'ISFJ',
    birthdate: '2001-10-10',
  },
  // 김은정: ePtHpj95tuOxokVBum4uU02PmJn2 -> 44b87d2c-50d1-7030-c19b-c22cc1c196bf
  '44b87d2c-50d1-7030-c19b-c22cc1c196bf': {
    name: '김은정',
    location: '경기도 안양시',
    gender: '여',
    mbti: 'ISFJ',
    birthdate: '1977-12-24',
  },
  // 박소연: iqAnVQ2tWwOLcP7arSAujx4qnKk1 -> 64e88dbc-20b1-70c2-e0b4-3584e926c9ac
  '64e88dbc-20b1-70c2-e0b4-3584e926c9ac': {
    name: '박소연',
    location: '경기도 안산시',
    gender: '여',
    mbti: 'ENTJ',
    birthdate: '1981-08-03',
  },
  // 주윤경: jcap8UJrciZpUl66i7fPJpzgRgW2 -> d408dd3c-4091-7051-eba8-8f8f71f3698c
  'd408dd3c-4091-7051-eba8-8f8f71f3698c': {
    name: '주윤경',
    location: '경기도 안양시',
    gender: '여',
    mbti: 'ENFJ',
    birthdate: '1975-05-07',
  },
  // 권윤지: WIRoWFcL6lV95YpHkwuvghlDp0p1 -> 84989d3c-3021-7043-9eb2-f9f375ce8435
  '84989d3c-3021-7043-9eb2-f9f375ce8435': {
    name: '권윤지',
    location: '경기도 안양시',
    gender: '여',
    mbti: 'ENFP',
    birthdate: '1977-11-17',
  },
};

async function restoreProfiles() {
  console.log('=== 프로필 데이터 복원 시작 ===\n');

  for (const [cognitoId, profile] of Object.entries(PROFILE_DATA)) {
    console.log(`[${profile.name}] ${cognitoId} 업데이트 중...`);

    try {
      await docClient.send(new UpdateCommand({
        TableName: 'mokoji-users',
        Key: { userId: cognitoId },
        UpdateExpression: 'SET #location = :location, gender = :gender, mbti = :mbti, birthdate = :birthdate',
        ExpressionAttributeNames: {
          '#location': 'location',
        },
        ExpressionAttributeValues: {
          ':location': profile.location,
          ':gender': profile.gender,
          ':mbti': profile.mbti,
          ':birthdate': profile.birthdate,
        },
      }));
      console.log(`  ✅ ${profile.name} 프로필 복원 완료\n`);
    } catch (error: any) {
      console.error(`  ❌ ${profile.name} 업데이트 실패:`, error.message);
    }
  }

  console.log('\n=== 완료 ===');
}

restoreProfiles().catch(console.error);
