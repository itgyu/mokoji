/**
 * 중복 멤버 제거 스크립트
 *
 * members 컬렉션에서 uid-orgId 조합이 중복된 레코드를 찾아서
 * 가장 최근 것만 남기고 나머지는 삭제합니다.
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

async function removeDuplicateMembers() {
  try {
    console.log('🔍 중복 멤버 찾기 시작...\n')

    // 1. 모든 members 가져오기
    const membersSnapshot = await getDocs(collection(db, 'members'))
    console.log(`총 ${membersSnapshot.size}개의 members 레코드 확인`)

    // 2. uid-orgId 조합별로 그룹화
    const memberGroups = new Map() // key: "uid-orgId", value: [{docId, data, joinDate}, ...]

    membersSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      const key = `${data.uid}-${data.orgId}`

      if (!memberGroups.has(key)) {
        memberGroups.set(key, [])
      }

      memberGroups.get(key).push({
        docId: docSnapshot.id,
        data: data,
        joinDate: data.joinDate || new Date(0).toISOString() // joinDate 없으면 가장 오래된 것으로 간주
      })
    })

    console.log(`총 ${memberGroups.size}개의 고유한 uid-orgId 조합 발견\n`)

    // 3. 중복된 레코드 찾기
    const duplicates = []

    memberGroups.forEach((members, key) => {
      if (members.length > 1) {
        // joinDate 기준으로 정렬 (최신순)
        members.sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate))

        // 첫 번째(가장 최신) 제외하고 나머지는 중복으로 처리
        const toDelete = members.slice(1)

        duplicates.push({
          key,
          keep: members[0],
          delete: toDelete
        })
      }
    })

    console.log(`❌ 중복된 조합 ${duplicates.length}개 발견!\n`)

    if (duplicates.length === 0) {
      console.log('✅ 중복된 멤버가 없습니다.')
      return
    }

    // 4. 중복 정보 출력
    console.log('📋 중복된 멤버 목록:')
    let totalToDelete = 0
    duplicates.forEach((dup, idx) => {
      console.log(`  ${idx + 1}. ${dup.keep.data.name} (uid: ${dup.keep.data.uid}, orgId: ${dup.keep.data.orgId})`)
      console.log(`     - 유지: ${dup.keep.docId} (joinDate: ${dup.keep.joinDate})`)
      dup.delete.forEach(d => {
        console.log(`     - 삭제: ${d.docId} (joinDate: ${d.joinDate})`)
        totalToDelete++
      })
    })

    console.log(`\n⚠️  총 ${totalToDelete}개의 중복 레코드를 삭제합니다...\n`)

    // 5. 중복 레코드 삭제
    let deletedCount = 0

    for (const dup of duplicates) {
      for (const toDelete of dup.delete) {
        await deleteDoc(doc(db, 'members', toDelete.docId))
        deletedCount++

        // 10개마다 진행상황 출력
        if (deletedCount % 10 === 0) {
          console.log(`  진행중... ${deletedCount}/${totalToDelete}`)
        }
      }
    }

    console.log(`✅ ${deletedCount}개 중복 레코드 삭제 완료`)
    console.log(`\n🎉 중복 제거 완료! 최종 멤버 수: ${membersSnapshot.size - deletedCount}`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 실행
removeDuplicateMembers()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
