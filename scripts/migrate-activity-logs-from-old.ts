import * as admin from 'firebase-admin'

// 이전 Firebase 프로젝트
const oldServiceAccount = require('../old-firebase-key.json')
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount)
}, 'old')

// 새 Firebase 프로젝트
const newServiceAccount = require('../new-firebase-key.json')
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount)
}, 'new')

const oldDb = oldApp.firestore()
const newDb = newApp.firestore()

async function migrateActivityLogs() {
  console.log('🚀 activityLogs 마이그레이션 시작 (이전 → 새 프로젝트)\n')

  try {
    // 1. 이전 프로젝트의 activityLogs 컬렉션 확인
    const activityLogsSnapshot = await oldDb.collection('activityLogs').get()
    console.log(`📦 이전 프로젝트에서 ${activityLogsSnapshot.size}개의 activity log 발견\n`)

    if (activityLogsSnapshot.size === 0) {
      console.log('⚠️  마이그레이션할 데이터가 없습니다.')
      return
    }

    let successCount = 0
    let errorCount = 0
    const orgMap: Record<string, number> = {}

    // 2. 새 프로젝트의 organizations/{orgId}/activity_logs로 마이그레이션
    for (const doc of activityLogsSnapshot.docs) {
      try {
        const data = doc.data()
        const orgId = data.orgId

        if (!orgId) {
          console.error(`❌ 문서 ${doc.id}: orgId가 없습니다. 건너뜀.`)
          errorCount++
          continue
        }

        // 새 프로젝트의 organizations/{orgId}/activity_logs/{docId}로 저장
        await newDb
          .collection('organizations')
          .doc(orgId)
          .collection('activity_logs')
          .doc(doc.id)
          .set(data)

        successCount++
        orgMap[orgId] = (orgMap[orgId] || 0) + 1

        if (successCount % 10 === 0) {
          console.log(`   진행중: ${successCount}/${activityLogsSnapshot.size}`)
        }
      } catch (error) {
        errorCount++
        console.error(`❌ 문서 ${doc.id} 마이그레이션 실패:`, error)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 마이그레이션 완료')
    console.log('='.repeat(50))
    console.log(`✅ 성공: ${successCount}개`)
    console.log(`❌ 실패: ${errorCount}개\n`)

    if (Object.keys(orgMap).length > 0) {
      console.log('크루별 로그 분포:')
      for (const [orgId, count] of Object.entries(orgMap)) {
        console.log(`   ${orgId}: ${count}개`)
      }
    }

    console.log('\n🎉 마이그레이션 완료!')
  } catch (error) {
    console.error('💥 마이그레이션 중 오류:', error)
    throw error
  } finally {
    await oldApp.delete()
    await newApp.delete()
  }
}

migrateActivityLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
