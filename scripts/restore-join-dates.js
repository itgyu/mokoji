/**
 * 가입일 복구 스크립트
 *
 * schedules, activityLogs, userProfiles 등에서
 * 각 사용자의 가장 이른 활동 시점을 찾아서 가입일로 설정
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

async function restoreJoinDates() {
  try {
    console.log('🔍 가입일 복구 시작...\n')

    const ORG_ID = 'LDOcG25Y4SvxNqGifSek'

    // 1. 모든 members 가져오기
    const membersSnapshot = await getDocs(collection(db, 'members'))
    const membersByUid = new Map() // uid -> { docId, data }

    membersSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      if (data.orgId === ORG_ID) {
        membersByUid.set(data.uid, {
          docId: docSnapshot.id,
          data: data,
          name: data.name
        })
      }
    })

    console.log(`📊 복구할 멤버: ${membersByUid.size}명\n`)

    // 2. 각 사용자의 가장 이른 활동 시점 찾기
    const userEarliestActivity = new Map() // uid -> earliest timestamp

    // 2-1. schedules에서 찾기
    console.log('🔍 schedules 컬렉션 분석 중...')
    const schedulesSnapshot = await getDocs(collection(db, 'schedules'))

    schedulesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()

      // 일정 생성자
      if (data.createdBy && data.createdAt) {
        const uid = data.createdBy
        const timestamp = data.createdAt

        if (membersByUid.has(uid)) {
          const existing = userEarliestActivity.get(uid)
          if (!existing || timestamp.seconds < existing.seconds) {
            userEarliestActivity.set(uid, timestamp)
          }
        }
      }

      // 참가자들
      if (data.participants && Array.isArray(data.participants) && data.createdAt) {
        data.participants.forEach(uid => {
          if (membersByUid.has(uid)) {
            const existing = userEarliestActivity.get(uid)
            if (!existing || data.createdAt.seconds < existing.seconds) {
              userEarliestActivity.set(uid, data.createdAt)
            }
          }
        })
      }
    })

    console.log(`  발견: ${userEarliestActivity.size}명의 활동 이력\n`)

    // 2-2. activityLogs에서 찾기
    console.log('🔍 activityLogs 컬렉션 분석 중...')
    const logsSnapshot = await getDocs(collection(db, 'activityLogs'))

    logsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      const uid = data.uid
      const timestamp = data.timestamp || data.createdAt

      if (uid && timestamp && membersByUid.has(uid)) {
        const existing = userEarliestActivity.get(uid)
        if (!existing || timestamp.seconds < existing.seconds) {
          userEarliestActivity.set(uid, timestamp)
        }
      }
    })

    console.log(`  추가 발견: ${userEarliestActivity.size}명의 활동 이력\n`)

    // 2-3. userProfiles의 createdAt 확인
    console.log('🔍 userProfiles 컬렉션 분석 중...')
    const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))

    userProfilesSnapshot.forEach((docSnapshot) => {
      const uid = docSnapshot.id
      const data = docSnapshot.data()
      const timestamp = data.createdAt

      if (uid && timestamp && membersByUid.has(uid)) {
        const existing = userEarliestActivity.get(uid)
        if (!existing || timestamp.seconds < existing.seconds) {
          userEarliestActivity.set(uid, timestamp)
        }
      }
    })

    console.log(`  최종: ${userEarliestActivity.size}명의 활동 이력\n`)

    // 3. 크루 생성일을 기본값으로 사용
    const orgCreatedAt = {
      seconds: 1761025700,
      nanoseconds: 765000000
    }

    // 4. 각 멤버의 가입일 업데이트
    console.log('⚙️  가입일 업데이트 시작...\n')

    const updates = []

    membersByUid.forEach((member, uid) => {
      let joinDate = userEarliestActivity.get(uid)

      // 활동 이력이 없으면 크루 생성일 사용
      if (!joinDate) {
        joinDate = orgCreatedAt
      }

      updates.push({
        uid,
        name: member.name,
        docId: member.docId,
        joinDate: joinDate
      })
    })

    // 가입일순 정렬 (이른 순서대로)
    updates.sort((a, b) => a.joinDate.seconds - b.joinDate.seconds)

    console.log('📋 업데이트할 멤버 (가입일순):\n')
    updates.forEach((update, idx) => {
      const date = new Date(update.joinDate.seconds * 1000)
      console.log(`  ${idx + 1}. ${update.name} - ${date.toLocaleDateString('ko-KR')}`)
    })

    console.log('\n⚠️  업데이트를 진행합니다...\n')

    // 실제 업데이트
    let updatedCount = 0

    for (const update of updates) {
      await updateDoc(doc(db, 'members', update.docId), {
        joinDate: update.joinDate
      })

      updatedCount++

      if (updatedCount % 10 === 0) {
        console.log(`  진행중... ${updatedCount}/${updates.length}`)
      }
    }

    console.log(`\n✅ ${updatedCount}명 가입일 업데이트 완료`)

    // 통계
    const withActivity = updates.filter(u => u.joinDate.seconds !== orgCreatedAt.seconds).length
    const withoutActivity = updates.length - withActivity

    console.log('\n📊 최종 통계:')
    console.log(`  - 활동 이력으로 복구: ${withActivity}명`)
    console.log(`  - 크루 생성일로 설정: ${withoutActivity}명`)
    console.log(`\n🎉 가입일 복구 완료!`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

restoreJoinDates()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
