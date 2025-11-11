import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, writeBatch, doc } from 'firebase/firestore'

// Firebase 설정
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

console.log('✅ Firebase 초기화 완료')
console.log('   Project ID:', firebaseConfig.projectId)

async function deleteCollection(collectionName: string) {
  console.log(`\n🗑️  "${collectionName}" 컬렉션 삭제 시작...`)

  try {
    const collectionRef = collection(db, collectionName)
    console.log('   컬렉션 참조 생성 완료')

    const snapshot = await getDocs(collectionRef)
    console.log(`📊 총 ${snapshot.size}개 문서 발견`)

    if (snapshot.size === 0) {
      console.log('⚠️  삭제할 문서가 없습니다. (빈 컬렉션)')
      console.log('   → Firebase Console에서 수동으로 삭제해야 합니다.')
      return
    }

    // 처음 3개 문서 미리보기
    console.log('\n📄 삭제할 문서 샘플:')
    snapshot.docs.slice(0, 3).forEach((doc, idx) => {
      const data = doc.data()
      console.log(`   ${idx + 1}. ID: ${doc.id}`)
      console.log(`      데이터:`, JSON.stringify(data, null, 2).split('\n').slice(0, 3).join('\n'))
    })

    console.log('\n🔄 삭제 진행 중...')

    // Firestore는 한 번에 최대 500개 문서만 배치 삭제 가능
    const batchSize = 500
    let deletedCount = 0

    // 문서를 배치로 나눠서 삭제
    const docs = snapshot.docs
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db)
      const batchDocs = docs.slice(i, Math.min(i + batchSize, docs.length))

      batchDocs.forEach(docSnapshot => {
        console.log(`   삭제: ${docSnapshot.id}`)
        batch.delete(docSnapshot.ref)
      })

      await batch.commit()
      deletedCount += batchDocs.length

      console.log(`   ✅ ${deletedCount}/${docs.length} 삭제 완료`)
    }

    console.log(`\n✅ "${collectionName}" 컬렉션의 모든 문서 삭제 완료!`)
  } catch (error) {
    console.error(`❌ 삭제 실패:`, error)
    if (error instanceof Error) {
      console.error('에러 메시지:', error.message)
      console.error('에러 스택:', error.stack)
    }
    throw error
  }
}

async function main() {
  console.log('🔧 Firebase 데이터베이스 정리 스크립트')
  console.log('==========================================')

  try {
    // org_members 컬렉션 삭제
    await deleteCollection('org_members')

    console.log('\n✅ 모든 정리 작업 완료!')
    console.log('\n📋 정리 요약:')
    console.log('   ✅ org_members 컬렉션 삭제됨')
    console.log('\n현재 사용 중인 컬렉션:')
    console.log('   - userProfiles (사용자 프로필 + 크루 멤버십)')
    console.log('   - members (회원 기본 정보)')
    console.log('   - organizations (크루 정보)')
    console.log('   - org_schedules (크루 일정)')

  } catch (error) {
    console.error('\n❌ 정리 작업 실패:', error)
    process.exit(1)
  }
}

main()
