import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

const serviceAccount = require('../new-firebase-key.json')
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = app.firestore()

async function fixMessageTimestamps() {
  console.log('🔧 메시지 timestamp 수정 시작\n')

  try {
    // 모든 org_schedules 가져오기
    const schedulesSnapshot = await db.collection('org_schedules').get()
    console.log(`📅 총 ${schedulesSnapshot.size}개의 일정 발견\n`)

    let totalSchedules = 0
    let totalMessages = 0
    let fixedMessages = 0
    let errorMessages = 0

    for (const scheduleDoc of schedulesSnapshot.docs) {
      totalSchedules++
      const scheduleId = scheduleDoc.id
      const scheduleData = scheduleDoc.data()

      console.log(`\n📋 일정: ${scheduleData.title || scheduleId}`)

      // messages 서브컬렉션 가져오기
      const messagesSnapshot = await db
        .collection('org_schedules')
        .doc(scheduleId)
        .collection('messages')
        .get()

      if (messagesSnapshot.size === 0) {
        console.log('   메시지 없음')
        continue
      }

      console.log(`   총 ${messagesSnapshot.size}개의 메시지`)

      let scheduleFixed = 0
      let scheduleErrors = 0

      for (const messageDoc of messagesSnapshot.docs) {
        totalMessages++
        const messageData = messageDoc.data()
        const createdAt = messageData.createdAt

        let needsUpdate = false
        let newTimestamp: Timestamp | null = null

        // createdAt이 없는 경우
        if (!createdAt) {
          console.log(`   ❌ ${messageDoc.id}: createdAt 없음`)
          newTimestamp = Timestamp.now()
          needsUpdate = true
        }
        // Timestamp 객체가 아닌 경우
        else if (!(createdAt instanceof Timestamp)) {
          // 숫자인 경우 (Unix timestamp)
          if (typeof createdAt === 'number') {
            newTimestamp = Timestamp.fromMillis(createdAt)
            needsUpdate = true
          }
          // 문자열인 경우
          else if (typeof createdAt === 'string') {
            try {
              const date = new Date(createdAt)
              if (!isNaN(date.getTime())) {
                newTimestamp = Timestamp.fromDate(date)
                needsUpdate = true
              } else {
                throw new Error('Invalid date string')
              }
            } catch (error) {
              console.log(`   ❌ ${messageDoc.id}: 잘못된 날짜 형식 (${createdAt})`)
              newTimestamp = Timestamp.now()
              needsUpdate = true
              scheduleErrors++
            }
          }
          // _seconds와 _nanoseconds 객체인 경우 (Firestore export 형식)
          else if (typeof createdAt === 'object' && ('_seconds' in createdAt || 'seconds' in createdAt)) {
            const seconds = (createdAt as any)._seconds || (createdAt as any).seconds
            const nanoseconds = (createdAt as any)._nanoseconds || (createdAt as any).nanoseconds || 0
            newTimestamp = new Timestamp(seconds, nanoseconds)
            needsUpdate = true
          }
          // 기타 알 수 없는 형식
          else {
            console.log(`   ❌ ${messageDoc.id}: 알 수 없는 형식 (${typeof createdAt})`)
            newTimestamp = Timestamp.now()
            needsUpdate = true
            scheduleErrors++
          }
        }

        // 업데이트 필요한 경우
        if (needsUpdate && newTimestamp) {
          try {
            await db
              .collection('org_schedules')
              .doc(scheduleId)
              .collection('messages')
              .doc(messageDoc.id)
              .update({
                createdAt: newTimestamp
              })

            scheduleFixed++
            fixedMessages++

            if (scheduleFixed % 10 === 0) {
              console.log(`   진행중: ${scheduleFixed}개 수정됨`)
            }
          } catch (error) {
            console.error(`   ❌ ${messageDoc.id} 업데이트 실패:`, error)
            errorMessages++
          }
        }
      }

      if (scheduleFixed > 0) {
        console.log(`   ✅ ${scheduleFixed}개 메시지 수정 완료`)
      }
      if (scheduleErrors > 0) {
        console.log(`   ⚠️  ${scheduleErrors}개 메시지 오류`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 최종 결과')
    console.log('='.repeat(60))
    console.log(`일정 수: ${totalSchedules}개`)
    console.log(`전체 메시지: ${totalMessages}개`)
    console.log(`✅ 수정됨: ${fixedMessages}개`)
    console.log(`❌ 오류: ${errorMessages}개`)
    console.log('\n🎉 작업 완료!')

  } catch (error) {
    console.error('💥 오류 발생:', error)
    throw error
  } finally {
    await app.delete()
  }
}

fixMessageTimestamps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
