/**
 * 특정 사용자의 모든 데이터를 데이터베이스에서 완전히 삭제
 *
 * 삭제 대상:
 * - userProfiles 컬렉션
 * - members 컬렉션
 * - organizationMembers 컬렉션
 * - organizations의 pendingMembers 배열
 */

const admin = require('firebase-admin')
const path = require('path')

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../new-firebase-key.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()
const auth = admin.auth()

// 삭제할 사용자 정보
const TARGET_UID = 'sTM4WZrenzXkWf7Kfx6A7bJVhWF2'
const TARGET_EMAIL = 'wl0601@naver.com'

async function deleteUserCompletely() {
  console.log('🗑️  사용자 완전 삭제 시작...')
  console.log(`   UID: ${TARGET_UID}`)
  console.log(`   Email: ${TARGET_EMAIL}\n`)

  let deletedCount = 0

  try {
    // 1. userProfiles 컬렉션에서 삭제
    console.log('1️⃣  userProfiles 컬렉션 확인 중...')
    const userProfileRef = db.collection('userProfiles').doc(TARGET_UID)
    const userProfileSnap = await userProfileRef.get()

    if (userProfileSnap.exists) {
      await userProfileRef.delete()
      console.log('   ✅ userProfiles 삭제 완료')
      deletedCount++
    } else {
      console.log('   ⏭️  userProfiles 문서 없음')
    }

    // 2. members 컬렉션에서 삭제
    console.log('\n2️⃣  members 컬렉션 확인 중...')
    const membersQuery = await db.collection('members')
      .where('uid', '==', TARGET_UID)
      .get()

    if (!membersQuery.empty) {
      const batch = db.batch()
      membersQuery.forEach((doc: any) => {
        batch.delete(doc.ref)
        console.log(`   ✅ members 문서 삭제: ${doc.id}`)
        deletedCount++
      })
      await batch.commit()
      console.log(`   총 ${membersQuery.size}개 삭제 완료`)
    } else {
      console.log('   ⏭️  members 문서 없음')
    }

    // 3. organizationMembers 컬렉션에서 삭제
    console.log('\n3️⃣  organizationMembers 컬렉션 확인 중...')
    const orgMembersQuery = await db.collection('organizationMembers')
      .where('userId', '==', TARGET_UID)
      .get()

    if (!orgMembersQuery.empty) {
      const batch = db.batch()
      orgMembersQuery.forEach((doc: any) => {
        batch.delete(doc.ref)
        console.log(`   ✅ organizationMembers 문서 삭제: ${doc.id}`)
        deletedCount++
      })
      await batch.commit()
      console.log(`   총 ${orgMembersQuery.size}개 삭제 완료`)
    } else {
      console.log('   ⏭️  organizationMembers 문서 없음')
    }

    // 4. organizations의 pendingMembers에서 제거
    console.log('\n4️⃣  organizations의 pendingMembers 확인 중...')
    const orgsSnapshot = await db.collection('organizations').get()
    let pendingRemoved = 0

    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data()
      const pendingMembers = orgData.pendingMembers || []

      const updatedPending = pendingMembers.filter((m: any) => m.uid !== TARGET_UID)

      if (updatedPending.length < pendingMembers.length) {
        await orgDoc.ref.update({ pendingMembers: updatedPending })
        console.log(`   ✅ ${orgData.name}의 pendingMembers에서 제거`)
        pendingRemoved++
      }
    }

    if (pendingRemoved === 0) {
      console.log('   ⏭️  pendingMembers에 없음')
    }

    // 5. Firebase Authentication에서 사용자 삭제
    console.log('\n5️⃣  Firebase Authentication 확인 중...')
    try {
      await auth.getUser(TARGET_UID)
      await auth.deleteUser(TARGET_UID)
      console.log('   ✅ Firebase Auth 계정 삭제 완료')
      deletedCount++
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log('   ⏭️  Firebase Auth 계정 없음')
      } else {
        console.log('   ⚠️  Firebase Auth 삭제 실패:', error.message)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 사용자 완전 삭제 완료!')
    console.log('='.repeat(60))
    console.log(`🗑️  총 ${deletedCount}개의 레코드 삭제됨`)
    console.log('\n사용자가 이제 처음부터 다시 가입할 수 있습니다.')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ 삭제 중 에러 발생:', error)
    throw error
  }
}

// 실행
deleteUserCompletely()
  .then(() => {
    console.log('\n✅ 스크립트 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 에러:', error)
    process.exit(1)
  })
