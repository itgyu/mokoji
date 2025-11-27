import * as admin from 'firebase-admin'
import * as path from 'path'

// Firebase Admin 초기화
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../new-firebase-key.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const adminDb = admin.firestore()

async function checkCrewIds() {
  console.log('🔍 모든 members의 crewId 확인 중...\n')

  try {
    const membersSnapshot = await adminDb.collection('members').get()

    const withCrewId: any[] = []
    const withoutCrewId: any[] = []

    membersSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.crewId) {
        withCrewId.push({
          docId: doc.id,
          uid: data.uid,
          name: data.name,
          crewId: data.crewId,
        })
      } else {
        withoutCrewId.push({
          docId: doc.id,
          uid: data.uid,
          name: data.name,
          email: data.email,
        })
      }
    })

    console.log(`📊 통계:`)
    console.log(`   전체: ${membersSnapshot.size}`)
    console.log(`   crewId 있음: ${withCrewId.length}`)
    console.log(`   crewId 없음: ${withoutCrewId.length}\n`)

    if (withoutCrewId.length > 0) {
      console.log(`⚠️  crewId가 없는 사용자들:`)
      withoutCrewId.forEach((member, idx) => {
        console.log(`   ${idx + 1}. ${member.name} (${member.uid})`)
        console.log(`      문서 ID: ${member.docId}`)
        console.log(`      email: ${member.email}`)
        console.log('')
      })
    }

    if (withCrewId.length > 0) {
      console.log(`\n✅ crewId가 있는 사용자 샘플 (처음 3명):`)
      withCrewId.slice(0, 3).forEach((member, idx) => {
        console.log(`   ${idx + 1}. ${member.name} (${member.uid})`)
        console.log(`      crewId: ${member.crewId}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

checkCrewIds()
  .then(() => {
    console.log('\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 실패:', error)
    process.exit(1)
  })
