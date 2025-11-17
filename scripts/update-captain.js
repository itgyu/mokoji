/**
 * 크루장 정보 업데이트 스크립트
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore')

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

async function updateCaptain() {
  try {
    console.log('🔍 크루장 정보 업데이트 시작...\n')

    const CAPTAIN_UID = 'Ng2AroWF0BgRDP6nrR1WXqf4ImA3'
    const ORG_ID = 'LDOcG25Y4SvxNqGifSek'

    // members 컬렉션에서 크루장 찾기
    const membersSnapshot = await getDocs(collection(db, 'members'))

    let captainDoc = null

    membersSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      if (data.uid === CAPTAIN_UID && data.orgId === ORG_ID) {
        captainDoc = { id: docSnapshot.id, data }
      }
    })

    if (!captainDoc) {
      console.log('❌ 크루장을 members 컬렉션에서 찾을 수 없습니다')
      return
    }

    console.log(`✅ 크루장 찾음: ${captainDoc.data.name} (${CAPTAIN_UID})`)
    console.log(`   현재 role: ${captainDoc.data.role}`)
    console.log(`   현재 isCaptain: ${captainDoc.data.isCaptain}`)

    // 크루장 정보 업데이트
    await updateDoc(doc(db, 'members', captainDoc.id), {
      isCaptain: true,
      role: '크루장',
      isStaff: false
    })

    console.log('\n✅ 크루장 정보 업데이트 완료!')
    console.log(`   - isCaptain: true`)
    console.log(`   - role: 크루장`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

updateCaptain()
  .then(() => {
    console.log('\n✅ 스크립트 완료!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 스크립트 실패:', error)
    process.exit(1)
  })
