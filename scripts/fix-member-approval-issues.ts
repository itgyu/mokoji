/**
 * 멤버 승인 시스템 완전 수정 스크립트
 *
 * 해결하는 문제:
 * 1. 중복 멤버 표시 (members + organizationMembers 양쪽 조회)
 * 2. Invalid Date 문제 (joinDate vs joinedAt 필드명 불일치)
 * 3. 동명이인 처리 없음
 *
 * 실행 방법:
 * npx tsx scripts/fix-member-approval-issues.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

// Firebase Admin 초기화
const serviceAccountPath = path.join(__dirname, '../new-firebase-key.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다:', serviceAccountPath)
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath)
  })
}

const db = getFirestore()

// ==================================================
// 1단계: 기존 잘못된 데이터 정리
// ==================================================

async function cleanupOldMembersCollection() {
  console.log('\n📌 1단계: 구 members 컬렉션 정리 중...')

  const membersSnapshot = await db.collection('members').get()
  console.log(`  - 발견된 구 members 레코드: ${membersSnapshot.size}개`)

  const batch = db.batch()
  let deleteCount = 0

  for (const doc of membersSnapshot.docs) {
    const data = doc.data()
    const orgId = data.orgId
    const uid = data.uid

    if (!orgId || !uid) {
      console.log(`  ⚠️  건너뜀: 필수 필드 없음 (docId: ${doc.id})`)
      continue
    }

    // organizationMembers에 이미 존재하는지 확인
    const orgMemberQuery = await db
      .collection('organizationMembers')
      .where('organizationId', '==', orgId)
      .where('userId', '==', uid)
      .get()

    if (orgMemberQuery.size > 0) {
      // 이미 organizationMembers에 있으면 구 members에서 삭제
      batch.delete(doc.ref)
      deleteCount++
      console.log(`  ✅ 삭제 예정: ${data.name} (${uid}) - organizationMembers에 이미 존재`)
    } else {
      console.log(`  ℹ️  유지: ${data.name} (${uid}) - organizationMembers에 없음 (나중에 마이그레이션)`)
    }
  }

  if (deleteCount > 0) {
    await batch.commit()
    console.log(`  ✅ ${deleteCount}개의 중복 레코드 삭제 완료`)
  } else {
    console.log(`  ℹ️  삭제할 중복 레코드 없음`)
  }
}

// ==================================================
// 2단계: 구 members → organizationMembers 마이그레이션
// ==================================================

async function migrateOldMembersToOrganizationMembers() {
  console.log('\n📌 2단계: 구 members → organizationMembers 마이그레이션 중...')

  const membersSnapshot = await db.collection('members').get()

  if (membersSnapshot.empty) {
    console.log('  ℹ️  마이그레이션할 레코드 없음')
    return
  }

  console.log(`  - 발견된 members 레코드: ${membersSnapshot.size}개`)

  let migratedCount = 0
  let skipCount = 0

  for (const doc of membersSnapshot.docs) {
    const data = doc.data()
    const { orgId, uid, name, email, avatar, role } = data

    if (!orgId || !uid) {
      console.log(`  ⚠️  건너뜀: 필수 필드 없음 (docId: ${doc.id})`)
      skipCount++
      continue
    }

    // organizationMembers에 이미 존재하는지 확인
    const existingQuery = await db
      .collection('organizationMembers')
      .where('organizationId', '==', orgId)
      .where('userId', '==', uid)
      .get()

    if (existingQuery.size > 0) {
      console.log(`  ℹ️  건너뜀: ${name} (${uid}) - 이미 존재함`)
      skipCount++
      continue
    }

    // organizationMembers에 추가
    const newMemberData = {
      organizationId: orgId,
      userId: uid,
      role: role === '멤버' ? 'member' : role === '운영진' ? 'admin' : 'member',
      permissions: [],
      status: 'active',
      stats: {
        eventsAttended: 0,
        postsCreated: 0,
        lastActivityAt: Timestamp.now()
      },
      joinedAt: Timestamp.now(), // ✅ 올바른 Timestamp
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      organizationId_userId: `${orgId}_${uid}`
    }

    await db.collection('organizationMembers').add(newMemberData)
    migratedCount++
    console.log(`  ✅ 마이그레이션: ${name} (${uid})`)
  }

  console.log(`\n  ✅ 마이그레이션 완료: ${migratedCount}개`)
  console.log(`  ℹ️  건너뜀: ${skipCount}개`)
}

// ==================================================
// 3단계: organizationMembers의 잘못된 joinedAt 필드 수정
// ==================================================

async function fixInvalidJoinedAtFields() {
  console.log('\n📌 3단계: organizationMembers의 잘못된 joinedAt 필드 수정 중...')

  const orgMembersSnapshot = await db.collection('organizationMembers').get()
  console.log(`  - 전체 organizationMembers: ${orgMembersSnapshot.size}개`)

  let fixedCount = 0

  for (const doc of orgMembersSnapshot.docs) {
    const data = doc.data()
    const joinedAt = data.joinedAt

    // joinedAt이 없거나 문자열인 경우 (잘못된 형식)
    if (!joinedAt || typeof joinedAt === 'string') {
      await doc.ref.update({
        joinedAt: data.createdAt || Timestamp.now(), // createdAt 사용 또는 현재 시간
        updatedAt: Timestamp.now()
      })
      fixedCount++
      console.log(`  ✅ 수정: ${data.userId} - joinedAt을 Timestamp로 변환`)
    }
  }

  console.log(`  ✅ 수정 완료: ${fixedCount}개`)
}

// ==================================================
// 4단계: 동명이인 접미사 추가
// ==================================================

async function addSuffixesForSameNames() {
  console.log('\n📌 4단계: 동명이인 A,B,C,... 접미사 추가 중...')

  // 모든 조직 가져오기
  const orgsSnapshot = await db.collection('organizations').get()

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id
    const orgName = orgDoc.data().name

    console.log(`\n  🔍 크루: ${orgName} (${orgId})`)

    // 해당 조직의 모든 활성 멤버 가져오기
    const membersSnapshot = await db
      .collection('organizationMembers')
      .where('organizationId', '==', orgId)
      .where('status', '==', 'active')
      .get()

    if (membersSnapshot.empty) {
      console.log(`    ℹ️  멤버 없음`)
      continue
    }

    // 멤버를 이름별로 그룹화 (joinedAt 오름차순 정렬)
    const membersByName: { [name: string]: any[] } = {}

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data()

      // userProfiles에서 이름 가져오기
      const userDoc = await db.doc(`userProfiles/${memberData.userId}`).get()
      if (!userDoc.exists) {
        console.log(`    ⚠️  userProfile 없음: ${memberData.userId}`)
        continue
      }

      const userName = userDoc.data()?.name || '알 수 없음'

      if (!membersByName[userName]) {
        membersByName[userName] = []
      }

      membersByName[userName].push({
        docId: memberDoc.id,
        userId: memberData.userId,
        joinedAt: memberData.joinedAt || Timestamp.now(),
        memberData
      })
    }

    // 각 이름별로 처리
    for (const [userName, members] of Object.entries(membersByName)) {
      if (members.length === 1) {
        // 동명이인 아님 - 기존 suffix 제거
        const member = members[0]
        const userDoc = await db.doc(`userProfiles/${member.userId}`).get()
        const currentName = userDoc.data()?.name || ''

        // 기존에 suffix가 있었다면 제거
        const nameSuffixMatch = currentName.match(/^(.+)\s+([A-Z])$/)
        if (nameSuffixMatch) {
          const baseName = nameSuffixMatch[1]
          await db.doc(`userProfiles/${member.userId}`).update({
            name: baseName,
            updatedAt: Timestamp.now()
          })
          console.log(`    ✅ Suffix 제거: ${currentName} → ${baseName}`)
        }
      } else {
        // 동명이인 - 가입일자 순으로 정렬 후 A, B, C, ... 붙이기
        members.sort((a, b) => {
          const aTime = a.joinedAt?.seconds || 0
          const bTime = b.joinedAt?.seconds || 0
          return aTime - bTime // 가입일이 빠른 순
        })

        console.log(`    👥 동명이인 발견: ${userName} (${members.length}명)`)

        for (let i = 0; i < members.length; i++) {
          const member = members[i]
          const suffix = String.fromCharCode(65 + i) // A, B, C, ...

          const newName = `${userName} ${suffix}`

          await db.doc(`userProfiles/${member.userId}`).update({
            name: newName,
            updatedAt: Timestamp.now()
          })

          console.log(`      ✅ ${i + 1}번째: ${userName} → ${newName}`)
        }
      }
    }
  }

  console.log('\n  ✅ 동명이인 처리 완료')
}

// ==================================================
// 5단계: 최종 검증
// ==================================================

async function validateFix() {
  console.log('\n📌 5단계: 최종 검증 중...')

  // 1. 구 members 컬렉션 확인
  const membersCount = (await db.collection('members').get()).size
  console.log(`  - 구 members 컬렉션: ${membersCount}개 (0개여야 정상)`)

  // 2. organizationMembers 확인
  const orgMembersCount = (await db.collection('organizationMembers').get()).size
  console.log(`  - organizationMembers 컬렉션: ${orgMembersCount}개`)

  // 3. 잘못된 joinedAt 확인
  const orgMembersSnapshot = await db.collection('organizationMembers').get()
  let invalidDateCount = 0

  for (const doc of orgMembersSnapshot.docs) {
    const joinedAt = doc.data().joinedAt
    if (!joinedAt || typeof joinedAt === 'string') {
      invalidDateCount++
    }
  }

  console.log(`  - 잘못된 joinedAt: ${invalidDateCount}개 (0개여야 정상)`)

  if (membersCount === 0 && invalidDateCount === 0) {
    console.log('\n  ✅ 모든 검증 통과!')
  } else {
    console.log('\n  ⚠️  일부 문제가 남아있습니다.')
  }
}

// ==================================================
// 메인 실행
// ==================================================

async function main() {
  console.log('🚀 멤버 승인 시스템 완전 수정 시작\n')
  console.log('=' .repeat(60))

  try {
    // 1. 구 members 컬렉션 정리
    await cleanupOldMembersCollection()

    // 2. 마이그레이션
    await migrateOldMembersToOrganizationMembers()

    // 3. joinedAt 필드 수정
    await fixInvalidJoinedAtFields()

    // 4. 동명이인 처리
    await addSuffixesForSameNames()

    // 5. 최종 검증
    await validateFix()

    console.log('\n' + '='.repeat(60))
    console.log('✅ 모든 작업 완료!')
    console.log('\n다음 단계:')
    console.log('1. app/dashboard/page.tsx의 handleApproveMember 함수 수정')
    console.log('2. app/crew/[crewId]/settings/page.tsx에서 organizationMembers 사용')
    console.log('3. 코드 변경사항 커밋 및 배포')

  } catch (error) {
    console.error('\n❌ 오류 발생:', error)
    process.exit(1)
  }
}

main()
