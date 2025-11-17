import { db } from '../lib/firebase'
import { collection, getDocs, query, limit } from 'firebase/firestore'

async function checkMemberData() {
  console.log('🔍 멤버 데이터 위치 확인 중...')
  console.log('📍 Firebase 설정: lib/firebase.ts 사용\n')

  // 1. organizations 문서 상세 확인
  console.log('📦 1. organizations 컬렉션 상세:')
  const orgsSnapshot = await getDocs(collection(db, 'organizations'))

  console.log(`총 ${orgsSnapshot.size}개 조직 발견\n`)

  orgsSnapshot.docs.forEach((doc) => {
    const data = doc.data()
    console.log(`\n문서 ID: ${doc.id}`)
    console.log('모든 필드:', Object.keys(data))
    console.log('\n상세 데이터:')
    console.log(JSON.stringify(data, null, 2))
  })

  // 2. members 컬렉션 확인
  console.log('\n\n📦 2. members 컬렉션:')
  const membersSnapshot = await getDocs(query(collection(db, 'members'), limit(5)))
  console.log(`총 ${membersSnapshot.size}개 문서 (샘플 5개)`)

  if (membersSnapshot.size > 0) {
    console.log('\n샘플 멤버:')
    membersSnapshot.docs.forEach((doc, idx) => {
      const data = doc.data()
      console.log(`\n${idx + 1}. ${doc.id}`)
      console.log('   필드:', Object.keys(data))
      console.log('   - uid:', data.uid)
      console.log('   - name:', data.name)
      console.log('   - email:', data.email)
      console.log('   - organizationId:', data.organizationId)
      console.log('   - crewId:', data.crewId)
    })
  }

  // 3. userProfiles 컬렉션 확인
  console.log('\n\n📦 3. userProfiles 컬렉션:')
  const profilesSnapshot = await getDocs(query(collection(db, 'userProfiles'), limit(5)))
  console.log(`총 ${profilesSnapshot.size}개 문서 (샘플 5개)`)

  if (profilesSnapshot.size > 0) {
    console.log('\n샘플 프로필:')
    profilesSnapshot.docs.forEach((doc, idx) => {
      const data = doc.data()
      console.log(`\n${idx + 1}. ${doc.id}`)
      console.log('   - name:', data.name)
      console.log('   - joinedOrganizations:', data.joinedOrganizations)
    })
  }

  // 4. 기존 organizationMembers 확인
  console.log('\n\n📦 4. organizationMembers 컬렉션 (마이그레이션 대상):')
  const orgMembersSnapshot = await getDocs(collection(db, 'organizationMembers'))
  console.log(`총 ${orgMembersSnapshot.size}개 문서`)
}

checkMemberData()
  .then(() => {
    console.log('\n\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 오류:', error)
    process.exit(1)
  })
