/**
 * 이태규님 프로필 수정 - organizations 추가
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

async function fixTaegyuProfile() {
  console.log('🔧 이태규님 프로필 수정 중...\n')

  const userId = '0fN7kqRGodPg8IAhqVdYQTUQDrY2' // ian@keystonepartners.co.kr
  const orgId = 'LDOcG25Y4SvxNqGifSek' // It's Campers Crew

  // organizations 배열에 추가
  await db.collection('userProfiles').doc(userId).update({
    organizations: FieldValue.arrayUnion(orgId)
  })

  console.log('✅ ian@keystonepartners.co.kr 계정에 organizations 추가 완료')

  // 확인
  const userDoc = await db.collection('userProfiles').doc(userId).get()
  const userData = userDoc.data()
  console.log('\n📌 업데이트된 프로필:')
  console.log('  이름:', userData?.name)
  console.log('  이메일:', userData?.email)
  console.log('  Organizations:', userData?.organizations)
}

fixTaegyuProfile().then(() => {
  console.log('\n✅ 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
