/**
 * Firebase 데이터 마이그레이션 스크립트 (Admin SDK 사용)
 *
 * 구버전 프로젝트: it-s-campers-95640
 * 신버전 프로젝트: mokojiya
 *
 * 실행 방법:
 * 1. Firebase Console에서 서비스 계정 키 다운로드
 *    - https://console.firebase.google.com/project/it-s-campers-95640/settings/serviceaccounts/adminsdk
 *    - https://console.firebase.google.com/project/mokojiya/settings/serviceaccounts/adminsdk
 * 2. 키 파일을 scripts/ 폴더에 저장
 *    - old-service-account.json
 *    - new-service-account.json
 * 3. npx tsx scripts/migrate-from-old-firebase.ts
 */

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'

// 서비스 계정 키 파일 경로
const OLD_SERVICE_ACCOUNT_PATH = path.join(__dirname, 'old-service-account.json')
const NEW_SERVICE_ACCOUNT_PATH = path.join(__dirname, 'new-service-account.json')

// 서비스 계정 키 파일 존재 확인
if (!fs.existsSync(OLD_SERVICE_ACCOUNT_PATH)) {
  console.error('❌ 구버전 서비스 계정 키를 찾을 수 없습니다:')
  console.error('   ' + OLD_SERVICE_ACCOUNT_PATH)
  console.error('\n다운로드 방법:')
  console.error('1. https://console.firebase.google.com/project/it-s-campers-95640/settings/serviceaccounts/adminsdk')
  console.error('2. "새 비공개 키 생성" 클릭')
  console.error('3. 다운로드한 파일을 scripts/old-service-account.json 으로 저장')
  process.exit(1)
}

if (!fs.existsSync(NEW_SERVICE_ACCOUNT_PATH)) {
  console.error('❌ 신버전 서비스 계정 키를 찾을 수 없습니다:')
  console.error('   ' + NEW_SERVICE_ACCOUNT_PATH)
  console.error('\n다운로드 방법:')
  console.error('1. https://console.firebase.google.com/project/mokojiya/settings/serviceaccounts/adminsdk')
  console.error('2. "새 비공개 키 생성" 클릭')
  console.error('3. 다운로드한 파일을 scripts/new-service-account.json 으로 저장')
  process.exit(1)
}

// Firebase Admin 앱 초기화
const oldServiceAccount = JSON.parse(fs.readFileSync(OLD_SERVICE_ACCOUNT_PATH, 'utf8'))
const newServiceAccount = JSON.parse(fs.readFileSync(NEW_SERVICE_ACCOUNT_PATH, 'utf8'))

const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount),
  projectId: 'it-s-campers-95640'
}, 'old')

const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount),
  projectId: 'mokojiya'
}, 'new')

const oldDb = oldApp.firestore()
const newDb = newApp.firestore()

// 마이그레이션할 컬렉션 목록
const COLLECTIONS_TO_MIGRATE = [
  'userProfiles',
  'organizations',
  'schedules',
  'members',
  // 필요한 다른 컬렉션 추가
]

// 서브컬렉션이 있는 컬렉션 (schedules 안의 chats 등)
const COLLECTIONS_WITH_SUBCOLLECTIONS: Record<string, string[]> = {
  'schedules': ['chats', 'participants'],
  'organizations': ['photos'],
  'users': ['schedule_chat_states']
}

async function migrateCollection(collectionName: string) {
  console.log(`\n📦 ${collectionName} 마이그레이션 시작...`)

  try {
    const snapshot = await oldDb.collection(collectionName).get()

    if (snapshot.empty) {
      console.log(`  ℹ️  ${collectionName}: 데이터 없음`)
      return
    }

    console.log(`  📊 ${collectionName}: ${snapshot.size}개 문서 발견`)

    let successCount = 0
    let errorCount = 0

    // Batch 처리 (500개씩)
    const batchSize = 500
    let batch = newDb.batch()
    let operationCount = 0

    for (const docSnapshot of snapshot.docs) {
      try {
        const docId = docSnapshot.id
        const data = docSnapshot.data()

        // 신규 DB에 문서 쓰기
        const newDocRef = newDb.collection(collectionName).doc(docId)
        batch.set(newDocRef, data)
        operationCount++

        // Batch가 가득 차면 커밋하고 새로 시작
        if (operationCount >= batchSize) {
          await batch.commit()
          batch = newDb.batch()
          operationCount = 0
        }

        successCount++

        // 서브컬렉션이 있으면 함께 마이그레이션
        if (COLLECTIONS_WITH_SUBCOLLECTIONS[collectionName]) {
          for (const subCollectionName of COLLECTIONS_WITH_SUBCOLLECTIONS[collectionName]) {
            await migrateSubCollection(collectionName, docId, subCollectionName)
          }
        }

        if (successCount % 10 === 0) {
          console.log(`  ✓ ${successCount}/${snapshot.size} 완료`)
        }
      } catch (error: any) {
        errorCount++
        console.error(`  ❌ 문서 ${docSnapshot.id} 마이그레이션 실패:`, error.message)
      }
    }

    // 남은 batch 커밋
    if (operationCount > 0) {
      await batch.commit()
    }

    console.log(`  ✅ ${collectionName} 완료: ${successCount}개 성공, ${errorCount}개 실패`)
  } catch (error: any) {
    console.error(`  ❌ ${collectionName} 마이그레이션 실패:`, error.message)
  }
}

async function migrateSubCollection(
  parentCollection: string,
  parentDocId: string,
  subCollectionName: string
) {
  try {
    const snapshot = await oldDb
      .collection(parentCollection)
      .doc(parentDocId)
      .collection(subCollectionName)
      .get()

    if (snapshot.empty) return

    console.log(`    📎 ${parentCollection}/${parentDocId}/${subCollectionName}: ${snapshot.size}개`)

    // Batch 처리
    const batch = newDb.batch()

    for (const docSnapshot of snapshot.docs) {
      const docId = docSnapshot.id
      const data = docSnapshot.data()

      const newSubDocRef = newDb
        .collection(parentCollection)
        .doc(parentDocId)
        .collection(subCollectionName)
        .doc(docId)

      batch.set(newSubDocRef, data)
    }

    await batch.commit()
  } catch (error: any) {
    console.error(`    ❌ 서브컬렉션 ${subCollectionName} 마이그레이션 실패:`, error.message)
  }
}

async function main() {
  console.log('🚀 Firebase 데이터 마이그레이션 시작')
  console.log('📍 구버전: it-s-campers-95640')
  console.log('📍 신버전: mokojiya')
  console.log('=' .repeat(60))

  const startTime = Date.now()

  // 각 컬렉션 마이그레이션
  for (const collectionName of COLLECTIONS_TO_MIGRATE) {
    await migrateCollection(collectionName)
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  console.log('\n' + '='.repeat(60))
  console.log(`✅ 마이그레이션 완료! (소요시간: ${duration}초)`)
  console.log('=' .repeat(60))
}

// 스크립트 실행
main()
  .then(() => {
    console.log('\n✨ 모든 작업이 완료되었습니다!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 마이그레이션 중 오류 발생:', error)
    process.exit(1)
  })
