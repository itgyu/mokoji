/**
 * organization-members의 Firebase UID를 Cognito UUID로 마이그레이션
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
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

async function migrate() {
  // 1. Cognito 마이그레이션 백업에서 Firebase UID -> email 매핑 로드
  const backup = JSON.parse(fs.readFileSync('backups/cognito-migration-2025-12-01T05-27-00.json', 'utf8'));
  const firebaseToEmail = new Map<string, { email: string; name: string }>();
  for (const r of backup.results) {
    firebaseToEmail.set(r.userId, { email: r.email, name: r.name });
  }

  // 2. users 테이블에서 email -> Cognito UUID 매핑 로드 (전체 스캔)
  const allUsers: any[] = [];
  let lastKey: any = undefined;
  do {
    const usersResult = await docClient.send(new ScanCommand({
      TableName: 'mokoji-users',
      ExclusiveStartKey: lastKey,
    }));
    allUsers.push(...(usersResult.Items || []));
    lastKey = usersResult.LastEvaluatedKey;
  } while (lastKey);

  console.log('Total users in DB:', allUsers.length);

  const emailToCognitoId = new Map<string, string>();
  for (const user of allUsers) {
    if (user.email && user.userId) {
      // Cognito UUID 형식만 (하이픈 포함)
      if (user.userId.includes('-')) {
        emailToCognitoId.set(user.email, user.userId);
      }
    }
  }
  console.log('Cognito UUID mappings:', emailToCognitoId.size);

  // 3. organization-members 스캔
  const membersResult = await docClient.send(new ScanCommand({
    TableName: 'mokoji-organization-members',
  }));

  console.log('=== organization-members userId 마이그레이션 ===\n');

  let updated = 0;
  let alreadyCognito = 0;
  let noMapping = 0;
  const orphanMembers: any[] = [];

  for (const member of membersResult.Items || []) {
    const currentUserId = member.userId;
    const memberId = member.memberId;

    // 이미 Cognito UUID 형식이면 스킵
    if (currentUserId.includes('-')) {
      alreadyCognito++;
      continue;
    }

    // Firebase UID -> email 찾기
    const emailInfo = firebaseToEmail.get(currentUserId);
    if (!emailInfo) {
      console.log(`❌ ${currentUserId}: 이메일 매핑 없음 (memberId: ${memberId})`);
      noMapping++;
      orphanMembers.push(member);
      continue;
    }

    // email -> Cognito UUID 찾기
    const cognitoId = emailToCognitoId.get(emailInfo.email);
    if (!cognitoId) {
      console.log(`❌ ${currentUserId} (${emailInfo.email}): Cognito UUID 없음`);
      noMapping++;
      orphanMembers.push(member);
      continue;
    }

    // userId 업데이트 (DynamoDB는 키 변경 불가, 삭제 후 재생성)
    console.log(`✅ ${emailInfo.name} (${emailInfo.email})`);
    console.log(`   Firebase: ${currentUserId}`);
    console.log(`   Cognito:  ${cognitoId}`);

    // 기존 레코드 삭제
    await docClient.send(new DeleteCommand({
      TableName: 'mokoji-organization-members',
      Key: { memberId: memberId }
    }));

    // 새 userId로 레코드 생성
    const newMember = {
      ...member,
      userId: cognitoId,
    };

    await docClient.send(new PutCommand({
      TableName: 'mokoji-organization-members',
      Item: newMember
    }));

    updated++;
  }

  console.log('\n=== 결과 ===');
  console.log('이미 Cognito UUID:', alreadyCognito);
  console.log('업데이트 완료:', updated);
  console.log('매핑 없음 (고아 레코드):', noMapping);

  if (orphanMembers.length > 0) {
    console.log('\n=== 고아 레코드 (삭제 권장) ===');
    for (const m of orphanMembers) {
      console.log(`memberId: ${m.memberId}, userId: ${m.userId}, orgId: ${m.organizationId}`);
    }

    // 고아 레코드 삭제 여부 확인
    console.log('\n고아 레코드를 삭제하려면 --delete-orphans 옵션을 사용하세요.');

    if (process.argv.includes('--delete-orphans')) {
      console.log('\n고아 레코드 삭제 중...');
      for (const m of orphanMembers) {
        await docClient.send(new DeleteCommand({
          TableName: 'mokoji-organization-members',
          Key: { memberId: m.memberId }
        }));
        console.log(`삭제: ${m.memberId}`);
      }
      console.log('고아 레코드 삭제 완료');
    }
  }
}

migrate()
  .then(() => {
    console.log('\n✅ 마이그레이션 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
  });
