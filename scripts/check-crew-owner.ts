import * as admin from 'firebase-admin'

const serviceAccount = require('../new-firebase-key.json')
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = app.firestore()

async function checkCrewOwner() {
  console.log('🔍 크루장 확인 시작\n')

  try {
    // 모든 크루 가져오기
    const orgsSnapshot = await db.collection('organizations').get()
    console.log(`📋 총 ${orgsSnapshot.size}개의 크루 발견\n`)

    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data()
      console.log(`\n크루: ${orgData.name}`)
      console.log(`  - ID: ${orgDoc.id}`)
      console.log(`  - 크루장 UID: ${orgData.ownerUid}`)
      console.log(`  - 크루장 이름: ${orgData.ownerName}`)

      // 이 크루의 멤버들 확인
      const membersSnapshot = await db
        .collection('members')
        .where('orgId', '==', orgDoc.id)
        .get()

      console.log(`  - 멤버 수: ${membersSnapshot.size}명`)

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data()
        const isCaptain = memberData.uid === orgData.ownerUid
        console.log(`    ${isCaptain ? '👑' : '  '} ${memberData.name} (${memberData.uid})`)
      }
    }

    console.log('\n✅ 완료!')
  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await app.delete()
  }
}

checkCrewOwner()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
