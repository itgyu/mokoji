/**
 * 가입일 데이터 조사 - 왜 모두 12월 1일인가?
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const serviceAccountPath = path.join(__dirname, '../new-firebase-key.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath)
  })
}

const db = getFirestore()

async function checkJoinDates() {
  console.log('🔍 가입일 데이터 조사\n')

  const orgId = 'LDOcG25Y4SvxNqGifSek' // It's Campers Crew

  // organizationMembers 조회
  const orgMembersSnapshot = await db
    .collection('organizationMembers')
    .where('organizationId', '==', orgId)
    .get()

  console.log(`📊 전체 멤버 수: ${orgMembersSnapshot.size}명\n`)

  // 각 멤버의 가입일 정보 출력
  console.log('=== 멤버별 가입일 데이터 ===\n')

  for (const doc of orgMembersSnapshot.docs) {
    const data = doc.data()

    // userProfile에서 이름 가져오기
    const userProfileDoc = await db.collection('userProfiles').doc(data.userId).get()
    const userName = userProfileDoc.exists ? userProfileDoc.data()?.name : '알 수 없음'

    console.log(`이름: ${userName}`)
    console.log(`  - userId: ${data.userId}`)
    console.log(`  - joinedAt 원본:`, data.joinedAt)
    console.log(`  - joinedAt 타입:`, typeof data.joinedAt)

    if (data.joinedAt) {
      if (data.joinedAt instanceof Timestamp) {
        console.log(`  - Timestamp seconds: ${data.joinedAt.seconds}`)
        console.log(`  - 변환된 날짜: ${data.joinedAt.toDate().toISOString()}`)
        console.log(`  - 한국 시간: ${data.joinedAt.toDate().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
      } else if (typeof data.joinedAt === 'object' && 'seconds' in data.joinedAt) {
        console.log(`  - seconds: ${data.joinedAt.seconds}`)
        console.log(`  - 변환된 날짜: ${new Date(data.joinedAt.seconds * 1000).toISOString()}`)
      } else if (typeof data.joinedAt === 'object' && '_seconds' in data.joinedAt) {
        console.log(`  - _seconds: ${(data.joinedAt as any)._seconds}`)
        console.log(`  - 변환된 날짜: ${new Date((data.joinedAt as any)._seconds * 1000).toISOString()}`)
      }
    } else {
      console.log(`  - ⚠️ joinedAt 없음`)
    }
    console.log('')
  }

  // 통계
  console.log('\n=== 통계 ===')
  const withJoinedAt = orgMembersSnapshot.docs.filter(doc => doc.data().joinedAt)
  const withoutJoinedAt = orgMembersSnapshot.docs.filter(doc => !doc.data().joinedAt)

  console.log(`joinedAt 있음: ${withJoinedAt.length}명`)
  console.log(`joinedAt 없음: ${withoutJoinedAt.length}명`)

  // 날짜별 그룹화
  const dateGroups = new Map<string, number>()
  withJoinedAt.forEach(doc => {
    const joinedAt = doc.data().joinedAt
    let dateStr = ''

    if (joinedAt instanceof Timestamp) {
      dateStr = joinedAt.toDate().toLocaleDateString('ko-KR')
    } else if (typeof joinedAt === 'object' && 'seconds' in joinedAt) {
      dateStr = new Date(joinedAt.seconds * 1000).toLocaleDateString('ko-KR')
    } else if (typeof joinedAt === 'object' && '_seconds' in joinedAt) {
      dateStr = new Date((joinedAt as any)._seconds * 1000).toLocaleDateString('ko-KR')
    }

    dateGroups.set(dateStr, (dateGroups.get(dateStr) || 0) + 1)
  })

  console.log('\n날짜별 멤버 수:')
  dateGroups.forEach((count, date) => {
    console.log(`  ${date}: ${count}명`)
  })
}

checkJoinDates().then(() => {
  console.log('\n✅ 조사 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
