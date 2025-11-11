// Firebase schedules 컬렉션의 벙주 필드 채우기 스크립트
// createdBy가 없는 일정들에 참석자 맨 앞 사람으로 벙주를 채웁니다.

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

async function fillScheduleCreators() {
  console.log('🔄 schedules 컬렉션의 벙주 필드 채우기 시작...\n');

  try {
    // schedules 컬렉션 확인
    console.log('📋 Step 1: schedules 컬렉션 확인');
    const schedulesRef = collection(db, 'schedules');
    const schedulesSnapshot = await getDocs(schedulesRef);
    console.log(`  - schedules 문서 수: ${schedulesSnapshot.size}개\n`);

    let withCreatedBy = 0;
    let withoutCreatedBy = 0;
    const needsUpdate = [];

    schedulesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.createdBy) {
        withCreatedBy++;
      } else {
        withoutCreatedBy++;
        needsUpdate.push({
          id: docSnapshot.id,
          title: data.title || 'Untitled',
          participants: data.participants || []
        });
      }
    });

    console.log('📊 Step 2: createdBy 상태 확인');
    console.log(`  ✅ createdBy가 있는 일정: ${withCreatedBy}개`);
    console.log(`  ⚠️  createdBy가 없는 일정: ${withoutCreatedBy}개\n`);

    if (withoutCreatedBy === 0) {
      console.log('✅ 모든 일정에 createdBy가 이미 있습니다!');
      process.exit(0);
      return;
    }

    console.log('🔄 Step 3: createdBy 추가 작업 시작\n');

    let updatedCount = 0;
    let skippedCount = 0;

    for (const schedule of needsUpdate) {
      const scheduleRef = doc(db, 'schedules', schedule.id);

      if (schedule.participants.length > 0) {
        const firstParticipant = schedule.participants[0];
        await updateDoc(scheduleRef, {
          createdBy: firstParticipant
        });
        console.log(`  ✅ ${schedule.id} (${schedule.title}) - 벙주: ${firstParticipant}`);
        updatedCount++;
      } else {
        console.log(`  ⚠️  ${schedule.id} (${schedule.title}) - 참석자 없음, 건너뜀`);
        skippedCount++;
      }
    }

    console.log(`\n📊 업데이트 결과: ${updatedCount}개 일정에 벙주 추가 완료, ${skippedCount}개 건너뜀`);
    console.log(`\n✅ 완료! 이제 ${updatedCount}개 일정에 벙주가 표시됩니다.`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

fillScheduleCreators();
