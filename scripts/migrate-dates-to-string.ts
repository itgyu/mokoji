import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'

function timestampToISOString(timestamp: any): string {
  try {
    if (!timestamp) return new Date().toISOString().split('T')[0]

    // Firestore Timestamp 객체인 경우
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate()
      return date.toISOString().split('T')[0] // YYYY-MM-DD
    }

    // Date 객체인 경우
    if (timestamp instanceof Date) {
      return timestamp.toISOString().split('T')[0]
    }

    // 숫자 (milliseconds)인 경우
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString().split('T')[0]
    }

    // seconds 필드가 있는 객체인 경우
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000).toISOString().split('T')[0]
    }

    // 이미 문자열인 경우
    if (typeof timestamp === 'string') {
      return timestamp
    }

    // 알 수 없는 형식
    console.warn('Unknown timestamp format:', timestamp)
    return new Date().toISOString().split('T')[0]
  } catch (error) {
    console.error('Error converting timestamp:', error)
    return new Date().toISOString().split('T')[0]
  }
}

async function migrateDatesToString() {
  console.log('🔄 날짜 필드를 ISO 문자열로 마이그레이션 시작...\n')

  try {
    // 1. members 컬렉션 마이그레이션
    console.log('📦 Step 1: members 컬렉션 마이그레이션...')
    const membersSnapshot = await getDocs(collection(db, 'members'))
    console.log(`  총 ${membersSnapshot.size}개 문서 발견\n`)

    let membersUpdated = 0
    let membersSkipped = 0

    for (const memberDoc of membersSnapshot.docs) {
      const data = memberDoc.data()
      const joinDate = data.joinDate

      if (!joinDate) {
        console.log(`  ⚠️  [${data.name}] joinDate 없음 - 건너뜀`)
        membersSkipped++
        continue
      }

      // 이미 문자열이면 건너뛰기
      if (typeof joinDate === 'string') {
        console.log(`  ✓  [${data.name}] 이미 문자열 형식 - 건너뜀`)
        membersSkipped++
        continue
      }

      const isoDateString = timestampToISOString(joinDate)

      await updateDoc(doc(db, 'members', memberDoc.id), {
        joinDate: isoDateString
      })

      console.log(`  ✅ [${data.name}] ${joinDate} → ${isoDateString}`)
      membersUpdated++
    }

    console.log(`\n📊 members 결과: ${membersUpdated}개 업데이트, ${membersSkipped}개 건너뜀\n`)

    // 2. organizationMembers 컬렉션 마이그레이션
    console.log('📦 Step 2: organizationMembers 컬렉션 마이그레이션...')
    const orgMembersSnapshot = await getDocs(collection(db, 'organizationMembers'))
    console.log(`  총 ${orgMembersSnapshot.size}개 문서 발견\n`)

    let orgMembersUpdated = 0
    let orgMembersSkipped = 0

    for (const orgMemberDoc of orgMembersSnapshot.docs) {
      const data = orgMemberDoc.data()
      const joinedAt = data.joinedAt

      if (!joinedAt) {
        console.log(`  ⚠️  [${data.userId}] joinedAt 없음 - 건너뜀`)
        orgMembersSkipped++
        continue
      }

      // 이미 문자열이면 건너뛰기
      if (typeof joinedAt === 'string') {
        console.log(`  ✓  [${data.userId}] 이미 문자열 형식 - 건너뜀`)
        orgMembersSkipped++
        continue
      }

      const isoDateString = timestampToISOString(joinedAt)

      await updateDoc(doc(db, 'organizationMembers', orgMemberDoc.id), {
        joinedAt: isoDateString
      })

      console.log(`  ✅ [${data.userId}] ${joinedAt} → ${isoDateString}`)
      orgMembersUpdated++
    }

    console.log(`\n📊 organizationMembers 결과: ${orgMembersUpdated}개 업데이트, ${orgMembersSkipped}개 건너뜀\n`)

    // 3. 최종 결과
    console.log('=' .repeat(60))
    console.log('✅ 마이그레이션 완료!')
    console.log(`   members: ${membersUpdated}개 업데이트`)
    console.log(`   organizationMembers: ${orgMembersUpdated}개 업데이트`)
    console.log('=' .repeat(60))

  } catch (error: any) {
    console.error('\n❌ 마이그레이션 실패:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('='.repeat(60))
console.log('날짜 필드 → ISO 문자열 마이그레이션')
console.log('Timestamp → "YYYY-MM-DD"')
console.log('='.repeat(60))
console.log('')

migrateDatesToString()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패')
    console.error(error)
    process.exit(1)
  })
