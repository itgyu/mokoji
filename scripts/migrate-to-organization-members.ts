import { db } from '../lib/firebase'
import { collection, getDocs, doc, setDoc, query, where, Timestamp } from 'firebase/firestore'

async function migrateToOrganizationMembers() {
  console.log('🚀 organizationMembers 마이그레이션 시작...\n')
  console.log('⚠️  이 작업은 Firestore 데이터를 변경합니다.\n')
  console.log('📍 Firebase 설정: lib/firebase.ts 사용\n')

  try {
    // 1. 모든 크루 가져오기
    console.log('📦 Step 1: organizations 컬렉션 조회 중...')
    const orgsSnapshot = await getDocs(collection(db, 'organizations'))
    console.log(`✅ ${orgsSnapshot.size}개 크루 발견\n`)

    if (orgsSnapshot.size === 0) {
      console.log('⚠️  크루가 없습니다. 먼저 크루를 생성하세요.')
      return
    }

    let totalMemberships = 0
    let skipped = 0

    // 2. 각 크루의 멤버들을 organizationMembers로 이동
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data()
      const orgId = orgDoc.id

      console.log(`\n📍 크루: ${orgData.name || '이름 없음'} (${orgId})`)
      console.log(`   memberCount: ${orgData.memberCount || 0}`)

      // 2-1. members 컬렉션에서 orgId로 멤버 조회
      console.log('   🔍 members 컬렉션에서 조회 중...')
      const membersQuery = query(
        collection(db, 'members'),
        where('orgId', '==', orgId)
      )
      const membersSnapshot = await getDocs(membersQuery)

      console.log(`   ✅ members 컬렉션에서 ${membersSnapshot.size}명 발견`)

      if (membersSnapshot.size === 0) {
        console.log('   ⏭️  멤버를 찾을 수 없음 (스킵)')
        continue
      }

      // 2-2. 각 멤버에 대해 organizationMember 문서 생성
      const ownerId = orgData.ownerId || orgData.createdBy
      if (ownerId) {
        console.log(`   크루장: ${ownerId}`)
      }

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data()
        const memberId = memberData.uid

        if (!memberId) {
          console.log(`   ⏭️  uid 없음 - ${memberDoc.id} (스킵)`)
          continue
        }

        try {
          // 이미 존재하는지 확인
          const membershipQuery = query(
            collection(db, 'organizationMembers'),
            where('organizationId', '==', orgId),
            where('userId', '==', memberId)
          )
          const existingSnapshot = await getDocs(membershipQuery)

          if (!existingSnapshot.empty) {
            console.log(`   ⏭️  ${memberId} - 이미 존재 (스킵)`)
            skipped++
            continue
          }

          // 역할 결정
          const role = memberId === ownerId ? 'owner' : 'member'

          // organizationMember 문서 생성
          const membershipRef = doc(collection(db, 'organizationMembers'))
          const membershipData = {
            organizationId: orgId,
            userId: memberId,
            role: role,
            permissions: [],
            status: 'active',
            stats: {
              eventsAttended: 0,
              postsCreated: 0,
              lastActivityAt: Timestamp.now(),
            },
            joinedAt: orgData.createdAt || Timestamp.now(),
            organizationId_userId: `${orgId}_${memberId}`,
          }

          await setDoc(membershipRef, membershipData)

          console.log(`   ✅ ${memberId} - ${role}로 추가`)
          totalMemberships++
        } catch (error: any) {
          console.error(`   ❌ ${memberId} - 오류: ${error.message}`)
        }
      }
    }

    console.log(`\n\n🎉 마이그레이션 완료!`)
    console.log(`   총 생성: ${totalMemberships}개`)
    console.log(`   스킵: ${skipped}개`)

    // 3. 최종 확인
    console.log('\n📊 마이그레이션 결과 확인...')
    const membershipsSnapshot = await getDocs(collection(db, 'organizationMembers'))
    console.log(`✅ organizationMembers 컬렉션: ${membershipsSnapshot.size}개 문서\n`)

    // 4. 샘플 데이터 출력
    console.log('📝 샘플 데이터 (첫 5개):')
    membershipsSnapshot.docs.slice(0, 5).forEach((doc, idx) => {
      const data = doc.data()
      console.log(`   ${idx + 1}. ${data.userId} → ${data.organizationId} (${data.role})`)
    })

  } catch (error: any) {
    console.error('\n❌ 마이그레이션 실패:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('=' .repeat(60))
console.log('organizationMembers 마이그레이션 스크립트')
console.log('=' .repeat(60))
console.log('')

migrateToOrganizationMembers()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    console.log('Firestore Console에서 organizationMembers 컬렉션을 확인하세요.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패')
    console.error(error)
    process.exit(1)
  })
