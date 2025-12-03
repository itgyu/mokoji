'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, signOut as cognitoSignOut, type CognitoAuthUser } from '@/lib/cognito'
import { usersAPI, membersAPI } from '@/lib/api-client'
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
  user: CognitoAuthUser | null
  userProfile: UserProfile | null
  memberships: OrganizationMember[]
  loading: boolean
  refreshUserProfile: () => Promise<void>
  refreshAuth: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  memberships: [],
  loading: true,
  refreshUserProfile: async () => {},
  refreshAuth: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

// ============================================
// AuthProvider 구현 (Cognito + DynamoDB)
// ============================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoAuthUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (cognitoUser: CognitoAuthUser) => {
    try {
      console.log('🔍 프로필 데이터 조회 시작:', cognitoUser.sub)

      // ============================================
      // 1. API를 통해 사용자 프로필 가져오기
      // ============================================
      console.log('🔍 API users 테이블 조회 시도')
      const userDataByEmail = await usersAPI.getByEmail(cognitoUser.email)

      let userProfileData: any = {}
      let userId = cognitoUser.sub

      if (userDataByEmail) {
        userProfileData = userDataByEmail
        userId = userDataByEmail.userId
        console.log('✅ API users 테이블 데이터:', JSON.stringify(userProfileData, null, 2))
        console.log('   - avatar:', userProfileData.avatar)
        console.log('   - birthdate:', userProfileData.birthdate)
        console.log('   - location:', userProfileData.location)
        console.log('   - gender:', userProfileData.gender)
        console.log('   - mbti:', userProfileData.mbti)
      } else {
        console.log('⚠️ API users 테이블에 데이터 없음 - 기본 프로필 생성')
        // 기본 프로필 생성
        const newUser = {
          userId: cognitoUser.sub,
          email: cognitoUser.email,
          name: cognitoUser.name || cognitoUser.email.split('@')[0],
          gender: '-',
          birthdate: '-',
          location: '서울',
          mbti: '-',
          avatar: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        try {
          await usersAPI.create(newUser)
          userProfileData = newUser
          console.log('✅ 기본 프로필 생성 완료')
        } catch (error) {
          console.error('❌ 기본 프로필 생성 실패:', error)
        }
      }

      // ============================================
      // 2. API를 통해 멤버십 가져오기
      // ============================================
      console.log('🔍 API members 테이블 조회 시도:', userId)
      let userMemberships: any[] = []

      try {
        console.log('🔍 API members 호출 시작, userId:', userId)
        const response = await membersAPI.getByUser(userId)
        console.log('📦 API members 응답:', JSON.stringify(response, null, 2))
        const membersData = response.memberships || response || []
        console.log('✅ API members:', Array.isArray(membersData) ? membersData.length : 'undefined', '개')

        // OrganizationMember 타입으로 변환
        userMemberships = Array.isArray(membersData) ? membersData.map((m: any) => ({
          id: m.memberId,
          userId: m.userId,
          organizationId: m.organizationId,
          role: m.role || 'member',
          joinedAt: m.joinedAt ? { seconds: Math.floor(m.joinedAt / 1000) } : null,
          status: m.status || 'active',
        })) as OrganizationMember[] : []

        setMemberships(userMemberships)
      } catch (error) {
        console.log('⚠️ API members 조회 실패:', error)
        setMemberships([])
      }

      // Timestamp를 Date로 변환
      const convertLocations = (locations: any[]): UserLocation[] => {
        if (!locations) return []
        return locations.map(loc => ({
          ...loc,
          verifiedAt: new Date(loc.verifiedAt || Date.now())
        }))
      }

      // ============================================
      // 3. 멤버십 데이터에서 역할과 가입일 결정
      // ============================================
      let userRole: 'member' | 'staff' | 'captain' = 'member'
      let joinDate = ''

      if (userMemberships.length > 0) {
        // 첫 번째 멤버십의 역할 사용
        const firstMembership = userMemberships[0]
        if (firstMembership.role === 'owner') {
          userRole = 'captain'
        } else if (firstMembership.role === 'admin') {
          userRole = 'staff'
        }

        // 가장 오래된 가입일 사용
        const joinedAt = firstMembership.joinedAt
        if (joinedAt) {
          try {
            if (typeof joinedAt === 'object' && 'seconds' in joinedAt) {
              joinDate = new Date(joinedAt.seconds * 1000).toLocaleDateString('ko-KR')
            } else if (typeof joinedAt === 'number') {
              joinDate = new Date(joinedAt).toLocaleDateString('ko-KR')
            } else {
              joinDate = new Date(joinedAt).toLocaleDateString('ko-KR')
            }
          } catch (e) {
            console.log('⚠️ joinDate 변환 실패:', e)
            joinDate = ''
          }
        }
      }

      // joinedOrganizations 생성
      const joinedOrgs = userMemberships.map(m => m.organizationId)

      // ============================================
      // 4. 최종 프로필 설정
      // ============================================
      setUserProfile({
        uid: userId,
        email: userProfileData.email || cognitoUser.email,
        name: userProfileData.name || cognitoUser.name || '사용자',
        gender: userProfileData.gender || '-',
        birthdate: userProfileData.birthdate || '-',
        location: userProfileData.location || '서울',
        mbti: userProfileData.mbti || '-',
        avatar: userProfileData.avatar || '',
        joinDate: joinDate,
        role: userRole,
        interestCategories: userProfileData.interestCategories || [],
        organizations: userProfileData.organizations || [],
        joinedOrganizations: joinedOrgs,
        locations: convertLocations(userProfileData.locations || []),
        selectedLocationId: userProfileData.selectedLocationId || ''
      })

      console.log('✅ 최종 프로필 설정 완료')
      console.log('   - name:', userProfileData.name)
      console.log('   - email:', cognitoUser.email)
      console.log('   - role:', userRole)
      console.log('   - joinDate:', joinDate)
      console.log('   - joinedOrganizations:', joinedOrgs)
      console.log('   - memberships:', userMemberships.length)

    } catch (error) {
      console.error('❌ Error fetching user profile:', error)
    }
  }

  const checkAuth = async () => {
    try {
      const cognitoUser = await getCurrentUser()
      setUser(cognitoUser)

      if (cognitoUser) {
        await fetchUserProfile(cognitoUser)
      } else {
        setUserProfile(null)
        setMemberships([])
      }
    } catch (error) {
      console.error('❌ 인증 확인 실패:', error)
      setUser(null)
      setUserProfile(null)
      setMemberships([])
    } finally {
      setLoading(false)
    }
  }

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user)
    }
  }

  const refreshAuth = async () => {
    setLoading(true)
    await checkAuth()
  }

  const signOut = async () => {
    try {
      await cognitoSignOut()
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
    checkAuth()

    // 5분마다 세션 확인
    const interval = setInterval(checkAuth, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        memberships,
        loading,
        refreshUserProfile,
        refreshAuth,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
