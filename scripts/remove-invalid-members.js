/**
 * 잘못된 멤버 레코드 제거 스크립트
 *
 * orgId가 undefined이거나 null인 members 레코드를 삭제합니다.
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore')

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

async function removeInvalidMembers() {
  try {
    console.log('🔍 잘못된 멤버 레코드 찾기 시작...\n')

    // 1. 모든 members 가져오기
    const membersSnapshot = await getDocs(collection(db, 'members'))
    console.log(`총 ${membersSnapshot.size}개의 members 레코드 확인`)

    // 2. orgId가 undefined이거나 null인 레코드 찾기
    const invalidMembers = []

    membersSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()

      if (!data.orgId || data.orgId === 'undefined' || data.orgId === null) {
        invalidMembers.push({
          docId: docSnapshot.id,
          data: data
        })
      }
    })

    console.log(`❌ orgId가 잘못된 레코드 ${invalidMembers.length}개 발견!\n`)

    if (invalidMembers.length === 0) {
      console.log('✅ 모든 멤버 레코드가 올바릅니다.')
      return
    }

    // 3. 잘못된 레코드 정보 출력
    console.log('📋 삭제할 레코드 목록 (처음 10개만 표시):')
    invalidMembers.slice(0, 10).forEach((member, idx) => {
      console.log(`  ${idx + 1}. ${member.data.name || '이름 없음'} (uid: ${member.data.uid || 'N/A'}, orgId: ${member.data.orgId})`)
      console.log(`     docId: ${member.docId}`)
    })

    if (invalidMembers.length > 10) {
      console.log(`  ... 외 ${invalidMembers.length - 10}개`)
    }

    console.log(`\n⚠️  총 ${invalidMembers.length}개의 잘못된 레코드를 삭제합니다...\n`)

    // 4. 잘못된 레코드 삭제
    let deletedCount = 0

    for (const member of invalidMembers) {
      await deleteDoc(doc(db, 'members', member.docId))
      deletedCount++

      // 10개마다 진행상황 출력
      if (deletedCount % 10 === 0) {
        console.log(`  진행중... ${deletedCount}/${invalidMembers.length}`)
      }
    }

    console.log(`✅ ${deletedCount}개 잘못된 레코드 삭제 완료`)
    console.log(`\n🎉 정리 완료! 최종 멤버 수: ${membersSnapshot.size - deletedCount}`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 실행
removeInvalidMembers()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
