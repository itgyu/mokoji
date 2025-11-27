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

async function checkOrgMembersStructure() {
  console.log('🔍 organizationMembers 컬렉션 구조 확인 중...\n')

  try {
    const orgMembersSnapshot = await adminDb.collection('organizationMembers').get()

    console.log(`총 ${orgMembersSnapshot.size}개 문서 발견\n`)

    if (orgMembersSnapshot.size > 0) {
      console.log('📄 첫 5개 문서 샘플:\n')

      orgMembersSnapshot.docs.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data()
        console.log(`${idx + 1}. 문서 ID: ${doc.id}`)
        console.log('   모든 필드:', Object.keys(data))
        console.log('   전체 데이터:')
        console.log(JSON.stringify(data, null, 2))
        console.log('')
      })

      // 특정 organizationId로 필터링
      console.log('\n🔍 하위 컬렉션 확인 (첫 번째 문서):')
      const firstDoc = orgMembersSnapshot.docs[0]
      const subcollections = await firstDoc.ref.listCollections()

      if (subcollections.length > 0) {
        console.log(`   하위 컬렉션 ${subcollections.length}개 발견:`)
        for (const subcol of subcollections) {
          console.log(`   - ${subcol.id}`)

          // 하위 컬렉션의 샘플 문서 확인
          const subDocs = await subcol.limit(2).get()
          if (subDocs.size > 0) {
            console.log(`     (${subDocs.size}개 문서 샘플)`)
            subDocs.docs.forEach((subDoc) => {
              const subData = subDoc.data()
              console.log(`     - 문서 ID: ${subDoc.id}`)
              console.log(`       필드: ${Object.keys(subData).join(', ')}`)
              if (subData.uid) {
                console.log(`       uid: ${subData.uid}`)
              }
              if (subData.name) {
                console.log(`       name: ${subData.name}`)
              }
            })
          }
        }
      } else {
        console.log('   하위 컬렉션 없음')
      }
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

checkOrgMembersStructure()
  .then(() => {
    console.log('\n✅ 확인 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 실패:', error)
    process.exit(1)
  })
