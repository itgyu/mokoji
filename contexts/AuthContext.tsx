'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export interface UserProfile {
  uid: string
  email: string
  name: string
  gender: string
  birthdate: string
  location: string
  mbti?: string
  avatar?: string
  joinDate: string
  role?: 'member' | 'staff' | 'captain'
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  refreshUserProfile: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (uid: string) => {
    try {
      const user = auth.currentUser
      if (!user) return

      console.log('🔍 프로필 데이터 조회 시작:', uid)

      // 1. members 컬렉션에서 기본 정보 가져오기
      const membersRef = collection(db, 'members')
      let q = query(membersRef, where('uid', '==', uid))
      let querySnapshot = await getDocs(q)

      // uid로 못 찾으면 email로 시도
      if (querySnapshot.empty && user.email) {
        console.log('uid로 못 찾음, email로 재시도:', user.email)
        q = query(membersRef, where('email', '==', user.email))
        querySnapshot = await getDocs(q)
      }

      if (!querySnapshot.empty) {
        const memberDoc = querySnapshot.docs[0]
        const memberData = memberDoc.data()

        // 아바타를 제외한 필드만 로그 출력
        const { avatar, ...memberDataWithoutAvatar } = memberData
        console.log('✅ members 컬렉션 필드 목록:', Object.keys(memberData))
        console.log('✅ members 컬렉션 데이터 (아바타 제외):', memberDataWithoutAvatar)

        // 2. userProfiles 컬렉션에서 상세 프로필 가져오기
        console.log('🔍 userProfiles 컬렉션 조회 시도:', uid)
        const userDocRef = doc(db, 'userProfiles', uid)
        const userDocSnap = await getDoc(userDocRef)

        let userProfileData: any = {}
        if (userDocSnap.exists()) {
          userProfileData = userDocSnap.data()
          console.log('✅ userProfiles 컬렉션 필드 목록:', Object.keys(userProfileData))
          console.log('✅ userProfiles 컬렉션 데이터:', userProfileData)
        } else {
          console.log('⚠️ userProfiles 컬렉션에 문서 없음 - 문서 ID:', uid)
        }

        // members 컬렉션에 혹시 profile 데이터가 포함되어 있는지 확인
        console.log('🔍 memberData에서 중요 필드 확인:')
        console.log('  - name:', memberData.name)
        console.log('  - email:', memberData.email)
        console.log('  - gender:', memberData.gender)
        console.log('  - birthdate:', memberData.birthdate)
        console.log('  - location:', memberData.location)
        console.log('  - mbti:', memberData.mbti)
        console.log('  - joinDate:', memberData.joinDate)
        console.log('  - role:', memberData.role)
        console.log('  - isCaptain:', memberData.isCaptain)
        console.log('  - isStaff:', memberData.isStaff)

        setUserProfile({
          uid: memberData.uid || uid,
          email: memberData.email,
          name: memberData.name,
          gender: userProfileData.gender || memberData.gender || '-',
          birthdate: userProfileData.birthdate || memberData.birthdate || '-',
          location: userProfileData.location || memberData.location || '서울',
          mbti: userProfileData.mbti || memberData.mbti || '-',
          avatar: memberData.avatar || userProfileData.avatar,
          joinDate: memberData.joinDate,
          role: memberData.isCaptain ? 'captain' : (memberData.isStaff ? 'staff' : 'member')
        })

        console.log('✅ 최종 프로필 설정 완료')
      } else {
        console.log('❌ 멤버 데이터를 찾을 수 없음')
        console.log('- uid:', uid)
        console.log('- email:', user.email)
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error)
    }
  }

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        await fetchUserProfile(user.uid)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
