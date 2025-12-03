'use client'

/**
 * CONVERSION NOTE: Firebase → DynamoDB Migration
 *
 * This file has been converted from Firebase/Firestore to AWS DynamoDB.
 *
 * Major changes:
 * 1. Imports: Removed Firebase imports, added DynamoDB library imports
 * 2. Auth: signOut now uses Cognito instead of Firebase Auth
 * 3. Database operations:
 *    - fetchOrganizations: Uses organizationsAPI.get() instead of Firestore queries
 *    - fetchAllOrganizations: Needs DynamoDB scan implementation (currently returns empty)
 *    - fetchSchedules: Uses schedulesAPI.getByOrganization() instead of onSnapshot (no real-time)
 *    - fetchMembers: Uses membersAPI.getByOrganization() and usersAPI.get()
 *    - All CRUD operations converted to DynamoDB equivalents
 * 4. Real-time listeners: Removed onSnapshot, replaced with regular async queries
 * 5. Timestamps: serverTimestamp() → Date.now(), Timestamp objects → milliseconds
 * 6. Array operations: arrayUnion/arrayRemove replaced with manual array manipulation
 *
 * Known limitations:
 * - fetchAllOrganizations() requires DynamoDB scan implementation
 * - fetchRecommendedOrganizations() requires scan implementation
 * - Photo features (upload/delete) need separate photos table in DynamoDB
 * - No real-time updates (client needs to refresh to see changes)
 *
 * TODO: Some Firebase operations may remain in error handlers or edge cases
 */

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { signOut, changePassword } from '@/lib/cognito'
import { usersAPI, organizationsAPI, membersAPI, schedulesAPI, activityLogsAPI } from '@/lib/api-client'
import { Home, Users, Calendar, User, MapPin, Bell, Settings, Target, MessageCircle, Sparkles, Star, Tent, Search, Plus, Check, Edit, LogOut, X, ChevronLeft, Camera, Clock, ImageIcon } from 'lucide-react'
import { uploadToS3 } from '@/lib/s3-client'
import ScheduleDeepLink from '@/components/ScheduleDeepLink'
import { getCities, getDistricts } from '@/lib/locations'
import ImageCropModal from '@/components/ImageCropModal'
import { BRAND } from '@/lib/brand'
import { CREW_CATEGORIES, CATEGORY_GROUPS } from '@/lib/constants'
import LocationVerification from '@/components/LocationVerification'
import LocationSettings from '@/components/LocationSettings'
import { getCurrentPosition, getAddressFromCoords, calculateDistance, formatDistance } from '@/lib/location-utils'
import { getOrganizations, getOrganizationMembers, addOrganizationMember } from '@/lib/firestore-helpers'
import type { OrganizationMember } from '@/types'
import { formatTimestamp } from '@/lib/date-utils'
import LoadingScreen from '@/components/LoadingScreen'
import { addDuplicateNameSuffixes } from '@/lib/name-utils'
import { AppHeader } from '@/components/AppHeader'
import { Logo } from '@/components/Logo'
import { cacheSchedules } from '@/lib/schedule-cache'

type Page = 'home' | 'category' | 'mycrew' | 'myprofile' | 'schedules'

// Helper function: 참석자 수 계산 (status === 'going'인 참가자만 카운트)
const getGoingCount = (participants: any[] | undefined): number => {
  if (!participants || !Array.isArray(participants)) return 0;
  // participants가 객체 배열인 경우 status === 'going'인 것만 카운트
  // participants가 문자열 배열인 경우(레거시) 전체 길이 반환
  if (participants.length === 0) return 0;
  if (typeof participants[0] === 'string') return participants.length;
  return participants.filter((p: any) => p.status === 'going').length;
}

interface Comment {
  id: string
  userName: string
  userUid: string
  text: string
  createdAt: string
}

interface Schedule {
  id: string
  title: string
  date: string        // Display format: "11/1(토)"
  dateISO?: string    // ISO format for comparison: "2025-11-01"
  time: string
  location: string
  type: string
  participants: string[]
  maxParticipants: number
  createdBy: string
  createdByUid?: string
  orgId?: string
  comments?: Comment[]
  createdAt?: string
}

interface Member {
  id: string
  uid: string
  name: string
  email: string
  avatar?: string
  joinDate: string
  birthdate?: string
  isCaptain: boolean
  isStaff: boolean
  role: string
}

interface Organization {
  id: string
  name: string
  description: string
  categories: string[]  // 다중 카테고리 지원
  ownerUid: string      // 크루장 UID
  ownerName: string     // 크루장 이름
  avatar?: string
  memberCount?: number
  subtitle?: string
  createdAt: string
  // 기존 데이터 호환을 위한 optional
  category?: string
  location?: {          // 크루 활동 지역
    address: string     // 전체 주소
    sido: string        // 시/도
    sigungu: string     // 시/군/구
    dong: string        // 동/읍/면
    latitude: number    // 위도
    longitude: number   // 경도
  }
  pendingMembers?: Array<{  // 가입 대기 멤버
    uid: string
    name: string
    email: string
    avatar?: string
    requestedAt: any
  }>
}

