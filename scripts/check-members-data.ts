/**
 * 현재 멤버 데이터 상태 확인 스크립트
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

async function checkMembersData() {
  console.log('🔍 멤버 데이터 상태 확인 중...\n')

  // 1. 구 members 컬렉션
  const oldMembersSnapshot = await db.collection('members').get()
  console.log(`📌 구 members 컬렉션: ${oldMembersSnapshot.size}개`)

  if (oldMembersSnapshot.size > 0) {
    console.log('  멤버 목록:')
    oldMembersSnapshot.docs.forEach((doc, idx) => {
      const data = doc.data()
      console.log(`  ${idx + 1}. ${data.name} (uid: ${data.uid})`)
    })
  }

  // 2. organizationMembers 컬렉션
  const orgMembersSnapshot = await db.collection('organizationMembers').get()
  console.log(`\n📌 organizationMembers 컬렉션: ${orgMembersSnapshot.size}개`)

  if (orgMembersSnapshot.size > 0) {
    console.log('  멤버 목록:')
    for (const [idx, doc] of orgMembersSnapshot.docs.entries()) {
      const data = doc.data()
      const userDoc = await db.doc(`userProfiles/${data.userId}`).get()
      const userName = userDoc.exists() ? userDoc.data()?.name : '알 수 없음'
      console.log(`  ${idx + 1}. ${userName} (uid: ${data.userId}, orgId: ${data.organizationId}, status: ${data.status || '없음'})`)
    }
  }

  // 3. 각 조직별로 멤버 수 확인
  console.log('\n📌 조직별 멤버 수:')
  const orgsSnapshot = await db.collection('organizations').get()

  for (const orgDoc of orgsSnapshot.docs) {
    const orgName = orgDoc.data().name
    const orgId = orgDoc.id

    const membersInOrg = await db
      .collection('organizationMembers')
      .where('organizationId', '==', orgId)
      .get()

    console.log(`  ${orgName}: ${membersInOrg.size}명`)
  }
}

checkMembersData().then(() => {
  console.log('\n✅ 확인 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
