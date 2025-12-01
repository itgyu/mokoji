import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
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

// Cognito 클라이언트
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const USER_POOL_ID = process.env.AWS_COGNITO_USER_POOL_ID;

interface MigrationResult {
  userId: string;
  email: string;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  temporaryPassword?: string;
}

// 임시 비밀번호 생성 (8자 이상, 대소문자+숫자 포함)
function generateTemporaryPassword(): string {
  const randomBytes = crypto.randomBytes(8);
  const password = randomBytes.toString('base64').slice(0, 12);
  // Cognito 요구사항: 대문자, 소문자, 숫자
  return `Temp${password}123`;
}

async function createCognitoUser(userId: string, email: string, name: string): Promise<MigrationResult> {
  try {
    // 1. Cognito에 사용자 생성
    const tempPassword = generateTemporaryPassword();

    await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      TemporaryPassword: tempPassword,
      MessageAction: 'SUPPRESS', // 이메일 발송 안함 (나중에 일괄 발송)
    }));

    // 2. 비밀번호를 영구적으로 설정 (첫 로그인 시 변경 불필요)
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: tempPassword,
      Permanent: false, // 사용자가 첫 로그인 시 변경하도록
    }));

    console.log(`  ✅ ${email} - 생성 완료`);

    return {
      userId,
      email,
      name,
      status: 'success',
      temporaryPassword: tempPassword,
    };

  } catch (error: any) {
    if (error.name === 'UsernameExistsException') {
      console.log(`  ⏭️  ${email} - 이미 존재함 (건너뜀)`);
      return {
        userId,
        email,
        name,
        status: 'skipped',
        error: 'Already exists',
      };
    }

    console.error(`  ❌ ${email} - 실패:`, error.message);
    return {
      userId,
      email,
      name,
      status: 'failed',
      error: error.message,
    };
  }
}

async function main() {
  console.log('🚀 Firebase Authentication → AWS Cognito 사용자 마이그레이션 시작...');
  console.log('');
  console.log('⚠️  이 작업은 모든 Firebase 사용자를 Cognito로 복사합니다.');
  console.log('⚠️  기존 Firebase 인증은 유지됩니다 (삭제되지 않음).');
  console.log('');

  if (!USER_POOL_ID) {
    console.error('❌ AWS_COGNITO_USER_POOL_ID가 설정되지 않았습니다.');
    console.error('   .env.aws 파일을 확인하세요.');
    process.exit(1);
  }

  console.log(`📋 User Pool ID: ${USER_POOL_ID}`);
  console.log('');
  console.log('5초 후에 시작합니다... (Ctrl+C로 취소)');

  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // Firebase에서 모든 사용자 프로필 가져오기
    const snapshot = await db.collection('userProfiles').get();
    const users: { userId: string; email: string; name: string }[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        users.push({
          userId: doc.id,
          email: data.email,
          name: data.name || data.email.split('@')[0],
        });
      }
    });

    console.log(`📊 마이그레이션할 사용자: ${users.length}명\n`);

    // 각 사용자를 Cognito로 마이그레이션
    const results: MigrationResult[] = [];

    for (const user of users) {
      const result = await createCognitoUser(user.userId, user.email, user.name);
      results.push(result);

      // Rate limiting 방지 (초당 10개)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 결과 집계
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log('\n🎉 마이그레이션 완료!');
    console.log('');
    console.log('📊 결과:');
    console.log(`  ✅ 성공: ${successCount}명`);
    console.log(`  ⏭️  건너뜀: ${skippedCount}명 (이미 존재)`);
    console.log(`  ❌ 실패: ${failedCount}명`);
    console.log('');

    // 결과를 파일로 저장
    const reportDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportPath = path.join(reportDir, `cognito-migration-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: users.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      results
    }, null, 2));

    console.log(`📝 마이그레이션 보고서: ${reportPath}`);
    console.log('');
    console.log('⚠️  중요 사항:');
    console.log('1. 임시 비밀번호는 위 보고서 파일에 저장되었습니다.');
    console.log('2. 사용자들에게 비밀번호 재설정 링크를 발송해야 합니다.');
    console.log('3. 기존 Firebase 인증은 아직 활성화되어 있습니다.');
    console.log('');
    console.log('다음 단계:');
    console.log('1. Cognito에서 사용자 확인');
    console.log('2. 프론트엔드 인증 코드를 Cognito로 전환');
    console.log('3. 테스트 후 Firebase Auth 비활성화');

    // 실패한 사용자 목록 출력
    if (failedCount > 0) {
      console.log('');
      console.log('❌ 실패한 사용자:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.email}: ${r.error}`);
      });
    }

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
