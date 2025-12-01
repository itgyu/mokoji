/**
 * organizationMembers 컬렉션 백업 스크립트
 *
 * 중요 데이터(특히 joinedAt)를 정기적으로 백업합니다.
 * 마이그레이션 전에 반드시 실행하세요!
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

async function backupOrganizationMembers() {
  try {
    console.log('🔄 organizationMembers 백업 시작...\n')

    // 모든 organizationMembers 가져오기
    const snapshot = await db.collection('organizationMembers').get()

    if (snapshot.empty) {
      console.log('⚠️  백업할 데이터가 없습니다.')
      return
    }

    console.log(`📊 총 ${snapshot.size}개 문서 발견\n`)

    // 백업 데이터 구성
    const backupData: any[] = []

    snapshot.forEach((doc) => {
      const data = doc.data()

      // joinedAt을 읽기 쉬운 형식으로 변환
      let joinedAtReadable = null
      if (data.joinedAt) {
        if (typeof data.joinedAt === 'object' && 'seconds' in data.joinedAt) {
          const date = new Date(data.joinedAt.seconds * 1000)
          joinedAtReadable = date.toISOString()
        } else if (typeof data.joinedAt === 'object' && '_seconds' in data.joinedAt) {
          const date = new Date(data.joinedAt._seconds * 1000)
          joinedAtReadable = date.toISOString()
        }
      }

      backupData.push({
        docId: doc.id,
        ...data,
        joinedAt_backup: data.joinedAt, // 원본 Timestamp 객체
        joinedAt_readable: joinedAtReadable, // 사람이 읽을 수 있는 형식
      })
    })

    // 백업 디렉토리 생성
    const backupDir = path.join(__dirname, '../backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // 파일명에 타임스탬프 추가
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const backupFilePath = path.join(backupDir, `organizationMembers_${timestamp}.json`)

    // JSON 파일로 저장
    fs.writeFileSync(
      backupFilePath,
      JSON.stringify(backupData, null, 2),
      'utf-8'
    )

    console.log(`✅ 백업 완료!`)
    console.log(`📁 파일 위치: ${backupFilePath}`)
    console.log(`📊 백업된 문서 수: ${backupData.length}개\n`)

    // 통계 출력
    const orgsSet = new Set(backupData.map(d => d.organizationId))
    console.log('📈 통계:')
    console.log(`  - 총 크루 수: ${orgsSet.size}개`)
    console.log(`  - 총 멤버 수: ${backupData.length}명`)

    // joinedAt이 있는 멤버 수
    const withJoinedAt = backupData.filter(d => d.joinedAt).length
    console.log(`  - joinedAt 데이터가 있는 멤버: ${withJoinedAt}명`)
    console.log(`  - joinedAt 데이터가 없는 멤버: ${backupData.length - withJoinedAt}명`)

  } catch (error) {
    console.error('❌ 백업 중 오류 발생:', error)
    process.exit(1)
  }
}

backupOrganizationMembers().then(() => {
  console.log('\n✅ 백업 작업 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 백업 실패:', error)
  process.exit(1)
})
