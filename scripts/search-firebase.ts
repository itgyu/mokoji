import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// OLD Firebase (it-s-campers-95640)
const oldServiceAccount = require('/Users/taegyulee/Downloads/old-firebase-key.json');
const oldApp = initializeApp({
  credential: cert(oldServiceAccount)
}, 'old-firebase');

const oldDb = getFirestore(oldApp);

// NEW Firebase (mokojiya)
const newServiceAccount = require(path.join(__dirname, '../new-firebase-key.json'));
const newApp = initializeApp({
  credential: cert(newServiceAccount)
}, 'new-firebase');

const newDb = getFirestore(newApp);

async function searchInDb(db: FirebaseFirestore.Firestore, dbName: string) {
  console.log(`\n========== ${dbName} ==========`);

  const schedulesRef = db.collection('schedules');
  const snapshot = await schedulesRef.get();

  console.log('schedules 총:', snapshot.size, '개');

  let foundBangeo = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('방어')) {
      foundBangeo = true;
      console.log('\n=== 방어 발견! ===');
      console.log('ID:', doc.id);
      console.log('title:', data.title);
      console.log('date:', data.date, '| dateISO:', data.dateISO);
      console.log('participants:', data.participants?.length, '명');
      if (data.participants) {
        data.participants.forEach((p: any) => {
          console.log('  -', p.userName || p.name || p);
        });
      }
    }
  });

  if (!foundBangeo) {
    console.log('방어 포함 일정 없음');
  }

  // 12/20 일정 확인
  console.log('\n12/20 일정:');
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.dateISO === '2025-12-20' || data.date?.includes('12/20')) {
      console.log('-', data.title, '| ID:', doc.id, '| participants:', data.participants?.length);
    }
  });

  // 최근 생성된 일정 확인
  console.log('\n최근 생성된 일정 (createdAt 순):');
  const allDocs: any[] = [];
  snapshot.forEach(doc => {
    allDocs.push({ id: doc.id, ...doc.data() });
  });
  allDocs
    .filter(d => d.createdAt)
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return bTime - aTime;
    })
    .slice(0, 5)
    .forEach(d => {
      const created = d.createdAt?.toDate?.() || new Date(d.createdAt);
      console.log(created.toLocaleString('ko-KR'), '|', d.title);
    });
}

async function main() {
  await searchInDb(oldDb, 'OLD Firebase (it-s-campers-95640)');
  await searchInDb(newDb, 'NEW Firebase (mokojiya)');
}

main();
