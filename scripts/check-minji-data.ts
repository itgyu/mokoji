import { db } from '../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

async function checkMinjiData() {
  console.log('🔍 김민지A 데이터 상세 확인...\n')

  const targetUID = 'kODxwEwwtqMuU60MyTlbA02sgsC2'
  const targetOrgId = 'LDOcG25Y4SvxNqGifSek'

  try {
    // 1. organizationMembers에서 확인
    console.log('📦 1. organizationMembers 컬렉션 확인...')
    const orgMembersQuery = query(
      collection(db, 'organizationMembers'),
      where('userId', '==', targetUID)
    )
    const orgMembersSnapshot = await getDocs(orgMembersQuery)

    console.log(`✅ 발견된 문서: ${orgMembersSnapshot.size}개\n`)

    if (!orgMembersSnapshot.empty) {
      orgMembersSnapshot.docs.forEach(doc => {
        const data = doc.data()
        console.log(`문서 ID: ${doc.id}`)
        console.log(`  userId: ${data.userId}`)
        console.log(`  organizationId: ${data.organizationId}`)
        console.log(`  role: ${data.role}`)
        console.log(`  status: ${data.status}`)
        console.log(`  joinedAt: ${data.joinedAt?.toDate?.() || data.joinedAt}`)
        console.log(`  organizationId_userId: ${data.organizationId_userId}`)
        console.log('')
      })
    }

    // 2. members 컬렉션에서 확인
    console.log('📦 2. members 컬렉션 확인...')
    const membersQuery = query(
      collection(db, 'members'),
      where('uid', '==', targetUID)
    )
    const membersSnapshot = await getDocs(membersQuery)

    console.log(`✅ 발견된 문서: ${membersSnapshot.size}개\n`)

    if (!membersSnapshot.empty) {
      membersSnapshot.docs.forEach(doc => {
        const data = doc.data()
        console.log(`문서 ID: ${doc.id}`)
        console.log(`  uid: ${data.uid}`)
        console.log(`  name: ${data.name}`)
        console.log(`  email: ${data.email}`)
        console.log(`  orgId: ${data.orgId}`)
        console.log(`  organizationId: ${data.organizationId}`)
        console.log(`  isCaptain: ${data.isCaptain}`)
        console.log(`  isStaff: ${data.isStaff}`)
        console.log(`  role: ${data.role}`)
        console.log(`  joinDate: ${data.joinDate?.toDate?.() || data.joinDate}`)
        console.log('')
      })

      // orgId 매칭 확인
      const matchingMembers = membersSnapshot.docs.filter(doc => {
        const data = doc.data()
        return data.orgId === targetOrgId || data.organizationId === targetOrgId
      })

      if (matchingMembers.length === 0) {
        console.log(`⚠️  members 컬렉션에 uid=${targetUID}는 있지만,`)
        console.log(`   orgId=${targetOrgId}와 매칭되는 문서가 없습니다!\n`)
        console.log(`💡 해결 방법: members 컬렉션의 orgId를 수정해야 합니다.\n`)
      } else {
        console.log(`✅ orgId가 올바르게 매칭됩니다.\n`)
      }
    } else {
      console.log(`❌ members 컬렉션에 uid=${targetUID}인 문서가 없습니다!\n`)
      console.log(`💡 해결 방법: members 컬렉션에 새로운 문서를 생성해야 합니다.\n`)
    }

    // 3. userProfiles에서 확인
    console.log('📦 3. userProfiles 컬렉션 확인...')
    const userProfilesQuery = query(
      collection(db, 'userProfiles'),
      where('__name__', '==', targetUID)
    )
    const userProfilesSnapshot = await getDocs(userProfilesQuery)

    if (!userProfilesSnapshot.empty) {
      userProfilesSnapshot.docs.forEach(doc => {
        const data = doc.data()
        console.log(`✅ 문서 ID: ${doc.id}`)
        console.log(`  name: ${data.name}`)
        console.log(`  email: ${data.email}`)
        console.log(`  organizations: ${JSON.stringify(data.organizations)}`)
        console.log('')
      })
    } else {
      console.log(`⚠️  userProfiles에 ${targetUID} 문서가 없습니다.\n`)
    }

    // 4. 전체 members 컬렉션에서 orgId로 검색
    console.log('📦 4. 해당 크루의 모든 멤버 확인...')
    const allMembersQuery = query(
      collection(db, 'members'),
      where('orgId', '==', targetOrgId)
    )
    const allMembersSnapshot = await getDocs(allMembersQuery)

    console.log(`✅ 해당 크루 멤버: ${allMembersSnapshot.size}명\n`)

    const allUIDs = allMembersSnapshot.docs.map(doc => doc.data().uid)
    console.log('모든 멤버 UID:')
    allUIDs.forEach((uid, idx) => {
      console.log(`  ${idx + 1}. ${uid}`)
    })

    if (!allUIDs.includes(targetUID)) {
      console.log(`\n❌ members 컬렉션에 uid=${targetUID}, orgId=${targetOrgId}인 문서가 없습니다!`)
      console.log(`💡 members 컬렉션에 문서를 생성하거나 기존 문서의 uid를 수정해야 합니다.\n`)
    }

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('='.repeat(60))
console.log('김민지A 데이터 상세 확인 스크립트')
console.log('='.repeat(60))
console.log('')

checkMinjiData()
  .then(() => {
    console.log('\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 확인 실패')
    console.error(error)
    process.exit(1)
  })
