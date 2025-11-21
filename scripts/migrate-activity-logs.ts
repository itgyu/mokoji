import * as admin from 'firebase-admin'

const serviceAccount = require('../new-firebase-key.json')
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = app.firestore()

async function migrateActivityLogs() {
  console.log('🚀 activityLogs → organizations/activity_logs 마이그레이션 시작\n')

  try {
    // 1. activityLogs 컬렉션의 모든 문서 가져오기
    const activityLogsSnapshot = await db.collection('activityLogs').get()
    console.log(`📦 총 ${activityLogsSnapshot.size}개의 activity log 발견\n`)

    if (activityLogsSnapshot.size === 0) {
      console.log('⚠️  마이그레이션할 데이터가 없습니다.')
      return
    }

    let successCount = 0
    let errorCount = 0
    const orgMap: Record<string, number> = {}

    // 2. 각 로그를 organizations 서브컬렉션으로 이동
    for (const doc of activityLogsSnapshot.docs) {
      try {
        const data = doc.data()
        const orgId = data.orgId

        if (!orgId) {
          console.error(`❌ 문서 ${doc.id}: orgId가 없습니다. 건너뜀.`)
          errorCount++
          continue
        }

        // organizations/{orgId}/activity_logs/{docId}로 복사
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('activity_logs')
          .doc(doc.id)
          .set(data)

        // 원본 삭제
        await db.collection('activityLogs').doc(doc.id).delete()

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

    console.log('크루별 로그 분포:')
    for (const [orgId, count] of Object.entries(orgMap)) {
      console.log(`   ${orgId}: ${count}개`)
    }

    console.log('\n🎉 마이그레이션 완료!')
  } catch (error) {
    console.error('💥 마이그레이션 중 오류:', error)
    throw error
  } finally {
    await app.delete()
  }
}

migrateActivityLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
