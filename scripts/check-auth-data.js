/**
 * 인증 및 사용자 데이터 확인 스크립트
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

async function checkAuthData() {
  try {
    console.log('🔍 사용자 데이터 확인 시작...\n')

    const ORG_ID = 'LDOcG25Y4SvxNqGifSek'

    // 1. userProfiles 확인
    const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))
    console.log(`✅ userProfiles 컬렉션: ${userProfilesSnapshot.size}개 문서`)

    // 크루 멤버 확인
    let crewMembers = 0
    userProfilesSnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.organizations && data.organizations.includes(ORG_ID)) {
        crewMembers++
      }
    })
    console.log(`✅ 크루 멤버 (userProfiles.organizations): ${crewMembers}명`)

    // 2. members 컬렉션 확인
    const membersSnapshot = await getDocs(collection(db, 'members'))
    console.log(`✅ members 컬렉션: ${membersSnapshot.size}개 문서`)

    let crewMembersInCollection = 0
    membersSnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.orgId === ORG_ID) {
        crewMembersInCollection++
      }
    })
    console.log(`✅ 크루 멤버 (members 컬렉션): ${crewMembersInCollection}명`)

    // 3. 일치 여부 확인
    console.log('\n📊 데이터 일치 여부:')
    if (crewMembers === crewMembersInCollection) {
      console.log('✅ userProfiles와 members가 일치합니다')
    } else {
      console.log(`❌ 불일치: userProfiles=${crewMembers}명, members=${crewMembersInCollection}명`)
      console.log(`   차이: ${Math.abs(crewMembers - crewMembersInCollection)}명`)
    }

    // 4. userProfiles 샘플 확인 (처음 3명)
    console.log('\n📋 userProfiles 샘플 (처음 3명):')
    let count = 0
    userProfilesSnapshot.forEach((doc) => {
      if (count < 3) {
        const data = doc.data()
        if (data.organizations && data.organizations.includes(ORG_ID)) {
          console.log(`\n  ${++count}. ${data.name || '이름 없음'}`)
          console.log(`     uid: ${doc.id}`)
          console.log(`     email: ${data.email || 'N/A'}`)
          console.log(`     organizations: ${JSON.stringify(data.organizations)}`)
          console.log(`     createdAt: ${data.createdAt || 'N/A'}`)
        }
      }
    })

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

checkAuthData()
  .then(() => {
    console.log('\n✅ 확인 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 확인 실패:', error)
    process.exit(1)
  })
