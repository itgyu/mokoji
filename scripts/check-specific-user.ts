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

async function checkSpecificUser() {
  const targetUid = 'sTM4WZrenzXkWf7Kfx6A7bJVhWF2'
  console.log(`🔍 사용자 ${targetUid} 상세 데이터 확인 중...\n`)

  try {
    // 1. members 컬렉션에서 이 uid를 가진 문서 찾기
    console.log('📦 1. members 컬렉션:')
    const membersSnapshot = await adminDb.collection('members')
      .where('uid', '==', targetUid)
      .get()

    if (membersSnapshot.empty) {
      console.log('   ❌ 데이터 없음')
    } else {
      membersSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        console.log(`   문서 ID: ${doc.id}`)
        console.log('   전체 데이터:')
        console.log(JSON.stringify(data, null, 2))
      })
    }

    // 2. organizationMembers 컬렉션
    console.log('\n📦 2. organizationMembers 컬렉션:')
    const orgMembersSnapshot = await adminDb.collection('organizationMembers')
      .where('userId', '==', targetUid)
      .get()

    if (orgMembersSnapshot.empty) {
      console.log('   ❌ 데이터 없음')
    } else {
      orgMembersSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        console.log(`   문서 ID: ${doc.id}`)
        console.log('   전체 데이터:')
        console.log(JSON.stringify(data, null, 2))
      })
    }

    // 3. userProfiles 컬렉션
    console.log('\n📦 3. userProfiles 컬렉션:')
    const profileDoc = await adminDb.collection('userProfiles').doc(targetUid).get()

    if (!profileDoc.exists) {
      console.log('   ❌ 데이터 없음')
    } else {
      const data = profileDoc.data()
      console.log(`   문서 ID: ${profileDoc.id}`)
      console.log('   전체 데이터:')
      console.log(JSON.stringify(data, null, 2))
    }

    // 4. crews 컬렉션에서 이 사용자가 속한 크루 찾기
    console.log('\n📦 4. crews 컬렉션 (이 사용자가 속한 크루):')

    // 먼저 members에서 crewId 가져오기
    const memberDoc = membersSnapshot.docs[0]
    const memberData = memberDoc?.data()
    const crewId = memberData?.crewId
    const organizationId = memberData?.organizationId

    if (crewId) {
      console.log(`   crewId: ${crewId}`)
      const crewDoc = await adminDb.collection('crews').doc(crewId).get()

      if (crewDoc.exists) {
        const crewData = crewDoc.data()
        console.log('   크루 데이터:')
        console.log(JSON.stringify(crewData, null, 2))
      } else {
        console.log('   ⚠️  crewId는 있지만 crews 컬렉션에 해당 문서가 없음!')
      }
    } else {
      console.log('   ⚠️  members에 crewId가 없음')
    }

    // 5. 같은 organizationId를 가진 다른 사용자와 비교
    if (organizationId) {
      console.log(`\n📦 5. 같은 조직의 다른 사용자 샘플 (비교용):`)
      console.log(`   organizationId: ${organizationId}`)

      const otherMembersSnapshot = await adminDb.collection('members')
        .where('organizationId', '==', organizationId)
        .where('uid', '!=', targetUid)
        .limit(2)
        .get()

      if (!otherMembersSnapshot.empty) {
        otherMembersSnapshot.docs.forEach((doc, idx) => {
          const data = doc.data()
          console.log(`\n   ${idx + 1}. ${data.name} (${data.uid}):`)
          console.log(`      문서 ID: ${doc.id}`)
          console.log(`      crewId: ${data.crewId || '없음'}`)
          console.log(`      email: ${data.email}`)
          console.log(`      phone: ${data.phone || '없음'}`)
          console.log(`      profileImage: ${data.profileImage || '없음'}`)
        })
      }
    }

    // 6. Auth 사용자 정보 확인
    console.log('\n📦 6. Firebase Auth 사용자 정보:')
    try {
      const userRecord = await admin.auth().getUser(targetUid)
      console.log(`   uid: ${userRecord.uid}`)
      console.log(`   email: ${userRecord.email}`)
      console.log(`   displayName: ${userRecord.displayName}`)
      console.log(`   emailVerified: ${userRecord.emailVerified}`)
      console.log(`   disabled: ${userRecord.disabled}`)
    } catch (error: any) {
      console.log(`   ❌ Auth 사용자를 찾을 수 없음: ${error.message}`)
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

checkSpecificUser()
  .then(() => {
    console.log('\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 실패:', error)
    process.exit(1)
  })