export default function DashboardPage() {
  console.log('🚀 [DashboardPage] 컴포넌트 렌더링 시작')

  const { user, userProfile, memberships, loading } = useAuth()
  console.log('👤 [DashboardPage] userProfile:', userProfile?.uid, 'loading:', loading)

  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 page 파라미터를 읽어 현재 페이지를 직접 계산 (useState 대신 useMemo 사용)
  const currentPage = useMemo(() => {
    const page = searchParams.get('page')
    console.log('📄 [currentPage] URL page 파라미터:', page)
    if (page && ['home', 'category', 'mycrew', 'myprofile', 'schedules'].includes(page)) {
      console.log('✅ [currentPage] 페이지 설정:', page)
      return page as Page
    }
    console.log('⚠️ [currentPage] 기본값 home으로 설정')
    return 'home' as Page
  }, [searchParams])

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([]) // 내가 가입한 크루
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]) // 모든 크루 (크루 찾기용)
  const [recommendedOrgs, setRecommendedOrgs] = useState<Organization[]>([])

  // 동명이인 처리: 같은 이름에 A, B, C... 접미사 추가
  const membersWithDisplayNames = useMemo(() => {
    return addDuplicateNameSuffixes(members.map(m => ({ ...m, joinedAt: m.joinDate })))
  }, [members])

  // URL에서 orgId 파라미터를 읽어 선택된 크루를 직접 계산 (useState 대신 useMemo 사용)
  const urlOrgId = searchParams.get('orgId')
  const selectedOrg = useMemo(() => {
    if (!urlOrgId) return null

    console.log('🔍 [selectedOrg] urlOrgId:', urlOrgId)
    console.log('📊 [selectedOrg] organizations:', organizations.length, '개')
    console.log('📊 [selectedOrg] allOrganizations:', allOrganizations.length, '개')

    // 1. 먼저 내가 가입한 크루에서 찾기
    const myOrg = organizations.find(o => o.id === urlOrgId)
    if (myOrg) {
      console.log('✅ [selectedOrg] 내 크루에서 찾음:', myOrg.name)
      return myOrg
    }

    // 2. 가입하지 않은 크루는 allOrganizations에서 찾기
    const otherOrg = allOrganizations.find(o => o.id === urlOrgId)
    if (otherOrg) {
      console.log('✅ [selectedOrg] allOrganizations에서 찾음:', otherOrg.name)
    } else {
      console.log('❌ [selectedOrg] 크루를 찾을 수 없음')
    }
    return otherOrg || null
  }, [urlOrgId, organizations, allOrganizations])

  // 현재 보고 있는 크루에 가입했는지 확인
  const isCrewMember = useMemo(() => {
    if (!selectedOrg || !userProfile) return false
    return organizations.some(o => o.id === selectedOrg.id)
  }, [selectedOrg, organizations, userProfile])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [showMemberList, setShowMemberList] = useState(false)
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'joined' | 'not-joined'>('all')
  const [memberActivityFilter, setMemberActivityFilter] = useState<'all' | '10plus' | '30plus' | '50plus' | '60plus'>('all')
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editingMemberInfo, setEditingMemberInfo] = useState<Member | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    gender: '',
    birthdate: '',
    location: '',
    mbti: ''
  })
  const [orgMemberCounts, setOrgMemberCounts] = useState<{ [key: string]: number }>({})
  const [viewingOrgMemberCount, setViewingOrgMemberCount] = useState<number>(0)
  const [editingMyProfile, setEditingMyProfile] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordChangeError, setPasswordChangeError] = useState('')
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [myProfileForm, setMyProfileForm] = useState({
    name: '',
    gender: '',
    birthdate: '',
    location: '',
    mbti: '',
    interestCategories: [] as string[]
  })
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedCityForMemberEdit, setSelectedCityForMemberEdit] = useState('')
  const [selectedDistrictForMemberEdit, setSelectedDistrictForMemberEdit] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<string | null>(null)
  // 카테고리 페이지 전용 상태
  const [categoryView, setCategoryView] = useState<'main' | 'subCategories' | 'crews'>('main')
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<string | null>(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [crewView, setCrewView] = useState<'schedules' | 'photos'>('schedules')
  const [photos, setPhotos] = useState<any[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [orgForm, setOrgForm] = useState({
    name: '',
    subtitle: '',
    description: '',
    categories: [] as string[],  // 다중 카테고리
    location: null as {
      address: string
      sido: string
      sigungu: string
      dong: string
      latitude: number
      longitude: number
    } | null
  })
  const [settingLocation, setSettingLocation] = useState(false)  // 위치 설정 로딩 상태
  const [showLocationSettings, setShowLocationSettings] = useState(false)  // 위치 설정 모달
  const [showCreateCrew, setShowCreateCrew] = useState(false)  // 크루 생성 모달
  const [createCrewStep, setCreateCrewStep] = useState<1 | 2 | 3>(1)  // 크루 생성 단계
  const [orgAvatarFile, setOrgAvatarFile] = useState<File | null>(null)
  const [orgAvatarPreview, setOrgAvatarPreview] = useState<string | null>(null)  // 크루 로고 미리보기
  const [myProfileAvatarFile, setMyProfileAvatarFile] = useState<File | null>(null)
  const [showDeleteCrewConfirm, setShowDeleteCrewConfirm] = useState(false)  // 크루 해체 확인 다이얼로그

  // 이미지 크롭 관련 상태
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [cropType, setCropType] = useState<'org' | 'profile' | null>(null)

  const [showCreateSchedule, setShowCreateSchedule] = useState(false)
  const [createScheduleForm, setCreateScheduleForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    type: '',
    maxParticipants: 10
  })
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editScheduleForm, setEditScheduleForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    type: '',
    maxParticipants: 10
  })
  const [managingParticipants, setManagingParticipants] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!loading && !userProfile) {
      router.push('/auth')
    }
  }, [userProfile, loading, router])

  useEffect(() => {
    console.log('🔄 [useEffect] userProfile 변경됨:', userProfile?.uid, 'memberships:', memberships.length, 'loading:', loading)

    // userProfile이 있고, loading이 완료된 후에만 실행
    if (!loading && userProfile?.uid) {
      console.log('✅ [useEffect] fetchOrganizations 및 fetchAllOrganizations 호출')
      fetchOrganizations() // 내가 가입한 크루
      fetchAllOrganizations() // 모든 크루 (크루 찾기용)
    } else {
      console.log('⚠️ [useEffect] 조건 미충족 - loading:', loading, 'userProfile:', userProfile?.uid)
    }
  }, [userProfile?.uid, memberships.length, loading])

  // 추천 크루 가져오기
  useEffect(() => {
    if (!loading && userProfile?.uid) {
      fetchRecommendedOrganizations()
    }
  }, [userProfile?.uid, loading])

  // 홈 화면 및 내 크루 화면에서 모든 크루의 일정을 가져오기
  useEffect(() => {
    // 홈 화면 또는 내 크루 화면이고 특정 크루가 선택되지 않은 경우, 모든 크루의 일정을 가져옴
    if (!loading && userProfile?.uid && (currentPage === 'home' || currentPage === 'mycrew') && !selectedOrg && organizations.length > 0) {
      const orgIds = organizations.map(org => org.id)
      fetchAllUserSchedules(orgIds) // Promise 반환값 무시 (DynamoDB는 실시간 리스너 없음)
    }

    // DynamoDB는 실시간 리스너 없으니까 cleanup 필요 없음
    return () => {}
  }, [userProfile?.uid, organizations, currentPage, selectedOrg, loading])

  // 특정 크루 선택 시 해당 크루의 일정과 멤버 가져오기
  useEffect(() => {
    if (!loading && userProfile?.uid && selectedOrg?.id) {
      fetchSchedules(selectedOrg.id) // Promise 반환값 무시 (DynamoDB는 실시간 리스너 없음)
      fetchMembers(selectedOrg.id)
    }

    // DynamoDB는 실시간 리스너 없으니까 cleanup 필요 없음
    return () => {}
  }, [userProfile?.uid, selectedOrg?.id, loading])

  // 사진첩 뷰로 전환시 사진 목록 불러오기
  useEffect(() => {
    if (selectedOrg && crewView === 'photos') {
      fetchPhotos(selectedOrg.id)
    }
  }, [selectedOrg, crewView])

  // 가입하지 않은 크루의 멤버 수 가져오기
  useEffect(() => {
    const fetchViewingOrgMemberCount = async () => {
      if (!selectedOrg || !urlOrgId) return
      if (isCrewMember) return // 이미 가입한 크루는 orgMemberCounts에 있음

      console.log('🔍 [fetchViewingOrgMemberCount] 비회원 크루 멤버 수 조회:', selectedOrg.id)

      try {
        const members = await getOrganizationMembers(selectedOrg.id)
        console.log('✅ [fetchViewingOrgMemberCount] 멤버 수:', members.length)
        setViewingOrgMemberCount(members.length)
      } catch (error) {
        console.error('❌ [fetchViewingOrgMemberCount] 조회 실패:', error)
        // 레거시 fallback removed - using membersAPI only
        console.error('❌ [fetchViewingOrgMemberCount] 조회 실패 - DynamoDB only')
        setViewingOrgMemberCount(0)
      }
    }

    fetchViewingOrgMemberCount()
  }, [selectedOrg, urlOrgId, isCrewMember])

  // 모달 열릴 때 백그라운드 스크롤 방지 - 제거됨 (CSS로 처리)
  // 각 모달 오버레이에 overscroll-behavior: contain 적용으로 대체

  // ============================================
  // 권한 체크 함수 (Permission Check Functions)
  // ============================================

  const getMyRole = (orgId: string): 'owner' | 'admin' | 'member' | null => {
    const membership = memberships.find(m =>
      m.organizationId === orgId && m.status === 'active'
    )
    return membership?.role || null
  }

  const canManageOrg = (orgId: string): boolean => {
    if (!userProfile) return false

    // 크루의 ownerUid를 직접 체크
    const org = organizations.find(o => o.id === orgId)
    if (org && org.ownerUid === userProfile.uid) {
      return true
    }

    // 멤버십 role도 체크 (admin도 관리 가능)
    const role = getMyRole(orgId)
    return role === 'owner' || role === 'admin'
  }

  // ============================================
  // 크루 데이터 로딩 (Organizations Data Loading)
  // ============================================

  const fetchOrganizations = async () => {
    try {
      console.log('🏁 [fetchOrganizations] 시작 - userProfile:', userProfile?.uid, 'memberships:', memberships.length);

      // userProfile.uid가 없으면 early return (undefined 방지)
      if (!userProfile?.uid) {
        console.log('⚠️ [fetchOrganizations] userProfile.uid 없음, 스킵')
        return
      }

      // 1. memberships 기반으로 가입한 크루 ID 목록 가져오기 (신규 방식)
      let userOrgIds: string[] = []

      if (memberships.length > 0) {
        // ✅ 신규: organizationMembers 컬렉션 사용
        userOrgIds = memberships
          .filter(m => m.status === 'active')
          .map(m => m.organizationId)
        console.log('✅ [fetchOrganizations] memberships에서 orgIds 추출:', userOrgIds);
      } else {
        // memberships가 아직 로드 안됐으면 그냥 리턴 (레거시 호출 제거)
        console.log('⚠️ [fetchOrganizations] memberships가 비어있음, 다음 렌더링 대기');
        return
      }

      if (userOrgIds.length === 0) {
        console.log('❌ [fetchOrganizations] userOrgIds가 비어있음 - organizations 빈 배열로 설정');
        setOrganizations([])
        setOrgMemberCounts({})
        return
      }

      // 2. organizations 컬렉션에서 크루 정보 가져오기
      // Get all organizations from DynamoDB
      const allOrgsResponse = await organizationsAPI.getAll ? await organizationsAPI.getAll() : []
      // Handle both array and {organizations: [...]} format
      const allOrgsArray = Array.isArray(allOrgsResponse)
        ? allOrgsResponse
        : (allOrgsResponse?.organizations || [])

      // 사용자의 organization만 필터링
      const fetchedOrgs = allOrgsArray.filter((org: any) =>
        userOrgIds.includes(org.id) || userOrgIds.includes(org.organizationId)
      )
      console.log('📚 [fetchMyOrganizations] 조회된 조직 수:', fetchedOrgs.length);

      console.log('✅ [fetchMyOrganizations] 최종 fetchedOrgs:', fetchedOrgs.length, '개', fetchedOrgs);
      setOrganizations(fetchedOrgs)

      // 3. 각 크루의 멤버 수 가져오기
      const counts: { [key: string]: number } = {}

      for (const org of fetchedOrgs) {
        // org.id가 유효할 때만 조회
        const orgId = org.id || org.organizationId
        if (!orgId) {
          console.log('⚠️ [fetchOrganizations] org.id가 없음, 스킵:', org)
          continue
        }
        try {
          // ✅ 신규: organizationMembers 컬렉션 사용 (더 정확함)
          const members = await getOrganizationMembers(orgId)
          counts[orgId] = members.length
        } catch (error) {
          // ⚠️ 레거시 fallback removed - using organizationMembers only
          console.error(`Error getting member count for ${orgId}:`, error)
          counts[orgId] = 0
        }
      }

      setOrgMemberCounts(counts)
    } catch (error) {
      console.error('❌ Error fetching organizations:', error)
    }
  }

  // 모든 크루 가져오기 (크루 찾기용)
  const fetchAllOrganizations = async () => {
    try {
      console.log('🔍 [fetchAllOrganizations] 모든 크루 로딩 시작...')
      const response = await organizationsAPI.getAll(100)

      // API 응답 형식 확인: {organizations: [...]} 형식
      const organizationsArray = response?.organizations || response || []

      // 배열인지 확인 (에러 객체 방어)
      if (!Array.isArray(organizationsArray)) {
        console.warn('⚠️ [fetchAllOrganizations] API returned non-array:', response)
        setAllOrganizations([])
        return
      }

      const allOrgs = organizationsArray.map((org: any) => ({
        id: org.organizationId || org.id,
        ...org
      })) as Organization[]

      console.log('✅ [fetchAllOrganizations] 크루 로딩 완료:', allOrgs.length, '개')
      setAllOrganizations(allOrgs)
    } catch (error) {
      console.error('❌ [fetchAllOrganizations] Error fetching all organizations:', error)
      setAllOrganizations([])
    }
  }

  const fetchRecommendedOrganizations = async () => {
    try {
      if (!userProfile) return


      // 사용자의 관심 카테고리 확인
      const userInterests = userProfile.interestCategories || []

      if (userInterests.length === 0) {
        setRecommendedOrgs([])
        return
      }

      // 사용자가 인증한 위치 확인
      if (!userProfile.locations || userProfile.locations.length === 0) {
        setRecommendedOrgs([])
        return
      }

      // 선택된 위치 또는 첫 번째 위치 가져오기
      const selectedLocation = userProfile.locations.find(
        loc => loc.id === userProfile.selectedLocationId
      ) || userProfile.locations[0]


      // 사용자가 이미 가입한 크루 ID 가져오기
      const userOrgIds = userProfile.organizations || []

      // 모든 organizations 가져오기
      // TODO: Implement scan in DynamoDB
      const allOrgs: any[] = [] // DynamoDB scan not yet implemented
      
      const recommended: OrganizationWithDistance[] = []
      allOrgs.forEach((orgData) => {
        const org = { id: orgData.organizationId, ...orgData } as Organization

        // 이미 가입한 크루는 제외
        if (userOrgIds.includes(org.id)) {
          return
        }

        // 카테고리 매칭 (org.categories 또는 구버전 org.category)
        const orgCategories = org.categories || (org.category ? [org.category] : [])
        const hasMatchingCategory = orgCategories.some(cat => userInterests.includes(cat))

        // 카테고리가 일치하지 않으면 제외
        if (!hasMatchingCategory) {
          return
        }

        // GPS 좌표가 있는 경우: 정확한 거리 계산
        if (org.location?.latitude && org.location?.longitude) {
          const distance = calculateDistance(
            selectedLocation.latitude,
            selectedLocation.longitude,
            org.location.latitude,
            org.location.longitude
          )

          // 10km 이내인 경우만 추천
          if (distance <= 10) {
            recommended.push({ ...org, distance })
          }
        }
        // GPS 좌표가 없는 경우: 텍스트 기반 지역 매칭 (fallback)
        else {
          const hasMatchingLocation = org.description?.includes(selectedLocation.sigungu) ||
                                      org.description?.includes(selectedLocation.dong) ||
                                      org.description?.includes(selectedLocation.sido)

          if (hasMatchingLocation) {
            recommended.push({ ...org, distance: 999 })
          }
        }
      })

      // 거리순으로 정렬
      recommended.sort((a, b) => a.distance - b.distance)

      setRecommendedOrgs(recommended)
    } catch (error) {
      console.error('Error fetching recommended organizations:', error)
    }
  }

  const fetchSchedules = async (orgId: string) => {
    try {
      // API: No real-time listeners, using regular query
      const response = await schedulesAPI.getByOrganization(orgId)
      // API returns {schedules: [...]} format
      const schedulesArray = response?.schedules || response || []

      const fetchedSchedules: Schedule[] = (Array.isArray(schedulesArray) ? schedulesArray : []).map((schedule: any) => ({
        id: schedule.scheduleId || schedule.id,
        ...schedule
      }))

      // 캐시에 저장 (상세 페이지 즉시 표시용)
      cacheSchedules(fetchedSchedules)

      setSchedules(fetchedSchedules)

      // Return empty function for compatibility (no unsubscribe needed)
      return () => {}
    } catch (error) {
      console.error('❌ Error fetching schedules:', error)
      setSchedules([])
      return () => {}
    }
  }

  // 모든 크루의 일정을 가져오는 함수 (홈 화면용)
  const fetchAllUserSchedules = async (orgIds: string[]) => {
    try {
      if (orgIds.length === 0) {
        setSchedules([])
        return () => {}
      }

      // API: Fetch all schedules for all orgs (no real-time updates)
      const allSchedulesPromises = orgIds.map(orgId =>
        schedulesAPI.getByOrganization(orgId)
      )

      const responses = await Promise.all(allSchedulesPromises)
      // Each response is {schedules: [...]} format
      const allSchedulesFlat: any[] = []
      for (const response of responses) {
        const schedulesArray = response?.schedules || response || []
        if (Array.isArray(schedulesArray)) {
          allSchedulesFlat.push(...schedulesArray)
        }
      }

      const allSchedules: Schedule[] = allSchedulesFlat.map((schedule: any) => ({
        id: schedule.scheduleId || schedule.id,
        ...schedule
      }))

      // 캐시에 저장 (상세 페이지 즉시 표시용)
      cacheSchedules(allSchedules)

      setSchedules(allSchedules)

      // Return empty function for compatibility (no unsubscribe needed)
      return () => {}
    } catch (error) {
      console.error('❌ Error fetching all schedules:', error)
      setSchedules([])
      return () => {}
    }
  }

  const fetchMembers = async (orgId: string) => {
    try {
      // API: Get organization members
      const response = await membersAPI.getByOrganization(orgId)
      // API returns {members: [...]} format
      const orgMembers = response?.members || response || []

      if (!Array.isArray(orgMembers) || orgMembers.length === 0) {
        setMembers([])
        return
      }

      // Get all user profiles for these members
      const userIds = orgMembers.map((m: any) => m.userId)
      const userProfilesPromises = userIds.map((uid: string) => usersAPI.get(uid).catch(() => null))
      const userProfilesResults = await Promise.all(userProfilesPromises)

      const userProfilesMap: { [uid: string]: any } = {}
      userProfilesResults.forEach((profile, index) => {
        if (profile) {
          userProfilesMap[userIds[index]] = profile
        }
      })

      // 멤버 리스트 생성
      const fetchedMembers: Member[] = []
      orgMembers.forEach((orgMemberData: any) => {
        const userProfile = userProfilesMap[orgMemberData.userId] || {}

        // DynamoDB timestamp를 한국 날짜 형식으로 변환
        let joinDateString = ''
        if (orgMemberData.joinedAt) {
          if (typeof orgMemberData.joinedAt === 'number') {
            joinDateString = new Date(orgMemberData.joinedAt).toLocaleDateString('ko-KR')
          }
        }

        fetchedMembers.push({
          id: orgMemberData.memberId,
          uid: orgMemberData.userId,
          name: userProfile.name || '알 수 없음',
          email: userProfile.email || '',
          avatar: userProfile.avatar || userProfile.photoURL || '',
          role: orgMemberData.role || 'member',
          isCaptain: orgMemberData.role === 'owner',
          isStaff: orgMemberData.role === 'admin',
          joinDate: joinDateString,
          birthdate: userProfile.birthdate || undefined,
          location: userProfile.location || undefined,
          orgId: orgId
        } as Member)
      })

      setMembers(fetchedMembers)
    } catch (error) {
      console.error('❌ Error fetching members:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSaveLocation = async (location: {
    address: string
    dong: string
    latitude: number
    longitude: number
    radius: number
  }) => {
    if (!userProfile) return

    try {
      // 지역 이름 결정
      const locationName = !userProfile?.locations || userProfile.locations.length === 0
        ? '집'
        : '직장'

      // 새로운 위치 데이터
      const locationData = {
        id: `loc_${Date.now()}`,
        name: locationName,
        address: location.address,
        sido: '',  // LocationSettings에서는 sido/sigungu가 없으므로 빈 문자열
        sigungu: '',
        dong: location.dong,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        verifiedAt: Date.now(),
        isPrimary: !userProfile?.locations || userProfile.locations.length === 0,
      }

      // DynamoDB: Manually add to locations array
      const currentLocations = userProfile?.locations || []
      const updatedLocations = [...currentLocations, locationData]

      await usersAPI.update(userProfile.uid, {
        locations: updatedLocations,
        // 첫 번째 지역이면 자동으로 선택
        ...((!userProfile?.locations || userProfile.locations.length === 0) && {
          selectedLocationId: locationData.id
        })
      })

      alert('동네가 설정되었어요!')
      window.location.reload()
    } catch (error) {
      console.error('Error saving location:', error)
      alert('동네 설정 중 문제가 발생했어요.')
    }
  }

  const handleRemoveMember = async (member: Member) => {
    if (!selectedOrg) return

    const confirmRemove = window.confirm(`${member.name}님을 크루에서 추방하시겠습니까?`)
    if (!confirmRemove) return

    try {
      // membersAPI를 사용하여 멤버 삭제
      await membersAPI.delete(member.id)

      // userProfiles의 joinedOrganizations 배열에서 제거
      const userProfile = await usersAPI.get(member.uid)
      if (userProfile) {
        const updatedOrgs = (userProfile.joinedOrganizations || []).filter((id: string) => id !== selectedOrg.id)
        await usersAPI.update(member.uid, { joinedOrganizations: updatedOrgs })
      }

      alert(`${member.name}님이 크루에서 제거되었습니다.`)

      // 멤버 리스트 새로고침
      await fetchMembers(selectedOrg.id)
      await fetchOrganizations() // 멤버 카운트도 업데이트
    } catch (error) {
      console.error('❌ Error removing member:', error)
      alert('멤버를 내보내는 중에 문제가 생겼어요.')
    }
  }

  const handleUpdateMemberRole = async (member: Member, newRole: 'captain' | 'staff' | 'member') => {
    if (!selectedOrg) return

    try {
      // membersAPI를 사용하여 역할 업데이트
      const roleValue = newRole === 'captain' ? 'owner' : newRole === 'staff' ? 'admin' : 'member'
      await membersAPI.update(member.id, { role: roleValue })

      alert('역할이 변경되었습니다.')
      setEditingMember(null)

      // 멤버 리스트 새로고침
      await fetchMembers(selectedOrg.id)
    } catch (error) {
      console.error('Error updating member role:', error)
      alert('역할을 바꾸는 중에 문제가 생겼어요.')
    }
  }

  const handleOpenMemberInfoEdit = async (member: Member) => {
    // userProfiles에서 상세 정보 가져오기
    try {
      const data = await usersAPI.get(member.uid)

      if (data) {
        // 지역 정보 파싱 (예: "서울특별시 강남구" -> city: "서울특별시", district: "강남구")
        const locationParts = (data.location || '').split(' ')
        const city = locationParts[0] || ''
        const district = locationParts[1] || ''

        setSelectedCityForMemberEdit(city)
        setSelectedDistrictForMemberEdit(district)

        setEditForm({
          name: member.name || '',
          gender: data.gender || '',
          birthdate: data.birthdate || '',
          location: data.location || '',
          mbti: data.mbti || ''
        })
      } else {
        setSelectedCityForMemberEdit('')
        setSelectedDistrictForMemberEdit('')

        setEditForm({
          name: member.name || '',
          gender: '',
          birthdate: '',
          location: '',
          mbti: ''
        })
      }

      setEditingMemberInfo(member)
    } catch (error) {
      console.error('Error loading member info:', error)
      alert('멤버 정보를 불러오는 중에 문제가 생겼어요.')
    }
  }

  const handleUpdateMemberInfo = async () => {
    if (!editingMemberInfo) return

    try {
      // usersAPI를 사용하여 프로필 업데이트
      await usersAPI.update(editingMemberInfo.uid, {
        name: editForm.name,
        gender: editForm.gender,
        birthdate: editForm.birthdate,
        location: editForm.location,
        mbti: editForm.mbti.toUpperCase()
      })

      alert('멤버 정보가 수정됐어요.')
      setEditingMemberInfo(null)

      // 멤버 리스트 새로고침
      if (selectedOrg) {
        await fetchMembers(selectedOrg.id)
      }
    } catch (error) {
      console.error('Error updating member info:', error)
      alert('멤버 정보를 수정하는 중에 문제가 생겼어요.')
    }
  }

  // 파일 선택 시 크롭 모달 열기
  const handleSelectAvatarFile = (file: File) => {
    const imageUrl = URL.createObjectURL(file)
    setCropImageUrl(imageUrl)
    setCropType('profile')
  }


  const handleUpdateMyProfile = async () => {
    if (!userProfile) return

    // 관심 카테고리 검증
    if (myProfileForm.interestCategories.length === 0) {
      alert('관심 카테고리를 최소 1개 이상 선택해주세요.')
      return
    }

    try {
      // Update 객체 생성 (아바타 제외)
      const updateData: any = {
        name: myProfileForm.name,
        gender: myProfileForm.gender,
        birthdate: myProfileForm.birthdate,
        location: myProfileForm.location,
        mbti: myProfileForm.mbti.toUpperCase(),
        interestCategories: myProfileForm.interestCategories
      }

      // usersAPI를 사용하여 프로필 업데이트
      await usersAPI.update(userProfile.uid, updateData)

      alert('프로필이 수정됐어요.')
      setEditingMyProfile(false)

      // AuthContext에서 프로필 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error updating my profile:', error)
      alert('프로필을 수정하는 중에 문제가 생겼어요.')
    }
  }

  // 비밀번호 변경 핸들러
  const handleChangePassword = async () => {
    setPasswordChangeError('')
    setPasswordChangeSuccess(false)

    // 유효성 검사
    if (!passwordForm.currentPassword) {
      setPasswordChangeError('현재 비밀번호를 입력해주세요.')
      return
    }
    if (!passwordForm.newPassword) {
      setPasswordChangeError('새 비밀번호를 입력해주세요.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordChangeError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      setPasswordChangeError('새 비밀번호는 대문자를 포함해야 합니다.')
      return
    }
    if (!/[a-z]/.test(passwordForm.newPassword)) {
      setPasswordChangeError('새 비밀번호는 소문자를 포함해야 합니다.')
      return
    }
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setPasswordChangeError('새 비밀번호는 숫자를 포함해야 합니다.')
      return
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword)) {
      setPasswordChangeError('새 비밀번호는 특수문자를 포함해야 합니다.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordChangeError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    try {
      setChangingPassword(true)
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordChangeSuccess(true)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      // 3초 후 성공 메시지 숨기기
      setTimeout(() => {
        setPasswordChangeSuccess(false)
        setShowPasswordChange(false)
      }, 2000)
    } catch (error: any) {
      console.error('Password change error:', error)
      if (error.code === 'NotAuthorizedException' || error.message?.includes('Incorrect')) {
        setPasswordChangeError('현재 비밀번호가 올바르지 않습니다.')
      } else if (error.message?.includes('password')) {
        setPasswordChangeError('비밀번호 정책을 충족하지 않습니다.')
      } else {
        setPasswordChangeError('비밀번호 변경 중 오류가 발생했습니다.')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const handleOpenOrgEdit = (org: Organization) => {
    setEditingOrg(org)
    setOrgForm({
      name: org.name,
      subtitle: org.subtitle || '',
      description: org.description,
      categories: org.categories || (org.category ? [org.category] : [])  // 기존 데이터 호환
    })
    setOrgAvatarFile(null)
  }

  // 현재 위치로 크루 location 설정
  const handleSetCrewLocation = async () => {
    try {
      setSettingLocation(true)
      const { latitude, longitude } = await getCurrentPosition()
      const { address, sido, sigungu, dong } = await getAddressFromCoords(
        latitude,
        longitude
      )

      setOrgForm({
        ...orgForm,
        location: {
          address,
          sido,
          sigungu,
          dong,
          latitude,
          longitude
        }
      })
    } catch (error: any) {
      alert(error.message || '위치를 설정하는 중에 문제가 생겼어요.')
    } finally {
      setSettingLocation(false)
    }
  }

  // 크루 해체
  const handleDeleteCrew = async () => {
    if (!editingOrg) return

    try {
      // 1. organizationMembers에서 해당 크루의 모든 멤버 조회 및 삭제
      const membersResponse = await membersAPI.getByOrganization(editingOrg.id)
      const membersList = membersResponse?.members || membersResponse || []
      if (Array.isArray(membersList)) {
        for (const member of membersList) {
          await membersAPI.delete(member.memberId || member.id)
        }
      }

      // 2. schedules에서 해당 크루의 모든 일정 조회 및 삭제
      const schedulesResponse = await schedulesAPI.getByOrganization(editingOrg.id)
      const schedulesList = schedulesResponse?.schedules || schedulesResponse || []
      if (Array.isArray(schedulesList)) {
        for (const schedule of schedulesList) {
          await schedulesAPI.delete(schedule.scheduleId || schedule.id)
        }
      }

      // 3. 크루 문서 삭제
      await organizationsAPI.delete(editingOrg.id)

      alert(`"${editingOrg.name}" 크루가 해체되었습니다.`)
      setEditingOrg(null)
      setShowDeleteCrewConfirm(false)
      router.replace('/dashboard?page=mycrew', { scroll: false })

      // 크루 목록 새로고침
      fetchOrganizations()
      fetchAllOrganizations()
    } catch (error) {
      console.error('Error deleting crew:', error)
      alert('크루를 해체하는 중에 문제가 생겼어요.')
    }
  }

  const handleCreateCrew = async () => {
    if (!userProfile) return

    // 필수값 검증
    if (!orgForm.name.trim()) {
      alert('크루 이름을 알려주세요.')
      return
    }
    if (!orgForm.description.trim()) {
      alert('크루 설명을 알려주세요.')
      return
    }
    if (orgForm.categories.length === 0) {
      alert('카테고리를 최소 1개 이상 선택해주세요.')
      return
    }

    try {
      // 1. 먼저 크루 문서 생성 (ID 얻기 위해)
      const orgData: any = {
        name: orgForm.name,
        description: orgForm.description,
        categories: orgForm.categories,
        ownerUid: userProfile.uid,
        ownerName: userProfile.name,
        createdAt: new Date().toISOString(),
        avatar: ''
      }

      if (orgForm.subtitle && orgForm.subtitle.trim()) {
        orgData.subtitle = orgForm.subtitle
      }

      if (orgForm.location) {
        orgData.location = orgForm.location
      }

      // organizationsAPI를 사용하여 크루 생성
      const response = await organizationsAPI.create(orgData)
      const newOrgId = response?.organization?.organizationId || response?.organizationId

      if (!newOrgId) {
        throw new Error('Failed to create organization')
      }

      // 2. 이미지가 있으면 S3에 업로드하고 URL 업데이트
      if (orgAvatarFile) {
        const avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${newOrgId}`)
        await organizationsAPI.update(newOrgId, { avatar: avatarUrl })
      }

      // 3. 사용자를 크루의 owner 멤버로 추가
      await membersAPI.create({
        userId: userProfile.uid,
        organizationId: newOrgId,
        role: 'owner',
        status: 'active',
        joinedAt: Date.now()
      })

      // 4. 사용자 프로필의 joinedOrganizations 배열에 추가
      const currentOrgs = userProfile.joinedOrganizations || []
      await usersAPI.update(userProfile.uid, {
        joinedOrganizations: [...currentOrgs, newOrgId]
      })

      alert('크루가 만들어졌어요!')
      setShowCreateCrew(false)
      setOrgForm({ name: '', subtitle: '', description: '', categories: [], location: null })
      setOrgAvatarFile(null)

      // 크루 목록 새로고침
      await fetchOrganizations()

      // 새로 생성한 크루를 선택
      router.replace(`/dashboard?page=mycrew&orgId=${newOrgId}`, { scroll: false })
    } catch (error) {
      console.error('❌ 크루 생성 실패:', error)
      alert('크루를 만드는 중에 문제가 생겼어요.')
    }
  }

  const handleUpdateOrg = async () => {
    if (!userProfile || !editingOrg) return

    // 필수값 검증
    if (!orgForm.name.trim()) {
      alert('크루 이름을 알려주세요.')
      return
    }
    if (!orgForm.description.trim()) {
      alert('크루 설명을 알려주세요.')
      return
    }
    if (orgForm.categories.length === 0) {
      alert('카테고리를 최소 1개 이상 선택해주세요.')
      return
    }

    try {
      // 1. 크루 정보 업데이트
      const updateData: any = {
        name: orgForm.name,
        description: orgForm.description,
        categories: orgForm.categories,
        updatedAt: new Date().toISOString()
      }

      if (orgForm.subtitle && orgForm.subtitle.trim()) {
        updateData.subtitle = orgForm.subtitle
      } else {
        updateData.subtitle = ''
      }

      if (orgForm.location) {
        updateData.location = orgForm.location
      } else {
        updateData.location = null
      }

      // organizationsAPI를 사용하여 크루 정보 업데이트
      await organizationsAPI.update(editingOrg.id, updateData)

      // 2. 새 이미지가 있으면 S3에 업로드하고 URL 업데이트
      if (orgAvatarFile) {
        const avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${editingOrg.id}`)
        await organizationsAPI.update(editingOrg.id, { avatar: avatarUrl })
      }

      alert('크루 정보가 수정되었어요!')
      setEditingOrg(null)
      setOrgAvatarFile(null)
      setOrgAvatarPreview(null)

      // 크루 목록 새로고침
      await fetchOrganizations()
      await fetchAllOrganizations()
    } catch (error) {
      console.error('❌ 크루 정보 수정 실패:', error)
      alert('크루 정보를 수정하는 중에 문제가 생겼어요.')
    }
  }

  // 사진첩: 사진 목록 불러오기 (photosAPI 사용)
  const fetchPhotos = async (orgId: string) => {
    try {
      // TODO: photosAPI.getByOrganization 구현 필요
      // 현재는 빈 배열 반환
      setPhotos([])
    } catch (error) {
      console.error('사진 목록 불러오기 실패:', error)
      setPhotos([])
    }
  }

  // 사진첩: 사진 업로드
  const handlePhotoUpload = async (file: File, orgId: string) => {
    if (!userProfile) return

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('사진 크기는 10MB 이하여야 합니다.')
      return
    }

    setUploadingPhoto(true)

    try {
      // S3에 업로드
      const photoUrl = await uploadToS3(file, `organizations/${orgId}/photos/${Date.now()}_${file.name}`)

      // TODO: photosAPI.create 구현 필요
      // 현재는 사진 업로드만 하고 메타데이터 저장은 스킵

      alert('사진이 업로드되었어요!')
      await fetchPhotos(orgId)
    } catch (error) {
      console.error('사진 업로드 실패:', error)
      alert('사진을 업로드하는 중에 문제가 생겼어요.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // 사진첩: 사진 삭제
  const handlePhotoDelete = async (photoId: string, orgId: string) => {
    if (!userProfile) return

    if (!confirm('이 사진을 삭제할까요?')) return

    try {
      // TODO: photosAPI.delete 구현 필요
      alert('사진 삭제 기능은 아직 준비 중이에요.')
      setSelectedPhoto(null)
    } catch (error) {
      console.error('사진 삭제 실패:', error)
      alert('사진을 삭제하는 중에 문제가 생겼어요.')
    }
  }

  // 이미지 파일 선택 시 크롭 모달 열기
  const handleImageSelect = (file: File, type: 'org' | 'profile') => {
    const reader = new FileReader()
    reader.onload = () => {
      setCropImageUrl(reader.result as string)
      setCropType(type)
    }
    reader.readAsDataURL(file)
  }

  // 크롭 완료 시 처리
  const handleCropComplete = async (croppedBlob: Blob) => {
    // Blob을 File로 변환
    const file = new File([croppedBlob], 'cropped-image.jpg', { type: 'image/jpeg' })

    if (cropType === 'org') {
      setOrgAvatarFile(file)
      // 미리보기 URL 생성
      const previewUrl = URL.createObjectURL(file)
      setOrgAvatarPreview(previewUrl)
      // 크롭 모달 닫기
      setCropImageUrl(null)
      setCropType(null)
    } else if (cropType === 'profile') {
      // 프로필 사진은 바로 S3에 업로드
      if (!userProfile) return

      setCropImageUrl(null)
      setCropType(null)
      setUploadingAvatar(true)

      try {
        const avatarUrl = await uploadToS3(file, `avatars/${userProfile.uid}`)
        await usersAPI.update(userProfile.uid, { avatar: avatarUrl })
        window.location.reload()
      } catch (error) {
        console.error('Error updating avatar:', error)
        alert('프로필 사진을 바꾸는 중에 문제가 생겼어요.')
      } finally {
        setUploadingAvatar(false)
      }
    } else {
      // 크롭 모달 닫기
      setCropImageUrl(null)
      setCropType(null)
    }
  }

  // 크롭 취소
  const handleCropCancel = () => {
    setCropImageUrl(null)
    setCropType(null)
  }

  // 내 동네 근처 크루 필터링 (10km 이내)
  const getNearbyOrganizations = () => {

    // 임시: 일단 모든 크루를 보여줌 (위치 필터링 없이)
    // TODO: 모든 크루에 location 데이터가 입력되면 10km 필터링 활성화
    const nearby: OrganizationWithDistance[] = allOrganizations.map(org => ({
      ...org,
      distance: 0 // 거리 정보 없음
    }))


    return nearby
  }

  // 검색 및 카테고리 필터링
  const filteredCrews = useMemo(() => {
    let filtered = allOrganizations

    // 검색어 필터링 (크루명 또는 카테고리)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((org) => {
        const nameMatch = org.name?.toLowerCase().includes(query)
        const categoryMatch = (org.categories || [org.category])
          .filter(Boolean)
          .some((cat) => cat?.toLowerCase().includes(query))
        return nameMatch || categoryMatch
      })
    }

    // 카테고리 필터링
    if (selectedCategory !== '전체') {
      filtered = filtered.filter((org) => {
        const categories = org.categories || [org.category]
        return categories.includes(selectedCategory)
      })
    }

    return filtered
  }, [allOrganizations, searchQuery, selectedCategory])

  // 크루 가입 신청
  const handleJoinCrew = async (orgId: string) => {
    if (!userProfile) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      // organizationsAPI를 사용하여 크루 정보 조회
      const orgResponse = await organizationsAPI.get(orgId)
      const orgData = orgResponse?.organization || orgResponse

      if (!orgData) {
        alert('크루를 찾을 수 없습니다.')
        return
      }

      const existingPending = orgData.pendingMembers || []

      // 이미 신청한 경우
      if (existingPending.some((m: any) => m.uid === userProfile.uid)) {
        alert('이미 가입 신청을 보내셨어요.')
        return
      }

      // pendingMembers에 추가
      const newPendingMember = {
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        avatar: userProfile.avatar || '',
        requestedAt: new Date().toISOString()
      }
      await organizationsAPI.update(orgId, {
        pendingMembers: [...existingPending, newPendingMember]
      })

      alert('가입 신청을 보냈어요! 크루장의 승인을 기다려주세요.')
      fetchOrganizations()

      // 카테고리 페이지로 돌아가기
      router.replace('/dashboard?page=category', { scroll: false })

    } catch (error) {
      console.error('가입 신청 실패:', error)
      alert('가입 신청에 문제가 생겼어요. 다시 시도해주세요.')
    }
  }

  // 크루 가입 승인
  const handleApproveMember = async (orgId: string, member: any) => {
    if (!confirm(`${member.name}님의 가입을 승인하시겠습니까?`)) return

    try {
      // 크루 정보 조회
      const orgResponse = await organizationsAPI.get(orgId)
      const orgData = orgResponse?.organization || orgResponse
      const currentPending = orgData?.pendingMembers || []

      // pendingMembers에서 제거
      const updatedPending = currentPending.filter((m: any) => m.uid !== member.uid)
      await organizationsAPI.update(orgId, { pendingMembers: updatedPending })

      // userProfiles의 joinedOrganizations 배열에 추가
      const userProfile = await usersAPI.get(member.uid)
      const currentOrgs = userProfile?.joinedOrganizations || []
      await usersAPI.update(member.uid, {
        joinedOrganizations: [...currentOrgs, orgId]
      })

      // organizationMembers 컬렉션에 추가
      await addOrganizationMember(orgId, member.uid, 'member')
      console.log('✅ organizationMembers에 추가 완료:', orgId, member.uid)

      alert(`${member.name}님이 크루에 가입되었습니다!`)
      fetchOrganizations()

      // 멤버 리스트 새로고침
      if (selectedOrg) {
        await fetchMembers(orgId)
      }

    } catch (error) {
      console.error('❌ 승인 실패:', error)
      alert('승인하는 중에 문제가 생겼어요. 다시 시도해주세요.')
    }
  }

  // 크루 가입 거절
  const handleRejectMember = async (orgId: string, member: any) => {
    if (!confirm(`${member.name}님의 가입을 거절하시겠습니까?`)) return

    try {
      // 크루 정보 조회
      const orgResponse = await organizationsAPI.get(orgId)
      const orgData = orgResponse?.organization || orgResponse
      const currentPending = orgData?.pendingMembers || []

      // pendingMembers에서만 제거
      const updatedPending = currentPending.filter((m: any) => m.uid !== member.uid)
      await organizationsAPI.update(orgId, { pendingMembers: updatedPending })

      alert(`${member.name}님의 가입 신청을 거절했어요.`)
      fetchOrganizations()

    } catch (error) {
      console.error('거절 실패:', error)
      alert('거절하는 중에 문제가 생겼어요. 다시 시도해주세요.')
    }
  }

  const handleCreateSchedule = async () => {
    if (!selectedOrg || !userProfile) return

    // 필수값 검증
    if (!createScheduleForm.title.trim()) {
      alert('일정 제목을 알려주세요.')
      return
    }
    if (!createScheduleForm.date) {
      alert('날짜를 알려주세요.')
      return
    }
    if (!createScheduleForm.time) {
      alert('시간을 알려주세요.')
      return
    }
    if (!createScheduleForm.location.trim()) {
      alert('장소를 입력해주세요.')
      return
    }
    if (!createScheduleForm.type.trim()) {
      alert('활동 유형을 입력해주세요.')
      return
    }

    try {
      // createScheduleForm.date is now in ISO format: "2025-11-17"
      const isoDate = createScheduleForm.date
      // Generate display format: "11/17(일)"
      const selectedDate = new Date(isoDate)
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const month = selectedDate.getMonth() + 1
      const day = selectedDate.getDate()
      const dayOfWeek = days[selectedDate.getDay()]
      const displayDate = `${month}/${day}(${dayOfWeek})`

      // schedulesAPI를 사용하여 일정 생성
      // 생성자를 자동으로 참석자에 추가 (이름 문자열로 저장)
      const creatorName = userProfile?.name || '익명'

      await schedulesAPI.create({
        title: createScheduleForm.title,
        date: displayDate,      // Display format for UI
        dateISO: isoDate,       // ISO format for comparison
        time: createScheduleForm.time,
        location: createScheduleForm.location,
        type: createScheduleForm.type,
        maxParticipants: createScheduleForm.maxParticipants,
        participants: [creatorName],
        createdBy: creatorName,
        createdByUid: userProfile?.uid || '',
        orgId: selectedOrg.id,
        comments: [],
        createdAt: new Date().toISOString(),
        hasChat: true,
        lastChatMessageAt: null,
        lastChatMessagePreview: null
      })

      alert('일정이 등록됐어요.')
      setShowCreateSchedule(false)
      setCreateScheduleForm({
        title: '',
        date: '',
        time: '',
        location: '',
        type: '',
        maxParticipants: 10
      })
    } catch (error) {
      console.error('Error creating schedule:', error)
      alert('일정을 만드는 중에 문제가 생겼어요.')
    }
  }

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return

    // 필수값 검증
    if (!editScheduleForm.title.trim()) {
      alert('일정 제목을 알려주세요.')
      return
    }
    if (!editScheduleForm.date) {
      alert('날짜를 알려주세요.')
      return
    }
    if (!editScheduleForm.time) {
      alert('시간을 알려주세요.')
      return
    }
    if (!editScheduleForm.location.trim()) {
      alert('장소를 입력해주세요.')
      return
    }
    if (!editScheduleForm.type.trim()) {
      alert('활동 유형을 입력해주세요.')
      return
    }

    try {
      // editScheduleForm.date is now in ISO format: "2025-11-22"
      const isoDate = editScheduleForm.date
      // Generate display format: "11/22(토)"
      const selectedDate = new Date(isoDate)
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const month = selectedDate.getMonth() + 1
      const day = selectedDate.getDate()
      const dayOfWeek = days[selectedDate.getDay()]
      const displayDate = `${month}/${day}(${dayOfWeek})`

      // schedulesAPI를 사용하여 일정 수정
      await schedulesAPI.update(editingSchedule.id, {
        title: editScheduleForm.title,
        date: displayDate,      // Display format for UI
        dateISO: isoDate,       // ISO format for comparison
        time: editScheduleForm.time,
        location: editScheduleForm.location,
        type: editScheduleForm.type,
        maxParticipants: editScheduleForm.maxParticipants
      })

      alert('일정이 수정됐어요.')
      setEditingSchedule(null)
      setSelectedSchedule(null)
    } catch (error) {
      console.error('Error updating schedule:', error)
      alert('일정을 수정하는 중에 문제가 생겼어요.')
    }
  }

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm('정말 삭제하시겠어요?')) return

    try {
      // TODO: Convert to DynamoDB - removed Firebase dynamic import
      await schedulesAPI.delete(schedule.id)

      alert('일정이 삭제됐어요.')
      setSelectedSchedule(null)
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('일정을 삭제하는 중에 문제가 생겼어요.')
    }
  }

  const handleAddParticipant = async (schedule: Schedule, memberName: string) => {
    try {
      // 정원 체크 (status === 'going'인 참가자만 카운트)
      if (getGoingCount(schedule.participants) >= schedule.maxParticipants) {
        alert('정원이 초과되었습니다.')
        return
      }

      const updatedParticipants = [...(schedule.participants || []), memberName]
      // schedulesAPI를 사용하여 참석자 추가
      await schedulesAPI.update(schedule.id, { participants: updatedParticipants })

      // selectedSchedule 업데이트 (UI 즉시 반영)
      if (selectedSchedule?.id === schedule.id) {
        setSelectedSchedule({
          ...selectedSchedule,
          participants: updatedParticipants
        })
      }
    } catch (error) {
      console.error('Error adding participant:', error)
      alert('참석자를 추가하는 중에 문제가 생겼어요.')
    }
  }

  const handleRemoveParticipant = async (schedule: Schedule, memberName: string) => {
    try {
      const updatedParticipants = schedule.participants.filter(name => name !== memberName)
      // schedulesAPI를 사용하여 참석자 제거
      await schedulesAPI.update(schedule.id, { participants: updatedParticipants })

      // selectedSchedule 업데이트 (UI 즉시 반영)
      if (selectedSchedule?.id === schedule.id) {
        setSelectedSchedule({
          ...selectedSchedule,
          participants: updatedParticipants
        })
      }
    } catch (error) {
      console.error('Error removing participant:', error)
      alert('참석자를 내보내는 중에 문제가 생겼어요.')
    }
  }

  const handleShareSchedule = async (schedule: Schedule) => {
    // 일정 상세 페이지 URL 생성
    const scheduleUrl = `${window.location.origin}/dashboard?schedule=${schedule.id}`

    const shareText = `⛺ ${schedule.title}

📅 일시: ${formatDateWithYear(schedule.date)} ${schedule.time}
📍 장소: ${schedule.location}
🎯 벙주: ${schedule.createdBy || '정보 없음'}
👥 참여 인원: ${getGoingCount(schedule.participants)} / ${schedule.maxParticipants}명

${BRAND.NAME}와 함께하는 모임 일정에 참여하세요!

🔗 일정 보기: ${scheduleUrl}`

    // Web Share API 사용 (모바일에서 카카오톡 포함 공유 가능)
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        })
      } catch (error) {
        // 사용자가 공유를 취소한 경우는 에러 처리 안함
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Share failed:', error)
          // 폴백: 클립보드에 복사
          copyToClipboard(shareText)
        }
      }
    } else {
      // Web Share API를 지원하지 않는 브라우저의 경우 클립보드에 복사
      copyToClipboard(shareText)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('일정 정보가 클립보드에 복사되었습니다!\n카카오톡에 붙여넣기 하세요.')
    }).catch(() => {
      alert('링크 복사에 문제가 생겼어요.')
    })
  }

  const handleAddComment = async (schedule: Schedule) => {
    if (!commentText.trim() || !userProfile) return

    try {
      const newComment: Comment = {
        id: Date.now().toString(),
        userName: userProfile?.name || '익명',
        userUid: userProfile.uid,
        text: commentText,
        createdAt: new Date().toISOString()
      }
      const updatedComments = [...(schedule.comments || []), newComment]
      // schedulesAPI를 사용하여 댓글 추가
      await schedulesAPI.update(schedule.id, { comments: updatedComments })
      setCommentText('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('댓글을 추가하는 중에 문제가 생겼어요.')
    }
  }

  const handleDeleteComment = async (schedule: Schedule, commentId: string) => {
    if (!window.confirm('정말 삭제하시겠어요?')) return

    try {
      const updatedComments = schedule.comments?.filter(comment => comment.id !== commentId) || []
      // schedulesAPI를 사용하여 댓글 삭제
      await schedulesAPI.update(schedule.id, { comments: updatedComments })
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  // 유형별 색상 반환 함수
  const getTypeColor = (type: string) => {
    switch (type) {
      case '오토캠핑':
        return 'bg-blue-100 text-blue-700'
      case '노지캠핑':
        return 'bg-green-100 text-green-700'
      case '백패킹':
        return 'bg-orange-100 text-orange-700'
      case '일반모임':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-orange-50 text-[#FF9B50]' // 기본값 (기존 데이터용)
    }
  }

  // 날짜를 Date 객체로 변환하는 함수
  const parseScheduleDate = (dateString: string): Date => {
    if (dateString.match(/^\d{1,2}\/\d{1,2}\(/)) {
      const match = dateString.match(/^(\d{1,2})\/(\d{1,2})/)
      if (match) {
        const month = parseInt(match[1]) - 1
        const day = parseInt(match[2])
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        // 1월 일정이고 현재가 10월 이후(하반기)면 다음 연도, 그 외에는 올해
        if (month === 0 && currentMonth >= 10) {
          return new Date(currentYear + 1, month, day)
        }
        return new Date(currentYear, month, day)
      }
    }
    return new Date(dateString)
  }

  // 아바타 URL 검증 함수 (이모티콘이나 잘못된 URL 필터링)
  const getValidAvatarUrl = (avatar: string | undefined | null): string => {
    if (!avatar || avatar.trim() === '') {
      return '/default-avatar.svg'
    }

    // 이모티콘이나 특수문자만 있는지 확인 (한글, 영문, 숫자가 없으면 유효하지 않음)
    const hasValidChars = /[\p{L}\p{N}]/u.test(avatar)

    // URL 형식인지 확인 (http, https, data:, / 로 시작)
    const isUrlFormat = avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('data:')

    // URL 형식이 아니거나, 유효한 문자가 없으면 기본 아바타 사용
    if (!isUrlFormat || !hasValidChars) {
      return '/default-avatar.svg'
    }

    return avatar
  }

  // 멤버의 마지막 참여일로부터 경과일 계산 함수
  const getMemberLastParticipationDays = (memberName: string, memberUid?: string): number | null => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // 시간 부분 제거

    // 멤버가 참여한 과거 일정만 찾기 (미래 일정 제외)
    const participatedSchedules = schedules.filter(schedule => {
      if (!schedule.participants || schedule.participants.length === 0) {
        return false
      }

      // participants가 문자열 배열인지 객체 배열인지 확인
      let isParticipant = false
      if (typeof schedule.participants[0] === 'string') {
        // 문자열 배열: ["이태규", "유시몬", ...]
        isParticipant = schedule.participants.includes(memberName)
      } else {
        // 객체 배열: [{name: "이태규", uid: "...", userId: "..."}, ...]
        // userId, name, userName 필드로 체크
        isParticipant = schedule.participants.some((p: any) =>
          (memberUid && p.userId === memberUid) ||
          p.name === memberName ||
          p.userName === memberName
        )
      }

      if (!isParticipant) {
        return false
      }

      // 일정 날짜 파싱
      const scheduleDate = parseScheduleDate(schedule.date)
      scheduleDate.setHours(0, 0, 0, 0)

      // 과거 일정만 포함 (오늘 포함)
      return scheduleDate.getTime() <= today.getTime()
    })

    if (participatedSchedules.length === 0) {
      return null // 참여 이력 없음 (과거 일정 기준)
    }

    // 가장 최근 과거 일정 찾기
    const sortedSchedules = participatedSchedules.sort((a, b) => {
      const dateA = parseScheduleDate(a.date).getTime()
      const dateB = parseScheduleDate(b.date).getTime()
      return dateB - dateA // 최신순 정렬
    })

    const mostRecentSchedule = sortedSchedules[0]
    const scheduleDate = parseScheduleDate(mostRecentSchedule.date)
    scheduleDate.setHours(0, 0, 0, 0)

    // 경과일 계산
    const diffTime = today.getTime() - scheduleDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  // 날짜 비교 유틸 함수
  const isSchedulePast = (dateString: string) => {
    try {
      let scheduleDate: Date | null = null

      // "10/11(토) 오후 1:00" 형식 (연도 없음)
      if (dateString.match(/^\d{1,2}\/\d{1,2}\(/)) {
        const match = dateString.match(/^(\d{1,2})\/(\d{1,2})/)
        if (match) {
          const month = parseInt(match[1]) - 1  // 0-based
          const day = parseInt(match[2])
          const now = new Date()
          const currentYear = now.getFullYear()
          const currentMonth = now.getMonth()

          // 1월 일정이고 현재가 10월 이후(하반기)면 다음 연도, 그 외에는 올해
          if (month === 0 && currentMonth >= 10) {
            scheduleDate = new Date(currentYear + 1, month, day)
          } else {
            scheduleDate = new Date(currentYear, month, day)
          }
        }
      }
      // "2024. 12. 25" 형식
      else if (dateString.includes('.')) {
        const parts = dateString.split('.').map(p => p.trim())
        if (parts.length === 3) {
          const year = parseInt(parts[0])
          const month = parseInt(parts[1]) - 1
          const day = parseInt(parts[2])
          scheduleDate = new Date(year, month, day)
        }
      }
      // "2024-12-25" 형식
      else if (dateString.includes('-')) {
        scheduleDate = new Date(dateString)
      }

      if (scheduleDate && !isNaN(scheduleDate.getTime())) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        scheduleDate.setHours(0, 0, 0, 0)

        const isPast = scheduleDate < today
        return isPast
      }

      return false
    } catch (e) {
      console.error(`날짜 파싱 오류: ${dateString}`, e)
      return false
    }
  }

  const handleToggleParticipation = async (schedule: Schedule) => {
    try {
      if (!selectedOrg) return

      const myName = userProfile?.name || '익명'
      const isParticipating = schedule.participants?.includes(myName)

      let updatedParticipants: string[]
      if (isParticipating) {
        // 참여 취소
        updatedParticipants = schedule.participants.filter(name => name !== myName)
      } else {
        // 참여 (status === 'going'인 참가자만 카운트)
        if (getGoingCount(schedule.participants) >= schedule.maxParticipants) {
          alert('정원이 초과되었습니다.')
          return
        }
        updatedParticipants = [...schedule.participants, myName]
      }

      // schedulesAPI를 사용하여 참여 상태 업데이트
      await schedulesAPI.update(schedule.id, {
        participants: updatedParticipants
      })
    } catch (error) {
      console.error('Error toggling participation:', error)
      alert('참여 상태를 바꾸는 중에 문제가 생겼어요.')
    }
  }

  // 초기 로딩 중이고 유저 프로필이 없을 때만 로딩 화면 표시 (이미 인증된 상태에서는 깜빡임 방지)
  if (loading && !userProfile) {
    return <LoadingScreen />
  }

  if (!userProfile) {
    return null
  }

  // userProfile을 profile로 사용
  const profile = userProfile

  // 날짜에 연도 추가하는 함수
  const formatDateWithYear = (dateString: string): string => {
    // 이미 연도가 포함되어 있으면 그대로 반환
    if (dateString.match(/^\d{4}/)) {
      return dateString
    }

    // "MM/DD(요일)" 형식
    if (dateString.match(/^\d{1,2}\/\d{1,2}\(/)) {
      const match = dateString.match(/^(\d{1,2})\/(\d{1,2})/)
      if (match) {
        const month = parseInt(match[1]) - 1
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        // 1월 일정이고 현재가 10월 이후(하반기)면 다음 연도, 그 외에는 올해
        const year = (month === 0 && currentMonth >= 10) ? currentYear + 1 : currentYear
        return `${year}년 ${dateString}`
      }
    }

    return dateString
  }

  // 다가오는 일정과 지난 일정 구분 (IIFE로 계산 - Hook 순서 문제 없음)
  const upcomingSchedules = (() => {
    const filtered = schedules
      .filter(s => !isSchedulePast(s.date))
      .sort((a, b) => parseScheduleDate(a.date).getTime() - parseScheduleDate(b.date).getTime())

    return filtered
  })()

  const pastSchedules = schedules
    .filter(s => isSchedulePast(s.date))
    .sort((a, b) => parseScheduleDate(b.date).getTime() - parseScheduleDate(a.date).getTime()) // 날짜 내림차순 (최근 순)

  // 내가 참여한 일정만 필터링 (IIFE로 계산)
  const mySchedules = (() => {
    const filtered = upcomingSchedules.filter(s => {
      const participants = s.participants || []
      const myName = userProfile?.name || ''
      const myUid = userProfile?.uid || ''

      // 배열인 경우
      if (Array.isArray(participants)) {
        const hasMyName = participants.includes(myName)
        const hasMyUid = participants.includes(myUid)

        if (hasMyName || hasMyUid) {
          return true
        }

        // 객체 배열인 경우 확인 (새 일정: {userId, userName, status}, 기존 일정: {uid, name})
        const matchedParticipant = participants.find(p => {
          if (typeof p === 'object' && p !== null) {
            return (
              p.userId === myUid ||     // 새 일정 형식
              p.userName === myName ||  // 새 일정 형식
              p.uid === myUid ||        // 기존 일정 형식 (호환)
              p.name === myName         // 기존 일정 형식 (호환)
            )
          }
          return false
        })

        if (matchedParticipant) {
          return true
        }
      }

      // 문자열인 경우
      if (typeof participants === 'string') {
        const names = participants.split(',').map(n => n.trim())
        const hasMyName = names.includes(myName)

        if (hasMyName) {
          return true
        }
      }

      return false
    })

    return filtered
  })()

  return (
    <div className="min-h-screen bg-gray-100 pb-28 max-w-md mx-auto">
      {/* URL 파라미터로 공유된 일정 자동 열기 */}
      <Suspense fallback={null}>
        <ScheduleDeepLink
          schedules={schedules}
          selectedSchedule={selectedSchedule}
          setSelectedSchedule={setSelectedSchedule}
          organizations={organizations}
        />
      </Suspense>

      {/* Home Page */}
      {currentPage === 'home' && (
        <div className="bg-[#FAFAFA]">
          {/* MOKKOJI Header */}
          <AppHeader showNotification showSettings />

          <div className="px-4 md:px-6 py-4 pb-24 space-y-6">
            {/* 내 동네 크루 섹션 */}
            <div>
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#5f0080]" strokeWidth={1.5} />
                  <h2 className="text-lg font-semibold text-gray-900">
                    내 주변 크루
                  </h2>
                  {userProfile?.locations && userProfile.locations.length > 0 && (
                    <span className="px-3 py-1 bg-mokkoji-primary-light text-mokkoji-primary text-xs font-medium rounded-full">
                      {(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).dong}
                    </span>
                  )}
                </div>

                {/* 동네 인증 버튼 (미인증 시) */}
                {(!userProfile?.locations || userProfile.locations.length === 0) && (
                  <button
                    onClick={() => setShowLocationSettings(true)}
                    className="px-4 py-2 bg-mokkoji-primary text-white text-sm font-medium rounded-lg hover:bg-mokkoji-primary-hover transition-all duration-300 active:scale-95"
                  >
                    위치 설정
                  </button>
                )}
              </div>

              {/* 크루 카드 리스트 */}
              {(() => {
                const nearbyCrews = getNearbyOrganizations()

                if (!userProfile?.locations || userProfile.locations.length === 0) {
                  // Empty State - 동네 미인증
                  return (
                    <div className="card-premium p-8 text-center">
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-mokkoji-accent/10 flex items-center justify-center">
                          <MapPin className="w-8 h-8 text-mokkoji-accent" />
                        </div>
                      </div>
                      <p className="text-mokkoji-black font-medium text-base mb-2">
                        위치 설정이 필요합니다
                      </p>
                      <p className="text-mokkoji-gray-600 text-sm">
                        내 동네를 설정하고 주변 크루를 찾아보세요
                      </p>
                    </div>
                  )
                }

                if (nearbyCrews.length === 0) {
                  // Empty State - 크루 없음
                  return (
                    <div className="card-premium p-8 text-center">
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-mokkoji-primary/10 flex items-center justify-center">
                          <Users className="w-8 h-8 text-mokkoji-primary" />
                        </div>
                      </div>
                      <p className="text-mokkoji-black font-medium text-base mb-2">
                        주변에 크루가 없습니다
                      </p>
                      <p className="text-mokkoji-gray-600 text-sm">
                        카테고리에서 다른 크루를 찾아보세요
                      </p>
                    </div>
                  )
                }

                // 크루 카드 가로 슬라이드 (Embla Carousel)
                return <NearbyCrewsCarousel nearbyCrews={nearbyCrews} router={router} orgMemberCounts={orgMemberCounts} formatDistance={formatDistance} />
              })()}
            </div>

            {/* 스크롤바 숨기기 CSS */}
            <style jsx global>{`
              .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}</style>

            {/* 다가오는 일정 섹션 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#5f0080]" strokeWidth={1.5} />
                  <h2 className="text-lg font-semibold text-gray-900">
                    다가오는 일정
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setScheduleFilter('joined')
                    router.replace('/dashboard?page=schedules', { scroll: false })
                  }}
                  className="text-[#5f0080] text-sm font-medium hover:text-[#4a0066] transition-colors px-3 py-2 rounded-lg hover:bg-[#f3e8f7]"
                >
                  전체보기
                </button>
              </div>
              {mySchedules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-mokkoji-primary/10 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-mokkoji-primary" />
                    </div>
                  </div>
                  <p className="text-mokkoji-black font-medium text-base mb-2">예정된 일정이 없습니다</p>
                  <p className="text-mokkoji-gray-600 text-sm">크루에서 새로운 일정을 만들어보세요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                      className="bg-mokkoji-gray-50 rounded-xl p-5 hover:bg-white hover:shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer border border-mokkoji-gray-200"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-medium text-lg tracking-tight text-mokkoji-black leading-tight">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        <p className="text-mokkoji-gray-700 text-sm font-normal flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span>{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="text-mokkoji-gray-700 text-sm font-normal flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span>{schedule.location}</span>
                        </p>
                        <p className="text-mokkoji-gray-700 text-sm font-normal flex items-center gap-2">
                          <Target className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span>Host: {schedule.createdBy}</span>
                        </p>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-mokkoji-gray-200">
                          <p className="text-mokkoji-gray-600 text-sm font-normal flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-mokkoji-primary" />
                            Participants
                          </p>
                          <p className="text-mokkoji-black text-lg font-medium">
                            {getGoingCount(schedule.participants)}<span className="text-mokkoji-gray-500">/{schedule.maxParticipants}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Page - Premium Design */}
      {currentPage === 'category' && (
        <div className="bg-[#FAFAFA] min-h-screen">
          {/* MOKKOJI Header */}
          <AppHeader showNotification />

          {/* 검색창 */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="크루명 또는 카테고리 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#5f0080] focus:bg-white"
                style={{ fontSize: '16px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* 카테고리 필터 칩 */}
          <div className="sticky top-[var(--header-height)] bg-white z-9 border-b border-mokkoji-gray-200">
            {/* 대카테고리 */}
            <div className="px-4 md:px-6 pt-3 pb-2 overflow-x-auto scrollbar-hide border-b border-mokkoji-gray-100" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-2 flex-nowrap" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => {
                    setSelectedCategoryGroup(null)
                    setSelectedCategory('전체')
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 active:scale-95 ${
                    selectedCategoryGroup === null
                      ? 'bg-mokkoji-primary text-white shadow-md'
                      : 'bg-mokkoji-gray-100 text-mokkoji-gray-700 hover:bg-mokkoji-gray-200'
                  }`}
                >
                  ALL
                </button>
                {Object.keys(CATEGORY_GROUPS).map((groupName) => (
                  <button
                    key={groupName}
                    onClick={() => {
                      setSelectedCategoryGroup(groupName)
                      setSelectedCategory('전체')
                    }}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 active:scale-95 ${
                      selectedCategoryGroup === groupName
                        ? 'bg-mokkoji-primary text-white shadow-md'
                        : 'bg-mokkoji-gray-100 text-mokkoji-gray-700 hover:bg-mokkoji-gray-200'
                    }`}
                  >
                    {groupName}
                  </button>
                ))}
              </div>
            </div>

            {/* 세부 카테고리 */}
            <div className="px-4 md:px-6 py-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-2 flex-nowrap" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => setSelectedCategory('전체')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                    selectedCategory === '전체'
                      ? 'bg-mokkoji-primary-light text-mokkoji-primary border border-mokkoji-primary'
                      : 'bg-white text-mokkoji-gray-600 border border-mokkoji-gray-200 hover:border-mokkoji-gray-300'
                  }`}
                >
                  All
                </button>
                {(selectedCategoryGroup
                  ? CATEGORY_GROUPS[selectedCategoryGroup as keyof typeof CATEGORY_GROUPS]
                  : CREW_CATEGORIES.slice(0, 10)
                ).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                      selectedCategory === category
                        ? 'bg-mokkoji-primary-light text-mokkoji-primary border border-mokkoji-primary'
                        : 'bg-white text-mokkoji-gray-600 border border-mokkoji-gray-200 hover:border-mokkoji-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 크루 리스트 */}
          <div className="px-4 md:px-6 py-4">
            {filteredCrews.length === 0 ? (
              <div className="card-premium p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-mokkoji-gray-200/50 flex items-center justify-center">
                    <Search className="w-8 h-8 text-mokkoji-gray-400" />
                  </div>
                </div>
                <p className="text-lg font-medium text-mokkoji-black mb-2">
                  No Results Found
                </p>
                <p className="text-sm text-mokkoji-gray-600">
                  Try different keywords or categories
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCrews.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => {
                      router.replace(`/dashboard?page=mycrew&orgId=${org.id}`, { scroll: false })
                    }}
                    className="card-premium p-5 hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-[0.98] border-mokkoji-gray-200 hover:border-mokkoji-primary"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-mokkoji-gray-100">
                        {org.avatar ? (
                          <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tent className="w-6 h-6 text-mokkoji-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {org.subtitle && (
                          <p className="text-sm font-normal text-mokkoji-gray-600 mb-1 truncate">
                            {org.subtitle}
                          </p>
                        )}
                        <h4 className="text-lg font-medium tracking-tight text-mokkoji-black mb-2 truncate">
                          {org.name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(org.categories || [org.category]).filter(Boolean).slice(0, 3).map((cat, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 bg-mokkoji-gray-100 text-mokkoji-gray-700 text-xs rounded-lg font-normal"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-mokkoji-primary text-xl">→</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Crew List Page - 가입한 크루 목록 */}
      {currentPage === 'mycrew' && !urlOrgId && (
        <div className="bg-[#FAFAFA] min-h-screen">
          {/* MOKKOJI Header */}
          <AppHeader showNotification showSettings />

          {/* 페이지 타이틀 */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">내 크루</h1>
          </div>

          {/* 크루 목록 */}
          <div className="px-4 py-4">
            {organizations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#f3e8f7] flex items-center justify-center">
                    <Tent className="w-8 h-8 text-[#5f0080]" strokeWidth={1.5} />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">가입한 크루가 없습니다</p>
                <p className="text-sm text-gray-500">주변 크루를 찾아 가입해보세요</p>
              </div>
            ) : (
              <div className="space-y-4">
                {organizations.map((org, index) => {
                  const orgId = org.id || org.organizationId
                  const memberCount = orgMemberCounts[orgId] || org.memberCount || 0
                  // 예정된 일정만 카운트 (오늘 포함, 그 이후)
                  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
                  const orgScheduleCount = schedules.filter(s => {
                    if (s.orgId !== orgId) return false
                    // dateISO 필드가 있으면 사용, 없으면 date 필드 사용 (마이그레이션 전 데이터 대응)
                    const scheduleDate = s.dateISO || s.date
                    return scheduleDate >= today
                  }).length

                  return (
                    <div
                      key={orgId || `org-${index}`}
                      onClick={() => {
                        router.replace(`/dashboard?page=mycrew&orgId=${orgId}`, { scroll: false })
                      }}
                      className="card-premium p-6 border border-mokkoji-gray-200 hover:border-mokkoji-primary hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-mokkoji-gray-100">
                          {org.avatar ? (
                            <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Tent className="w-5 h-5 md:w-6 md:h-6 md:w-7 md:h-7 text-mokkoji-primary" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {org.subtitle && (
                            <p className="text-sm leading-5 font-normal text-mokkoji-gray-600 mb-1 truncate">{org.subtitle}</p>
                          )}
                          <h3 className="text-lg leading-7 md:text-xl font-medium tracking-tight text-mokkoji-black mb-1 truncate">
                            {org.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm leading-5 text-mokkoji-gray-700">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                              <span className="font-normal">{memberCount}명</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                              <span className="font-normal">{orgScheduleCount}개 일정</span>
                            </span>
                          </div>
                          {(org.categories || [org.category]).filter(Boolean).length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              {(org.categories || [org.category]).filter(Boolean).slice(0, 3).map((cat, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 bg-mokkoji-gray-100 text-mokkoji-gray-700 text-xs rounded-lg font-normal">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-mokkoji-primary">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 새 크루 만들기 버튼 */}
            <div className="px-5 pb-6 mt-4">
              <button
                onClick={() => {
                  setShowCreateCrew(true)
                  setOrgForm({ name: '', subtitle: '', description: '', categories: [] })
                  setOrgAvatarFile(null)
                }}
                className="w-full bg-[#5f0080] hover:bg-[#4a0066] rounded-xl p-5 transition-all active:scale-[0.98] text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="text-lg font-semibold mb-1">새 크루 만들기</h3>
                    <p className="text-sm opacity-90">나만의 크루를 시작하세요</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <Plus className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Schedules Page - 다가오는 일정 전체보기 (독립 페이지) */}
      {currentPage === 'schedules' && (
        <div className="bg-[#FAFAFA] min-h-screen">
          {/* MOKKOJI Header */}
          <AppHeader showNotification showSettings />

          {/* 페이지 타이틀 & 필터 */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">일정</h1>
            </div>
            {/* 필터 칩 */}
            <div className="px-4 pb-3 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-2 flex-nowrap" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => setScheduleFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 active:scale-95 flex-shrink-0 ${
                    scheduleFilter === 'all'
                      ? 'bg-[#5f0080] text-white shadow-md'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  전체 ({upcomingSchedules.length})
                </button>
                <button
                  onClick={() => setScheduleFilter('joined')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 active:scale-95 flex-shrink-0 ${
                    scheduleFilter === 'joined'
                      ? 'bg-[#5f0080] text-white shadow-md'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  참여중 ({mySchedules.length})
                </button>
                <button
                  onClick={() => setScheduleFilter('not-joined')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 active:scale-95 flex-shrink-0 ${
                    scheduleFilter === 'not-joined'
                      ? 'bg-[#5f0080] text-white shadow-md'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  참여가능 ({upcomingSchedules.length - mySchedules.length})
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 md:py-6 space-y-6">
            {(() => {
              // 필터 적용
              let filteredSchedules = upcomingSchedules
              const myName = userProfile?.name || '익명'
              const myUid = userProfile?.uid || ''

              // 참여 여부 확인 헬퍼 함수
              const isParticipating = (schedule: any) => {
                const participants = schedule.participants
                if (!participants) return false

                // 배열인 경우
                if (Array.isArray(participants)) {
                  // 문자열 배열 체크 (기존 방식)
                  if (participants.some(p => typeof p === 'string' && p === myName)) {
                    return true
                  }

                  // 객체 배열 체크 (새 방식)
                  return participants.some(p =>
                    typeof p === 'object' && p !== null && (
                      p.userId === myUid ||
                      p.userName === myName ||
                      p.uid === myUid ||
                      p.name === myName
                    )
                  )
                }

                return false
              }

              if (scheduleFilter === 'joined') {
                filteredSchedules = upcomingSchedules.filter(s => isParticipating(s))
              } else if (scheduleFilter === 'not-joined') {
                filteredSchedules = upcomingSchedules.filter(s => !isParticipating(s))
              }

              if (filteredSchedules.length === 0) {
                return (
                  <div className="card-premium p-8 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 rounded-full bg-mokkoji-accent/10 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-mokkoji-accent" />
                      </div>
                    </div>
                    <p className="text-base leading-6 font-medium text-mokkoji-gray-600">
                      {scheduleFilter === 'all' && 'No events scheduled'}
                      {scheduleFilter === 'joined' && 'No joined events'}
                      {scheduleFilter === 'not-joined' && 'No available events'}
                    </p>
                  </div>
                )
              }

              // 크루별로 그룹화
              const schedulesByOrg = filteredSchedules.reduce((acc, schedule) => {
                const orgId = schedule.orgId
                if (!acc[orgId]) {
                  acc[orgId] = []
                }
                acc[orgId].push(schedule)
                return acc
              }, {} as Record<string, typeof filteredSchedules>)

              return (
                <div className="space-y-3 md:space-y-6">
                  {Object.entries(schedulesByOrg).map(([orgId, orgSchedules]) => {
                    const org = organizations.find(o => o.id === orgId)
                    return (
                      <div key={orgId}>
                        {/* 크루 헤더 */}
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-lg md:text-xl font-medium text-mokkoji-black">
                            {org?.name || '알 수 없는 크루'}
                          </h2>
                          <span className="text-sm leading-5 text-mokkoji-gray-600 font-medium">
                            {orgSchedules.length} events
                          </span>
                        </div>

                        {/* 일정 카드들 */}
                        <div className="space-y-4">
                          {orgSchedules.map((schedule) => {
                            const myName = userProfile?.name || '익명'
                            const isParticipating = schedule.participants?.includes(myName)
                            return (
                              <div
                                key={schedule.id}
                                onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                                className={`card-premium p-6 border transition-all duration-300 cursor-pointer active:scale-[0.98] ${
                                  isParticipating ? 'border-mokkoji-primary shadow-md' : 'hover:border-mokkoji-primary hover:shadow-md'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <h3 className="font-medium text-lg leading-7 tracking-tight text-mokkoji-black flex-1">{schedule.title}</h3>
                                  <span className={`text-xs px-3 py-1.5 rounded-lg font-medium ${getTypeColor(schedule.type)}`}>
                                    {schedule.type}
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm leading-5 text-mokkoji-gray-700">
                                  <p className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                                    <span className="font-normal">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                                    <span className="font-normal">{schedule.location}</span>
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                                    <span className="font-normal">{getGoingCount(schedule.participants)}/{schedule.maxParticipants}명</span>
                                  </p>
                                </div>
                                {isParticipating && (
                                  <div className="mt-4 text-xs bg-mokkoji-primary-light text-mokkoji-primary px-3 py-2 rounded-lg font-medium text-center">
                                    <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Joined</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Crew Detail Page */}
      {currentPage === 'mycrew' && urlOrgId && (
        <div className="bg-[#FAFAFA] min-h-screen">
          {!selectedOrg ? (
            // organizations 로딩 중일 때 로딩 표시
            <div className="bg-[#FAFAFA] min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-6 h-6 text-gray-400 animate-pulse" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-gray-500">크루 정보를 불러오는 중...</p>
              </div>
            </div>
          ) : !isCrewMember ? (
            // 가입하지 않은 크루 - 가입 신청 페이지
            <div className="bg-[#FAFAFA] min-h-screen">
              <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
                <div className="px-4 py-3">
                  <button
                    onClick={() => router.replace('/dashboard?page=category', { scroll: false })}
                    className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out -ml-2"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
                  </button>
                </div>
              </header>

              <div className="px-6 py-8">
                {/* 크루 정보 카드 */}
                <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden mb-4 bg-gray-100">
                      {selectedOrg.avatar ? (
                        <img src={selectedOrg.avatar} alt={selectedOrg.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tent className="w-12 h-12 text-[#FF9B50]" />
                        </div>
                      )}
                    </div>
                    {selectedOrg.subtitle && (
                      <p className="text-base font-bold text-gray-600 mb-2">{selectedOrg.subtitle}</p>
                    )}
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{selectedOrg.name}</h1>
                    {/* 태그 - 가로 스크롤 */}
                    <div className="w-full mb-4">
                      <p className="text-sm text-gray-500 font-medium mb-2">관심사</p>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                        {(selectedOrg.categories || [selectedOrg.category]).filter(Boolean).map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-[#F5F5F4] text-gray-700 text-sm rounded-lg font-medium whitespace-nowrap flex-shrink-0"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedOrg.description && (
                      <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {selectedOrg.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* 멤버 수 정보 - 개선된 디자인 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm mb-24">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f3e8f7] flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#5f0080]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-semibold text-2xl text-gray-900">
                        {viewingOrgMemberCount}명
                      </p>
                      <p className="text-sm text-gray-500">크루 멤버</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 고정 가입 신청 버튼 */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
                <button
                  onClick={() => handleJoinCrew(selectedOrg.id)}
                  className="w-full h-14 bg-[#FF9B50] text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  크루 가입 신청하기
                </button>
                <p className="text-center text-xs text-gray-500 mt-2">
                  크루장의 승인 후 크루에 참여할 수 있습니다
                </p>
              </div>
            </div>
          ) : (
            // 가입한 크루 - 크루 상세 페이지
            <>
              {/* 헤더 (sticky) */}
              <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div className="h-14 px-4 flex items-center justify-between">
                  <button
                    onClick={() => router.replace('/dashboard?page=mycrew', { scroll: false })}
                    className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
                  </button>
                  <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">{selectedOrg.name}</h1>
                  {canManageOrg(selectedOrg.id) ? (
                    <button
                      onClick={() => router.push(`/crew/${selectedOrg.id}/settings`)}
                      className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
                    </button>
                  ) : (
                    <div className="w-9" />
                  )}
                </div>
              </header>

              {/* 크루 정보 카드 */}
              <div className="bg-[#FAFAFA] px-4 py-4 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-4">
                    {/* 크루 이미지 */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {selectedOrg.avatar ? (
                        <img src={selectedOrg.avatar} alt={selectedOrg.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tent className="w-10 h-10 text-gray-400" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    {/* 크루 정보 */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedOrg.name}</h2>
                      {selectedOrg.subtitle && (
                        <p className="text-sm text-gray-500 mt-0.5">{selectedOrg.subtitle}</p>
                      )}
                      {selectedOrg.description && (
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{selectedOrg.description}</p>
                      )}
                      {/* 멤버 수, 일정 수 */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                          멤버 {orgMemberCounts[selectedOrg.id] || selectedOrg.memberCount || 0}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                          일정 {upcomingSchedules.length}개
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 태그들 */}
                  {(selectedOrg.categories || [selectedOrg.category]).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                      {(selectedOrg.categories || [selectedOrg.category]).filter(Boolean).map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 탭 영역 */}
                <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1">
                  <button
                    onClick={() => setCrewView('schedules')}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      crewView === 'schedules'
                        ? 'bg-[#5f0080] text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Calendar className="w-4 h-4 inline-block mr-1.5" strokeWidth={1.5} />
                    일정
                  </button>
                  <button
                    onClick={() => setCrewView('photos')}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      crewView === 'photos'
                        ? 'bg-[#5f0080] text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Camera className="w-4 h-4 inline-block mr-1.5" strokeWidth={1.5} />
                    사진
                  </button>
                </div>

                {/* 일정 필터 - 일정 탭에서만 표시 */}
                {crewView === 'schedules' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleFilter('all')}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${
                        scheduleFilter === 'all'
                          ? 'bg-[#5f0080] text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl font-semibold">{upcomingSchedules.length}</div>
                      <div className="text-xs mt-0.5">전체</div>
                    </button>
                    <button
                      onClick={() => setScheduleFilter('joined')}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${
                        scheduleFilter === 'joined'
                          ? 'bg-[#5f0080] text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl font-semibold">{mySchedules.length}</div>
                      <div className="text-xs mt-0.5">참여중</div>
                    </button>
                    <button
                      onClick={() => setScheduleFilter('not-joined')}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${
                        scheduleFilter === 'not-joined'
                          ? 'bg-[#5f0080] text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl font-semibold">{upcomingSchedules.length - mySchedules.length}</div>
                      <div className="text-xs mt-0.5">참여가능</div>
                    </button>
                  </div>
                )}
              </div>

          {/* 일정 뷰 */}
          {crewView === 'schedules' && (
          <div className="px-6 py-4 md:py-6 space-y-6 md:space-y-6">
            {/* 크루장 전용 - 가입 승인 섹션 */}
            {canManageOrg(selectedOrg.id) && selectedOrg.pendingMembers && selectedOrg.pendingMembers.length > 0 && (
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium tracking-wider uppercase text-mokkoji-black">
                    가입 대기
                  </h3>
                  <span className="px-3 py-1 bg-mokkoji-accent text-white text-sm font-medium rounded-full">
                    {selectedOrg.pendingMembers.length}명
                  </span>
                </div>
                <div className="space-y-3">
                  {selectedOrg.pendingMembers.map((member: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-mokkoji-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-mokkoji-primary-light flex items-center justify-center overflow-hidden">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-mokkoji-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-mokkoji-black">{member.name}</p>
                          <p className="text-sm text-mokkoji-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveMember(selectedOrg.id, member)}
                          className="px-4 py-2 bg-mokkoji-primary text-white text-sm font-medium rounded-lg hover:bg-mokkoji-primary-hover transition-all duration-300 active:scale-95"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleRejectMember(selectedOrg.id, member)}
                          className="px-4 py-2 bg-mokkoji-gray-200 text-mokkoji-gray-700 text-sm font-medium rounded-lg hover:bg-mokkoji-gray-300 transition-all duration-300 active:scale-95"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 다가오는 일정 */}
            <div>
              <h3 className="text-lg md:text-xl font-medium tracking-wider uppercase text-mokkoji-black mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-mokkoji-primary" />
                Upcoming Events
              </h3>
              <div className="space-y-4">
                {(() => {
                  let filteredSchedules = upcomingSchedules
                  const myName = userProfile?.name || '익명'
                  const myUid = userProfile?.uid || ''

                  // 참여 여부 확인 헬퍼 함수
                  const isParticipating = (schedule: any) => {
                    const participants = schedule.participants
                    if (!participants) return false

                    // 배열인 경우
                    if (Array.isArray(participants)) {
                      // 문자열 배열 체크 (기존 방식)
                      if (participants.some(p => typeof p === 'string' && p === myName)) {
                        return true
                      }

                      // 객체 배열 체크 (새 방식)
                      return participants.some(p =>
                        typeof p === 'object' && p !== null && (
                          p.userId === myUid ||
                          p.userName === myName ||
                          p.uid === myUid ||
                          p.name === myName
                        )
                      )
                    }

                    return false
                  }

                  if (scheduleFilter === 'joined') {
                    filteredSchedules = upcomingSchedules.filter(s => isParticipating(s))
                  } else if (scheduleFilter === 'not-joined') {
                    filteredSchedules = upcomingSchedules.filter(s => !isParticipating(s))
                  }

                  if (filteredSchedules.length === 0) {
                    return (
                      <div className="card-premium p-8 text-center">
                        <div className="flex justify-center mb-4">
                          <div className="w-16 h-16 rounded-full bg-mokkoji-accent/10 flex items-center justify-center">
                            <Calendar className="w-8 h-8 text-mokkoji-accent" />
                          </div>
                        </div>
                        <p className="text-base leading-6 font-medium text-mokkoji-gray-600">No events scheduled</p>
                      </div>
                    )
                  }

                  return filteredSchedules.map((schedule) => {
                  const scheduleIsParticipating = isParticipating(schedule)
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                      className={`card-premium p-6 border transition-all duration-300 cursor-pointer active:scale-[0.98] ${
                        scheduleIsParticipating ? 'border-mokkoji-primary shadow-md' : 'hover:border-mokkoji-primary hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-medium text-lg leading-7 tracking-tight text-mokkoji-black flex-1">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-medium ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm leading-5 text-mokkoji-gray-700">
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span className="font-normal">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span className="font-normal">{schedule.location}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span className="font-normal">{getGoingCount(schedule.participants)}/{schedule.maxParticipants}명</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-mokkoji-primary flex-shrink-0" />
                          <span className="font-normal">Host: {schedule.createdBy}</span>
                        </p>
                      </div>
                      {scheduleIsParticipating && (
                        <div className="mt-4 text-xs bg-mokkoji-primary-light text-mokkoji-primary px-3 py-2 rounded-lg font-medium text-center">
                          <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Joined</span>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
              </div>
            </div>

            {/* 지난 일정 */}
            {pastSchedules.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg md:text-xl font-medium tracking-wider uppercase text-mokkoji-gray-600 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-mokkoji-gray-500" />
                  Past Events
                </h3>
                <div className="space-y-4">
                  {pastSchedules.map((schedule) => {
                    const isParticipating = schedule.participants?.includes(profile.name)
                    return (
                      <div
                        key={schedule.id}
                        onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                        className="card-premium p-6 opacity-60 hover:opacity-75 hover:shadow-md transition-all duration-300 cursor-pointer border-mokkoji-gray-200"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-lg leading-7 text-mokkoji-gray-700">{schedule.title}</h3>
                          <span className="text-xs bg-mokkoji-gray-100 text-mokkoji-gray-700 px-3 py-1 rounded-lg font-medium">
                            {schedule.type}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm leading-5 text-mokkoji-gray-600">
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-mokkoji-gray-500 flex-shrink-0" />
                            <span className="font-normal">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-mokkoji-gray-500 flex-shrink-0" />
                            <span className="font-normal">{schedule.location}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-mokkoji-gray-500 flex-shrink-0" />
                            <span className="font-normal">{getGoingCount(schedule.participants)}/{schedule.maxParticipants}명</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-mokkoji-gray-500 flex-shrink-0" />
                            <span className="font-normal">Host: {schedule.createdBy}</span>
                          </p>
                        </div>
                        {isParticipating && (
                          <div className="mt-3 text-xs bg-mokkoji-gray-100 text-mokkoji-gray-700 px-3 py-2 rounded-lg font-medium text-center">
                            <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Attended</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {/* 사진첩 뷰 */}
          {crewView === 'photos' && selectedOrg && (
            <div className="px-6 py-4 md:py-6">
              {/* 사진 업로드 버튼 - 크루 멤버만 */}
              {members.some(m => m.uid === userProfile?.uid) && (
                <div className="mb-6">
                  <label className="w-full py-4 px-6 bg-mokkoji-primary hover:bg-mokkoji-primary-hover text-white rounded-xl font-medium text-sm tracking-wider uppercase cursor-pointer active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2">
                    {uploadingPhoto ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        Upload Photo
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file && selectedOrg) {
                          handlePhotoUpload(file, selectedOrg.id)
                        }
                      }}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* 사진 그리드 */}
              {photos.length === 0 ? (
                <div className="card-premium p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-mokkoji-accent/10 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-mokkoji-accent" />
                    </div>
                  </div>
                  <p className="text-base leading-6 font-medium text-mokkoji-gray-600 mb-2">No photos yet</p>
                  <p className="text-sm leading-5 text-mokkoji-gray-500">Upload your first photo!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        // 크루 멤버만 상세 보기 가능
                        if (members.some(m => m.uid === userProfile?.uid)) {
                          setSelectedPhoto(photo)
                        } else {
                          alert('크루 멤버만 사진을 자세히 볼 수 있어요.')
                        }
                      }}
                      className="aspect-square rounded-xl overflow-hidden bg-mokkoji-gray-100 hover:opacity-80 transition-all duration-300 active:scale-[0.98]"
                    >
                      <img
                        src={photo.url}
                        alt={photo.fileName}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* 비회원용 안내 메시지 */}
              {!members.some(m => m.uid === userProfile?.uid) && photos.length > 0 && (
                <div className="mt-6 p-4 bg-mokkoji-accent-light border border-mokkoji-accent rounded-xl">
                  <p className="text-sm leading-5 text-mokkoji-gray-700 text-center flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4 text-mokkoji-accent flex-shrink-0" />
                    <span>Join the crew to view and upload photos</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 플로팅 액션 버튼 - 일정 탭에서만 표시 */}
          {crewView === 'schedules' && (
          <div className="fixed bottom-32 right-5 flex flex-col gap-2 md:gap-4 z-30">
            <button
              onClick={() => setShowMemberList(true)}
              className="w-16 h-16 bg-white border-2 border-mokkoji-primary text-mokkoji-primary rounded-full shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center hover:bg-mokkoji-primary-light"
            >
              <Users className="w-7 h-7" />
            </button>
            <button
              onClick={() => setShowCreateSchedule(true)}
              className="w-16 h-16 bg-mokkoji-primary hover:bg-mokkoji-primary-hover text-white rounded-full shadow-lg text-2xl font-medium active:scale-95 transition-all duration-300"
            >
              +
            </button>
          </div>
          )}
            </>
          )}
        </div>
      )}

      {/* 사진 상세 모달 - 크루 멤버만 */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl">
            {/* 닫기 버튼 */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white text-3xl hover:opacity-80"
            >
              <X className="w-8 h-8" />
            </button>

            {/* 사진 */}
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.fileName}
              className="w-full h-auto rounded-2xl"
            />

            {/* 사진 정보 */}
            <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <p className="text-sm leading-5 font-medium">
                올린 사람: {selectedPhoto.uploaderName}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {selectedPhoto.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '날짜 정보 없음'}
              </p>

              {/* 삭제 버튼 - 본인만 */}
              {userProfile && selectedPhoto.uploaderUid === userProfile.uid && selectedOrg && (
                <button
                  onClick={() => handlePhotoDelete(selectedPhoto.id, selectedOrg.id)}
                  className="mt-3 w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm leading-5"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 멤버 리스트 모달 */}
      {showMemberList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#FF9B50] text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl leading-7 md:text-xl md:text-2xl font-bold">CREW MEMBERS</h2>
                  <button
                    onClick={() => selectedOrg && fetchMembers(selectedOrg.id)}
                    className="text-white text-xl leading-7 hover:opacity-80 bg-white/20 px-3 py-1 rounded-lg"
                  >
                    ↻
                  </button>
                </div>
                <button
                  onClick={() => setShowMemberList(false)}
                  className="text-white text-xl leading-7 md:text-xl md:text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm leading-5 opacity-90">총 {members.length}명</p>

              {/* 활동 경과일 필터 */}
              <div className="mt-3">
                <select
                  value={memberActivityFilter}
                  onChange={(e) => setMemberActivityFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/20 text-white rounded-lg text-sm leading-5 border border-white/30"
                >
                  <option value="all" className="text-gray-900">전체 멤버</option>
                  <option value="10plus" className="text-gray-900">경과일 10일이상</option>
                  <option value="30plus" className="text-gray-900">경과일 30일이상</option>
                  <option value="50plus" className="text-gray-900">경과일 50일이상</option>
                  <option value="60plus" className="text-gray-900">경과일 60일이상</option>
                </select>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                {membersWithDisplayNames.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 md:py-8">멤버가 없습니다.</p>
                ) : (
                  membersWithDisplayNames
                    .filter((member) => {
                      // 활동 경과일 필터 적용
                      if (memberActivityFilter === 'all') return true

                      const daysSinceLastParticipation = getMemberLastParticipationDays(member.displayName, member.uid)

                      if (memberActivityFilter === '10plus') {
                        return daysSinceLastParticipation !== null && daysSinceLastParticipation >= 10
                      } else if (memberActivityFilter === '30plus') {
                        return daysSinceLastParticipation !== null && daysSinceLastParticipation >= 30
                      } else if (memberActivityFilter === '50plus') {
                        return daysSinceLastParticipation !== null && daysSinceLastParticipation >= 50
                      } else if (memberActivityFilter === '60plus') {
                        return daysSinceLastParticipation !== null && daysSinceLastParticipation >= 60
                      }

                      return true
                    })
                    .sort((a, b) => {
                      // 1. 크루장이 제일 위
                      if (a.isCaptain && !b.isCaptain) return -1
                      if (!a.isCaptain && b.isCaptain) return 1

                      // 2. 운영진이 그 다음
                      if (a.role === 'admin' && b.role !== 'admin') return -1
                      if (a.role !== 'admin' && b.role === 'admin') return 1

                      // 3. 나머지는 가입일 순서 (오래된 순)
                      // Korean locale 날짜 형식 파싱 (예: "2025. 1. 15.")
                      const parseKoreanDate = (dateStr: string): number => {
                        try {
                          // "2025. 1. 15." 형식을 "2025-01-15" ISO 형식으로 변환
                          const cleaned = dateStr.replace(/\.\s*/g, '-').replace(/-$/, '')
                          const parts = cleaned.split('-').map(p => p.trim())
                          if (parts.length === 3) {
                            const [year, month, day] = parts
                            const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                            const timestamp = new Date(isoDate).getTime()
                            return isNaN(timestamp) ? 0 : timestamp
                          }
                          return 0
                        } catch {
                          return 0
                        }
                      }

                      const dateA = parseKoreanDate(a.joinDate)
                      const dateB = parseKoreanDate(b.joinDate)

                      // 날짜가 같으면 이름 순으로 정렬
                      if (dateA === dateB) {
                        return a.name.localeCompare(b.name)
                      }

                      return dateA - dateB
                    })
                    .map((member) => {
                      const isCaptain = userProfile?.role === 'captain'
                      const isCurrentUser = userProfile?.uid === member.uid
                      const daysSinceLastParticipation = getMemberLastParticipationDays(member.name, member.uid)

                      return (
                      <div
                        key={member.id}
                        className="bg-gray-100 rounded-lg p-4 flex items-center gap-3"
                      >
                        <div
                          onClick={(e) => {
                            const img = e.currentTarget.querySelector('img')
                            if (img && img.src && !img.src.includes('default-avatar.svg')) {
                              setSelectedAvatarUrl(img.src)
                            }
                          }}
                          className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#FF9B50] bg-gray-200"
                        >
                          <img
                            src={getValidAvatarUrl(member.avatar)}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              if (target.src !== `${window.location.origin}/default-avatar.svg`) {
                                target.src = '/default-avatar.svg'
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{member.displayName}</span>
                            {member.isCaptain && (
                              <span className="text-xs bg-[#FF9B50] text-white px-2 py-0.5 rounded-full">
                                크루장
                              </span>
                            )}
                            {member.role === 'admin' && !member.isCaptain && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                운영진
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">가입일: {formatTimestamp(member.joinDate)}</p>
                          {member.birthdate && (
                            <p className="text-xs text-gray-600 mt-0.5">생년월일: {member.birthdate}</p>
                          )}
                          {(member as any).location && (
                            <p className="text-xs text-gray-600 mt-0.5">지역: {(member as any).location}</p>
                          )}
                          <p className="text-xs text-gray-700 mt-0.5">
                            {daysSinceLastParticipation === null ? (
                              <span className="text-red-500">참여 이력 없음</span>
                            ) : daysSinceLastParticipation === 0 ? (
                              <span className="text-[#FF9B50] font-bold">오늘 참여</span>
                            ) : (
                              <span className={daysSinceLastParticipation >= 90 ? 'text-red-500' : daysSinceLastParticipation >= 60 ? 'text-orange-500' : 'text-gray-700'}>
                                마지막 참여: {daysSinceLastParticipation}일 전
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일정 상세 모달 - 토스 스타일 */}
      {selectedSchedule && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSchedule(null)
            }
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden my-auto shadow-2xl animate-slideUp">
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-2 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            {/* 헤더 */}
            <div className="px-3 md:px-6 pt-5 pb-4 border-b border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h2 className="text-xl md:text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 leading-tight mb-2">
                    {selectedSchedule.title}
                  </h2>
                  <span className="inline-block text-sm leading-5 font-extrabold bg-[#F5F5F4] text-gray-700 px-3 py-1.5 rounded-lg">
                    {selectedSchedule.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out -mr-2"
                >
                  <span className="text-xl leading-7 md:text-xl md:text-2xl text-gray-600">×</span>
                </button>
              </div>
            </div>

            <div className="px-3 md:px-6 py-5 space-y-6 md:space-y-6 max-h-[70vh] overflow-y-auto">
              {/* 일정 정보 카드 */}
              <div className="bg-[#FFFBF7] rounded-2xl p-5 space-y-4">
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4" />일시</div>
                  <div className="text-base leading-6 font-extrabold text-gray-900">
                    {formatDateWithYear(selectedSchedule.date)} {selectedSchedule.time}
                  </div>
                </div>

                <div className="h-px bg-gray-200"></div>

                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" />장소</div>
                  <div className="text-base leading-6 font-extrabold text-gray-900">{selectedSchedule.location}</div>
                </div>

                <div className="h-px bg-gray-200"></div>

                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-2 flex items-center gap-1.5"><Target className="w-4 h-4" />벙주</div>
                  <div className="text-base leading-6 font-extrabold text-gray-900">{selectedSchedule.createdBy || '정보 없음'}</div>
                </div>
              </div>

              {/* 참여 인원 섹션 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-base leading-6 font-extrabold text-gray-900 flex items-center gap-1.5"><Users className="w-5 h-5 text-[#FF9B50]" />참여 인원</div>
                  <div className="text-base leading-6 font-extrabold text-[#FF9B50]">
                    {getGoingCount(selectedSchedule.participants)} / {selectedSchedule.maxParticipants}명
                  </div>
                </div>
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSchedule.participants.map((name) => (
                      <div key={name} className="bg-[#F5F5F4] px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition-all duration-200">
                        <span className="text-sm leading-5 font-extrabold text-gray-900">{name}</span>
                        {((selectedOrg && canManageOrg(selectedOrg.id)) || selectedSchedule.createdByUid === userProfile?.uid) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveParticipant(selectedSchedule, name)
                            }}
                            className="text-gray-600 hover:text-red-500 font-extrabold text-xl leading-none active:scale-[0.99] transition-transform duration-200 ease-out"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {((selectedOrg && canManageOrg(selectedOrg.id)) || selectedSchedule.createdByUid === userProfile?.uid) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setManagingParticipants(!managingParticipants)
                    }}
                    className="mt-3 text-sm leading-5 text-[#FF9B50] hover:text-[#FF8A3D] font-extrabold py-1 active:scale-[0.99] transition-transform duration-200 ease-out"
                  >
                    {managingParticipants ? '관리 종료' : '+ 참석자 추가하기'}
                  </button>
                )}
                {managingParticipants && membersWithDisplayNames.filter(m => !selectedSchedule.participants?.includes(m.displayName)).length > 0 && (
                  <div className="mt-3 p-4 bg-[#FFFBF7] rounded-2xl max-h-40 overflow-y-auto">
                    <div className="text-sm leading-5 font-extrabold text-gray-600 mb-3">멤버를 클릭하여 추가</div>
                    <div className="flex flex-wrap gap-2">
                      {membersWithDisplayNames.filter(m => !selectedSchedule.participants?.includes(m.displayName)).map(member => (
                        <button
                          key={member.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddParticipant(selectedSchedule, member.displayName)
                          }}
                          className="text-sm leading-5 font-extrabold bg-white px-4 py-2 rounded-xl hover:bg-[#FF9B50] hover:text-white border border-[#E5E8EB] active:scale-[0.99] transition-transform duration-200 ease-out"
                        >
                          + {member.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 댓글 섹션 */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base leading-6 font-extrabold text-gray-900 inline-flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#FF9B50]" />댓글</span>
                  <span className="text-sm leading-5 font-extrabold text-gray-600">({selectedSchedule.comments?.length || 0})</span>
                </div>
                {selectedSchedule.comments && selectedSchedule.comments.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {selectedSchedule.comments.map((comment, index) => (
                      <div key={`${comment.id}-${index}`} className="bg-[#FFFBF7] p-4 rounded-2xl">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-sm leading-5 text-[#FF9B50]">{comment.userName || '익명'}</div>
                          {(comment.userUid === userProfile?.uid || (selectedOrg && canManageOrg(selectedOrg.id))) && (
                            <button
                              onClick={() => handleDeleteComment(selectedSchedule, comment.id)}
                              className="text-gray-600 hover:text-red-500 text-xl md:text-xl leading-none active:scale-[0.99] transition-transform duration-200 ease-out"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed mb-2">{comment.text}</div>
                        <div className="text-xs font-medium text-gray-600">
                          {new Date(comment.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment(selectedSchedule)}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 px-4 py-3 border-2 border-[#E5E8EB] rounded-xl text-sm leading-5 focus:border-[#FF9B50] focus:outline-none transition-all duration-200"
                  />
                  <button
                    onClick={() => handleAddComment(selectedSchedule)}
                    className="px-6 py-4 bg-[#FF9B50] text-white rounded-xl text-sm leading-5 font-extrabold hover:bg-[#FF8A3D] active:scale-[0.99] transition-transform duration-200 ease-out"
                  >
                    등록
                  </button>
                </div>
              </div>

              {/* 카카오톡 공유하기 버튼 */}
              <div className="border-t border-gray-200 pt-5">
                <button
                  onClick={() => handleShareSchedule(selectedSchedule)}
                  className="w-full bg-[#FEE500] text-gray-900 py-4 rounded-2xl font-extrabold hover:bg-[#FDD835] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" />
                  <span>카카오톡 공유하기</span>
                </button>
              </div>

              {/* 마스터(크루장/운영진) 또는 벙주만 수정/삭제 가능 */}
              {((selectedOrg && canManageOrg(selectedOrg.id)) || selectedSchedule.createdByUid === userProfile?.uid) && (
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setEditScheduleForm({
                        title: selectedSchedule.title || '',
                        date: selectedSchedule.dateISO || selectedSchedule.date || '',
                        time: selectedSchedule.time || '',
                        location: selectedSchedule.location || '',
                        type: selectedSchedule.type || '',
                        maxParticipants: selectedSchedule.maxParticipants || 10
                      })
                      setEditingSchedule(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="flex-1 bg-[#5f0080] text-white py-4 rounded-2xl font-semibold hover:bg-[#4a0066] transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" strokeWidth={1.5} />
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(selectedSchedule)}
                    className="flex-1 bg-gray-100 text-red-500 py-4 rounded-2xl font-semibold hover:bg-red-50 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                    삭제
                  </button>
                </div>
              )}

              <div>
                {selectedSchedule.participants?.includes(userProfile?.name || '익명') ? (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-[#F5F5F4] text-[#F04452] py-4 rounded-2xl font-extrabold hover:bg-[#FFE5E8] transition-all active:scale-[0.98]"
                  >
                    참여 안 할래요
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-[#FF9B50] text-white py-4 rounded-2xl font-extrabold hover:bg-[#FF8A3D] disabled:bg-[#E5E8EB] disabled:text-gray-600 transition-all active:scale-[0.98]"
                    disabled={getGoingCount(selectedSchedule.participants) >= selectedSchedule.maxParticipants}
                  >
                    {getGoingCount(selectedSchedule.participants) >= selectedSchedule.maxParticipants ? '정원 초과' : '참여하기'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Profile Page - 토스 스타일 */}
      {currentPage === 'myprofile' && (
        <div className="bg-[#FAFAFA] min-h-screen pb-20">
          {/* MOKKOJI Header */}
          <AppHeader showNotification showSettings />

          {/* 페이지 타이틀 */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">프로필</h1>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* 프로필 카드 */}
            <div className="card-premium p-4 sm:p-5 md:p-6">
              <div className="text-center mb-5 sm:mb-6">
                <div className="relative w-16 h-16 md:w-20 md:h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 group">
                  <label className="block w-full h-full cursor-pointer">
                    <div className="w-full h-full bg-gradient-to-br from-orange-50 to-indigo-50 rounded-full flex items-center justify-center text-xl leading-7 md:text-xl md:text-2xl md:text-3xl sm:text-4xl overflow-hidden">
                      <img
                        src={getValidAvatarUrl(profile.avatar)}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          if (target.src !== `${window.location.origin}/default-avatar.svg`) {
                            target.src = '/default-avatar.svg'
                          }
                        }}
                      />
                    </div>
                    {/* 카메라 아이콘 - 항상 표시 */}
                    <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-7 sm:h-7 bg-mokkoji-primary rounded-full flex items-center justify-center shadow-md border-2 border-white">
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleSelectAvatarFile(file)
                        }
                        // input 초기화 (같은 파일 다시 선택 가능하도록)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {/* 업로드 중 오버레이 */}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">업로드 중...</span>
                    </div>
                  )}
                </div>
                <h2 className="text-xl leading-7 sm:text-xl md:text-2xl font-medium tracking-tight text-mokkoji-black mb-1.5 sm:mb-2">{profile.name}</h2>
                <p className="text-xs sm:text-sm text-mokkoji-gray-600">{profile.email}</p>
              </div>

              {/* 정보 섹션 */}
              <div className="bg-mokkoji-primary-light/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-6 sm:space-y-4">
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">Birth Date</div>
                  <div className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">{profile.birthdate}</div>
                </div>
                <div className="h-px bg-mokkoji-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">Gender</div>
                  <div className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">{profile.gender}</div>
                </div>
                <div className="h-px bg-mokkoji-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">Location</div>
                  <div className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">{profile.location}</div>
                </div>
                <div className="h-px bg-mokkoji-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">MBTI</div>
                  <div className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">{profile.mbti || '-'}</div>
                </div>
                <div className="h-px bg-mokkoji-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">Interests</div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(profile.interestCategories || []).length > 0 ? (
                      profile.interestCategories.map((category, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 sm:px-3 bg-mokkoji-primary text-white text-xs rounded-full font-medium">
                          {category}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">-</span>
                    )}
                  </div>
                </div>
                <div className="h-px bg-mokkoji-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-medium text-mokkoji-gray-600 mb-1.5 sm:mb-2 tracking-wider uppercase">Joined</div>
                  <div className="text-sm leading-5 sm:text-base font-normal text-mokkoji-black">{formatTimestamp(profile.joinDate)}</div>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-3 sm:space-y-3">
              <button
                onClick={() => {
                  // 지역 정보 파싱 (예: "서울특별시 강남구" -> city: "서울특별시", district: "강남구")
                  const locationParts = profile.location?.split(' ') || []
                  const city = locationParts[0] || ''
                  const district = locationParts[1] || ''

                  setMyProfileForm({
                    name: profile.name,
                    gender: profile.gender,
                    birthdate: profile.birthdate,
                    location: profile.location,
                    mbti: profile.mbti || '',
                    interestCategories: profile.interestCategories || []
                  })
                  setSelectedCity(city)
                  setSelectedDistrict(district)
                  setEditingMyProfile(true)
                }}
                className="w-full bg-mokkoji-primary text-white py-3.5 sm:py-4 rounded-xl text-sm leading-5 sm:text-base font-medium tracking-wider uppercase hover:bg-mokkoji-primary-hover active:scale-95 transition-all duration-300"
              >
                <span className="inline-flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-mokkoji-gray-100 text-red-600 py-3.5 sm:py-4 rounded-xl text-sm leading-5 sm:text-base font-medium tracking-wider uppercase hover:bg-red-50 active:scale-95 transition-all duration-300"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 사진 확대 모달 */}
      {selectedAvatarUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAvatarUrl(null)}
        >
          <div className="max-w-2xl max-h-[80vh] relative">
            <img
              src={selectedAvatarUrl}
              alt="Profile"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedAvatarUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full text-white text-xl leading-7 md:text-xl md:text-2xl flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 멤버 역할 수정 모달 */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-blue-600 text-white p-3 md:p-6">
              <h2 className="text-xl leading-7 md:text-2xl font-extrabold">멤버 역할 변경</h2>
              <p className="text-sm leading-5 opacity-90 mt-1">{editingMember.name}</p>
            </div>

            <div className="p-3 md:p-6 space-y-6">
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'captain')}
                className="w-full py-4 bg-[#FF9B50] text-white rounded-xl font-extrabold text-base leading-6 hover:bg-[#FF8A3D] transition-all duration-200"
              >
                크루장으로 변경
              </button>
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'staff')}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-extrabold hover:bg-blue-600 transition-all duration-200"
              >
                운영진으로 변경
              </button>
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'member')}
                className="w-full py-3 bg-gray-500 text-white rounded-lg font-extrabold hover:bg-stone-600 transition-all duration-200"
              >
                일반 멤버로 변경
              </button>
              <button
                onClick={() => setEditingMember(null)}
                className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 정보 수정 모달 */}
      {editingMemberInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#FF9B50] text-white p-6">
              <h2 className="text-xl leading-7 md:text-2xl font-extrabold">멤버 정보 수정</h2>
              <p className="text-sm leading-5 opacity-90 mt-1">{editingMemberInfo.name}</p>
              <p className="text-xs opacity-75 mt-1">로그인 계정: {editingMemberInfo.email}</p>
            </div>

            <div className="p-3 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">성별 *</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                >
                  <option value="">선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">생년월일 *</label>
                <input
                  type="date"
                  value={editForm.birthdate}
                  onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">지역 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCityForMemberEdit}
                    onChange={(e) => {
                      setSelectedCityForMemberEdit(e.target.value)
                      setSelectedDistrictForMemberEdit('') // Reset district when city changes
                      setEditForm({ ...editForm, location: e.target.value })
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                  >
                    <option value="">시/도</option>
                    {getCities().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDistrictForMemberEdit}
                    onChange={(e) => {
                      setSelectedDistrictForMemberEdit(e.target.value)
                      setEditForm({ ...editForm, location: `${selectedCityForMemberEdit} ${e.target.value}` })
                    }}
                    disabled={!selectedCityForMemberEdit}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">구/군</option>
                    {selectedCityForMemberEdit && getDistricts(selectedCityForMemberEdit).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={editForm.mbti}
                  onChange={(e) => setEditForm({ ...editForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>
            </div>

            <div className="p-3 md:p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMemberInfo}
                className="flex-1 py-4 bg-[#FF9B50] text-white rounded-xl font-extrabold text-base leading-6 hover:bg-[#FF8A3D] transition-all duration-200"
              >
                저장
              </button>
              <button
                onClick={() => setEditingMemberInfo(null)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 정보 수정 모달 */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col relative">
            {/* Close Button - Top Right */}
            <button
              onClick={() => {
                setEditingOrg(null)
                setOrgAvatarFile(null)
                setOrgAvatarPreview(null)
              }}
              className="absolute top-6 right-6 p-2 hover:bg-red-50 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <div className="bg-[#FF9B50] text-white p-6">
              <h2 className="text-xl leading-7 md:text-2xl font-extrabold">크루 정보 수정</h2>
              <p className="text-sm leading-5 opacity-90 mt-1">{editingOrg.name}</p>
            </div>

            <div className="p-3 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">크루명 *</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="우리 크루"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">크루 소제목</label>
                <input
                  type="text"
                  value={orgForm.subtitle}
                  onChange={(e) => setOrgForm({ ...orgForm, subtitle: e.target.value })}
                  placeholder="함께하는 아웃도어 라이프"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">크루 설명 *</label>
                <textarea
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  placeholder="어떤 크루인지 소개해주세요"
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-2">카테고리 * (중복 선택 가능)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                  {CREW_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={orgForm.categories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setOrgForm({ ...orgForm, categories: [...orgForm.categories, category] })
                          } else {
                            setOrgForm({ ...orgForm, categories: orgForm.categories.filter(c => c !== category) })
                          }
                        }}
                        className="w-4 h-4 text-[#FF9B50] border-gray-300 rounded focus:ring-[#FF9B50]"
                      />
                      <span className="text-sm leading-5 text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {orgForm.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {orgForm.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF9B50] text-white text-xs rounded-full">
                        {cat}
                        <button
                          type="button"
                          onClick={() => setOrgForm({ ...orgForm, categories: orgForm.categories.filter(c => c !== cat) })}
                          className="hover:text-red-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 크루 활동 지역 */}
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-2">크루 활동 지역 (선택)</label>
                <div className="space-y-2">
                  {orgForm.location ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-base leading-6 font-extrabold text-emerald-900">{orgForm.location.dong}</p>
                          <p className="text-xs text-emerald-700 mt-1">{orgForm.location.address}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrgForm({ ...orgForm, location: null })}
                          className="text-red-600 text-xs font-medium hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSetCrewLocation}
                      disabled={settingLocation}
                      className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 active:scale-[0.99] transition-transform duration-200 ease-out disabled:opacity-50"
                    >
                      {settingLocation ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          위치 가져오는 중...
                        </span>
                      ) : (
                        '현재 위치로 설정'
                      )}
                    </button>
                  )}
                  <p className="text-xs text-gray-600">※ 내 동네 크루 필터링에 사용됩니다</p>
                </div>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-2">크루 메인사진</label>
                <div className="space-y-2">
                  {orgAvatarFile && (
                    <div className="p-3 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-7 md:text-xl md:text-2xl">📷</span>
                        <span className="text-sm leading-5 text-gray-700">{orgAvatarFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrgAvatarFile(null)}
                        className="text-red-500 text-base leading-6 font-bold"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-100 active:scale-[0.99] transition-transform duration-200 ease-out flex items-center justify-center gap-1.5">
                      <Camera className="w-4 h-4" strokeWidth={1.5} /> 사진 촬영
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageSelect(file, 'org')
                        }}
                        className="hidden"
                      />
                    </label>
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-100 active:scale-[0.99] transition-transform duration-200 ease-out flex items-center justify-center gap-1.5">
                      <ImageIcon className="w-4 h-4" strokeWidth={1.5} /> 갤러리
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageSelect(file, 'org')
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-600">※ 5MB 이하 권장</p>
                </div>
              </div>
            </div>

            <div className="p-3 md:p-6 border-t space-y-6">
              <div className="flex gap-4">
                <button
                  onClick={handleUpdateOrg}
                  className="flex-1 py-4 bg-[#FF9B50] text-white rounded-xl font-extrabold text-base leading-6 hover:bg-[#FF8A3D] transition-all duration-200"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingOrg(null)
                    setOrgAvatarFile(null)
                  }}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
                >
                  취소
                </button>
              </div>
              <button
                onClick={() => setShowDeleteCrewConfirm(true)}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-extrabold text-base leading-6 hover:bg-red-600 transition-all duration-200"
              >
                크루를 해체할까요?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 생성 모달 */}
      {showCreateCrew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto relative">
            {/* 닫기 버튼 - 우측 상단 */}
            <button
              onClick={() => {
                setShowCreateCrew(false)
                setCreateCrewStep(1)
                setOrgForm({ name: '', subtitle: '', description: '', categories: [], location: null })
                setOrgAvatarFile(null)
                setOrgAvatarPreview(null)
              }}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>

            {/* 프로그레스 바 */}
            <div className="flex gap-2 mb-8">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-1 rounded-full transition-all ${
                    createCrewStep >= step ? 'bg-[#FF9B50]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Step 1: 기본 정보 */}
            {createCrewStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">기본 정보를 입력해주세요</h2>
                  <p className="text-gray-600">크루의 이름과 로고를 설정하세요</p>
                </div>

                {/* 크루 로고 */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                      {orgAvatarPreview ? (
                        <img src={orgAvatarPreview} alt="크루 로고" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-12 h-12 text-gray-400" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-10 h-10 bg-[#FF9B50] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#FF8A3D] transition-colors shadow-lg">
                      <Camera className="w-5 h-5 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageSelect(file, 'org')
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">크루 로고를 등록해주세요</p>
                </div>

                {/* 크루명 */}
                <div>
                  <label className="block text-base font-bold text-gray-700 mb-2">크루명 *</label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    placeholder="예: 서울 캠핑 크루"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent"
                  />
                </div>

                {/* 한줄 소개 */}
                <div>
                  <label className="block text-base font-bold text-gray-700 mb-2">한줄 소개</label>
                  <input
                    type="text"
                    value={orgForm.subtitle}
                    onChange={(e) => setOrgForm({ ...orgForm, subtitle: e.target.value })}
                    placeholder="예: 함께하는 아웃도어 라이프"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent"
                  />
                </div>

                {/* 다음 버튼 */}
                <button
                  onClick={() => {
                    if (!orgForm.name.trim()) {
                      alert('크루명을 입력해주세요')
                      return
                    }
                    setCreateCrewStep(2)
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#FF9B50] to-[#2563EB] text-white rounded-xl font-bold hover:opacity-90 transition-all"
                >
                  다음
                </button>
              </div>
            )}

            {/* Step 2: 카테고리 선택 */}
            {createCrewStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">어떤 활동을 하나요?</h2>
                  <p className="text-gray-600">크루의 카테고리를 선택해주세요 (중복 가능)</p>
                </div>

                {/* 카테고리 선택 */}
                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2">
                  {CREW_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        orgForm.categories.includes(category)
                          ? 'border-[#FF9B50] bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={orgForm.categories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setOrgForm({ ...orgForm, categories: [...orgForm.categories, category] })
                          } else {
                            setOrgForm({ ...orgForm, categories: orgForm.categories.filter(c => c !== category) })
                          }
                        }}
                        className="w-5 h-5 text-[#FF9B50] border-gray-300 rounded focus:ring-[#FF9B50]"
                      />
                      <span className="text-sm font-medium text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>

                {/* 선택된 카테고리 */}
                {orgForm.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4 bg-orange-50 rounded-xl">
                    {orgForm.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FF9B50] text-white text-sm rounded-full">
                        {cat}
                        <button
                          type="button"
                          onClick={() => setOrgForm({ ...orgForm, categories: orgForm.categories.filter(c => c !== cat) })}
                          className="hover:text-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateCrewStep(1)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 inline mr-1" />
                    이전
                  </button>
                  <button
                    onClick={() => {
                      if (orgForm.categories.length === 0) {
                        alert('카테고리를 하나 이상 선택해주세요')
                        return
                      }
                      setCreateCrewStep(3)
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-[#FF9B50] to-[#2563EB] text-white rounded-xl font-bold hover:opacity-90 transition-all"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 상세 설명 */}
            {createCrewStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">크루를 소개해주세요</h2>
                  <p className="text-gray-600">상세한 설명과 활동 지역을 설정하세요</p>
                </div>

                {/* 크루 설명 */}
                <div>
                  <label className="block text-base font-bold text-gray-700 mb-2">크루 설명 *</label>
                  <textarea
                    value={orgForm.description}
                    onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                    placeholder="어떤 크루인지 소개해주세요"
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent resize-none"
                  />
                </div>

                {/* 크루 활동 지역 */}
                <div>
                  <label className="block text-base font-bold text-gray-700 mb-2">크루 활동 지역 (선택)</label>
                  <div className="space-y-2">
                    {orgForm.location ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-base font-bold text-emerald-900">{orgForm.location.dong}</p>
                            <p className="text-xs text-emerald-700 mt-1">{orgForm.location.address}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOrgForm({ ...orgForm, location: null })}
                            className="text-red-600 text-sm font-medium hover:text-red-700"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSetCrewLocation}
                        disabled={settingLocation}
                        className="w-full py-3 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-[#FF9B50] transition-all disabled:opacity-50"
                      >
                        {settingLocation ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            위치 가져오는 중...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <MapPin className="w-5 h-5" />
                            현재 위치로 설정
                          </span>
                        )}
                      </button>
                    )}
                    <p className="text-xs text-gray-500 text-center">내 동네 크루 필터링에 사용됩니다</p>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateCrewStep(2)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 inline mr-1" />
                    이전
                  </button>
                  <button
                    onClick={handleCreateCrew}
                    className="flex-1 py-3 bg-gradient-to-r from-[#FF9B50] to-[#2563EB] text-white rounded-xl font-bold hover:opacity-90 transition-all"
                  >
                    크루 만들기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내 프로필 수정 모달 */}
      {editingMyProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            {/* 헤더 */}
            <div className="bg-[#5f0080] px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">내 정보 바꾸기</h2>
                <button
                  onClick={() => setEditingMyProfile(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
                <input
                  type="text"
                  value={myProfileForm.name}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">성별 *</label>
                <select
                  value={myProfileForm.gender}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, gender: e.target.value })}
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors bg-white"
                >
                  <option value="">선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">생년월일 *</label>
                <input
                  type="date"
                  value={myProfileForm.birthdate}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, birthdate: e.target.value })}
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">지역 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value)
                      setSelectedDistrict('')
                      setMyProfileForm({ ...myProfileForm, location: e.target.value })
                    }}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors bg-white"
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
                      setMyProfileForm({ ...myProfileForm, location: `${selectedCity} ${e.target.value}` })
                    }}
                    disabled={!selectedCity}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="">구/군</option>
                    {selectedCity && getDistricts(selectedCity).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">MBTI</label>
                <input
                  type="text"
                  value={myProfileForm.mbti}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  관심 크루 카테고리 * (중복 선택 가능)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
                  {CREW_CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={myProfileForm.interestCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMyProfileForm({
                              ...myProfileForm,
                              interestCategories: [...myProfileForm.interestCategories, category]
                            })
                          } else {
                            setMyProfileForm({
                              ...myProfileForm,
                              interestCategories: myProfileForm.interestCategories.filter(c => c !== category)
                            })
                          }
                        }}
                        className="w-4 h-4 text-[#5f0080] border-gray-300 rounded focus:ring-[#5f0080]"
                      />
                      <span className="text-xs text-gray-600">{category}</span>
                    </label>
                  ))}
                </div>
                {myProfileForm.interestCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {myProfileForm.interestCategories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#5f0080] text-white text-xs font-medium rounded-full">
                        {cat}
                        <button
                          type="button"
                          onClick={() => setMyProfileForm({
                            ...myProfileForm,
                            interestCategories: myProfileForm.interestCategories.filter(c => c !== cat)
                          })}
                          className="hover:text-gray-200 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 비밀번호 변경 섹션 */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(true)
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordChangeError('')
                    setPasswordChangeSuccess(false)
                  }}
                  className="w-full h-12 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  비밀번호 변경
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setEditingMyProfile(false)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                취소
              </button>
              <button
                onClick={handleUpdateMyProfile}
                className="flex-1 h-12 rounded-xl bg-[#5f0080] text-sm font-medium text-white hover:bg-[#4a0066] active:scale-[0.98] transition-all"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden flex flex-col shadow-xl">
            {/* 헤더 */}
            <div className="bg-[#5f0080] px-5 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">비밀번호 변경</h2>
                <button
                  onClick={() => {
                    setShowPasswordChange(false)
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordChangeError('')
                    setPasswordChangeSuccess(false)
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {passwordChangeSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-base font-semibold text-green-600">비밀번호가 변경되었습니다!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">현재 비밀번호</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                      placeholder="현재 비밀번호 입력"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                      placeholder="8자 이상, 대소문자/숫자/특수문자 포함"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-[#5f0080] focus:ring-1 focus:ring-[#5f0080] focus:outline-none transition-colors"
                      placeholder="새 비밀번호 다시 입력"
                    />
                  </div>

                  {passwordChangeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-600">{passwordChangeError}</p>
                    </div>
                  )}

                  <div className="p-3 bg-[#f3e8f7] rounded-xl">
                    <p className="text-xs font-medium text-[#5f0080] mb-1.5">비밀번호 조건:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5 ml-1">
                      <li>• 8자 이상</li>
                      <li>• 대문자 포함</li>
                      <li>• 소문자 포함</li>
                      <li>• 숫자 포함</li>
                      <li>• 특수문자 포함 (!@#$%^&* 등)</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {!passwordChangeSuccess && (
              <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordChange(false)
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordChangeError('')
                  }}
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 h-12 rounded-xl bg-[#5f0080] text-sm font-medium text-white hover:bg-[#4a0066] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 일정 수정 모달 */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-orange-500 to-blue-600 text-white p-3 md:p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl leading-7 md:text-xl md:text-2xl font-bold">일정 수정</h2>
                <button
                  onClick={() => setEditingSchedule(null)}
                  className="text-white text-xl leading-7 md:text-xl md:text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm leading-5 opacity-90">{selectedOrg?.name}</p>
            </div>

            <div className="p-3 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={editScheduleForm.title}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={editScheduleForm.date}
                  onChange={(e) => {
                    // ISO 형식으로 저장 (일정 생성과 동일하게)
                    const isoDate = e.target.value
                    setEditScheduleForm({ ...editScheduleForm, date: isoDate })
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
                {editScheduleForm.date && (
                  <p className="text-sm leading-5 text-gray-700 mt-1">현재 날짜: {editScheduleForm.date.includes('-') ? new Date(editScheduleForm.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }) : editScheduleForm.date}</p>
                )}
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">시간 *</label>
                <input
                  type="time"
                  value={editScheduleForm.time}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">장소 *</label>
                <input
                  type="text"
                  value={editScheduleForm.location}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">유형 *</label>
                <select
                  value={editScheduleForm.type}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                >
                  <option value="오토캠핑">오토캠핑</option>
                  <option value="노지캠핑">노지캠핑</option>
                  <option value="백패킹">백패킹</option>
                  <option value="일반모임">일반모임</option>
                </select>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">최대 인원 *</label>
                <input
                  type="number"
                  value={editScheduleForm.maxParticipants}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, maxParticipants: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="p-3 md:p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateSchedule}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-blue-600 text-white rounded-lg font-extrabold hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                수정 완료
              </button>
              <button
                onClick={() => setEditingSchedule(null)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 생성 모달 */}
      {showCreateSchedule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#FF9B50] text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl leading-7 md:text-xl md:text-2xl font-bold">언제 만날까요?</h2>
                <button
                  onClick={() => setShowCreateSchedule(false)}
                  className="text-white text-xl leading-7 md:text-xl md:text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm leading-5 opacity-90">{selectedOrg?.name}</p>
            </div>

            <div className="p-3 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={createScheduleForm.title}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, title: e.target.value })}
                  placeholder="무엇을 할까요?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={createScheduleForm.date}
                  onChange={(e) => {
                    const isoDate = e.target.value  // "2025-11-17"
                    const selectedDate = new Date(isoDate)
                    const days = ['일', '월', '화', '수', '목', '금', '토']
                    const month = selectedDate.getMonth() + 1
                    const day = selectedDate.getDate()
                    const dayOfWeek = days[selectedDate.getDay()]
                    const formattedDate = `${month}/${day}(${dayOfWeek})`
                    // Store ISO date for form, will save both formats to Firestore
                    setCreateScheduleForm({ ...createScheduleForm, date: isoDate })
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
                {createScheduleForm.date && (
                  <p className="text-sm leading-5 text-gray-700 mt-1">선택된 날짜: {new Date(createScheduleForm.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })}</p>
                )}
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">시간 *</label>
                <input
                  type="time"
                  value={createScheduleForm.time}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">장소 *</label>
                <input
                  type="text"
                  value={createScheduleForm.location}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, location: e.target.value })}
                  placeholder="어디서 만날까요?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">유형 *</label>
                <select
                  value={createScheduleForm.type}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                >
                  <option value="">선택</option>
                  <option value="오토캠핑">오토캠핑</option>
                  <option value="노지캠핑">노지캠핑</option>
                  <option value="백패킹">백패킹</option>
                  <option value="일반모임">일반모임</option>
                </select>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">최대 인원 *</label>
                <input
                  type="number"
                  value={createScheduleForm.maxParticipants || ''}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, maxParticipants: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>
            </div>

            <div className="p-3 md:p-6 border-t flex gap-3">
              <button
                onClick={handleCreateSchedule}
                disabled={!createScheduleForm.title || !createScheduleForm.date || !createScheduleForm.time || !createScheduleForm.location || !createScheduleForm.type}
                className="flex-1 py-4 bg-[#FF9B50] text-white rounded-xl font-extrabold text-base leading-6 hover:bg-[#FF8A3D] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                생성
              </button>
              <button
                onClick={() => setShowCreateSchedule(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 사진 크롭 모달 */}
      {cropImageUrl && cropType === 'profile' && (
        <ImageCropModal
          imageUrl={cropImageUrl}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          cropShape="round"
          title="프로필 사진 편집"
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
        <div className="flex items-center justify-around h-14">
          {[
            { id: 'home' as Page, icon: Home, label: '홈' },
            { id: 'category' as Page, icon: Search, label: '둘러보기' },
            { id: 'mycrew' as Page, icon: Users, label: '내 크루' },
            { id: 'schedules' as Page, icon: Calendar, label: '일정' },
            { id: 'myprofile' as Page, icon: User, label: '프로필' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                if (id === 'mycrew') {
                  router.replace('/dashboard?page=mycrew', { scroll: false })
                  fetchOrganizations()
                } else if (id === 'home' && organizations.length > 0) {
                  router.replace(`/dashboard?page=home&orgId=${organizations[0].id}`, { scroll: false })
                } else {
                  router.replace(`/dashboard?page=${id}`, { scroll: false })
                }
              }}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[64px] transition-colors touch-target"
            >
              <Icon
                className={`w-5 h-5 ${currentPage === id ? 'text-[#5f0080]' : 'text-gray-400'}`}
                strokeWidth={1.5}
              />
              <span className={`text-xs ${currentPage === id ? 'text-[#5f0080] font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* 이미지 크롭 모달 */}
      {cropImageUrl && (
        <ImageCropModal
          imageUrl={cropImageUrl}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          title={cropType === 'org' ? '크루 메인사진 자르기' : '프로필 사진 자르기'}
        />
      )}

      {/* 위치 설정 모달 */}
      <LocationSettings
        isOpen={showLocationSettings}
        onClose={() => setShowLocationSettings(false)}
        onSave={handleSaveLocation}
        initialLocation={
          userProfile?.locations && userProfile.locations.length > 0
            ? {
                latitude: userProfile.locations[0].latitude,
                longitude: userProfile.locations[0].longitude,
                radius: userProfile.locations[0].radius || 1000,
              }
            : undefined
        }
      />
    </div>
  )
}

// Nearby Crews Carousel Component
function NearbyCrewsCarousel({
  nearbyCrews,
  router,
  orgMemberCounts,
  formatDistance
}: {
  nearbyCrews: any[]
  router: any
  orgMemberCounts: { [key: string]: number }
  formatDistance: (distance: number) => string
}) {
  return (
    <div className="px-6 space-y-6">
      {nearbyCrews.map((crew) => {
        // 크루 이미지 URL (우선순위: avatar > imageURL > images[0])
        const imageUrl = crew.avatar || crew.imageURL || (crew.images && crew.images[0]) || null

        // 카테고리 배열 (최대 2개만 표시)
        const categories = Array.isArray(crew.categories)
          ? crew.categories.slice(0, 2)
          : crew.category
            ? [crew.category].slice(0, 2)
            : []

        const totalCategories = Array.isArray(crew.categories)
          ? crew.categories.length
          : crew.category ? 1 : 0

        return (
          <button
            key={crew.id}
            onClick={() => {
              router.replace(`/dashboard?page=mycrew&orgId=${crew.id}`, { scroll: false })
            }}
            className="w-full flex gap-4 bg-white rounded-2xl p-5 border-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            {/* 크루 로고 (왼쪽) */}
            <div className="flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-400 to-pink-500">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={crew.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Tent className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* 크루 정보 (오른쪽) */}
            <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
              {/* 크루 이름 */}
              <h3 className="text-base leading-6 sm:text-xl font-extrabold text-gray-900 mb-1 truncate">
                {crew.name}
              </h3>

              {/* 위치 */}
              <div className="flex items-center gap-1 text-gray-700 text-xs sm:text-sm mb-1.5">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF9B50] flex-shrink-0" />
                <span className="truncate">
                  {crew.location?.dong || crew.description?.split(' ').slice(0, 2).join(' ') || '위치 미설정'}
                </span>
                {crew.distance > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600 font-medium">{formatDistance(crew.distance)}</span>
                  </>
                )}
              </div>

              {/* 카테고리 */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {categories.map((cat: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm leading-5 font-extrabold rounded-lg"
                    >
                      {cat}
                    </span>
                  ))}
                  {totalCategories > 2 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg">
                      +{totalCategories - 2}
                    </span>
                  )}
                </div>
              )}

              {/* 멤버 수 */}
              <div className="flex items-center gap-1 text-gray-600 text-xs sm:text-sm">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF9B50] flex-shrink-0" />
                <span>멤버 {orgMemberCounts[crew.id] || crew.memberCount || 0}명</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
