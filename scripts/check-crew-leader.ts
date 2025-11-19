import { db } from '../lib/firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'

async function checkCrewLeader() {
  console.log('👑 크루장 정보 확인 중...\n');

  try {
    // 1. 모든 일정 가져오기
    const schedulesSnapshot = await getDocs(collection(db, 'org_schedules'));
    console.log(`📊 총 ${schedulesSnapshot.size}개의 일정 발견\n`);

    const orgIds = new Set<string>();

    // 각 일정의 organization 정보 수집
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      if (scheduleData.organizationId) {
        orgIds.add(scheduleData.organizationId);
      }

      console.log(`📅 일정: ${scheduleData.title}`);
      console.log(`   - 일정 ID: ${scheduleDoc.id}`);
      console.log(`   - 작성자 UID: ${scheduleData.createdByUid || scheduleData.createdBy || '없음'}`);
      console.log(`   - 조직 ID: ${scheduleData.organizationId || '없음'}`);
      console.log('');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 크루(조직) 정보:\n');

    // 2. 각 조직의 크루장 정보 가져오기
    for (const orgId of orgIds) {
      try {
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          console.log(`🏕️  크루: ${orgData.name}`);
          console.log(`   - 조직 ID: ${orgId}`);
          console.log(`   - 크루장 UID: ${orgData.ownerUid || '없음'}`);
          console.log(`   - 크루장 이름: ${orgData.ownerName || '없음'}`);
          console.log('');
        } else {
          console.log(`⚠️  조직 ${orgId}을(를) 찾을 수 없습니다.\n`);
        }
      } catch (error) {
        console.error(`❌ 조직 ${orgId} 조회 실패:`, error);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  }
}

// 실행
checkCrewLeader()
  .then(() => {
    console.log('🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  });
