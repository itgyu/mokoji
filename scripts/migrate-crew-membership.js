const admin = require('firebase-admin')
const serviceAccount = require('../serviceAccountKey.json')

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()

async function migrateCrewMembership() {
  try {
    console.log('🚀 크루 멤버십 마이그레이션 시작...\n')

    // 1. 기본 크루 찾기
    console.log('📍 Step 1: 기본 크루 찾기...')
    const orgsSnapshot = await db.collection('organizations').get()
    let defaultOrg = null

    orgsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.name === '잇츠 캠퍼즈') {
        defaultOrg = { id: doc.id, ...data }
        console.log(`✅ 기본 크루 발견: ${doc.id}`)
      }
    })

    if (!defaultOrg) {
      console.error('❌ 기본 크루를 찾을 수 없습니다!')
      return
    }

    // 2. 모든 유저 프로필 가져오기
    console.log('\n📍 Step 2: 모든 유저 프로필 가져오기...')
    const userProfilesSnapshot = await db.collection('userProfiles').get()
    console.log(`✅ 총 ${userProfilesSnapshot.size}명의 유저 발견\n`)

    let updatedCount = 0
    let skippedCount = 0

    // 3. 각 유저에게 잇츠캠퍼즈 크루 ID 추가
    console.log('📍 Step 3: 유저 프로필 업데이트 중...')

    for (const doc of userProfilesSnapshot.docs) {
      const userData = doc.data()
      const userId = doc.id
      const userName = userData.name || '이름없음'

      // 이미 joinedOrganizations가 있고 기본 크루가 포함되어 있으면 스킵
      if (userData.joinedOrganizations && userData.joinedOrganizations.includes(defaultOrg.id)) {
        console.log(`⏭️  ${userName} (${userId}): 이미 가입됨`)
        skippedCount++
        continue
      }

      // joinedOrganizations 필드 추가 또는 업데이트
      const existingOrgs = userData.joinedOrganizations || []
      const updatedOrgs = [...new Set([...existingOrgs, defaultOrg.id])] // 중복 제거

      await db.collection('userProfiles').doc(userId).update({
        joinedOrganizations: updatedOrgs
      })

      console.log(`✅ ${userName} (${userId}): 기본 크루 자동 가입 완료`)
      updatedCount++
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 마이그레이션 완료!')
    console.log(`✅ 업데이트된 유저: ${updatedCount}명`)
    console.log(`⏭️  스킵된 유저: ${skippedCount}명`)
    console.log(`📊 총 유저: ${userProfilesSnapshot.size}명`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  }
}

// 스크립트 실행
migrateCrewMembership()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패:', error)
    process.exit(1)
  })
