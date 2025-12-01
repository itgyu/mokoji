import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.aws' });

// Firebase Admin 초기화
const serviceAccountPath = path.join(__dirname, '../../new-firebase-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다');
  console.error(`   경로: ${serviceAccountPath}`);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath)
  });
}

const db = getFirestore();

// DynamoDB 초기화
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-2'
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true, // undefined 값 자동 제거
    convertEmptyValues: false,
    convertClassInstanceToMap: true,
  }
});

// Timestamp를 Unix timestamp (Number)로 변환
function convertTimestamp(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp._seconds) {
    return timestamp._seconds * 1000 + Math.floor(timestamp._nanoseconds / 1000000);
  }
  return Date.now();
}

// 배치 작업 헬퍼 (25개씩 묶어서 처리)
async function batchWrite(tableName: string, items: any[]) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  let successCount = 0;
  let failCount = 0;

  for (const chunk of chunks) {
    try {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map(item => ({
            PutRequest: { Item: item }
          }))
        }
      }));
      successCount += chunk.length;
      console.log(`  ✅ ${successCount}/${items.length} 완료`);
    } catch (error) {
      console.error(`  ❌ 배치 쓰기 실패:`, error);
      failCount += chunk.length;
    }
  }

  return { successCount, failCount };
}

// 1. userProfiles → mokoji-users
async function migrateUsers() {
  console.log('\n📋 1/5: userProfiles → mokoji-users 마이그레이션 시작...');

  const snapshot = await db.collection('userProfiles').get();
  const users = [];
  let skippedCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();

    // email이 없거나 빈 문자열인 경우 건너뛰기 (DynamoDB 인덱스 제약)
    if (!data.email || data.email.trim() === '') {
      console.warn(`  ⚠️  ${doc.id} - email 없음, 건너뜀`);
      skippedCount++;
      return;
    }

    users.push({
      userId: doc.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      avatar: data.avatar || data.photoURL || '',
      birthdate: data.birthdate || '',
      gender: data.gender || '',
      location: data.location || '',
      mbti: data.mbti || '',
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    });
  });

  console.log(`  📊 마이그레이션할 사용자: ${users.length}명 (건너뜀: ${skippedCount}명)`);

  const result = await batchWrite(process.env.DYNAMODB_USERS_TABLE!, users);
  console.log(`  ✅ userProfiles 마이그레이션 완료: ${result.successCount}명 성공, ${result.failCount}명 실패`);

  return { total: users.length + skippedCount, skipped: skippedCount, ...result };
}

// 2. organizations → mokoji-organizations
async function migrateOrganizations() {
  console.log('\n📋 2/5: organizations → mokoji-organizations 마이그레이션 시작...');

  const snapshot = await db.collection('organizations').get();
  const orgs = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    orgs.push({
      organizationId: doc.id,
      name: data.name || '',
      description: data.description || '',
      categories: data.categories || [],
      ownerUid: data.ownerUid || '',
      ownerName: data.ownerName || '',
      avatar: data.avatar || '',
      memberCount: data.memberCount || 0,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    });
  });

  console.log(`  📊 마이그레이션할 조직: ${orgs.length}개`);

  const result = await batchWrite(process.env.DYNAMODB_ORGANIZATIONS_TABLE!, orgs);
  console.log(`  ✅ organizations 마이그레이션 완료: ${result.successCount}개 성공, ${result.failCount}개 실패`);

  return { total: orgs.length, ...result };
}

// 3. organizationMembers → mokoji-organization-members (⚠️ joinedAt 보존!)
async function migrateOrganizationMembers() {
  console.log('\n📋 3/5: organizationMembers → mokoji-organization-members 마이그레이션 시작...');
  console.log('  ⚠️  joinedAt 필드 보존 중요!');

  const snapshot = await db.collection('organizationMembers').get();
  const members = [];
  let joinedAtMissingCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();

    // ⚠️ joinedAt이 없는 경우 경고
    if (!data.joinedAt) {
      joinedAtMissingCount++;
      console.warn(`  ⚠️  WARNING: ${doc.id} - joinedAt 필드 없음!`);
    }

    members.push({
      memberId: doc.id,
      organizationId: data.organizationId || '',
      userId: data.userId || '',
      role: data.role || 'member',
      joinedAt: convertTimestamp(data.joinedAt), // ⚠️ 중요: 원본 보존
      status: data.status || 'active',
    });
  });

  console.log(`  📊 마이그레이션할 멤버: ${members.length}명`);
  if (joinedAtMissingCount > 0) {
    console.log(`  ⚠️  joinedAt 누락: ${joinedAtMissingCount}명`);
  }

  const result = await batchWrite(process.env.DYNAMODB_MEMBERS_TABLE!, members);
  console.log(`  ✅ organizationMembers 마이그레이션 완료: ${result.successCount}명 성공, ${result.failCount}명 실패`);

  return { total: members.length, missingJoinedAt: joinedAtMissingCount, ...result };
}

