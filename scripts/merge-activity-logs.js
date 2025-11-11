// Firebase 컬렉션 통합 스크립트: org_activityLogs -> activityLogs
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

async function mergeActivityLogs() {
  console.log('🔄 활동 로그 컬렉션 통합 시작...\n');

  try {
    // 1. activityLogs 컬렉션 확인
    console.log('📋 Step 1: activityLogs 컬렉션 확인');
    const activityLogsRef = collection(db, 'activityLogs');
    const activityLogsSnapshot = await getDocs(activityLogsRef);
    console.log(`  - activityLogs 문서 수: ${activityLogsSnapshot.size}개`);

    const activityLogsData = [];
    activityLogsSnapshot.forEach((doc) => {
      activityLogsData.push({ id: doc.id, ...doc.data() });
      const data = doc.data();
      console.log(`    • ${doc.id}: ${data.action || 'N/A'} - ${data.userName || 'Unknown'}`);
    });

    // 2. org_activityLogs 컬렉션 확인
    console.log('\n📋 Step 2: org_activityLogs 컬렉션 확인');
    const orgActivityLogsRef = collection(db, 'org_activityLogs');
    const orgActivityLogsSnapshot = await getDocs(orgActivityLogsRef);
    console.log(`  - org_activityLogs 문서 수: ${orgActivityLogsSnapshot.size}개`);

    const orgActivityLogsData = [];
    orgActivityLogsSnapshot.forEach((doc) => {
      orgActivityLogsData.push({ id: doc.id, ...doc.data() });
      const data = doc.data();
      console.log(`    • ${doc.id}: ${data.action || 'N/A'} - ${data.userName || 'Unknown'}`);
    });

    // 3. 통합 계획
    console.log('\n📊 Step 3: 통합 계획');
    console.log(`  - activityLogs에 있는 문서: ${activityLogsData.length}개`);
    console.log(`  - org_activityLogs에 있는 문서: ${orgActivityLogsData.length}개`);

    if (orgActivityLogsData.length === 0) {
      console.log('\n✅ org_activityLogs가 비어있습니다. activityLogs만 사용하면 됩니다.');
      console.log('\n🗑️  org_activityLogs 컬렉션 정리 완료');
      process.exit(0);
      return;
    }

    // 4. org_activityLogs 데이터를 activityLogs로 복사
    console.log('\n🔄 Step 4: org_activityLogs -> activityLogs 데이터 복사');

    let copiedCount = 0;
    let skippedCount = 0;

    for (const log of orgActivityLogsData) {
      const logId = log.id;
      const logData = { ...log };
      delete logData.id; // id 필드 제거 (문서 ID로만 사용)

      // activityLogs에 이미 같은 ID가 있는지 확인
      const existingDoc = activityLogsData.find(l => l.id === logId);

      if (existingDoc) {
        console.log(`  ⚠️  ${logId} - 이미 activityLogs에 존재, 건너뜀`);
        skippedCount++;
        continue;
      }

      // activityLogs로 복사
      const newDocRef = doc(db, 'activityLogs', logId);
      await setDoc(newDocRef, logData);
      console.log(`  ✅ ${logId} - 복사 완료`);
      copiedCount++;
    }

    console.log(`\n📊 복사 결과: ${copiedCount}개 복사, ${skippedCount}개 건너뜀`);

    // 5. org_activityLogs 문서 삭제
    console.log('\n🗑️  Step 5: org_activityLogs 문서 삭제');

    for (const log of orgActivityLogsData) {
      const docRef = doc(db, 'org_activityLogs', log.id);
      await deleteDoc(docRef);
      console.log(`  🗑️  ${log.id} - 삭제 완료`);
    }

    console.log('\n✅ 통합 완료!');
    console.log(`  - 최종 activityLogs 문서 수: ${activityLogsData.length + copiedCount}개`);
    console.log('  - org_activityLogs 컬렉션: 비어있음 (안전하게 무시 가능)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

mergeActivityLogs();
