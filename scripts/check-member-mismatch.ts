import * as admin from 'firebase-admin'
import * as path from 'path'

// Firebase Admin 초기화
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../new-firebase-key.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const adminDb = admin.firestore()

async function checkMemberMismatch() {
  console.log('🔍 members와 organizationMembers 불일치 확인 중...\n')

  try {
    // 1. members 컬렉션의 모든 uid 수집
    console.log('📦 1. members 컬렉션 데이터 로딩...')
    const membersSnapshot = await adminDb.collection('members').get()
    const memberUids = new Set<string>()
    const memberDataMap = new Map<string, any>()

    console.log(`총 ${membersSnapshot.size}개 members 문서 발견\n`)

    membersSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.uid) {
        memberUids.add(data.uid)
        memberDataMap.set(doc.id, {
          docId: doc.id,
          uid: data.uid,
          name: data.name,
          email: data.email,
        })
      }
    })

    // 특정 문서 확인
    const targetDocId = 'kjT3xLjtN4YmU2RnRqus'
    const targetUid = 'sTM4WZrenzXkWf7Kfx6A7bJVhWF2'

    console.log(`🎯 특정 문서 확인 (members):`)
    console.log(`   문서 ID: ${targetDocId}`)
    if (memberDataMap.has(targetDocId)) {
      const targetData = memberDataMap.get(targetDocId)
      console.log(`   ✅ members에 존재함`)
      console.log(`   uid: ${targetData.uid}`)
      console.log(`   name: ${targetData.name}`)
      console.log(`   email: ${targetData.email}`)
    } else {
      console.log(`   ❌ members에서 찾을 수 없음`)
    }

    // 2. organizationMembers 컬렉션의 모든 userId 수집 (uid가 아니라 userId!)
    console.log('\n📦 2. organizationMembers 컬렉션 데이터 로딩...')
    const orgMembersSnapshot = await adminDb.collection('organizationMembers').get()
    const orgMemberUserIds = new Set<string>()
    const orgMemberDataMap = new Map<string, any>()

    console.log(`총 ${orgMembersSnapshot.size}개 organizationMembers 문서 발견\n`)

    orgMembersSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.userId) {  // uid 대신 userId 사용
        orgMemberUserIds.add(data.userId)
        orgMemberDataMap.set(data.userId, {
          docId: doc.id,
          userId: data.userId,
          organizationId: data.organizationId,
          role: data.role,
          status: data.status,
        })
      }
    })

    // 3. 특정 uid가 organizationMembers에 있는지 확인
    console.log(`🎯 특정 uid (${targetUid}) organizationMembers 확인:`)
    if (orgMemberUserIds.has(targetUid)) {
      const orgData = orgMemberDataMap.get(targetUid)
      console.log(`   ✅ organizationMembers에 존재함`)
      console.log(`   문서 ID: ${orgData.docId}`)
      console.log(`   userId: ${orgData.userId}`)
      console.log(`   organizationId: ${orgData.organizationId}`)
      console.log(`   role: ${orgData.role}`)
      console.log(`   status: ${orgData.status}`)
    } else {
      console.log(`   ❌ organizationMembers에서 찾을 수 없음`)
    }

    // 4. members에는 있지만 organizationMembers에 없는 uid 찾기
    console.log('\n📊 3. members에는 있지만 organizationMembers에 없는 uid:')
    const missingInOrgMembers: any[] = []

    memberUids.forEach((uid) => {
      if (!orgMemberUserIds.has(uid)) {
        // members에서 해당 uid의 문서 찾기
        const memberDoc = Array.from(memberDataMap.values()).find(m => m.uid === uid)
        if (memberDoc) {
          missingInOrgMembers.push(memberDoc)
        }
      }
    })

    if (missingInOrgMembers.length > 0) {
      console.log(`   ⚠️  ${missingInOrgMembers.length}개 발견:`)
      missingInOrgMembers.forEach((member, idx) => {
        console.log(`   ${idx + 1}. 문서 ID: ${member.docId}`)
        console.log(`      uid: ${member.uid}`)
        console.log(`      name: ${member.name}`)
        console.log(`      email: ${member.email}`)
        console.log('')
      })
    } else {
      console.log('   ✅ 없음 (모든 members가 organizationMembers에 존재)')
    }

    // 5. organizationMembers에는 있지만 members에 없는 userId 찾기
    console.log('📊 4. organizationMembers에는 있지만 members에 없는 userId:')
    const missingInMembers: any[] = []

    orgMemberUserIds.forEach((userId) => {
      if (!memberUids.has(userId)) {
        const orgMember = orgMemberDataMap.get(userId)
        if (orgMember) {
          missingInMembers.push(orgMember)
        }
      }
    })

    if (missingInMembers.length > 0) {
      console.log(`   ⚠️  ${missingInMembers.length}개 발견:`)
      missingInMembers.forEach((member, idx) => {
        console.log(`   ${idx + 1}. 문서 ID: ${member.docId}`)
        console.log(`      userId: ${member.userId}`)
        console.log(`      organizationId: ${member.organizationId}`)
        console.log(`      role: ${member.role}`)
        console.log(`      status: ${member.status}`)
        console.log('')
      })
    } else {
      console.log('   ✅ 없음 (모든 organizationMembers가 members에 존재)')
    }

    // 6. 요약
    console.log('\n📊 요약:')
    console.log(`   members 총 개수: ${memberUids.size}`)
    console.log(`   organizationMembers 총 개수: ${orgMemberUserIds.size}`)
    console.log(`   members에만 있음: ${missingInOrgMembers.length}`)
    console.log(`   organizationMembers에만 있음: ${missingInMembers.length}`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

checkMemberMismatch()
  .then(() => {
    console.log('\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 실패:', error)
    process.exit(1)
  })
