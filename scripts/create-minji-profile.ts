import { db } from '../lib/firebase'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'

async function createMinjiProfile() {
  console.log('🔧 김민지A userProfiles 문서 생성 시작...\n')

  const targetUID = 'kODxwEwwtqMuU60MyTlbA02sgsC2'
  const targetOrgId = 'LDOcG25Y4SvxNqGifSek'

  try {
    // 1. 이미 있는지 확인
    console.log('📦 Step 1: 기존 userProfiles 문서 확인...')
    const profileRef = doc(db, 'userProfiles', targetUID)
    const profileSnap = await getDoc(profileRef)

    if (profileSnap.exists()) {
      console.log('⚠️  이미 userProfiles 문서가 존재합니다!')
      console.log('현재 데이터:', profileSnap.data())

      const data = profileSnap.data()
      const organizations = data.organizations || []

      if (organizations.includes(targetOrgId)) {
        console.log('✅ organizations 배열에 이미 크루 ID가 포함되어 있습니다.')
        return
      } else {
        console.log('⚠️  organizations 배열에 크루 ID가 없습니다. 추가합니다...')

        const updatedOrganizations = [...organizations, targetOrgId]
        await setDoc(profileRef, {
          ...data,
          organizations: updatedOrganizations
        }, { merge: true })

        console.log('✅ organizations 배열에 크루 ID 추가 완료!')
        return
      }
    }

    // 2. 새로운 userProfiles 문서 생성
    console.log('📝 Step 2: 새로운 userProfiles 문서 생성...')

    const newProfileData = {
      name: '김민지A',
      email: 'fjqjwngml@gmail.com',
      organizations: [targetOrgId],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // 기본값들
      photoURL: '',
      gender: '',
      birthdate: '',
      location: '',
      mbti: '',
      bio: ''
    }

    await setDoc(profileRef, newProfileData)

    console.log('✅ userProfiles 문서 생성 완료!')
    console.log('\n생성된 데이터:')
    console.log(JSON.stringify(newProfileData, null, 2))

    // 3. 확인
    console.log('\n📦 Step 3: 생성된 문서 확인...')
    const verifySnap = await getDoc(profileRef)

    if (verifySnap.exists()) {
      console.log('✅ 문서가 정상적으로 생성되었습니다!')
      console.log('문서 ID:', verifySnap.id)
      console.log('organizations:', verifySnap.data().organizations)
    } else {
      console.log('❌ 문서 생성에 실패했습니다.')
    }

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('='.repeat(60))
console.log('김민지A userProfiles 생성 스크립트')
console.log('='.repeat(60))
console.log('')

createMinjiProfile()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패')
    console.error(error)
    process.exit(1)
  })
