/**
 * 기존 멤버 데이터를 organizationMembers 컬렉션으로 마이그레이션
 *
 * 목적:
 * - userProfiles.organizations와 members 컬렉션의 데이터를 organizationMembers로 동기화
 * - "내 크루" 기능이 정상적으로 작동하도록 함
 */

const admin = require('firebase-admin')
const path = require('path')

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../new-firebase-key.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()

async function migrateToOrganizationMembers() {
  console.log('🚀 organizationMembers 마이그레이션 시작...\n')

  try {
    // 1. 모든 userProfiles 가져오기
    const userProfilesSnapshot = await db.collection('userProfiles').get()
    console.log(`📊 총 ${userProfilesSnapshot.size}명의 사용자 프로필 발견\n`)

    let totalMigrated = 0
    let totalSkipped = 0
    let totalErrors = 0

    // 2. 각 사용자의 organizations 배열 순회
    for (const userDoc of userProfilesSnapshot.docs) {
      const userId = userDoc.id
      const userData = userDoc.data()
      const organizations = userData.organizations || []

      if (organizations.length === 0) {
        console.log(`⏭️  사용자 ${userData.name || userId}: 가입한 크루 없음`)
        continue
      }

      console.log(`\n👤 사용자: ${userData.name || userId} (${userId})`)
      console.log(`   가입 크루: ${organizations.length}개`)

      // 3. 각 크루에 대해 organizationMembers 문서 생성/확인
      for (const orgId of organizations) {
        try {
          // 이미 존재하는지 확인
          const existingQuery = await db.collection('organizationMembers')
            .where('userId', '==', userId)
            .where('organizationId', '==', orgId)
            .get()

          if (!existingQuery.empty) {
            console.log(`   ✓ ${orgId}: 이미 존재함 (스킵)`)
            totalSkipped++
            continue
          }

          // members 컬렉션에서 추가 정보 가져오기 (선택)
          const memberQuery = await db.collection('members')
            .where('uid', '==', userId)
            .where('orgId', '==', orgId)
            .get()

          let role = 'member'
          let joinedAt = admin.firestore.Timestamp.now()

          if (!memberQuery.empty) {
            const memberData = memberQuery.docs[0].data()
            // isCaptain이 true면 owner, isStaff면 admin, 아니면 member
            if (memberData.isCaptain) {
              role = 'owner'
            } else if (memberData.isStaff) {
              role = 'admin'
            }

            // joinDate가 있으면 사용
            if (memberData.joinDate) {
              try {
                const joinDate = new Date(memberData.joinDate)
                if (!isNaN(joinDate.getTime())) {
                  joinedAt = admin.firestore.Timestamp.fromDate(joinDate)
                }
              } catch (e) {
                // 파싱 실패시 현재 시간 사용
              }
            }
          }

          // organizationMembers 문서 생성
          const newMemberData = {
            organizationId: orgId,
            userId: userId,
            role: role,
            permissions: [],
            status: 'active',
            stats: {
              eventsAttended: 0,
              postsCreated: 0,
              lastActivityAt: admin.firestore.Timestamp.now(),
            },
            joinedAt: joinedAt,
            organizationId_userId: `${orgId}_${userId}`,
          }

          await db.collection('organizationMembers').add(newMemberData)
          console.log(`   ✅ ${orgId}: 추가 완료 (role: ${role})`)
          totalMigrated++

        } catch (error) {
          console.error(`   ❌ ${orgId}: 에러 -`, error)
          totalErrors++
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 마이그레이션 완료!')
    console.log('='.repeat(60))
    console.log(`✅ 추가됨: ${totalMigrated}개`)
    console.log(`⏭️  스킵됨: ${totalSkipped}개 (이미 존재)`)
    console.log(`❌ 에러: ${totalErrors}개`)
    console.log('='.repeat(60))

    // 4. 검증: organizationMembers 총 개수 확인
    const orgMembersSnapshot = await db.collection('organizationMembers').get()
    console.log(`\n🔍 현재 organizationMembers 총 문서 수: ${orgMembersSnapshot.size}개`)

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
    throw error
  }
}

// 실행
migrateToOrganizationMembers()
  .then(() => {
    console.log('\n✅ 스크립트 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 에러:', error)
    process.exit(1)
  })
