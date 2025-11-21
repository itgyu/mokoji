import * as admin from 'firebase-admin'

// 이전 Firebase 프로젝트 초기화
const oldServiceAccount = require('../old-firebase-key.json')
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount)
}, 'old')

// 새 Firebase 프로젝트 초기화
const newServiceAccount = require('../new-firebase-key.json')
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount)
}, 'new')

const oldDb = oldApp.firestore()
const newDb = newApp.firestore()
const oldAuth = oldApp.auth()
const newAuth = newApp.auth()

async function migrateCollection(collectionName: string) {
  console.log(`\n📦 ${collectionName} 컬렉션 마이그레이션 시작...`)

  try {
    const snapshot = await oldDb.collection(collectionName).get()
    console.log(`   총 ${snapshot.size}개의 문서 발견`)

    let successCount = 0
    let errorCount = 0

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data()
        await newDb.collection(collectionName).doc(doc.id).set(data)
        successCount++
        if (successCount % 10 === 0) {
          console.log(`   진행중: ${successCount}/${snapshot.size}`)
        }
      } catch (error) {
        errorCount++
        console.error(`   ❌ 문서 ${doc.id} 마이그레이션 실패:`, error)
      }
    }

    console.log(`✅ ${collectionName} 완료: ${successCount}개 성공, ${errorCount}개 실패`)
    return { success: successCount, error: errorCount }
  } catch (error) {
    console.error(`❌ ${collectionName} 컬렉션 마이그레이션 실패:`, error)
    return { success: 0, error: -1 }
  }
}

async function migrateSubcollections(parentCollection: string, subcollectionName: string) {
  console.log(`\n📦 ${parentCollection} > ${subcollectionName} 서브컬렉션 마이그레이션 시작...`)

  try {
    const parentDocs = await oldDb.collection(parentCollection).get()
    let totalSuccess = 0
    let totalError = 0

    for (const parentDoc of parentDocs.docs) {
      const subcollectionSnapshot = await oldDb
        .collection(parentCollection)
        .doc(parentDoc.id)
        .collection(subcollectionName)
        .get()

      if (subcollectionSnapshot.size > 0) {
        console.log(`   ${parentDoc.id}: ${subcollectionSnapshot.size}개 문서`)

        for (const subDoc of subcollectionSnapshot.docs) {
          try {
            const data = subDoc.data()
            await newDb
              .collection(parentCollection)
              .doc(parentDoc.id)
              .collection(subcollectionName)
              .doc(subDoc.id)
              .set(data)
            totalSuccess++
          } catch (error) {
            totalError++
            console.error(`   ❌ ${parentDoc.id}/${subDoc.id} 실패:`, error)
          }
        }
      }
    }

    console.log(`✅ ${parentCollection} > ${subcollectionName} 완료: ${totalSuccess}개 성공, ${totalError}개 실패`)
    return { success: totalSuccess, error: totalError }
  } catch (error) {
    console.error(`❌ ${parentCollection} > ${subcollectionName} 마이그레이션 실패:`, error)
    return { success: 0, error: -1 }
  }
}

async function migrateAuthentication() {
  console.log('\n🔐 Authentication 사용자 마이그레이션 시작...')

  try {
    let nextPageToken: string | undefined
    let totalUsers = 0
    let successCount = 0
    let errorCount = 0

    do {
      const listUsersResult = await oldAuth.listUsers(1000, nextPageToken)
      totalUsers += listUsersResult.users.length

      for (const user of listUsersResult.users) {
        try {
          const userImportRecord: admin.auth.UserImportRecord = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            disabled: user.disabled,
            metadata: {
              creationTime: user.metadata.creationTime,
              lastSignInTime: user.metadata.lastSignInTime,
            },
            passwordHash: user.passwordHash,
            passwordSalt: user.passwordSalt,
          }

          await newAuth.importUsers([userImportRecord], {
            hash: {
              algorithm: 'SCRYPT' as any,
              key: Buffer.from(''),
            }
          })

          successCount++
          if (successCount % 10 === 0) {
            console.log(`   진행중: ${successCount}/${totalUsers}`)
          }
        } catch (error: any) {
          // 이미 존재하는 사용자는 무시
          if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
            console.log(`   ⚠️ 사용자 ${user.email} 이미 존재 (건너뜀)`)
            successCount++
          } else {
            errorCount++
            console.error(`   ❌ 사용자 ${user.email} 마이그레이션 실패:`, error.message)
          }
        }
      }

      nextPageToken = listUsersResult.pageToken
    } while (nextPageToken)

    console.log(`✅ Authentication 완료: ${successCount}개 성공, ${errorCount}개 실패`)
    return { success: successCount, error: errorCount }
  } catch (error) {
    console.error('❌ Authentication 마이그레이션 실패:', error)
    return { success: 0, error: -1 }
  }
}

async function main() {
  console.log('🚀 Firebase 완전 마이그레이션 시작')
  console.log('='.repeat(50))

  const results: Record<string, { success: number; error: number }> = {}

  // 1. Authentication 마이그레이션
  results['Authentication'] = await migrateAuthentication()

  // 2. 주요 컬렉션 마이그레이션
  const collections = [
    'organizations',
    'organization_members',
    'org_schedules',
    'schedules',  // 혹시 남아있을 수 있는 구 데이터
    'profiles',
    'schedule_participants',
    'activity_logs',
  ]

  for (const collection of collections) {
    results[collection] = await migrateCollection(collection)
  }

  // 3. 서브컬렉션 마이그레이션
  results['org_schedules > messages'] = await migrateSubcollections('org_schedules', 'messages')
  results['organizations > activity_logs'] = await migrateSubcollections('organizations', 'activity_logs')

  // 최종 결과
  console.log('\n' + '='.repeat(50))
  console.log('📊 마이그레이션 완료 요약')
  console.log('='.repeat(50))

  let totalSuccess = 0
  let totalError = 0

  for (const [name, result] of Object.entries(results)) {
    console.log(`${name}: ${result.success}개 성공, ${result.error}개 실패`)
    totalSuccess += result.success
    totalError += result.error
  }

  console.log('='.repeat(50))
  console.log(`✅ 전체: ${totalSuccess}개 성공, ${totalError}개 실패`)
  console.log('\n🎉 마이그레이션 완료!')

  process.exit(0)
}

main().catch((error) => {
  console.error('💥 마이그레이션 중 치명적 오류:', error)
  process.exit(1)
})
