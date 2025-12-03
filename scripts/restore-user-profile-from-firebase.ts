/**
 * 이전 Firebase 프로젝트에서 사용자 프로필 데이터를 복원하는 스크립트
 *
 * 사용법:
 * 1. Firebase Console에서 서비스 계정 키 다운로드:
 *    https://console.firebase.google.com/project/it-s-campers-95640/settings/serviceaccounts/adminsdk
 * 2. 키 파일을 scripts/old-service-account.json 으로 저장
 * 3. npx tsx scripts/restore-user-profile-from-firebase.ts
 */

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// 서비스 계정 키 파일 경로
const OLD_SERVICE_ACCOUNT_PATH = path.join(__dirname, 'old-service-account.json')

// DynamoDB 클라이언트 설정
const client = new DynamoDBClient({
  region: (process.env.AWS_REGION || 'ap-northeast-2').trim(),
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  },
})
const docClient = DynamoDBDocumentClient.from(client)
const USERS_TABLE = (process.env.DYNAMODB_USERS_TABLE || 'mokoji-users').trim()

// Firebase userId와 Cognito userId 매핑 (이메일 기준)
interface UserMapping {
  email: string
  firebaseUid: string
  cognitoUid: string
  name: string
}

// 복원할 사용자 목록 (Cognito migration 백업에서 가져옴)
const USER_MAPPINGS: UserMapping[] = [
  { email: 'itgyu@kakao.com', firebaseUid: 'Ng2AroWF0BgRDP6nrR1WXqf4ImA3', cognitoUid: 'b468fd2c-c081-705c-4fdd-1f1ccfd445d2', name: '이태규' },
  // 필요한 다른 사용자 추가...
]

async function restoreUserProfiles() {
  // 서비스 계정 키 확인
  if (!fs.existsSync(OLD_SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다:')
    console.error('   ' + OLD_SERVICE_ACCOUNT_PATH)
    console.error('\n다운로드 방법:')
    console.error('1. https://console.firebase.google.com/project/it-s-campers-95640/settings/serviceaccounts/adminsdk')
    console.error('2. "새 비공개 키 생성" 클릭')
    console.error('3. 다운로드한 파일을 scripts/old-service-account.json 으로 저장')
    process.exit(1)
  }

  // Firebase 초기화
  const serviceAccount = JSON.parse(fs.readFileSync(OLD_SERVICE_ACCOUNT_PATH, 'utf8'))
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'it-s-campers-95640'
  })
  const db = app.firestore()

  console.log('🔄 사용자 프로필 복원 시작...\n')

  for (const mapping of USER_MAPPINGS) {
    console.log(`👤 ${mapping.name} (${mapping.email}) 처리 중...`)

    try {
      // Firebase에서 프로필 가져오기
      const firebaseProfileDoc = await db.collection('userProfiles').doc(mapping.firebaseUid).get()

      if (!firebaseProfileDoc.exists) {
        console.log(`   ⚠️ Firebase에 프로필 없음, 건너뜀`)
        continue
      }

      const firebaseProfile = firebaseProfileDoc.data()
      console.log(`   📥 Firebase 프로필 발견:`)
      console.log(`      - birthdate: ${firebaseProfile?.birthdate || '(없음)'}`)
      console.log(`      - location: ${firebaseProfile?.location || '(없음)'}`)
      console.log(`      - avatar: ${firebaseProfile?.avatar ? '(있음)' : '(없음)'}`)
      console.log(`      - gender: ${firebaseProfile?.gender || '(없음)'}`)
      console.log(`      - mbti: ${firebaseProfile?.mbti || '(없음)'}`)

      // DynamoDB 현재 데이터 확인
      const dynamoResult = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: mapping.cognitoUid }
        })
      )

      const currentProfile = dynamoResult.Item
      console.log(`   📦 DynamoDB 현재 데이터:`)
      console.log(`      - birthdate: ${currentProfile?.birthdate || '(없음)'}`)
      console.log(`      - location: ${currentProfile?.location || '(없음)'}`)
      console.log(`      - avatar: ${currentProfile?.avatar ? '(있음)' : '(없음)'}`)

      // 업데이트할 필드 결정 (Firebase 데이터가 더 완전한 경우만 업데이트)
      const updates: Record<string, any> = {}

      // avatar: DynamoDB가 비어있고 Firebase에 있으면 복원
      if ((!currentProfile?.avatar || currentProfile.avatar === '') && firebaseProfile?.avatar) {
        updates.avatar = firebaseProfile.avatar
      }

      // birthdate: 기본값이거나 비어있으면 Firebase에서 복원
      if (
        (!currentProfile?.birthdate || currentProfile.birthdate === '-' || currentProfile.birthdate === '1990-01-01') &&
        firebaseProfile?.birthdate && firebaseProfile.birthdate !== '-'
      ) {
        updates.birthdate = firebaseProfile.birthdate
      }

      // location: 불완전하면 Firebase에서 복원
      if (
        (!currentProfile?.location || currentProfile.location === '서울' || !currentProfile.location.includes(' ')) &&
        firebaseProfile?.location && firebaseProfile.location.includes(' ')
      ) {
        updates.location = firebaseProfile.location
      }

      // gender: 기본값이면 Firebase에서 복원
      if (
        (!currentProfile?.gender || currentProfile.gender === '-') &&
        firebaseProfile?.gender && firebaseProfile.gender !== '-'
      ) {
        updates.gender = firebaseProfile.gender
      }

      // mbti: 기본값이면 Firebase에서 복원
      if (
        (!currentProfile?.mbti || currentProfile.mbti === '-') &&
        firebaseProfile?.mbti && firebaseProfile.mbti !== '-'
      ) {
        updates.mbti = firebaseProfile.mbti
      }

      // interestCategories 복원
      if (
        (!currentProfile?.interestCategories || currentProfile.interestCategories.length === 0) &&
        firebaseProfile?.interestCategories && firebaseProfile.interestCategories.length > 0
      ) {
        updates.interestCategories = firebaseProfile.interestCategories
      }

      if (Object.keys(updates).length > 0) {
        // DynamoDB 업데이트
        const updateExpression = 'SET ' + Object.keys(updates).map((key, i) => `#${key} = :${key}`).join(', ') + ', updatedAt = :updatedAt'
        const expressionAttributeNames: Record<string, string> = {}
        const expressionAttributeValues: Record<string, any> = { ':updatedAt': Date.now() }

        Object.keys(updates).forEach(key => {
          expressionAttributeNames[`#${key}`] = key
          expressionAttributeValues[`:${key}`] = updates[key]
        })

        await docClient.send(
          new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { userId: mapping.cognitoUid },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
          })
        )

        console.log(`   ✅ 업데이트 완료:`)
        Object.keys(updates).forEach(key => {
          const value = key === 'avatar' ? '(있음)' : updates[key]
          console.log(`      - ${key}: ${value}`)
        })
      } else {
        console.log(`   ℹ️  업데이트할 데이터 없음 (이미 완전하거나 Firebase에 더 나은 데이터 없음)`)
      }

    } catch (error) {
      console.error(`   ❌ 오류:`, error)
    }

    console.log('')
  }

  console.log('✅ 복원 완료!')
}

restoreUserProfiles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 오류:', err)
    process.exit(1)
  })
