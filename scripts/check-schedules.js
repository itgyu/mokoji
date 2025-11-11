// Firebase schedules 데이터 확인 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
};

async function checkSchedules() {
  console.log('🔍 Firebase schedules 조회 시작...\n');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const schedulesRef = collection(db, 'schedules');
  const snapshot = await getDocs(schedulesRef);

  console.log(`📊 전체 일정 수: ${snapshot.size}개\n`);

  const schedules = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    schedules.push({
      id: doc.id,
      ...data
    });
  });

  // 날짜순 정렬
  schedules.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  // 각 일정 출력
  schedules.forEach((schedule, index) => {
    console.log(`\n[${index + 1}] ${schedule.title || '제목없음'}`);
    console.log(`  📅 날짜: ${schedule.date || '날짜없음'}`);
    console.log(`  🏢 orgId: "${schedule.orgId}"`);
    console.log(`  🆔 ID: ${schedule.id}`);
    console.log(`  ⏰ 생성: ${schedule.createdAt || '정보없음'}`);
    if (schedule.participants) {
      console.log(`  👥 참가자: ${schedule.participants.length}명`);
    }
  });

  // orgId별 그룹화
  console.log('\n\n📊 orgId별 일정 수:');
  const byOrgId = {};
  schedules.forEach(s => {
    const orgId = s.orgId || 'null';
    byOrgId[orgId] = (byOrgId[orgId] || 0) + 1;
  });

  Object.entries(byOrgId).forEach(([orgId, count]) => {
    console.log(`  ${orgId}: ${count}개`);
  });

  // 11월 일정 필터
  console.log('\n\n📅 11월 일정:');
  const novSchedules = schedules.filter(s => s.date && s.date.startsWith('2024-11'));
  novSchedules.forEach(s => {
    console.log(`  ${s.date} - ${s.title} (orgId: ${s.orgId})`);
  });
}

checkSchedules().catch(console.error);
