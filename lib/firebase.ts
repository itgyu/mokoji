import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// 환경변수에서 Firebase 설정 읽기 (mokojiya 프로젝트 사용)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
}

// 디버깅: API 키 확인
console.log('🔍 API Key 길이:', firebaseConfig.apiKey?.length)
console.log('🔍 API Key 끝 문자 코드:', firebaseConfig.apiKey?.charCodeAt(firebaseConfig.apiKey.length - 1))
console.log('🔍 원본 환경변수:', JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_API_KEY))

// Firebase 설정 검증
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase 환경변수가 설정되지 않았습니다!')
  console.error('현재 프로젝트:', firebaseConfig.projectId || '없음')
}

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

console.log('✅ Firebase 초기화 완료:', firebaseConfig.projectId)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
