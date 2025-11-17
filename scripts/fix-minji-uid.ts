import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore'

async function fixMinjiUID() {
  console.log('🔍 UID 불일치 문제 해결 시작...\n')

  const correctUID = 'kODxwEwwtqMuU60MyTlbA02sgsC2'

  try {
    // 1. members 컬렉션에서 모든 uid 가져오기
    console.log('📦 Step 1: members 컬렉션 조회...')
    const membersSnapshot = await getDocs(collection(db, 'members'))
    const memberUIDs = new Set<string>()
    membersSnapshot.docs.forEach(doc => {
      const uid = doc.data().uid
      if (uid) memberUIDs.add(uid)
    })
    console.log(`✅ members 컬렉션: ${memberUIDs.size}개 고유 UID 발견\n`)

    // 2. organizationMembers 컬렉션에서 모든 userId 가져오기
    console.log('📦 Step 2: organizationMembers 컬렉션 조회...')
    const orgMembersSnapshot = await getDocs(collection(db, 'organizationMembers'))
    const orgMemberUIDs = new Set<string>()
    const orgMemberDocs: any[] = []

    orgMembersSnapshot.docs.forEach(doc => {
      const userId = doc.data().userId
      if (userId) {
        orgMemberUIDs.add(userId)
        orgMemberDocs.push({ id: doc.id, data: doc.data(), ref: doc.ref })
      }
    })
    console.log(`✅ organizationMembers 컬렉션: ${orgMemberUIDs.size}개 고유 userId 발견\n`)

    // 3. 매칭 안 되는 UID 찾기
    console.log('🔎 Step 3: 매칭 안 되는 UID 찾기...\n')

    console.log('👉 members에는 없고 organizationMembers에만 있는 UID:')
    const unmatchedInOrgMembers: string[] = []
    orgMemberUIDs.forEach(uid => {
      if (!memberUIDs.has(uid)) {
        unmatchedInOrgMembers.push(uid)
        console.log(`   ❌ ${uid}`)
      }
    })

    console.log('\n👉 organizationMembers에는 없고 members에만 있는 UID:')
    const unmatchedInMembers: string[] = []
    memberUIDs.forEach(uid => {
      if (!orgMemberUIDs.has(uid)) {
        unmatchedInMembers.push(uid)
        console.log(`   ❌ ${uid}`)
      }
    })

    if (unmatchedInOrgMembers.length === 0 && unmatchedInMembers.length === 0) {
      console.log('\n✅ 모든 UID가 정상적으로 매칭됩니다!')
      return
    }

    // 4. 김민지A 찾기 (organizationMembers에서)
    console.log('\n📦 Step 4: 김민지A 데이터 찾기...')
    const minjiDocs = orgMemberDocs.filter(doc => {
      // userProfiles에서 이름 확인이 필요할 수 있으므로, userId로 먼저 필터링
      return unmatchedInOrgMembers.includes(doc.data.userId)
    })

    console.log(`\n발견된 매칭 안 되는 organizationMembers 문서 (${minjiDocs.length}개):`)
    for (const doc of minjiDocs) {
      console.log(`\n문서 ID: ${doc.id}`)
      console.log(`  userId: ${doc.data.userId}`)
      console.log(`  organizationId: ${doc.data.organizationId}`)
      console.log(`  role: ${doc.data.role}`)
    }

    // 5. correctUID가 members에 있는지 확인
    console.log(`\n📦 Step 5: 올바른 UID (${correctUID}) 확인...`)
    if (memberUIDs.has(correctUID)) {
      console.log(`✅ ${correctUID}는 members 컬렉션에 존재합니다.`)
    } else {
      console.log(`❌ ${correctUID}는 members 컬렉션에 없습니다!`)
      console.log(`⚠️  UID를 다시 확인해주세요.`)
      return
    }

    // 6. 수정 확인
    if (minjiDocs.length === 1) {
      const wrongUID = minjiDocs[0].data.userId
      console.log(`\n🔧 Step 6: UID 수정 준비...`)
      console.log(`   잘못된 UID: ${wrongUID}`)
      console.log(`   올바른 UID: ${correctUID}`)
      console.log(`   문서 개수: ${minjiDocs.length}개`)

      console.log('\n📝 5초 후 자동으로 수정합니다...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // UID 수정
      console.log('\n🔧 UID 수정 중...')
      const docToUpdate = minjiDocs[0]
      await updateDoc(docToUpdate.ref, {
        userId: correctUID,
        organizationId_userId: `${docToUpdate.data.organizationId}_${correctUID}`
      })

      console.log('✅ organizationMembers 문서 수정 완료!')

      // 7. 검증
      console.log('\n📦 Step 7: 수정 검증...')
      const updatedDoc = await getDocs(query(
        collection(db, 'organizationMembers'),
        where('userId', '==', correctUID)
      ))
      console.log(`✅ 수정된 문서 확인: ${updatedDoc.size}개`)

      console.log('\n🎉 UID 수정이 완료되었습니다!')
    } else if (minjiDocs.length > 1) {
      console.log(`\n⚠️  매칭 안 되는 문서가 ${minjiDocs.length}개 발견되었습니다.`)
      console.log('수동으로 확인이 필요합니다.')
    } else {
      console.log('\n⚠️  매칭 안 되는 문서를 찾을 수 없습니다.')
    }

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('='.repeat(60))
console.log('김민지A UID 수정 스크립트')
console.log('='.repeat(60))
console.log('')

fixMinjiUID()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패')
    console.error(error)
    process.exit(1)
  })