// 4. org_schedules → mokoji-schedules
async function migrateSchedules() {
  console.log('\n📋 4/5: org_schedules → mokoji-schedules 마이그레이션 시작...');

  const snapshot = await db.collection('org_schedules').get();
  const schedules = [];
  let skippedCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();

    // organizationId가 없거나 빈 문자열인 경우 건너뛰기 (DynamoDB 인덱스 제약)
    if (!data.organizationId || data.organizationId.trim() === '') {
      console.warn(`  ⚠️  ${doc.id} - organizationId 없음, 건너뜀`);
      skippedCount++;
      return;
    }

    // participants 배열을 평문 객체로 변환
    const participants = (data.participants || []).map((p: any) => {
      if (typeof p === 'string') return { userId: p };

      return {
        userId: p.userId || p.uid || '',
        name: p.name || '',
        joinedAt: p.joinedAt ? convertTimestamp(p.joinedAt) : undefined,
      };
    });

    schedules.push({
      scheduleId: doc.id,
      organizationId: data.organizationId,
      title: data.title || '',
      date: data.date || '',
      time: data.time || '',
      location: data.location || '',
      participants,
      maxParticipants: data.maxParticipants || 0,
      createdBy: data.createdBy || '',
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    });
  });

  console.log(`  📊 마이그레이션할 일정: ${schedules.length}개 (건너뜀: ${skippedCount}개)`);

  const result = await batchWrite(process.env.DYNAMODB_SCHEDULES_TABLE!, schedules);
  console.log(`  ✅ org_schedules 마이그레이션 완료: ${result.successCount}개 성공, ${result.failCount}개 실패`);

  return { total: schedules.length + skippedCount, skipped: skippedCount, ...result };
}

// 5. org_activity_logs → mokoji-activity-logs
async function migrateActivityLogs() {
  console.log('\n📋 5/5: org_activity_logs → mokoji-activity-logs 마이그레이션 시작...');

  const snapshot = await db.collection('org_activity_logs').get();
  const logs = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    logs.push({
      logId: doc.id,
      organizationId: data.organizationId || '',
      userId: data.userId || '',
      userName: data.userName || '',
      action: data.action || '',
      details: data.details || {},
      timestamp: convertTimestamp(data.timestamp),
    });
  });

  console.log(`  📊 마이그레이션할 로그: ${logs.length}개`);

  const result = await batchWrite(process.env.DYNAMODB_ACTIVITY_LOGS_TABLE!, logs);
  console.log(`  ✅ org_activity_logs 마이그레이션 완료: ${result.successCount}개 성공, ${result.failCount}개 실패`);

  return { total: logs.length, ...result };
}

// 메인 마이그레이션 실행
async function main() {
  console.log('🚀 Firebase → DynamoDB 마이그레이션 시작...');
  console.log('');
  console.log('⚠️  경고: 이 작업은 되돌릴 수 없습니다!');
  console.log('⚠️  마이그레이션 전에 반드시 백업을 실행했는지 확인하세요: npm run backup:members');
  console.log('');
  console.log('10초 후에 시작합니다... (Ctrl+C로 취소)');

  await new Promise(resolve => setTimeout(resolve, 10000));

  const startTime = Date.now();
  const results = {
    users: { total: 0, successCount: 0, failCount: 0 },
    organizations: { total: 0, successCount: 0, failCount: 0 },
    members: { total: 0, successCount: 0, failCount: 0, missingJoinedAt: 0 },
    schedules: { total: 0, successCount: 0, failCount: 0 },
    activityLogs: { total: 0, successCount: 0, failCount: 0 },
  };

  try {
    results.users = await migrateUsers();
    results.organizations = await migrateOrganizations();
    results.members = await migrateOrganizationMembers();
    results.schedules = await migrateSchedules();
    results.activityLogs = await migrateActivityLogs();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n🎉 마이그레이션 완료!');
    console.log('');
    console.log('📊 마이그레이션 결과:');
    console.log(`  1. Users: ${results.users.successCount}/${results.users.total} 성공`);
    console.log(`  2. Organizations: ${results.organizations.successCount}/${results.organizations.total} 성공`);
    console.log(`  3. Members: ${results.members.successCount}/${results.members.total} 성공 (joinedAt 누락: ${results.members.missingJoinedAt}명)`);
    console.log(`  4. Schedules: ${results.schedules.successCount}/${results.schedules.total} 성공`);
    console.log(`  5. Activity Logs: ${results.activityLogs.successCount}/${results.activityLogs.total} 성공`);
    console.log('');
    console.log(`⏱️  소요 시간: ${duration}초`);
    console.log('');

    // 결과 파일로 저장
    const reportDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `migration-report-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      results
    }, null, 2));

    console.log(`📝 마이그레이션 보고서: ${reportPath}`);
    console.log('');
    console.log('다음 단계:');
    console.log('1. DynamoDB에서 데이터 확인');
    console.log('2. Firebase Auth → Cognito 사용자 마이그레이션: npm run migrate:users-to-cognito');
    console.log('3. Lambda Functions 배포');

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
