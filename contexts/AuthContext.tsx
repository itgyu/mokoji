'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getUserProfile, getUserMemberships } from '@/lib/firestore-helpers'
import type { UserProfile as NewUserProfile, OrganizationMember } from '@/types'

// ============================================
// 기존 타입 정의 (하위 호환성 유지)
// ============================================

export interface UserLocation {
  id: string
  name: string              // "집", "직장" 등
  address: string           // "서울특별시 강남구 역삼동"
  sido: string              // "서울특별시"
  sigungu: string           // "강남구"
  dong: string              // "역삼동"
  latitude: number          // 위도
  longitude: number         // 경도
  verifiedAt: Date          // 인증 시각
  isPrimary: boolean        // 주 지역 여부
  radius?: number           // 동네 생활 반경 (미터 단위)
}

export interface UserProfile {
  uid: string
  email: string
  name: string
  gender: string
  birthdate: string
  location: string          // 레거시 호환용 (기존 지역 문자열)
  mbti?: string
  avatar?: string
  joinDate: string
  role?: 'member' | 'staff' | 'captain'
  interestCategories?: string[]
  organizations?: string[]  // 레거시 호환용 (기존 필드)
  joinedOrganizations?: string[]  // 사용자가 가입한 크루 ID 목록
  locations?: UserLocation[]    // 인증된 지역 목록 (최대 2개)
  selectedLocationId?: string   // 현재 선택된 지역 ID
}

// ============================================
// AuthContext 타입 정의
// ============================================

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  memberships: OrganizationMember[]  // 새로 추가: 크루 멤버십 목록
  loading: boolean
  refreshUserProfile: () => Promise<void>
  signOut: () => Promise<void>  // 새로 추가: 로그아웃 함수
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  memberships: [],
  loading: true,
  refreshUserProfile: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

// ============================================
// AuthProvider 구현
// ============================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (uid: string) => {
    try {
      const user = auth.currentUser
      if (!user) return

      console.log('🔍 프로필 데이터 조회 시작:', uid)

      // ============================================
      // 1. members 컬렉션에서 기본 정보 가져오기
      // ============================================
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

        // ============================================
        // 2. userProfiles 컬렉션에서 상세 프로필 가져오기
        // ============================================
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

        // ============================================
        // 3. organizationMembers에서 멤버십 가져오기 (새로 추가)
        // ============================================
        console.log('🔍 organizationMembers 컬렉션 조회 시도:', uid)
        try {
          const userMemberships = await getUserMemberships(uid)
          console.log('✅ organizationMembers:', userMemberships.length, '개')
          setMemberships(userMemberships)

          // joinedOrganizations 업데이트
          const joinedOrgIds = userMemberships.map(m => m.organizationId)
          if (joinedOrgIds.length > 0 && userDocSnap.exists()) {
            await updateDoc(userDocRef, {
              joinedOrganizations: joinedOrgIds
            })
          }
        } catch (error) {
          console.log('⚠️ organizationMembers 조회 실패 (아직 마이그레이션 안됨):', error)
          setMemberships([])
        }

        // Firestore의 Timestamp를 Date로 변환
        const convertLocations = (locations: any[]): UserLocation[] => {
          if (!locations) return []
          return locations.map(loc => ({
            ...loc,
            verifiedAt: loc.verifiedAt?.toDate ? loc.verifiedAt.toDate() : new Date(loc.verifiedAt)
          }))
        }

        // ============================================
        // 4. 기존 유저 자동 마이그레이션 (레거시 지원)
        // ============================================
        let joinedOrgs = userProfileData.joinedOrganizations || []
        if (joinedOrgs.length === 0 && memberships.length === 0) {
          console.log('🔄 기존 유저 감지 - 기본 크루 자동 가입 중...')
          // 모꼬지 기본 크루 ID 찾기
          const orgsSnapshot = await getDocs(collection(db, 'organizations'))
          let defaultCrewId = ''
          orgsSnapshot.forEach(orgDoc => {
            if (orgDoc.data().name === '잇츠 캠퍼즈') {
              defaultCrewId = orgDoc.id
            }
          })

          if (defaultCrewId) {
            joinedOrgs = [defaultCrewId]
            // Firestore에 저장
            if (userDocSnap.exists()) {
              await updateDoc(userDocRef, {
                joinedOrganizations: joinedOrgs
              })
            }
            console.log('✅ 기본 크루 자동 가입 완료')
          }
        } else if (memberships.length > 0) {
          // organizationMembers에서 가져온 데이터로 업데이트
          joinedOrgs = memberships.map(m => m.organizationId)
        }

        // ============================================
        // 5. 최종 프로필 설정
        // ============================================
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
          role: memberData.isCaptain ? 'captain' : (memberData.isStaff ? 'staff' : 'member'),
          interestCategories: userProfileData.interestCategories || [],
          organizations: userProfileData.organizations || [],
          joinedOrganizations: joinedOrgs,
          locations: convertLocations(userProfileData.locations || []),
          selectedLocationId: userProfileData.selectedLocationId || ''
        })

        console.log('✅ 최종 프로필 설정 완료')
        console.log('   - joinedOrganizations:', joinedOrgs)
        console.log('   - memberships:', memberships.length)
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

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setUserProfile(null)
      setMemberships([])
      console.log('✅ 로그아웃 완료')
    } catch (error) {
      console.error('❌ 로그아웃 실패:', error)
      throw error
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        await fetchUserProfile(user.uid)
      } else {
        setUserProfile(null)
        setMemberships([])
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        memberships,
        loading,
        refreshUserProfile,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
