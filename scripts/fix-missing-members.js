/**
 * 누락된 멤버 복구 스크립트
 *
 * userProfiles의 organizations 배열에는 있지만
 * members 컬렉션에 레코드가 없는 멤버들을 찾아서 추가합니다.
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, addDoc } = require('firebase/firestore')

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

async function fixMissingMembers() {
  try {
    console.log('🔍 누락된 멤버 찾기 시작...\n')

    // 1. 모든 userProfiles 가져오기
    const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))
    console.log(`총 ${userProfilesSnapshot.size}개의 userProfiles 확인`)

    // 2. 모든 members 가져오기
    const membersSnapshot = await getDocs(collection(db, 'members'))
    const existingMembers = new Map() // uid-orgId 조합을 키로 사용

    membersSnapshot.forEach(doc => {
      const data = doc.data()
      const key = `${data.uid}-${data.orgId}`
      existingMembers.set(key, true)
    })
    console.log(`총 ${membersSnapshot.size}개의 members 레코드 존재\n`)

    const missingMembers = []

    // 3. userProfiles를 순회하며 누락된 멤버 찾기
    for (const userDoc of userProfilesSnapshot.docs) {
      const uid = userDoc.id
      const data = userDoc.data()
      const organizations = data.organizations || []

      if (organizations.length === 0) continue

      // 이 사용자의 각 크루에 대해 members 컬렉션에 레코드가 있는지 확인
      for (const orgId of organizations) {
        const key = `${uid}-${orgId}`

        if (!existingMembers.has(key)) {
          missingMembers.push({
            uid,
            orgId,
            name: data.name || '이름 없음',
            email: data.email || '',
            avatar: data.avatar || null
          })
        }
      }
    }

    console.log(`❌ 누락된 멤버 ${missingMembers.length}명 발견!\n`)

    if (missingMembers.length === 0) {
      console.log('✅ 모든 멤버가 올바르게 등록되어 있습니다.')
      return
    }

    // 4. 누락된 멤버들 표시
    console.log('📋 누락된 멤버 목록:')
    missingMembers.forEach((member, idx) => {
      console.log(`  ${idx + 1}. ${member.name} (uid: ${member.uid}, orgId: ${member.orgId})`)
    })

    console.log('\n⚠️  이 멤버들을 members 컬렉션에 추가합니다...\n')

    // 5. 누락된 멤버들을 members 컬렉션에 추가
    const membersRef = collection(db, 'members')
    let addedCount = 0

    for (const member of missingMembers) {
      await addDoc(membersRef, {
        uid: member.uid,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        role: '멤버',
        isCaptain: false,
        isStaff: false,
        joinDate: new Date().toISOString(),
        orgId: member.orgId
      })

      addedCount++

      // 10개마다 진행상황 출력
      if (addedCount % 10 === 0) {
        console.log(`  진행중... ${addedCount}/${missingMembers.length}`)
      }
    }

    console.log(`✅ ${addedCount}개 멤버 추가 완료`)

    console.log(`\n🎉 총 ${missingMembers.length}명의 누락된 멤버를 복구했습니다!`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 실행
fixMissingMembers()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
