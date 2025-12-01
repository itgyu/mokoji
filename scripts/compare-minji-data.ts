/**
 * 김민지와 다른 멤버들의 데이터 차이 분석
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

async function compareData() {
  console.log('🔍 김민지 vs 다른 멤버 데이터 비교\n')

  const orgId = 'LDOcG25Y4SvxNqGifSek'

  // organizationMembers 조회
  const orgMembersSnapshot = await db
    .collection('organizationMembers')
    .where('organizationId', '==', orgId)
    .get()

  console.log(`📊 전체 organizationMembers: ${orgMembersSnapshot.size}개\n`)

  // 김민지 찾기
  let minjiDocs = []
  let otherDocs = []

  for (const doc of orgMembersSnapshot.docs) {
    const data = doc.data()
    const userProfileDoc = await db.collection('userProfiles').doc(data.userId).get()
    const userName = userProfileDoc.exists ? userProfileDoc.data()?.name : '알 수 없음'

    if (userName && userName.includes('민지')) {
      minjiDocs.push({ doc, data, userName })
    } else {
      otherDocs.push({ doc, data, userName })
    }
  }

  console.log(`👤 김민지: ${minjiDocs.length}명`)
  console.log(`👥 다른 멤버: ${otherDocs.length}명\n`)

  // 김민지 데이터 출력
  console.log('=== 김민지 데이터 ===')
  for (const { doc, data, userName } of minjiDocs) {
    console.log(`\n이름: ${userName}`)
    console.log(`문서 ID: ${doc.id}`)
    console.log(`데이터:`, JSON.stringify(data, null, 2))
  }

  // 다른 멤버 1명 샘플
  if (otherDocs.length > 0) {
    const sample = otherDocs[0]
    console.log('\n\n=== 다른 멤버 샘플 (비교용) ===')
    console.log(`이름: ${sample.userName}`)
    console.log(`문서 ID: ${sample.doc.id}`)
    console.log(`데이터:`, JSON.stringify(sample.data, null, 2))
  }

  // 필드 비교
  console.log('\n\n=== 필드 존재 여부 비교 ===')
  if (minjiDocs.length > 0 && otherDocs.length > 0) {
    const minjiFields = Object.keys(minjiDocs[0].data)
    const otherFields = Object.keys(otherDocs[0].data)

    console.log('\n김민지 필드:', minjiFields.join(', '))
    console.log('다른 멤버 필드:', otherFields.join(', '))

    const minjiOnly = minjiFields.filter(f => !otherFields.includes(f))
    const otherOnly = otherFields.filter(f => !minjiFields.includes(f))

    if (minjiOnly.length > 0) {
      console.log('\n⚠️ 김민지에만 있는 필드:', minjiOnly.join(', '))
    }
    if (otherOnly.length > 0) {
      console.log('⚠️ 다른 멤버에만 있는 필드:', otherOnly.join(', '))
    }

    // 필드 값 타입 비교
    console.log('\n=== 필드 타입 비교 ===')
    for (const field of minjiFields) {
      if (otherFields.includes(field)) {
        const minjiType = typeof minjiDocs[0].data[field]
        const otherType = typeof otherDocs[0].data[field]
        const minjiValue = minjiDocs[0].data[field]
        const otherValue = otherDocs[0].data[field]

        console.log(`\n${field}:`)
        console.log(`  김민지: ${minjiType} = ${JSON.stringify(minjiValue)}`)
        console.log(`  다른 멤버: ${otherType} = ${JSON.stringify(otherValue)}`)
      }
    }
  }
}

compareData().then(() => {
  console.log('\n✅ 분석 완료')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 오류:', error)
  process.exit(1)
})
