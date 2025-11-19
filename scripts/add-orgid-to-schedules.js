// Mokoji - Firebase schedules 컬렉션에 orgId 추가 스크립트
// orgId가 없는 모든 일정에 기본 크루 ID를 추가합니다.

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mokoji Default Crew ID
const DEFAULT_ORG_ID = 'LDOcG25Y4SvxNqGifSek';

async function addOrgIdToSchedules() {
  console.log('🔄 schedules 컬렉션에 orgId 추가 시작...\n');

  try {
    // schedules 컬렉션 확인
    console.log('📋 Step 1: schedules 컬렉션 확인');
    const schedulesRef = collection(db, 'schedules');
    const schedulesSnapshot = await getDocs(schedulesRef);
    console.log(`  - schedules 문서 수: ${schedulesSnapshot.size}개\n`);

    let withOrgId = 0;
    let withoutOrgId = 0;
    const needsUpdate = [];

    schedulesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.orgId) {
        withOrgId++;
      } else {
        withoutOrgId++;
        needsUpdate.push({ id: doc.id, title: data.title || 'Untitled' });
      }
    });

    console.log('📊 Step 2: orgId 상태 확인');
    console.log(`  ✅ orgId가 있는 일정: ${withOrgId}개`);
    console.log(`  ⚠️  orgId가 없는 일정: ${withoutOrgId}개\n`);

    if (withoutOrgId === 0) {
      console.log('✅ 모든 일정에 orgId가 이미 있습니다!');
      process.exit(0);
      return;
    }

    console.log('🔄 Step 3: orgId 추가 작업 시작');
    console.log(`  - 기본 orgId: ${DEFAULT_ORG_ID}\n`);

    let updatedCount = 0;

    for (const schedule of needsUpdate) {
      const scheduleRef = doc(db, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        orgId: DEFAULT_ORG_ID
      });
      console.log(`  ✅ ${schedule.id} (${schedule.title}) - orgId 추가 완료`);
      updatedCount++;
    }

    console.log(`\n📊 업데이트 결과: ${updatedCount}개 일정에 orgId 추가 완료`);
    console.log(`\n✅ 완료! 이제 모든 일정(${schedulesSnapshot.size}개)이 표시됩니다.`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

addOrgIdToSchedules();
