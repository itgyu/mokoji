/**
 * participants의 빈 userName을 users 테이블에서 조회하여 채우는 스크립트
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: 'ap-northeast-2',
});

const docClient = DynamoDBDocumentClient.from(client);

async function main() {
  console.log('=== Participants 이름 수정 스크립트 ===\n');

  // 1. 모든 users를 userId -> name 맵으로 변환
  console.log('1. Users 테이블 스캔 중...');
  const usersResult = await docClient.send(
    new ScanCommand({
      TableName: 'mokoji-users',
      ProjectionExpression: 'userId, #n, avatar',
      ExpressionAttributeNames: { '#n': 'name' },
    })
  );

  const userMap = new Map<string, { name: string; avatar?: string }>();
  for (const user of usersResult.Items || []) {
    userMap.set(user.userId, {
      name: user.name,
      avatar: user.avatar,
    });
  }
  console.log(`   ${userMap.size}명의 사용자 로드됨\n`);

  // 2. 모든 schedules 스캔
  console.log('2. Schedules 테이블 스캔 중...');
  const schedulesResult = await docClient.send(
    new ScanCommand({
      TableName: 'mokoji-schedules',
      ProjectionExpression: 'scheduleId, title, participants',
    })
  );

  const schedules = schedulesResult.Items || [];
  console.log(`   ${schedules.length}개의 일정 발견됨\n`);

  // 3. 각 schedule의 participants 수정
  let updatedCount = 0;

  for (const schedule of schedules) {
    const scheduleId = schedule.scheduleId;
    const title = schedule.title;
    const participants = schedule.participants || [];

    if (!participants.length) continue;

    let needsUpdate = false;
    const updatedParticipants = [];

    for (const p of participants) {
      // 문자열인 경우 (이름만 있는 경우) - 스킵하거나 객체로 변환
      if (typeof p === 'string') {
        console.log(`   [${title}] 문자열 참석자 발견: ${p} (스킵)`);
        updatedParticipants.push(p);
        continue;
      }

      // 객체인 경우
      if (p.userId) {
        const user = userMap.get(p.userId);

        // userName이 비어있고 users 테이블에 정보가 있는 경우
        if ((!p.userName || p.userName === '') && user) {
          console.log(`   [${title}] ${p.userId} -> ${user.name}`);
          needsUpdate = true;
          updatedParticipants.push({
            ...p,
            userName: user.name,
            userAvatar: p.userAvatar || user.avatar || null,
          });
        } else if (!p.userName && !user) {
          console.log(`   [${title}] ${p.userId} - 사용자 정보 없음`);
          updatedParticipants.push(p);
        } else {
          // 이미 userName이 있는 경우
          updatedParticipants.push(p);
        }
      } else {
        updatedParticipants.push(p);
      }
    }

    // 업데이트가 필요한 경우
    if (needsUpdate) {
      console.log(`   -> ${title} 업데이트 중...`);

      try {
        await docClient.send(
          new UpdateCommand({
            TableName: 'mokoji-schedules',
            Key: { scheduleId },
            UpdateExpression: 'SET participants = :participants',
            ExpressionAttributeValues: {
              ':participants': updatedParticipants,
            },
          })
        );

        updatedCount++;
        console.log(`   -> ${title} 업데이트 완료!`);
      } catch (error: any) {
        console.error(`   -> ${title} 업데이트 실패:`, error.message);
      }
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`총 ${updatedCount}개의 일정이 업데이트됨`);
}

main().catch(console.error);
