const admin = require('firebase-admin');
const serviceAccount = require('../new-firebase-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findSchedule() {
  const orgId = 'LDOcG25Y4SvxNqGifSek';
  const schedulesRef = db.collection('organizations').doc(orgId).collection('schedules');
  const snapshot = await schedulesRef.get();

  console.log('Firebase 일정 수:', snapshot.size);
  console.log('\n전체 일정:');
  snapshot.forEach((doc: any) => {
    const data = doc.data();
    console.log('-', doc.id, ':', data.title);
  });
}

findSchedule().then(() => process.exit(0));
