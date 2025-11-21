import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

const serviceAccount = require('../new-firebase-key.json')
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = app.firestore()

// Timestamp 변환 헬퍼 함수
function convertToTimestamp(value: any): Timestamp {
  // 이미 Timestamp인 경우
  if (value instanceof Timestamp) {
    return value
  }

  // 숫자인 경우 (Unix timestamp)
  if (typeof value === 'number') {
    return Timestamp.fromMillis(value)
  }

  // 문자열인 경우
  if (typeof value === 'string') {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return Timestamp.fromDate(date)
      }
    } catch (error) {
      // 실패 시 현재 시간 반환
    }
  }

  // _seconds와 _nanoseconds 객체인 경우
  if (typeof value === 'object' && value !== null) {
    const seconds = value._seconds || value.seconds
    const nanoseconds = value._nanoseconds || value.nanoseconds || 0
    if (typeof seconds === 'number') {
      return new Timestamp(seconds, nanoseconds)
    }
  }

  // 기본값: 현재 시간
  return Timestamp.now()
}

async function migrateChatsToSubcollection() {
  console.log('🚀 채팅 메시지 마이그레이션 시작\n')
  console.log('📦 schedule_chats → org_schedules/{scheduleId}/messages\n')

  try {
    // 1. schedule_chats 컬렉션의 모든 메시지 가져오기
    const chatsSnapshot = await db.collection('schedule_chats').get()
    console.log(`📬 총 ${chatsSnapshot.size}개의 메시지 발견\n`)

    if (chatsSnapshot.size === 0) {
      console.log('⚠️  마이그레이션할 메시지가 없습니다.')
      return
    }

    // scheduleId별로 메시지 그룹화
    const messagesBySchedule: Record<string, any[]> = {}

    for (const doc of chatsSnapshot.docs) {
      const data = doc.data()
      const scheduleId = data.scheduleId

      if (!scheduleId) {
        console.log(`⚠️  메시지 ${doc.id}: scheduleId 없음 (건너뜀)`)
        continue
      }

      if (!messagesBySchedule[scheduleId]) {
        messagesBySchedule[scheduleId] = []
      }

      messagesBySchedule[scheduleId].push({
        id: doc.id,
        ...data
      })
    }

    console.log(`📊 ${Object.keys(messagesBySchedule).length}개의 일정에 메시지 분포\n`)

    let totalMigrated = 0
    let totalFixed = 0
    let totalErrors = 0

    // 2. 각 일정별로 서브컬렉션으로 마이그레이션
    for (const [scheduleId, messages] of Object.entries(messagesBySchedule)) {
      // 일정 정보 가져오기
      const scheduleDoc = await db.collection('org_schedules').doc(scheduleId).get()

      if (!scheduleDoc.exists) {
        console.log(`❌ 일정 ${scheduleId}: 존재하지 않음 (${messages.length}개 메시지 건너뜀)`)
        totalErrors += messages.length
        continue
      }

      const scheduleData = scheduleDoc.data()
      console.log(`\n📋 일정: ${scheduleData?.title || scheduleId}`)
      console.log(`   메시지: ${messages.length}개`)

      let migratedCount = 0
      let fixedCount = 0

      for (const message of messages) {
        try {
          // createdAt과 updatedAt을 Timestamp로 변환
          const createdAt = convertToTimestamp(message.createdAt)
          const updatedAt = convertToTimestamp(message.updatedAt || message.createdAt)

          // Timestamp가 변환된 경우 카운트
          if (!(message.createdAt instanceof Timestamp)) {
            fixedCount++
          }

          // 서브컬렉션에 메시지 저장 (원본 ID 유지)
          await db
            .collection('org_schedules')
            .doc(scheduleId)
            .collection('messages')
            .doc(message.id)
            .set({
              scheduleId: message.scheduleId,
              senderId: message.senderId,
              senderName: message.senderName,
              senderAvatar: message.senderAvatar || null,
              content: message.content || '',
              type: message.type || 'text',
              attachments: message.attachments || null,
              replyTo: message.replyTo || null,
              reactions: message.reactions || null,
              createdAt,
              updatedAt,
              isDeleted: message.isDeleted || false,
              deletedAt: message.deletedAt || null,
              deletedBy: message.deletedBy || null,
              readBy: message.readBy || [],
            })

          migratedCount++
          totalMigrated++

          if (migratedCount % 10 === 0) {
            console.log(`   진행중: ${migratedCount}/${messages.length}`)
          }
        } catch (error) {
          console.error(`   ❌ 메시지 ${message.id} 마이그레이션 실패:`, error)
          totalErrors++
        }
      }

      console.log(`   ✅ ${migratedCount}개 마이그레이션 완료`)
      if (fixedCount > 0) {
        console.log(`   🔧 ${fixedCount}개 timestamp 수정됨`)
      }
      totalFixed += fixedCount
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 마이그레이션 완료')
    console.log('='.repeat(60))
    console.log(`✅ 마이그레이션: ${totalMigrated}개`)
    console.log(`🔧 Timestamp 수정: ${totalFixed}개`)
    console.log(`❌ 오류: ${totalErrors}개`)

    // 3. 원본 schedule_chats 컬렉션 삭제 여부 확인
    if (totalErrors === 0) {
      console.log('\n⚠️  마이그레이션이 성공적으로 완료되었습니다.')
      console.log('⚠️  schedule_chats 컬렉션을 삭제하려면 Firebase Console에서 수동으로 삭제하세요.')
      console.log('⚠️  또는 이 스크립트를 다시 실행하여 --delete-old 플래그를 추가하세요.')
    } else {
      console.log('\n⚠️  일부 메시지 마이그레이션에 실패했습니다.')
      console.log('⚠️  schedule_chats 컬렉션을 삭제하지 마세요!')
    }

    console.log('\n🎉 작업 완료!')

  } catch (error) {
    console.error('💥 오류 발생:', error)
    throw error
  } finally {
    await app.delete()
  }
}

migrateChatsToSubcollection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
