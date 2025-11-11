// 배포 시 버전 정보 생성 스크립트
const fs = require('fs');
const path = require('path');

const versionData = {
  version: Date.now().toString(), // 타임스탬프를 버전으로 사용
  buildTime: new Date().toISOString(),
  env: process.env.NODE_ENV || 'production'
};

const outputPath = path.join(__dirname, '../public/version.json');

try {
  fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));
  console.log('✅ version.json 생성 완료!');
  console.log(`   버전: ${versionData.version}`);
  console.log(`   빌드 시간: ${versionData.buildTime}`);
} catch (error) {
  console.error('❌ version.json 생성 실패:', error);
  process.exit(1);
}
