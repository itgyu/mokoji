const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'it-s-campers-95640'
  });
}

const db = admin.firestore();

async function migrateSchedule() {
  try {
    console.log('🔍 org_schedules 컬렉션에서 일정 찾는 중...');

    const orgSchedulesSnapshot = await db.collection('org_schedules').get();

    if (orgSchedulesSnapshot.empty) {
      console.log('❌ org_schedules 컬렉션에 일정이 없습니다.');
      return;
    }

    console.log(`✅ ${orgSchedulesSnapshot.size}개의 일정을 발견했습니다.`);

    const batch = db.batch();
    const movedSchedules = [];

    for (const doc of orgSchedulesSnapshot.docs) {
      const data = doc.data();

      // schedules 컬렉션에 복사 (ID 제거)
      const { organizationId, ...scheduleData } = data;
      const newScheduleRef = db.collection('schedules').doc();

      batch.set(newScheduleRef, {
        ...scheduleData,
        // organizationId를 orgId로 변경 (기존 구조 유지)
        ...(organizationId && { orgId: organizationId })
      });

      // org_schedules에서 삭제
      batch.delete(doc.ref);

      movedSchedules.push({
        id: doc.id,
        title: data.title,
        date: data.date
      });
    }

    await batch.commit();

    console.log('✅ 일정 이동 완료!');
    console.log('이동된 일정:');
    movedSchedules.forEach(schedule => {
      console.log(`  - ${schedule.title} (${schedule.date})`);
    });

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  }
}

migrateSchedule();
