#!/usr/bin/env node

/**
 * 모든 환경(Production, Preview, Development)에 환경 변수 추가
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '../.vercel/project.json');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

console.log('🚀 모든 환경에 환경 변수 추가 시작...');
console.log(`📦 프로젝트: ${project.projectName}`);
console.log('');

const envVars = {
  'AWS_REGION': 'ap-northeast-2',
  'AWS_ACCESS_KEY_ID': 'AKIA******************',
  'AWS_SECRET_ACCESS_KEY': '****************************************',
  'AWS_S3_BUCKET': 'mokoji',
  'AWS_COGNITO_USER_POOL_ID': 'ap-northeast-2_2F6sdouGR',
  'AWS_COGNITO_CLIENT_ID': '5vl7s1q093kpelmk8oa72krp4g',
  'DYNAMODB_USERS_TABLE': 'mokoji-users',
  'DYNAMODB_ORGANIZATIONS_TABLE': 'mokoji-organizations',
  'DYNAMODB_MEMBERS_TABLE': 'mokoji-organization-members',
  'DYNAMODB_SCHEDULES_TABLE': 'mokoji-schedules',
  'DYNAMODB_ACTIVITY_LOGS_TABLE': 'mokoji-activity-logs',
  'DYNAMODB_PHOTOS_TABLE': 'mokoji-photos',
  'NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID': 'ap-northeast-2_2F6sdouGR',
  'NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID': '5vl7s1q093kpelmk8oa72krp4g',
  'NEXT_PUBLIC_KAKAO_MAP_API_KEY': 'ff364c3f44129afc87e31935ac353ba2',
  'NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT': 'true',
  'NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE': '100',
};

const environments = ['production', 'preview', 'development'];
let totalSuccess = 0;
let totalSkip = 0;

for (const env of environments) {
  console.log(`📝 ${env.toUpperCase()} 환경 설정 중...`);

  for (const [key, value] of Object.entries(envVars)) {
    try {
      execSync(`echo "${value}" | vercel env add ${key} ${env}`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      totalSuccess++;
    } catch (error) {
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        totalSkip++;
      }
    }
  }

  console.log(`   ✅ ${env} 완료\n`);
}

console.log('📊 최종 결과:');
console.log(`   ✅ 성공: ${totalSuccess}개`);
console.log(`   ⏭️  스킵: ${totalSkip}개`);
console.log('');
console.log('🔄 재배포 실행 중...');

try {
  execSync('vercel --prod --force', { stdio: 'inherit' });
  console.log('✅ 배포 완료!');
} catch (error) {
  console.log('⚠️  수동 재배포 필요: vercel --prod');
}
