// 천호역 쪽갈비벙 일정의 orgId 수정 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
};

async function fixScheduleOrgId() {
  console.log('🔧 일정 orgId 수정 시작...\n');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const scheduleId = 'ySFD8dN20avLztWqOHGF'; // 천호역 쪽갈비벙 일정 ID
  const correctOrgId = 'LDOcG25Y4SvxNqGifSek'; // 올바른 orgId

  try {
    const scheduleRef = doc(db, 'schedules', scheduleId);
    await updateDoc(scheduleRef, {
      orgId: correctOrgId
    });

    console.log('✅ 일정 orgId 수정 완료!');
    console.log(`   Schedule ID: ${scheduleId}`);
    console.log(`   새 orgId: ${correctOrgId}`);
    console.log('\n이제 대시보드를 새로고침하면 일정이 보일 겁니다!');
  } catch (error) {
    console.error('❌ 수정 실패:', error);
  }
}

fixScheduleOrgId().catch(console.error);
