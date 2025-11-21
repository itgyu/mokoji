import * as admin from 'firebase-admin'

const serviceAccount = require('../new-firebase-key.json')
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

async function checkAuthUsers() {
  console.log('🔍 Firebase Authentication 사용자 확인\n')

  try {
    const listUsersResult = await admin.auth().listUsers(1000)

    console.log(`📋 총 ${listUsersResult.users.length}명의 사용자 발견\n`)

    for (const user of listUsersResult.users) {
      console.log(`\n사용자: ${user.displayName || user.email}`)
      console.log(`  - UID: ${user.uid}`)
      console.log(`  - Email: ${user.email}`)
      console.log(`  - 생성일: ${user.metadata.creationTime}`)
      console.log(`  - 마지막 로그인: ${user.metadata.lastSignInTime}`)
      console.log(`  - 이메일 인증: ${user.emailVerified}`)
      console.log(`  - Provider: ${user.providerData.map(p => p.providerId).join(', ')}`)
      console.log(`  - 비밀번호 해시: ${user.passwordHash ? '존재함' : '없음'}`)
      console.log(`  - 비밀번호 Salt: ${user.passwordSalt ? '존재함' : '없음'}`)
    }

    console.log('\n✅ 완료!')
  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await app.delete()
  }
}

checkAuthUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
