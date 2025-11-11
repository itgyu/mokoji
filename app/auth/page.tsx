'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'

type AuthStep = 'email' | 'login' | 'signup' | 'forgot-password'

export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Signup fields
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [location, setLocation] = useState('')
  const [mbti, setMbti] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      let avatarUrl = ''
      if (avatarFile) {
        const storageRef = ref(storage, `avatars/${user.uid}`)
        await uploadBytes(storageRef, avatarFile)
        avatarUrl = await getDownloadURL(storageRef)
      }

      // 1. members 컬렉션에 기본 정보 저장
      await addDoc(collection(db, 'members'), {
        uid: user.uid,
        email,
        name,
        avatar: avatarUrl,
        joinDate: new Date().toLocaleDateString('ko-KR'),
        isStaff: false,
        isCaptain: false,
        role: '멤버',
        createdAt: serverTimestamp()
      })

      // 2. userProfiles 컬렉션에 상세 프로필 저장
      await setDoc(doc(db, 'userProfiles', user.uid), {
        name,
        gender,
        birthdate,
        location,
        mbti: mbti.toUpperCase(),
        avatar: avatarUrl,
        createdAt: serverTimestamp()
      })

      router.push('/dashboard')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError('회원가입에 실패했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email)
      alert(`${email}로 비밀번호 재설정 링크를 보냈습니다.\n메일함을 확인해주세요.`)
      setStep('login')
      setEmail('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError('비밀번호 재설정 메일 전송에 실패했습니다. 이메일을 확인해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="w-full max-w-md">
        {step === 'login' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">⛺</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">It's Campers Crew</h1>
              <p className="text-gray-600">캠핑 크루와 함께하는 아웃도어 라이프</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-3 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <div className="text-center space-y-2">
                <div>
                  <button
                    type="button"
                    onClick={() => setStep('forgot-password')}
                    className="text-gray-500 text-sm hover:text-gray-700 hover:underline"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">계정이 없으신가요? </span>
                  <button
                    type="button"
                    onClick={() => setStep('signup')}
                    className="text-emerald-600 text-sm font-semibold hover:underline"
                  >
                    회원가입
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {step === 'signup' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">👋</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h1>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 * (최소 6자)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">생년월일 *</label>
                <input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="서울 강남구"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={mbti}
                  onChange={(e) => setMbti(e.target.value)}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로필 사진</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">※ 5MB 이하 권장</p>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-3 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                {loading ? '가입 중...' : '가입하기'}
              </button>

              <button
                type="button"
                onClick={() => setStep('login')}
                className="w-full text-gray-600 text-sm hover:text-gray-900"
              >
                ← 로그인으로 돌아가기
              </button>
            </form>
          </div>
        )}

        {step === 'forgot-password' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🔑</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">비밀번호 찾기</h1>
              <p className="text-gray-600">가입하신 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-3 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                {loading ? '전송 중...' : '비밀번호 재설정 링크 보내기'}
              </button>

              <button
                type="button"
                onClick={() => setStep('login')}
                className="w-full text-gray-600 text-sm hover:text-gray-900"
              >
                ← 로그인으로 돌아가기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
