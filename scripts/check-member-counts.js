/**
 * 멤버 수 확인 스크립트
 *
 * userProfiles.organizations와 members 컬렉션의 크루별 멤버 수를 비교합니다.
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs } = require('firebase/firestore')

const firebaseConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function checkMemberCounts() {
  try {
    console.log('🔍 멤버 수 확인 시작...\n')

    // 1. userProfiles에서 크루별 멤버 수 계산
    const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))
    const orgMembersFromProfiles = new Map() // orgId -> Set of uids

    userProfilesSnapshot.forEach((doc) => {
      const data = doc.data()
      const organizations = data.organizations || []

      organizations.forEach((orgId) => {
        if (!orgMembersFromProfiles.has(orgId)) {
          orgMembersFromProfiles.set(orgId, new Set())
        }
        orgMembersFromProfiles.get(orgId).add(doc.id)
      })
    })

    console.log('📊 userProfiles.organizations 기준:')
    orgMembersFromProfiles.forEach((members, orgId) => {
      console.log(`  ${orgId}: ${members.size}명`)
    })

    // 2. members 컬렉션에서 크루별 멤버 수 계산
    const membersSnapshot = await getDocs(collection(db, 'members'))
    const orgMembersFromCollection = new Map() // orgId -> Set of uids

    membersSnapshot.forEach((doc) => {
      const data = doc.data()
      const orgId = data.orgId
      const uid = data.uid

      if (!orgMembersFromCollection.has(orgId)) {
        orgMembersFromCollection.set(orgId, new Set())
      }
      orgMembersFromCollection.get(orgId).add(uid)
    })

    console.log('\n📊 members 컬렉션 기준:')
    orgMembersFromCollection.forEach((members, orgId) => {
      console.log(`  ${orgId}: ${members.size}명`)
    })

    // 3. 크루 정보 가져오기
    const orgsSnapshot = await getDocs(collection(db, 'organizations'))
    const orgNames = new Map()

    orgsSnapshot.forEach((doc) => {
      const data = doc.data()
      orgNames.set(doc.id, data.name || '이름 없음')
    })

    console.log('\n📋 크루별 상세 비교:')
    const allOrgIds = new Set([
      ...orgMembersFromProfiles.keys(),
      ...orgMembersFromCollection.keys()
    ])

    allOrgIds.forEach((orgId) => {
      const fromProfiles = orgMembersFromProfiles.get(orgId)?.size || 0
      const fromCollection = orgMembersFromCollection.get(orgId)?.size || 0
      const orgName = orgNames.get(orgId) || '알 수 없음'

      const status = fromProfiles === fromCollection ? '✅' : '❌'
      console.log(`  ${status} ${orgName} (${orgId})`)
      console.log(`     - userProfiles: ${fromProfiles}명`)
      console.log(`     - members 컬렉션: ${fromCollection}명`)

      if (fromProfiles !== fromCollection) {
        console.log(`     ⚠️  차이: ${fromCollection - fromProfiles}명`)
      }
    })

    console.log(`\n📈 전체 통계:`)
    console.log(`  - 총 userProfiles: ${userProfilesSnapshot.size}개`)
    console.log(`  - 총 members 레코드: ${membersSnapshot.size}개`)
    console.log(`  - 크루 수: ${allOrgIds.size}개`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 실행
checkMemberCounts()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
