/**
 * 긴급 데이터 확인
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

async function emergencyCheck() {
  console.log('🚨 긴급 데이터 상태 확인 중...\n')

  // 1. userProfiles 확인
  console.log('📌 userProfiles 상태:')
  const userProfilesSnapshot = await db.collection('userProfiles').get()
  console.log(`  총 ${userProfilesSnapshot.size}개의 프로필`)

  // 이태규님 프로필 확인
  const taegyuProfiles = userProfilesSnapshot.docs.filter(doc => {
    const data = doc.data()
    return data.name && data.name.includes('태규')
  })

  if (taegyuProfiles.length > 0) {
    console.log('\n  이태규님 프로필:')
    taegyuProfiles.forEach(doc => {
      const data = doc.data()
      console.log(`    - ID: ${doc.id}`)
      console.log(`    - 이름: ${data.name}`)
      console.log(`    - 이메일: ${data.email}`)
      console.log(`    - Organizations: ${JSON.stringify(data.organizations)}`)
    })
  }

  // 2. organizationMembers 전체 확인
  console.log('\n📌 organizationMembers 상태:')
  const orgMembersSnapshot = await db.collection('organizationMembers').get()
  console.log(`  총 ${orgMembersSnapshot.size}개의 멤버 레코드`)

  // 조직별로 그룹화
  const membersByOrg: { [key: string]: any[] } = {}

  for (const doc of orgMembersSnapshot.docs) {
    const data = doc.data()
    const orgId = data.organizationId

    if (!membersByOrg[orgId]) {
      membersByOrg[orgId] = []
    }

    // userProfile 정보 가져오기
    const userProfileDoc = await db.collection('userProfiles').doc(data.userId).get()
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : null

    membersByOrg[orgId].push({
      userId: data.userId,
      name: userProfile?.name || '알 수 없음',
      role: data.role,
      status: data.status,
      joinedAt: data.joinedAt
    })
  }

  // 각 조직별 멤버 출력
  console.log('\n  조직별 멤버 목록:')
  for (const [orgId, members] of Object.entries(membersByOrg)) {
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    const orgName = orgDoc.exists ? orgDoc.data()?.name : '알 수 없음'

    console.log(`\n  ${orgName} (${orgId}):`)
    console.log(`    멤버 수: ${members.length}명`)
    members.forEach((member, idx) => {
      console.log(`    ${idx + 1}. ${member.name} (${member.userId}) - role: ${member.role}, status: ${member.status || '없음'}`)
    })
  }

  // 3. 구 members 컬렉션
  console.log('\n📌 구 members 컬렉션:')
  const oldMembersSnapshot = await db.collection('members').get()
  console.log(`  총 ${oldMembersSnapshot.size}개`)

  if (oldMembersSnapshot.size > 0) {
    oldMembersSnapshot.docs.forEach((doc, idx) => {
      const data = doc.data()
      console.log(`  ${idx + 1}. ${data.name} (uid: ${data.uid}, orgId: ${data.orgId || '없음'})`)
    })
  }
}

emergencyCheck().then(() => {
  console.log('\n✅ 확인 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
