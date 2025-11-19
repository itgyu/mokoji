/**
 * Firebase 프로젝트 마이그레이션 스크립트 (전체 버전)
 * it-s-campers-95640 → mokojiya
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc
} from 'firebase/firestore'

// 기존 프로젝트 설정
const oldConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
}

// 새 프로젝트 설정
const newConfig = {
  projectId: "mokojiya",
  appId: "1:1091904586656:web:11a0607cebee015f0c5ac5",
  storageBucket: "mokojiya.firebasestorage.app",
  apiKey: "AIzaSyAxNhznk06xHqhuAB9qAW99LiQayRtzS-I",
  authDomain: "mokojiya.firebaseapp.com",
  messagingSenderId: "1091904586656"
}

console.log('🔧 Firebase 앱 초기화 중...')
const oldApp = initializeApp(oldConfig, 'old')
const newApp = initializeApp(newConfig, 'new')

const oldDb = getFirestore(oldApp)
const newDb = getFirestore(newApp)
console.log('✅ Firebase 앱 초기화 완료')

// S3 URL 업데이트
function updateS3Urls(data: any): any {
  if (typeof data === 'string') {
    return data
      .replace(/its-campers\.s3\.ap-northeast-2\.amazonaws\.com/g, 'mokoji.s3.ap-northeast-2.amazonaws.com')
      .replace(/s3:\/\/its-campers\//g, 's3://mokoji/')
  }

  if (Array.isArray(data)) {
    return data.map(item => updateS3Urls(item))
  }

  if (data && typeof data === 'object') {
    const updated: any = {}
    for (const [key, value] of Object.entries(data)) {
      updated[key] = updateS3Urls(value)
    }
    return updated
  }

  return data
}

// 컬렉션 마이그레이션
async function migrateCollection(collectionName: string) {
  console.log(`\n📦 ${collectionName} 컬렉션 마이그레이션 중...`)

  try {
    const oldCollectionRef = collection(oldDb, collectionName)
    const oldSnapshot = await getDocs(oldCollectionRef)

    console.log(`  ✓ ${oldSnapshot.size}개의 문서 발견`)

    if (oldSnapshot.empty) {
      console.log(`  ⏭️  빈 컬렉션, 건너뜀`)
      return
    }

    let count = 0

    for (const oldDoc of oldSnapshot.docs) {
      let data = oldDoc.data()
      data = updateS3Urls(data)

      const newDocRef = doc(newDb, collectionName, oldDoc.id)
      await setDoc(newDocRef, data)
      count++

      if (count % 10 === 0) {
        console.log(`  ✓ ${count}/${oldSnapshot.size} 문서 완료`)
      }
    }

    console.log(`  ✅ ${collectionName}: ${count}개 문서 마이그레이션 완료`)
  } catch (error: any) {
    console.error(`  ❌ ${collectionName} 마이그레이션 실패:`)
    console.error(`     오류: ${error.message}`)
  }
}

// 메인
async function main() {
  console.log('🚀 Firebase 프로젝트 마이그레이션 시작')
  console.log('   기존: it-s-campers-95640')
  console.log('   신규: mokojiya')
  console.log('='.repeat(60))

  const collections = [
    'members',
    'userProfiles',
    'organizations',
    'organizationMembers',
    'schedules',
    'schedule_chats',
    'activity_logs'
  ]

  for (const collectionName of collections) {
    await migrateCollection(collectionName)
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎉 마이그레이션 완료!')
  console.log('='.repeat(60))
  console.log('\n📝 다음 단계:')
  console.log('1. ✅ S3 파일 마이그레이션 완료')
  console.log('2. ✅ Firestore 데이터 마이그레이션 완료')
  console.log('3. ⏭️  .env.local 파일 업데이트 필요')
  console.log('4. ⏭️  Vercel 환경 변수 업데이트 필요')
  console.log('5. ⏭️  Firestore 보안 규칙을 원래대로 복원 필요')

  process.exit(0)
}

main().catch((error) => {
  console.error('\n❌ 마이그레이션 실패:', error)
  process.exit(1)
})
