// Firebase 컬렉션 통합 스크립트: org_schedules -> schedules
// 데이터를 유실하지 않고 안전하게 통합합니다.

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');

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

async function mergeSchedules() {
  console.log('🔄 일정 컬렉션 통합 시작...\n');

  try {
    // 1. schedules 컬렉션 확인
    console.log('📋 Step 1: schedules 컬렉션 확인');
    const schedulesRef = collection(db, 'schedules');
    const schedulesSnapshot = await getDocs(schedulesRef);
    console.log(`  - schedules 문서 수: ${schedulesSnapshot.size}개`);

    const schedulesData = [];
    schedulesSnapshot.forEach((doc) => {
      schedulesData.push({ id: doc.id, ...doc.data() });
      console.log(`    • ${doc.id}: ${doc.data().title || 'Untitled'}`);
    });

    // 2. org_schedules 컬렉션 확인
    console.log('\n📋 Step 2: org_schedules 컬렉션 확인');
    const orgSchedulesRef = collection(db, 'org_schedules');
    const orgSchedulesSnapshot = await getDocs(orgSchedulesRef);
    console.log(`  - org_schedules 문서 수: ${orgSchedulesSnapshot.size}개`);

    const orgSchedulesData = [];
    orgSchedulesSnapshot.forEach((doc) => {
      orgSchedulesData.push({ id: doc.id, ...doc.data() });
      console.log(`    • ${doc.id}: ${doc.data().title || 'Untitled'}`);
    });

    // 3. 통합 계획
    console.log('\n📊 Step 3: 통합 계획');
    console.log(`  - schedules에 있는 문서: ${schedulesData.length}개`);
    console.log(`  - org_schedules에 있는 문서: ${orgSchedulesData.length}개`);

    if (orgSchedulesData.length === 0) {
      console.log('\n✅ org_schedules가 비어있습니다. schedules만 사용하면 됩니다.');

      // org_schedules 컬렉션 삭제 (문서가 없더라도 시도)
      console.log('\n🗑️  org_schedules 컬렉션 정리 완료');
      return;
    }

    // 4. org_schedules 데이터를 schedules로 복사
    console.log('\n🔄 Step 4: org_schedules -> schedules 데이터 복사');

    let copiedCount = 0;
    let skippedCount = 0;

    for (const schedule of orgSchedulesData) {
      const scheduleId = schedule.id;
      const scheduleData = { ...schedule };
      delete scheduleData.id; // id 필드 제거 (문서 ID로만 사용)

      // schedules에 이미 같은 ID가 있는지 확인
      const existingDoc = schedulesData.find(s => s.id === scheduleId);

      if (existingDoc) {
        console.log(`  ⚠️  ${scheduleId} - 이미 schedules에 존재, 건너뜀`);
        skippedCount++;
        continue;
      }

      // schedules로 복사
      const newDocRef = doc(db, 'schedules', scheduleId);
      await setDoc(newDocRef, scheduleData);
      console.log(`  ✅ ${scheduleId} - 복사 완료`);
      copiedCount++;
    }

    console.log(`\n📊 복사 결과: ${copiedCount}개 복사, ${skippedCount}개 건너뜀`);

    // 5. org_schedules 문서 삭제
    console.log('\n🗑️  Step 5: org_schedules 문서 삭제');

    for (const schedule of orgSchedulesData) {
      const docRef = doc(db, 'org_schedules', schedule.id);
      await deleteDoc(docRef);
      console.log(`  🗑️  ${schedule.id} - 삭제 완료`);
    }

    console.log('\n✅ 통합 완료!');
    console.log(`  - 최종 schedules 문서 수: ${schedulesData.length + copiedCount}개`);
    console.log('  - org_schedules 컬렉션: 비어있음 (안전하게 무시 가능)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

mergeSchedules();
