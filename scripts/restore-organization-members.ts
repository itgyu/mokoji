/**
 * organizationMembers 컬렉션 복구 스크립트
 *
 * 백업 파일로부터 joinedAt 데이터를 복구합니다.
 * 사용법: npm run restore:members <백업파일명>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const serviceAccountPath = path.join(__dirname, '../new-firebase-key.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath)
  })
}

const db = getFirestore()

async function restoreOrganizationMembers(backupFileName: string) {
  try {
    console.log('🔄 organizationMembers 복구 시작...\n')

    // 백업 파일 경로
    const backupFilePath = path.join(__dirname, '../backups', backupFileName)

    if (!fs.existsSync(backupFilePath)) {
      console.error(`❌ 백업 파일을 찾을 수 없습니다: ${backupFilePath}`)
      console.log('\n사용 가능한 백업 파일:')
      const backupDir = path.join(__dirname, '../backups')
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'))
        files.forEach(f => console.log(`  - ${f}`))
      }
      process.exit(1)
    }

    // 백업 파일 읽기
    console.log(`📁 백업 파일: ${backupFileName}`)
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'))
    console.log(`📊 총 ${backupData.length}개 문서 발견\n`)

    // 복구 확인
    console.log('⚠️  주의: 이 작업은 기존 joinedAt 데이터를 백업 데이터로 덮어씁니다.')
    console.log('계속하시겠습니까? (자동으로 10초 후 진행)\n')

    await new Promise(resolve => setTimeout(resolve, 10000))

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    // 각 문서 복구
    for (const item of backupData) {
      try {
        const docRef = db.collection('organizationMembers').doc(item.docId)
        const docSnap = await docRef.get()

        if (!docSnap.exists) {
          console.log(`⚠️  문서가 존재하지 않음: ${item.docId} (건너뜀)`)
          skipCount++
          continue
        }

        // joinedAt_backup이 있으면 복구
        if (item.joinedAt_backup) {
          let timestampToRestore: Timestamp

          // Timestamp 객체로 변환
          if (typeof item.joinedAt_backup === 'object' && 'seconds' in item.joinedAt_backup) {
            timestampToRestore = new Timestamp(
              item.joinedAt_backup.seconds,
              item.joinedAt_backup.nanoseconds || 0
            )
          } else if (typeof item.joinedAt_backup === 'object' && '_seconds' in item.joinedAt_backup) {
            timestampToRestore = new Timestamp(
              item.joinedAt_backup._seconds,
              item.joinedAt_backup._nanoseconds || 0
            )
          } else {
            console.log(`⚠️  잘못된 joinedAt 형식: ${item.docId} (건너뜀)`)
            skipCount++
            continue
          }

          // 현재 값과 비교
          const currentData = docSnap.data()
          const currentJoinedAt = currentData?.joinedAt

          let needsUpdate = true
          if (currentJoinedAt && typeof currentJoinedAt === 'object' && 'seconds' in currentJoinedAt) {
            if (currentJoinedAt.seconds === timestampToRestore.seconds) {
              needsUpdate = false
            }
          }

          if (needsUpdate) {
            // 주의: 이 업데이트는 Firestore Rules에서 막힐 수 있습니다
            // 복구 시에는 Rules를 임시로 비활성화하거나 Admin SDK 사용 필요
            await docRef.update({
              joinedAt: timestampToRestore
            })

            console.log(`✅ 복구: ${item.name} (${item.docId})`)
            successCount++
          } else {
            console.log(`⏭️  이미 올바른 값: ${item.name} (건너뜀)`)
            skipCount++
          }
        } else {
          console.log(`⚠️  백업 데이터에 joinedAt 없음: ${item.docId} (건너뜀)`)
          skipCount++
        }

      } catch (error: any) {
        console.error(`❌ 복구 실패: ${item.docId} -`, error.message)
        errorCount++
      }
    }

    console.log('\n📊 복구 결과:')
    console.log(`  ✅ 성공: ${successCount}개`)
    console.log(`  ⏭️  건너뜀: ${skipCount}개`)
    console.log(`  ❌ 실패: ${errorCount}개`)

  } catch (error) {
    console.error('❌ 복구 중 오류 발생:', error)
    process.exit(1)
  }
}

// 명령줄 인자에서 백업 파일명 가져오기
const backupFileName = process.argv[2]

if (!backupFileName) {
  console.error('❌ 사용법: npm run restore:members <백업파일명>')
  console.log('\n예시:')
  console.log('  npm run restore:members organizationMembers_2025-12-01T12-00-00.json')
  console.log('\n사용 가능한 백업 파일:')

  const backupDir = path.join(__dirname, '../backups')
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'))
    files.forEach(f => console.log(`  - ${f}`))
  } else {
    console.log('  (백업 파일 없음)')
  }

  process.exit(1)
}

restoreOrganizationMembers(backupFileName).then(() => {
  console.log('\n✅ 복구 작업 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 복구 실패:', error)
  process.exit(1)
})
