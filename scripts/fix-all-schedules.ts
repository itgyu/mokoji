import { db } from '../lib/firebase'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'

async function fixAllSchedules() {
  console.log('🔧 모든 일정을 "무주 낙화 백패킹" 일정과 동일하게 수정 시작...\n');

  try {
    // 1. "무주 낙화 백패킹" 일정 찾기 (가장 많이 접근된 일정)
    const referenceScheduleId = '4HkLZaaaOCmTBhmVP8Ef';
    console.log(`📋 참조 일정 ID: ${referenceScheduleId}`);

    const refScheduleDoc = await getDoc(doc(db, 'org_schedules', referenceScheduleId));

    if (!refScheduleDoc.exists()) {
      console.error('❌ 참조 일정을 찾을 수 없습니다.');
      process.exit(1);
    }

    const referenceSchedule = refScheduleDoc.data();
    console.log('✅ 참조 일정 데이터:');
    console.log(JSON.stringify(referenceSchedule, null, 2));
    console.log('\n');

    // 2. 모든 일정 가져오기
    const schedulesSnapshot = await getDocs(collection(db, 'org_schedules'));
    console.log(`📊 총 ${schedulesSnapshot.size}개의 일정 발견\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 3. 각 일정을 참조 일정과 동일하게 업데이트
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const scheduleId = scheduleDoc.id;
      const scheduleData = scheduleDoc.data();

      // 참조 일정은 건너뛰기
      if (scheduleId === referenceScheduleId) {
        console.log(`⏭️  ${scheduleData.title || scheduleId} - 참조 일정이므로 건너뜀`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 처리 중: ${scheduleData.title || scheduleId}`);

      // 업데이트할 필드들 (참조 일정의 구조 복사)
      const updateData: any = {
        hasChat: referenceSchedule?.hasChat ?? true, // 채팅 기능 활성화
        updatedAt: new Date(),
      };

      // 참조 일정에 있는 다른 중요 필드들도 복사
      if (referenceSchedule?.hasOwnProperty('participantLimit')) {
        updateData.participantLimit = referenceSchedule.participantLimit;
      }

      try {
        // 기존 필드는 유지하면서 업데이트
        await updateDoc(doc(db, 'org_schedules', scheduleId), updateData);
        console.log(`  ✅ 업데이트 완료: hasChat=${updateData.hasChat}`);
        updatedCount++;
      } catch (error) {
        console.error(`  ❌ 업데이트 실패:`, error);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 모든 일정 수정 완료!');
    console.log(`📊 총 ${schedulesSnapshot.size}개 일정`);
    console.log(`   - 업데이트: ${updatedCount}개`);
    console.log(`   - 건너뜀: ${skippedCount}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  }
}

// 실행
fixAllSchedules()
  .then(() => {
    console.log('🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  });
