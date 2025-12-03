import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// Firebase ID → Cognito ID 매핑 (확인된 사용자들)
const ID_MAPPING: Record<string, string> = {
  // 콘솔 에러에서 보고된 사용자들 (이전에 users 테이블 수정됨)
  'rwT5vvwMBfYZ16Hg7VwZEngVxeu2': '8448ed9c-0011-709d-353a-11a84901ee2b', // 정수현
  't8HLC8aD4cedOAMmJw2j5MDGhd43': 'a4885ddc-50a1-7028-00a2-a717584a8a03', // 김지완
  'fJsi4KvBQxU9M4jg9RG0jYYvQQr1': '7408addc-6031-702c-9e14-efd88ee03947', // 이정익
  'jM4obY7rxcOj17wbV8r7bR2Muzf2': 'f448cdbc-70a1-7065-b2c3-b53fc9c93a78', // 정영근
  'x0l6uQJZCEXlxlp7D7PDDdrkyM22': '5418bd9c-7061-70db-8a87-a698ce67cf40', // 송두나

  // 추가 발견된 Firebase ID들
  '3BG36fSW5vhm2d2lLzKf36JLYoM2': '54f8bdfc-0021-7032-e200-21e14fd70cd2', // 김시윤
  'ePtHpj95tuOxokVBum4uU02PmJn2': '44b87d2c-50d1-7030-c19b-c22cc1c196bf', // 김은정
  'jcap8UJrciZpUl66i7fPJpzgRgW2': 'd408dd3c-4091-7051-eba8-8f8f71f3698c', // 주윤경
};

interface Participant {
  userId: string;
  [key: string]: any;
}

interface Schedule {
  scheduleId: string;
  participants?: Participant[];
  [key: string]: any;
}

async function fixScheduleParticipants() {
  console.log('=== 스케줄 participants userId 수정 시작 ===\n');

  // 모든 스케줄 가져오기
  const scanResult = await docClient.send(new ScanCommand({
    TableName: 'mokoji-schedules',
  }));

  const schedules = (scanResult.Items || []) as Schedule[];
  console.log(`총 ${schedules.length}개 스케줄 발견\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const schedule of schedules) {
    const scheduleId = schedule.scheduleId;
    const participants = schedule.participants || [];

    if (!participants.length) {
      continue;
    }

    let hasChanges = false;
    const updatedParticipants = participants.map(p => {
      const oldUserId = p.userId;

      // 매핑에 있으면 변환
      if (ID_MAPPING[oldUserId]) {
        hasChanges = true;
        console.log(`[${scheduleId}] ${oldUserId} → ${ID_MAPPING[oldUserId]}`);
        return { ...p, userId: ID_MAPPING[oldUserId] };
      }

      return p;
    });

    if (hasChanges) {
      // 업데이트 실행
      try {
        await docClient.send(new UpdateCommand({
          TableName: 'mokoji-schedules',
          Key: { scheduleId },
          UpdateExpression: 'SET participants = :participants',
          ExpressionAttributeValues: {
            ':participants': updatedParticipants,
          },
        }));
        updatedCount++;
        console.log(`  ✅ 스케줄 ${scheduleId} 업데이트 완료\n`);
      } catch (error: any) {
        console.error(`  ❌ 스케줄 ${scheduleId} 업데이트 실패:`, error.message);
      }
    } else {
      skippedCount++;
    }
  }

  console.log('\n=== 완료 ===');
  console.log(`업데이트된 스케줄: ${updatedCount}개`);
  console.log(`변경 불필요: ${skippedCount}개`);
}

fixScheduleParticipants().catch(console.error);
