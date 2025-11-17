'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore'
import { BRAND } from '@/lib/brand'
import { auth, db } from '@/lib/firebase'
import { getCities, getDistricts } from '@/lib/locations'
import { uploadToS3 } from '@/lib/s3-utils'
import { CREW_CATEGORIES } from '@/lib/constants'

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
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [mbti, setMbti] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [interestCategories, setInterestCategories] = useState<string[]>([])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Sync email to userProfiles
      if (user.email) {
        const userProfileRef = doc(db, 'userProfiles', user.uid)
        await setDoc(userProfileRef, {
          email: user.email
        }, { merge: true })

        // Sync email to members collection
        const membersQuery = query(
          collection(db, 'members'),
          where('uid', '==', user.uid)
        )
        const membersSnapshot = await getDocs(membersQuery)
        const updatePromises = membersSnapshot.docs.map(memberDoc =>
          updateDoc(doc(db, 'members', memberDoc.id), {
            email: user.email
          })
        )
        await Promise.all(updatePromises)
      }

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

    // 관심 카테고리 검증
    if (interestCategories.length === 0) {
      setError('최소 1개 이상의 관심 카테고리를 선택해주세요.')
      setLoading(false)
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      let avatarUrl = ''
      if (avatarFile) {
        // S3에 아바타 업로드
        avatarUrl = await uploadToS3(avatarFile, `avatars/${user.uid}`)
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
        email,
        name,
        gender,
        birthdate,
        location,
        mbti: mbti.toUpperCase(),
        avatar: avatarUrl,
        interestCategories: interestCategories,
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="w-full max-w-md">
        {step === 'login' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">⛺</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{BRAND.NAME}</h1>
              <p className="text-gray-600">{BRAND.DESCRIPTION}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF9B50] text-white font-semibold py-3 rounded-lg hover:bg-[#FF8A3D] active:scale-95 transition-all"
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
                    className="text-[#FF9B50] text-sm font-semibold hover:underline"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value)
                      setSelectedDistrict('') // Reset district when city changes
                      setLocation(e.target.value)
                    }}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
                  >
                    <option value="">시/도</option>
                    {getCities().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value)
                      setLocation(`${selectedCity} ${e.target.value}`)
                    }}
                    disabled={!selectedCity}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">구/군</option>
                    {selectedCity && getDistricts(selectedCity).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={mbti}
                  onChange={(e) => setMbti(e.target.value)}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관심 크루 카테고리 * (중복 선택 가능)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-300 rounded-lg bg-gray-50">
                  {CREW_CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={interestCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInterestCategories([...interestCategories, category])
                          } else {
                            setInterestCategories(interestCategories.filter(c => c !== category))
                          }
                        }}
                        className="w-4 h-4 text-[#FF9B50] border-gray-300 rounded focus:ring-[#FF9B50]"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {interestCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {interestCategories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF9B50] text-white text-xs rounded-full">
                        {cat}
                        <button
                          type="button"
                          onClick={() => setInterestCategories(interestCategories.filter(c => c !== cat))}
                          className="hover:text-red-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로필 사진</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50]"
                />
                <p className="text-xs text-gray-500 mt-1">※ 5MB 이하 권장</p>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF9B50] text-white font-semibold py-3 rounded-lg hover:bg-[#FF8A3D] active:scale-95 transition-all"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF9B50] text-white font-semibold py-3 rounded-lg hover:bg-[#FF8A3D] active:scale-95 transition-all"
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
