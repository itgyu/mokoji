/**
 * members 컬렉션과 userProfiles 동기화 스크립트
 *
 * userProfiles의 email, avatar 등 정보를 members 컬렉션에 동기화
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore')

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

async function syncMemberProfiles() {
  try {
    console.log('🔍 멤버 프로필 동기화 시작...\n')

    const ORG_ID = 'LDOcG25Y4SvxNqGifSek'

    // 1. userProfiles 가져오기
    const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))
    const userProfilesMap = new Map() // uid -> profile data

    userProfilesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      userProfilesMap.set(docSnapshot.id, data)
    })

    console.log(`✅ userProfiles: ${userProfilesMap.size}개 로드`)

    // 2. members 컬렉션 가져오기
    const membersSnapshot = await getDocs(collection(db, 'members'))
    const membersToUpdate = []

    membersSnapshot.forEach((docSnapshot) => {
      const memberData = docSnapshot.data()

      if (memberData.orgId === ORG_ID) {
        const profile = userProfilesMap.get(memberData.uid)

        if (profile) {
          membersToUpdate.push({
            docId: docSnapshot.id,
            uid: memberData.uid,
            currentData: memberData,
            profileData: profile
          })
        }
      }
    })

    console.log(`✅ 동기화할 멤버: ${membersToUpdate.length}명\n`)

    // 3. 동기화 미리보기
    console.log('📋 동기화 미리보기 (처음 5명):\n')
    membersToUpdate.slice(0, 5).forEach((member, idx) => {
      console.log(`  ${idx + 1}. ${member.currentData.name}`)
      console.log(`     현재 email: ${member.currentData.email || '없음'}`)
      console.log(`     프로필 email: ${member.profileData.email || '없음'}`)
      console.log(`     현재 avatar: ${member.currentData.avatar || '없음'}`)
      console.log(`     프로필 avatar: ${member.profileData.avatar || '없음'}`)
      console.log(`     프로필 phone: ${member.profileData.phone || '없음'}`)
      console.log('')
    })

    // 4. 실제 동기화
    console.log('⚙️  동기화 시작...\n')

    let updatedCount = 0

    for (const member of membersToUpdate) {
      const updateData = {}

      // email 동기화
      if (member.profileData.email && member.currentData.email !== member.profileData.email) {
        updateData.email = member.profileData.email
      }

      // avatar 동기화
      if (member.profileData.avatar && member.currentData.avatar !== member.profileData.avatar) {
        updateData.avatar = member.profileData.avatar
      }

      // name 동기화 (프로필 이름이 다르면)
      if (member.profileData.name && member.currentData.name !== member.profileData.name) {
        updateData.name = member.profileData.name
      }

      // phone 추가 (없으면)
      if (member.profileData.phone && !member.currentData.phone) {
        updateData.phone = member.profileData.phone
      }

      // 업데이트할 내용이 있으면 실행
      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'members', member.docId), updateData)
        updatedCount++

        if (updatedCount % 10 === 0) {
          console.log(`  진행중... ${updatedCount}/${membersToUpdate.length}`)
        }
      }
    }

    console.log(`\n✅ ${updatedCount}명 동기화 완료`)

    // 5. 최종 통계
    console.log('\n📊 동기화 통계:')

    let emailSynced = 0
    let avatarSynced = 0
    let phoneSynced = 0

    for (const member of membersToUpdate) {
      if (member.profileData.email) emailSynced++
      if (member.profileData.avatar) avatarSynced++
      if (member.profileData.phone) phoneSynced++
    }

    console.log(`  - 이메일 동기화: ${emailSynced}명`)
    console.log(`  - 아바타 동기화: ${avatarSynced}명`)
    console.log(`  - 전화번호 추가: ${phoneSynced}명`)

    console.log('\n🎉 동기화 완료!')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

syncMemberProfiles()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
