import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// 올바른 백업 데이터 기반 매핑
const PROFILE_DATA: Record<string, {
  name: string;
  location: string;
  gender: string;
  mbti: string;
  birthdate: string;
  avatarFile?: string;
}> = {
  // 김시윤: 3BG36fSW5vhm2d2lLzKf36JLYoM2 -> 54f8bdfc-0021-7032-e200-21e14fd70cd2
  '54f8bdfc-0021-7032-e200-21e14fd70cd2': {
    name: '김시윤',
    location: '경기도 안양시',
    gender: '여',
    mbti: 'ENFP',
    birthdate: '1989-12-26',
    avatarFile: '/tmp/avatar_kimsiyun.txt',
  },
  // 김은정: ePtHpj95tuOxokVBum4uU02PmJn2 -> 44b87d2c-50d1-7030-c19b-c22cc1c196bf
  '44b87d2c-50d1-7030-c19b-c22cc1c196bf': {
    name: '김은정',
    location: '서울특별시 광진구',
    gender: '여',
    mbti: 'INTJ',
    birthdate: '1987-06-30',
    // avatar 없음 (length 0)
  },
  // 박소연: iqAnVQ2tWwOLcP7arSAujx4qnKk1 -> 64e88dbc-20b1-70c2-e0b4-3584e926c9ac
  '64e88dbc-20b1-70c2-e0b4-3584e926c9ac': {
    name: '박소연',
    location: '경기도 안산시',
    gender: '여',
    mbti: 'ISTP',
    birthdate: '1995-07-14',
    avatarFile: '/tmp/avatar_parksoyeon.txt',
  },
  // 주윤경: jcap8UJrciZpUl66i7fPJpzgRgW2 -> d408dd3c-4091-7051-eba8-8f8f71f3698c
  'd408dd3c-4091-7051-eba8-8f8f71f3698c': {
    name: '주윤경',
    location: '경기도 안산시',
    gender: '여',
    mbti: 'ENFP',
    birthdate: '1991-11-24',
    avatarFile: '/tmp/avatar_juyunkyung.txt',
  },
  // 권윤지: WIRoWFcL6lV95YpHkwuvghlDp0p1 -> 84989d3c-3021-7043-9eb2-f9f375ce8435
  '84989d3c-3021-7043-9eb2-f9f375ce8435': {
    name: '권윤지',
    location: '서울특별시 송파구',
    gender: '여',
    mbti: 'ENFP',
    birthdate: '1993-05-14',
    avatarFile: '/tmp/avatar_kwonyunji.txt',
  },
};

async function restoreProfiles() {
  console.log('=== 프로필 데이터 올바르게 복원 시작 ===\n');

  for (const [cognitoId, profile] of Object.entries(PROFILE_DATA)) {
    console.log(`[${profile.name}] ${cognitoId} 업데이트 중...`);
    console.log(`  지역: ${profile.location}, 생년월일: ${profile.birthdate}, MBTI: ${profile.mbti}`);

    try {
      // avatar 파일이 있으면 읽기
      let avatar: string | undefined;
      if (profile.avatarFile) {
        try {
          avatar = fs.readFileSync(profile.avatarFile, 'utf-8').trim();
          if (avatar && avatar.length > 0) {
            console.log(`  avatar 로드됨 (${avatar.length} bytes)`);
          } else {
            avatar = undefined;
          }
        } catch (e) {
          console.log(`  avatar 파일 읽기 실패`);
        }
      }

      const updateExpression = avatar
        ? 'SET #location = :location, gender = :gender, mbti = :mbti, birthdate = :birthdate, avatar = :avatar'
        : 'SET #location = :location, gender = :gender, mbti = :mbti, birthdate = :birthdate';

      const expressionAttributeValues: Record<string, string> = {
        ':location': profile.location,
        ':gender': profile.gender,
        ':mbti': profile.mbti,
        ':birthdate': profile.birthdate,
      };

      if (avatar) {
        expressionAttributeValues[':avatar'] = avatar;
      }

      await docClient.send(new UpdateCommand({
        TableName: 'mokoji-users',
        Key: { userId: cognitoId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          '#location': 'location',
        },
        ExpressionAttributeValues: expressionAttributeValues,
      }));
      console.log(`  ✅ ${profile.name} 프로필 복원 완료\n`);
    } catch (error: any) {
      console.error(`  ❌ ${profile.name} 업데이트 실패:`, error.message);
    }
  }

  console.log('\n=== 완료 ===');
}

restoreProfiles().catch(console.error);
