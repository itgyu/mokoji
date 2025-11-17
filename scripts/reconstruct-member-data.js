/**
 * 멤버 데이터 재구성 스크립트
 *
 * organizations와 다른 컬렉션에서 정보를 수집하여
 * 삭제된 members 데이터를 최대한 복구합니다.
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

async function reconstructMemberData() {
  try {
    console.log('🔍 멤버 데이터 재구성 시작...\n')

    // 1. organizations 컬렉션에서 크루장 정보 가져오기
    const orgsSnapshot = await getDocs(collection(db, 'organizations'))
    const orgInfo = new Map() // orgId -> { captainUid, staffUids, createdAt, ... }

    orgsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      orgInfo.set(docSnapshot.id, {
        name: data.name,
        captainUid: data.createdBy || data.captain || null,
        createdAt: data.createdAt,
        staff: data.staff || []
      })
    })

    console.log('📊 크루 정보:', Array.from(orgInfo.entries()).map(([id, info]) => {
      return `\n  - ${info.name} (${id})\n    크루장: ${info.captainUid || '알 수 없음'}\n    생성일: ${info.createdAt || '알 수 없음'}`
    }).join(''))

    // 2. schedules 컬렉션에서 가입일 추정
    console.log('\n\n🔍 schedules 컬렉션에서 활동 이력 조사...')
    const schedulesSnapshot = await getDocs(collection(db, 'schedules'))
    const userActivityDates = new Map() // uid-orgId -> earliest date

    schedulesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      const orgId = data.orgId
      const participants = data.participants || []
      const createdAt = data.createdAt

      participants.forEach((uid) => {
        const key = `${uid}-${orgId}`
        const existingDate = userActivityDates.get(key)

        if (!existingDate || (createdAt && new Date(createdAt) < new Date(existingDate))) {
          userActivityDates.set(key, createdAt)
        }
      })
    })

    console.log(`  발견된 활동 이력: ${userActivityDates.size}건`)

    // 3. activityLogs 컬렉션에서 가입 로그 찾기
    console.log('\n🔍 activityLogs 컬렉션에서 가입 로그 조사...')
    const logsSnapshot = await getDocs(collection(db, 'activityLogs'))
    const joinLogs = new Map() // uid-orgId -> { date, type }

    logsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()

      if (data.type === 'join' || data.type === 'member_added' || data.action?.includes('가입')) {
        const key = `${data.uid}-${data.orgId}`
        if (!joinLogs.has(key)) {
          joinLogs.set(key, {
            date: data.timestamp || data.createdAt,
            type: data.type
          })
        }
      }
    })

    console.log(`  발견된 가입 로그: ${joinLogs.size}건`)

    // 4. 현재 members 컬렉션 조회
    const membersSnapshot = await getDocs(collection(db, 'members'))
    console.log(`\n📊 현재 members 컬렉션: ${membersSnapshot.size}개 레코드`)

    // 5. 각 멤버의 정보 업데이트
    console.log('\n⚙️  멤버 정보 업데이트 시작...\n')

    let updatedCount = 0
    const updates = []

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data()
      const uid = memberData.uid
      const orgId = memberData.orgId
      const key = `${uid}-${orgId}`

      // 업데이트할 정보 수집
      const updateData = {}

      // 크루장 여부 확인
      orgInfo.forEach((info, oId) => {
        if (oId === orgId && info.captainUid === uid) {
          updateData.isCaptain = true
          updateData.role = '크루장'
        }
      })

      // 운영진 여부 확인
      orgInfo.forEach((info, oId) => {
        if (oId === orgId && info.staff && info.staff.includes(uid)) {
          updateData.isStaff = true
          if (!updateData.role || updateData.role === '멤버') {
            updateData.role = '운영진'
          }
        }
      })

      // 가입일 복구 시도
      const joinLog = joinLogs.get(key)
      const activityDate = userActivityDates.get(key)

      if (joinLog && joinLog.date) {
        updateData.joinDate = joinLog.date
      } else if (activityDate) {
        updateData.joinDate = activityDate
      } else {
        // 크루 생성일을 기본값으로
        const org = orgInfo.get(orgId)
        if (org && org.createdAt) {
          updateData.joinDate = org.createdAt
        }
      }

      // 업데이트 필요한 경우에만 실행
      if (Object.keys(updateData).length > 0) {
        updates.push({
          docId: memberDoc.id,
          uid,
          name: memberData.name,
          updateData
        })
      }
    }

    console.log(`📋 업데이트할 멤버: ${updates.length}명\n`)

    // 업데이트 미리보기
    updates.forEach((update, idx) => {
      console.log(`  ${idx + 1}. ${update.name} (${update.uid})`)
      Object.entries(update.updateData).forEach(([key, value]) => {
        console.log(`     - ${key}: ${value}`)
      })
    })

    console.log('\n⚠️  위 정보로 업데이트를 진행합니다...\n')

    // 실제 업데이트 실행
    for (const update of updates) {
      await updateDoc(doc(db, 'members', update.docId), update.updateData)
      updatedCount++

      if (updatedCount % 10 === 0) {
        console.log(`  진행중... ${updatedCount}/${updates.length}`)
      }
    }

    console.log(`\n✅ ${updatedCount}명 정보 업데이트 완료`)
    console.log(`\n🎉 재구성 완료!`)

    // 최종 통계
    console.log('\n📊 최종 통계:')
    console.log(`  - 크루장으로 복구: ${updates.filter(u => u.updateData.isCaptain).length}명`)
    console.log(`  - 운영진으로 복구: ${updates.filter(u => u.updateData.isStaff).length}명`)
    console.log(`  - 가입일 복구: ${updates.filter(u => u.updateData.joinDate).length}명`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 실행
reconstructMemberData()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
