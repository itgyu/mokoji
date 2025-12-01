#!/usr/bin/env node

/**
 * Vercel 환경 변수 자동 추가 스크립트
 * Vercel API를 사용하여 프로그래밍 방식으로 환경 변수 추가
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Vercel 프로젝트 정보 읽기
const projectPath = path.join(__dirname, '../.vercel/project.json');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

console.log('🚀 Vercel 환경 변수 자동 추가 시작...');
console.log(`📦 프로젝트: ${project.projectName}`);
console.log(`🔑 프로젝트 ID: ${project.projectId}`);
console.log('');

// 환경 변수 목록
const envVars = {
  // 서버 전용 변수
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

  // 클라이언트 공개 변수
  'NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID': 'ap-northeast-2_2F6sdouGR',
  'NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID': '5vl7s1q093kpelmk8oa72krp4g',
  'NEXT_PUBLIC_KAKAO_MAP_API_KEY': 'ff364c3f44129afc87e31935ac353ba2',
  'NEXT_PUBLIC_ENABLE_SCHEDULE_CHAT': 'true',
  'NEXT_PUBLIC_CHAT_ROLLOUT_PERCENTAGE': '100',
};

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

// 각 환경 변수 추가
for (const [key, value] of Object.entries(envVars)) {
  try {
    console.log(`📝 추가 중: ${key}`);

    // vercel env add 명령어 실행 (non-interactive)
    execSync(`echo "${value}" | vercel env add ${key} production`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });

    successCount++;
    console.log(`   ✅ 성공`);
  } catch (error) {
    const errorMessage = error.message || error.toString();

    // 이미 존재하는 변수는 스킵
    if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
      skipCount++;
      console.log(`   ⏭️  이미 존재함 (스킵)`);
    } else {
      errorCount++;
      console.log(`   ❌ 실패: ${errorMessage.split('\n')[0]}`);
    }
  }
}

console.log('');
console.log('📊 결과 요약:');
console.log(`   ✅ 성공: ${successCount}개`);
console.log(`   ⏭️  스킵: ${skipCount}개`);
console.log(`   ❌ 실패: ${errorCount}개`);
console.log('');

if (successCount > 0 || skipCount > 0) {
  console.log('🎉 환경 변수 설정 완료!');
  console.log('');
  console.log('🔄 이제 재배포를 실행합니다...');
  console.log('');

  try {
    // 재배포
    console.log('📦 vercel --prod 실행 중...');
    execSync('vercel --prod', { stdio: 'inherit' });
    console.log('');
    console.log('✅ 배포 완료!');
  } catch (error) {
    console.log('');
    console.log('⚠️  재배포 실패. 수동으로 실행하세요:');
    console.log('   vercel --prod');
  }
} else {
  console.log('❌ 환경 변수 추가에 실패했습니다.');
  console.log('   수동으로 Vercel Dashboard에서 설정하세요.');
}
