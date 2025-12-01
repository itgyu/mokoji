/**
 * userProfiles 컬렉션 구조 확인 - birthdate 필드가 있는지?
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const serviceAccountPath = path.join(__dirname, '../new-firebase-key.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath)
  })
}

const db = getFirestore()

async function checkUserProfiles() {
  console.log('🔍 userProfiles 구조 확인\n')

  const orgId = 'LDOcG25Y4SvxNqGifSek' // It's Campers Crew

  // organizationMembers에서 userId 가져오기
  const orgMembersSnapshot = await db
    .collection('organizationMembers')
    .where('organizationId', '==', orgId)
    .limit(5) // 샘플로 5명만
    .get()

  console.log(`📊 샘플 멤버 수: ${orgMembersSnapshot.size}명\n`)

  for (const doc of orgMembersSnapshot.docs) {
    const data = doc.data()

    // userProfile 조회
    const userProfileDoc = await db.collection('userProfiles').doc(data.userId).get()

    if (userProfileDoc.exists) {
      const profileData = userProfileDoc.data()
      console.log(`이름: ${profileData?.name}`)
      console.log('  전체 필드:')
      Object.keys(profileData || {}).forEach(key => {
        console.log(`    - ${key}: ${JSON.stringify(profileData?.[key])}`)
      })
      console.log('')
    }
  }
}

checkUserProfiles().then(() => {
  console.log('\n✅ 확인 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
