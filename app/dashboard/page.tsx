'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, orderBy, serverTimestamp } from 'firebase/firestore'
import { Home, Users, Calendar, User, MapPin, Bell, Settings, Target, MessageCircle, Sparkles, Star, Tent, Search, Plus, Check, Edit, LogOut, X, ChevronLeft, Camera } from 'lucide-react'
import { uploadToS3 } from '@/lib/s3-client'
import ScheduleDeepLink from '@/components/ScheduleDeepLink'
import { getCities, getDistricts } from '@/lib/locations'
import ImageCropModal from '@/components/ImageCropModal'
import { BRAND } from '@/lib/brand'
import { CREW_CATEGORIES } from '@/lib/constants'
import LocationVerification from '@/components/LocationVerification'
import LocationSettings from '@/components/LocationSettings'
import { getCurrentPosition, getAddressFromCoords, calculateDistance, formatDistance } from '@/lib/location-utils'
import { getOrganizations, getOrganizationMembers } from '@/lib/firestore-helpers'
import type { OrganizationMember } from '@/types'
import { formatTimestamp } from '@/lib/date-utils'
import LoadingScreen from '@/components/LoadingScreen'

type Page = 'home' | 'category' | 'mycrew' | 'myprofile' | 'schedules'

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
  const { user, userProfile, memberships, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 page 파라미터를 읽어 현재 페이지를 직접 계산 (useState 대신 useMemo 사용)
  const currentPage = useMemo(() => {
    const page = searchParams.get('page')
    if (page && ['home', 'category', 'mycrew', 'myprofile', 'schedules'].includes(page)) {
      return page as Page
    }
    return 'home' as Page
  }, [searchParams])

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([]) // 내가 가입한 크루
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]) // 모든 크루 (크루 찾기용)
  const [recommendedOrgs, setRecommendedOrgs] = useState<Organization[]>([])

  // URL에서 orgId 파라미터를 읽어 선택된 크루를 직접 계산 (useState 대신 useMemo 사용)
  const urlOrgId = searchParams.get('orgId')
  const selectedOrg = useMemo(() => {
    if (!urlOrgId || organizations.length === 0) return null
    const org = organizations.find(o => o.id === urlOrgId)
    if (org) {
    }
    return org || null
  }, [urlOrgId, organizations])
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
  const [editingMyProfile, setEditingMyProfile] = useState(false)
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
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchOrganizations() // 내가 가입한 크루
      fetchAllOrganizations() // 모든 크루 (크루 찾기용)
    }
  }, [user])

  // 추천 크루 가져오기
  useEffect(() => {
    if (user && userProfile) {
      fetchRecommendedOrganizations()
    }
  }, [user, userProfile])

  // 홈 화면 및 내 크루 화면에서 모든 크루의 일정을 가져오기
  useEffect(() => {

    let unsubscribe: (() => void) | undefined

    // 홈 화면 또는 내 크루 화면이고 특정 크루가 선택되지 않은 경우, 모든 크루의 일정을 가져옴
    if (user && (currentPage === 'home' || currentPage === 'mycrew') && !selectedOrg && organizations.length > 0) {
      const orgIds = organizations.map(org => org.id)
      unsubscribe = fetchAllUserSchedules(orgIds)
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user, organizations, currentPage, selectedOrg])

  // 특정 크루 선택 시 해당 크루의 일정과 멤버 가져오기
  useEffect(() => {

    let unsubscribe: (() => void) | undefined

    if (user && selectedOrg) {
      // 실시간 리스너 설정
      unsubscribe = fetchSchedules(selectedOrg.id)
      fetchMembers(selectedOrg.id)
    } else {
    }

    // Cleanup: 컴포넌트 언마운트 또는 selectedOrg 변경 시 리스너 해제
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user, selectedOrg])

  // 사진첩 뷰로 전환시 사진 목록 불러오기
  useEffect(() => {
    if (selectedOrg && crewView === 'photos') {
      fetchPhotos(selectedOrg.id)
    }
  }, [selectedOrg, crewView])

  // 모달 열릴 때 백그라운드 스크롤 방지
  useEffect(() => {
    const isAnyModalOpen =
      selectedSchedule ||
      showMemberList ||
      showCreateSchedule ||
      editingSchedule ||
      editingMember ||
      editingMemberInfo ||
      selectedAvatarUrl ||
      managingParticipants ||
      editingMyProfile ||
      editingOrg ||
      cropImageUrl ||
      showCreateCrew ||
      showDeleteCrewConfirm

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [
    selectedSchedule,
    showMemberList,
    showCreateSchedule,
    editingSchedule,
    editingMember,
    editingMemberInfo,
    selectedAvatarUrl,
    managingParticipants,
    editingMyProfile,
    editingOrg,
    cropImageUrl,
    showCreateCrew
  ])

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
    if (!user) return false

    // 크루의 ownerUid를 직접 체크
    const org = organizations.find(o => o.id === orgId)
    if (org && org.ownerUid === user.uid) {
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
      if (!user) return


      // 1. memberships 기반으로 가입한 크루 ID 목록 가져오기 (신규 방식)
      let userOrgIds: string[] = []

      if (memberships.length > 0) {
        // ✅ 신규: organizationMembers 컬렉션 사용
        userOrgIds = memberships
          .filter(m => m.status === 'active')
          .map(m => m.organizationId)
      } else {
        // ⚠️ 레거시: userProfiles.organizations 배열 사용 (하위 호환)
        const userProfileRef = doc(db, 'userProfiles', user.uid)
        const userProfileSnap = await getDoc(userProfileRef)

        if (userProfileSnap.exists()) {
          const data = userProfileSnap.data()
          userOrgIds = data.joinedOrganizations || data.organizations || []
        }
      }

      if (userOrgIds.length === 0) {
        setOrganizations([])
        setOrgMemberCounts({})
        return
      }

      // 2. organizations 컬렉션에서 크루 정보 가져오기
      const orgsRef = collection(db, 'organizations')
      const orgsSnapshot = await getDocs(orgsRef)

      const fetchedOrgs: Organization[] = []
      orgsSnapshot.forEach((orgDoc) => {
        if (userOrgIds.includes(orgDoc.id)) {
          fetchedOrgs.push({ id: orgDoc.id, ...orgDoc.data() } as Organization)
        }
      })

      setOrganizations(fetchedOrgs)

      // 3. 각 크루의 멤버 수 가져오기
      const counts: { [key: string]: number } = {}

      for (const org of fetchedOrgs) {
        try {
          // ✅ 신규: organizationMembers 컬렉션 사용 (더 정확함)
          const members = await getOrganizationMembers(org.id)
          counts[org.id] = members.length
        } catch (error) {
          // ⚠️ 레거시: organizationMembers가 없으면 userProfiles 사용
          const userProfilesRef = collection(db, 'userProfiles')
          const userProfilesSnapshot = await getDocs(userProfilesRef)

          let memberCount = 0
          userProfilesSnapshot.forEach((userDoc) => {
            const data = userDoc.data()
            const orgs = data.joinedOrganizations || data.organizations || []
            if (orgs.includes(org.id)) {
              memberCount++
            }
          })
          counts[org.id] = memberCount
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

      const orgsRef = collection(db, 'organizations')
      const orgsSnapshot = await getDocs(orgsRef)

      const allOrgs: Organization[] = []
      orgsSnapshot.forEach((doc) => {
        allOrgs.push({ id: doc.id, ...doc.data() } as Organization)
      })

      setAllOrganizations(allOrgs)
    } catch (error) {
      console.error('Error fetching all organizations:', error)
    }
  }

  const fetchRecommendedOrganizations = async () => {
    try {
      if (!user || !userProfile) return


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
      const orgsRef = collection(db, 'organizations')
      const orgsSnapshot = await getDocs(orgsRef)

      const recommended: OrganizationWithDistance[] = []
      orgsSnapshot.forEach((doc) => {
        const org = { id: doc.id, ...doc.data() } as Organization

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

  const fetchSchedules = (orgId: string) => {
    try {

      // schedules 컬렉션에서 해당 크루의 일정을 실시간으로 감지 (서버 사이드 필터링)
      const q = query(
        collection(db, 'org_schedules'),
        where('orgId', '==', orgId)
      )

      const unsubscribe = onSnapshot(q, (querySnapshot) => {

        const fetchedSchedules: Schedule[] = []

        querySnapshot.forEach((doc) => {
          const data = doc.data()
          fetchedSchedules.push({ id: doc.id, ...data } as Schedule)
        })

        setSchedules(fetchedSchedules)
      }, (error) => {
        console.error('❌ 일정 실시간 감지 오류:', error)
      })

      return unsubscribe
    } catch (error) {
      console.error('❌ Error setting up schedule listener:', error)
      return () => {}
    }
  }

  // 모든 크루의 일정을 가져오는 함수 (홈 화면용)
  const fetchAllUserSchedules = (orgIds: string[]) => {
    try {

      if (orgIds.length === 0) {
        setSchedules([])
        return () => {}
      }

      // 각 크루별로 리스너를 설정하고, 모든 일정을 합쳐서 관리
      const unsubscribers: (() => void)[] = []
      const allSchedulesMap = new Map<string, Schedule>()

      orgIds.forEach((orgId) => {
        const q = query(
          collection(db, 'org_schedules'),
          where('orgId', '==', orgId)
        )

        const unsubscribe = onSnapshot(q, (querySnapshot) => {

          // 해당 크루의 기존 일정 제거
          allSchedulesMap.forEach((schedule, id) => {
            if (schedule.orgId === orgId) {
              allSchedulesMap.delete(id)
            }
          })

          // 새로운 일정 추가
          querySnapshot.forEach((doc) => {
            const data = doc.data()
            allSchedulesMap.set(doc.id, { id: doc.id, ...data } as Schedule)
          })

          // 전체 일정을 배열로 변환하여 상태 업데이트
          const allSchedules = Array.from(allSchedulesMap.values())
          setSchedules(allSchedules)
        }, (error) => {
          console.error(`❌ 크루 ${orgId} 일정 감지 오류:`, error)
        })

        unsubscribers.push(unsubscribe)
      })


      // 모든 리스너를 해제하는 함수 반환
      return () => {
        unsubscribers.forEach(unsub => unsub())
      }
    } catch (error) {
      console.error('❌ Error setting up all schedules listeners:', error)
      return () => {}
    }
  }

  const fetchMembers = async (orgId: string) => {
    try {

      // userProfiles의 organizations 배열로 크루 멤버 찾기
      const userProfilesRef = collection(db, 'userProfiles')
      const userProfilesSnapshot = await getDocs(userProfilesRef)

      const memberUids: string[] = []
      const userProfilesMap: { [uid: string]: any } = {}
      userProfilesSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.organizations && Array.isArray(data.organizations) && data.organizations.includes(orgId)) {
          memberUids.push(doc.id)
          userProfilesMap[doc.id] = data
        }
      })

      if (memberUids.length === 0) {
        setMembers([])
        return
      }

      // members 컬렉션에서 상세 정보 가져오기
      const membersRef = collection(db, 'members')
      const membersSnapshot = await getDocs(membersRef)

      const fetchedMembers: Member[] = []
      membersSnapshot.forEach((doc) => {
        const data = doc.data()
        if (memberUids.includes(data.uid)) {
          // userProfiles에서 location 정보 가져와서 병합
          const userProfile = userProfilesMap[data.uid]

          // Firestore Timestamp를 한국 날짜 형식으로 변환
          let joinDateString = data.joinDate
          if (data.joinDate && typeof data.joinDate === 'object' && 'seconds' in data.joinDate) {
            joinDateString = new Date(data.joinDate.seconds * 1000).toLocaleDateString('ko-KR')
          }

          fetchedMembers.push({
            id: doc.id,
            ...data,
            joinDate: joinDateString,
            location: userProfile?.location || undefined
          } as Member)
        }
      })

      fetchedMembers.forEach(m => {
      })

      setMembers(fetchedMembers)
    } catch (error) {
      console.error('❌ Error fetching members:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
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
    if (!user) return

    try {
      const userRef = doc(db, 'userProfiles', user.uid)

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
        verifiedAt: serverTimestamp(),
        isPrimary: !userProfile?.locations || userProfile.locations.length === 0,
      }

      await updateDoc(userRef, {
        locations: arrayUnion(locationData),
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

      // userProfiles의 organizations 배열에서 제거
      const userProfileRef = doc(db, 'userProfiles', member.uid)
      const userProfileSnap = await getDoc(userProfileRef)

      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data()
        const updatedOrgs = (data.organizations || []).filter((id: string) => id !== selectedOrg.id)
        await updateDoc(userProfileRef, { organizations: updatedOrgs })
      } else {
        console.error('❌ userProfile을 찾을 수 없습니다.')
        alert('멤버 프로필을 찾을 수 없습니다.')
        return
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
      // members 컬렉션 업데이트
      const membersRef = collection(db, 'members')
      const membersQuery = query(membersRef, where('uid', '==', member.uid))
      const membersSnapshot = await getDocs(membersQuery)

      if (membersSnapshot.empty) {
        alert('멤버 정보를 찾을 수 없습니다.')
        return
      }

      const memberUpdatePromises = membersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, {
          isCaptain: newRole === 'captain',
          isStaff: newRole === 'staff',
          role: newRole === 'captain' ? '크루장' : newRole === 'staff' ? '운영진' : '멤버'
        })
      )
      await Promise.all(memberUpdatePromises)

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
      const userProfileRef = doc(db, 'userProfiles', member.uid)
      const userProfileSnap = await getDoc(userProfileRef)

      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data()

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
      // userProfiles 업데이트
      const userProfileRef = doc(db, 'userProfiles', editingMemberInfo.uid)
      await updateDoc(userProfileRef, {
        name: editForm.name,
        gender: editForm.gender,
        birthdate: editForm.birthdate,
        location: editForm.location,
        mbti: editForm.mbti.toUpperCase()
      })

      // members 컬렉션도 이름 업데이트
      const membersRef = collection(db, 'members')
      const membersQuery = query(membersRef, where('uid', '==', editingMemberInfo.uid))
      const membersSnapshot = await getDocs(membersQuery)

      const memberUpdatePromises = membersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { name: editForm.name })
      )
      await Promise.all(memberUpdatePromises)

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

  const handleChangeAvatar = async (file: File) => {
    if (!user) return

    setUploadingAvatar(true)
    try {
      // S3에 업로드
      const avatarUrl = await uploadToS3(file, `avatars/${user.uid}`)

      // userProfiles 업데이트
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, { avatar: avatarUrl })

      // members 컬렉션도 아바타 업데이트
      const membersRef = collection(db, 'members')
      const membersQuery = query(membersRef, where('uid', '==', user.uid))
      const membersSnapshot = await getDocs(membersQuery)

      const memberUpdatePromises = membersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { avatar: avatarUrl })
      )
      await Promise.all(memberUpdatePromises)

      // 페이지 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error updating avatar:', error)
      alert('프로필 사진을 바꾸는 중에 문제가 생겼어요.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateMyProfile = async () => {
    if (!user) return

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


      // userProfiles 업데이트
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, updateData)

      // members 컬렉션도 이름 업데이트
      const membersRef = collection(db, 'members')
      const membersQuery = query(membersRef, where('uid', '==', user.uid))
      const membersSnapshot = await getDocs(membersQuery)

      const memberUpdatePromises = membersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { name: myProfileForm.name })
      )
      await Promise.all(memberUpdatePromises)

      alert('프로필이 수정됐어요.')
      setEditingMyProfile(false)

      // AuthContext에서 프로필 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error updating my profile:', error)
      alert('프로필을 수정하는 중에 문제가 생겼어요.')
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
      const batch = writeBatch(db)

      // 1. 크루 문서 삭제
      const orgRef = doc(db, 'organizations', editingOrg.id)
      batch.delete(orgRef)

      // 2. organizationMembers에서 해당 크루의 모든 멤버 삭제
      const membersQuery = query(collection(db, 'organizationMembers'), where('organizationId', '==', editingOrg.id))
      const membersSnapshot = await getDocs(membersQuery)
      membersSnapshot.docs.forEach((memberDoc) => {
        batch.delete(doc(db, 'organizationMembers', memberDoc.id))
      })

      // 3. schedules에서 해당 크루의 모든 일정 삭제
      const schedulesQuery = query(collection(db, 'org_schedules'), where('orgId', '==', editingOrg.id))
      const schedulesSnapshot = await getDocs(schedulesQuery)
      schedulesSnapshot.docs.forEach((scheduleDoc) => {
        batch.delete(doc(db, 'org_schedules', scheduleDoc.id))
      })

      // 4. 모든 userProfiles의 organizations 배열에서 크루 ID 제거
      const userProfilesSnapshot = await getDocs(collection(db, 'userProfiles'))
      userProfilesSnapshot.docs.forEach((profileDoc) => {
        const profileData = profileDoc.data()
        if (profileData.organizations && profileData.organizations.includes(editingOrg.id)) {
          const userProfileRef = doc(db, 'userProfiles', profileDoc.id)
          batch.update(userProfileRef, {
            organizations: arrayRemove(editingOrg.id)
          })
        }
      })

      await batch.commit()

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
    if (!user || !userProfile) return

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
        ownerUid: user.uid,
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


      const docRef = await addDoc(collection(db, 'organizations'), orgData)

      // 2. 이미지가 있으면 S3에 업로드하고 URL 업데이트
      if (orgAvatarFile) {
        const avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${docRef.id}`)
        await updateDoc(docRef, { avatar: avatarUrl })
      }

      // 3. 사용자 프로필의 organizations 배열에 추가
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, {
        organizations: arrayUnion(docRef.id)
      })

      alert('크루가 만들어졌어요!')
      setShowCreateCrew(false)
      setOrgForm({ name: '', subtitle: '', description: '', categories: [], location: null })
      setOrgAvatarFile(null)

      // 크루 목록 새로고침
      await fetchOrganizations()

      // 새로 생성한 크루를 선택
      const newOrg = await getDoc(docRef)
      if (newOrg.exists()) {
        router.replace(`/dashboard?page=mycrew&orgId=${newOrg.id}`, { scroll: false })
      }
    } catch (error) {
      console.error('❌ 크루 생성 실패:', error)
      alert('크루를 만드는 중에 문제가 생겼어요.')
    }
  }

  const handleUpdateOrg = async () => {
    if (!user || !editingOrg) return

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

      const orgRef = doc(db, 'organizations', editingOrg.id)
      await updateDoc(orgRef, updateData)

      // 2. 새 이미지가 있으면 S3에 업로드하고 URL 업데이트
      if (orgAvatarFile) {
        const avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${editingOrg.id}`)
        await updateDoc(orgRef, { avatar: avatarUrl })
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

  // 사진첩: 사진 목록 불러오기
  const fetchPhotos = async (orgId: string) => {
    try {
      const photosRef = collection(db, 'organizations', orgId, 'photos')
      const q = query(photosRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const photoList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPhotos(photoList)
    } catch (error) {
      console.error('사진 목록 불러오기 실패:', error)
    }
  }

  // 사진첩: 사진 업로드
  const handlePhotoUpload = async (file: File, orgId: string) => {
    if (!user || !userProfile) return

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('사진 크기는 10MB 이하여야 합니다.')
      return
    }

    setUploadingPhoto(true)

    try {
      // S3에 업로드
      const photoUrl = await uploadToS3(file, `organizations/${orgId}/photos/${Date.now()}_${file.name}`)

      // Firestore에 메타데이터 저장
      const photosRef = collection(db, 'organizations', orgId, 'photos')
      await addDoc(photosRef, {
        url: photoUrl,
        uploaderUid: user.uid,
        uploaderName: userProfile.name,
        createdAt: serverTimestamp(),
        fileName: file.name
      })

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
    if (!user) return

    if (!confirm('이 사진을 삭제할까요?')) return

    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'photos', photoId))
      alert('사진이 삭제되었어요!')
      await fetchPhotos(orgId)
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
  const handleCropComplete = (croppedBlob: Blob) => {
    // Blob을 File로 변환
    const file = new File([croppedBlob], 'cropped-image.jpg', { type: 'image/jpeg' })

    if (cropType === 'org') {
      setOrgAvatarFile(file)
      // 미리보기 URL 생성
      const previewUrl = URL.createObjectURL(file)
      setOrgAvatarPreview(previewUrl)
    } else if (cropType === 'profile') {
      setMyProfileAvatarFile(file)
    }

    // 크롭 모달 닫기
    setCropImageUrl(null)
    setCropType(null)
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
    if (!user || !userProfile) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      const orgRef = doc(db, 'organizations', orgId)
      const orgSnap = await getDoc(orgRef)

      if (!orgSnap.exists()) {
        alert('크루를 찾을 수 없습니다.')
        return
      }

      const orgData = orgSnap.data()
      const existingPending = orgData.pendingMembers || []

      // 이미 신청한 경우
      if (existingPending.some((m: any) => m.uid === user.uid)) {
        alert('이미 가입 신청을 보내셨어요.')
        return
      }

      // pendingMembers에 추가
      await updateDoc(orgRef, {
        pendingMembers: arrayUnion({
          uid: user.uid,
          name: userProfile.name,
          email: userProfile.email,
          avatar: userProfile.avatar || '',
          requestedAt: new Date()
        })
      })

      alert('가입 신청을 보냈어요! 크루장의 승인을 기다려주세요.')
      fetchOrganizations()

    } catch (error) {
      console.error('가입 신청 실패:', error)
      alert('가입 신청에 문제가 생겼어요. 다시 시도해주세요.')
    }
  }

  // 크루 가입 승인
  const handleApproveMember = async (orgId: string, member: any) => {
    if (!confirm(`${member.name}님의 가입을 승인하시겠습니까?`)) return

    try {

      const orgRef = doc(db, 'organizations', orgId)
      const userRef = doc(db, 'userProfiles', member.uid)

      // pendingMembers에서 제거
      await updateDoc(orgRef, {
        pendingMembers: arrayRemove(member)
      })

      // userProfiles의 organizations 배열에 추가 (joinedOrganizations가 아님!)
      await updateDoc(userRef, {
        organizations: arrayUnion(orgId)
      })

      // members 컬렉션에 레코드 추가
      const membersRef = collection(db, 'members')
      await addDoc(membersRef, {
        uid: member.uid,
        name: member.name,
        email: member.email || '',
        avatar: member.avatar || null,
        role: '멤버',
        isCaptain: false,
        isStaff: false,
        joinDate: new Date().toLocaleDateString('ko-KR'),
        orgId: orgId
      })

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
      const orgRef = doc(db, 'organizations', orgId)

      // pendingMembers에서만 제거
      await updateDoc(orgRef, {
        pendingMembers: arrayRemove(member)
      })

      alert(`${member.name}님의 가입 신청을 거절했어요.`)
      fetchOrganizations()

    } catch (error) {
      console.error('거절 실패:', error)
      alert('거절하는 중에 문제가 생겼어요. 다시 시도해주세요.')
    }
  }

  const handleCreateSchedule = async () => {
    if (!selectedOrg || !user) return

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
      const { addDoc, collection } = await import('firebase/firestore')

      // createScheduleForm.date is now in ISO format: "2025-11-17"
      const isoDate = createScheduleForm.date
      // Generate display format: "11/17(일)"
      const selectedDate = new Date(isoDate)
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const month = selectedDate.getMonth() + 1
      const day = selectedDate.getDate()
      const dayOfWeek = days[selectedDate.getDay()]
      const displayDate = `${month}/${day}(${dayOfWeek})`

      await addDoc(collection(db, 'org_schedules'), {
        title: createScheduleForm.title,
        date: displayDate,      // Display format for UI
        dateISO: isoDate,       // ISO format for comparison
        time: createScheduleForm.time,
        location: createScheduleForm.location,
        type: createScheduleForm.type,
        maxParticipants: createScheduleForm.maxParticipants,
        participants: [],
        createdBy: userProfile?.name || user.displayName || '익명',
        createdByUid: user.uid,
        orgId: selectedOrg.id,
        comments: [],
        createdAt: new Date().toISOString(),
        hasChat: true,  // 채팅 기능 활성화
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
      const scheduleRef = doc(db, 'org_schedules', editingSchedule.id)

      // editScheduleForm.date is now in ISO format: "2025-11-22"
      const isoDate = editScheduleForm.date
      // Generate display format: "11/22(토)"
      const selectedDate = new Date(isoDate)
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const month = selectedDate.getMonth() + 1
      const day = selectedDate.getDate()
      const dayOfWeek = days[selectedDate.getDay()]
      const displayDate = `${month}/${day}(${dayOfWeek})`

      await updateDoc(scheduleRef, {
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
      const { deleteDoc } = await import('firebase/firestore')
      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      await deleteDoc(scheduleRef)

      alert('일정이 삭제됐어요.')
      setSelectedSchedule(null)
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('일정을 삭제하는 중에 문제가 생겼어요.')
    }
  }

  const handleAddParticipant = async (schedule: Schedule, memberName: string) => {
    try {
      // 정원 체크
      if (schedule.participants.length >= schedule.maxParticipants) {
        alert('정원이 초과되었습니다.')
        return
      }

      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      const updatedParticipants = [...(schedule.participants || []), memberName]
      await updateDoc(scheduleRef, { participants: updatedParticipants })

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
      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      const updatedParticipants = schedule.participants.filter(name => name !== memberName)
      await updateDoc(scheduleRef, { participants: updatedParticipants })

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
👥 참여 인원: ${schedule.participants?.length || 0} / ${schedule.maxParticipants}명

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
    if (!commentText.trim() || !user) return

    try {
      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      const newComment: Comment = {
        id: Date.now().toString(),
        userName: userProfile?.name || user.displayName || '익명',
        userUid: user.uid,
        text: commentText,
        createdAt: new Date().toISOString()
      }
      const updatedComments = [...(schedule.comments || []), newComment]
      await updateDoc(scheduleRef, { comments: updatedComments })
      setCommentText('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('댓글을 추가하는 중에 문제가 생겼어요.')
    }
  }

  const handleDeleteComment = async (schedule: Schedule, commentId: string) => {
    if (!window.confirm('정말 삭제하시겠어요?')) return

    try {
      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      const updatedComments = schedule.comments?.filter(comment => comment.id !== commentId) || []
      await updateDoc(scheduleRef, { comments: updatedComments })
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
  const getMemberLastParticipationDays = (memberName: string): number | null => {
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
        // 객체 배열: [{name: "이태규", uid: "..."}, ...]
        // name 또는 userName 필드로 체크
        isParticipant = schedule.participants.some((p: any) =>
          p.name === memberName || p.userName === memberName
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

      const myName = userProfile?.name || user?.displayName || '익명'
      const scheduleRef = doc(db, 'org_schedules', schedule.id)
      const isParticipating = schedule.participants?.includes(myName)

      let updatedParticipants: string[]
      if (isParticipating) {
        // 참여 취소
        updatedParticipants = schedule.participants.filter(name => name !== myName)
      } else {
        // 참여
        if (schedule.participants.length >= schedule.maxParticipants) {
          alert('정원이 초과되었습니다.')
          return
        }
        updatedParticipants = [...schedule.participants, myName]
      }

      await updateDoc(scheduleRef, {
        participants: updatedParticipants
      })

      // 실시간 리스너가 자동으로 업데이트하므로 로컬 상태 업데이트 불필요
    } catch (error) {
      console.error('Error toggling participation:', error)
      alert('참여 상태를 바꾸는 중에 문제가 생겼어요.')
    }
  }

  // 초기 로딩 중이고 유저가 없을 때만 로딩 화면 표시 (이미 인증된 상태에서는 깜빡임 방지)
  if (loading && !user) {
    return <LoadingScreen />
  }

  if (!user) {
    return null
  }

  // userProfile이 없을 경우 기본값 사용
  const profile = userProfile || {
    uid: user.uid,
    email: user.email || '',
    name: user.email?.split('@')[0] || '사용자',
    gender: '-',
    birthdate: '-',
    location: '서울',
    mbti: '-',
    joinDate: new Date().toLocaleDateString('ko-KR'),
    role: 'member' as const
  }

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
      const myUid = user?.uid || ''

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
        <div className="bg-[#FFFBF7]">
          {/* 토스 스타일 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-3 flex justify-between items-center">
              <div>
                <h1 className="text-xl leading-7 font-extrabold text-gray-900 flex items-center gap-2">
                  <Home className="w-5 h-5 text-[#FF9B50]" />
                  홈
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out">
                  <Bell className="w-5 h-5 text-gray-700" strokeWidth={2} />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out">
                  <Settings className="w-5 h-5 text-gray-700" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 py-4 pb-24 space-y-5">
            {/* 내 동네 크루 섹션 - 당근마켓 스타일 */}
            <div className="mb-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-[#FF9B50]" />
                  <h2 className="text-xl leading-7 md:text-2xl font-extrabold text-gray-900">내 동네 크루</h2>
                  {userProfile?.locations && userProfile.locations.length > 0 && (
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-orange-50 text-orange-600 text-xs sm:text-sm font-extrabold rounded-full">
                      {(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).dong}
                    </span>
                  )}
                </div>

                {/* 동네 인증 버튼 (미인증 시) */}
                {(!userProfile?.locations || userProfile.locations.length === 0) && (
                  <button
                    onClick={() => setShowLocationSettings(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500 text-white text-xs sm:text-sm font-extrabold rounded-lg hover:bg-orange-600 active:scale-[0.99] transition-transform duration-200 ease-out"
                  >
                    동네 인증
                  </button>
                )}
              </div>

              {/* 크루 카드 리스트 */}
              {(() => {
                const nearbyCrews = getNearbyOrganizations()

                if (!userProfile?.locations || userProfile.locations.length === 0) {
                  // 빈 상태 - 동네 미인증
                  return (
                    <div className="mx-6 p-8 bg-gray-100 rounded-2xl text-center">
                      <div className="flex justify-center mb-2 sm:mb-3"><MapPin className="w-16 h-16 text-[#FF9B50]" /></div>
                      <p className="text-gray-900 font-extrabold text-sm leading-5 sm:text-base mb-1">
                        동네 인증이 필요해요
                      </p>
                      <p className="text-gray-600 text-xs sm:text-sm">
                        동네를 인증하면 주변 크루를 찾을 수 있어요
                      </p>
                    </div>
                  )
                }

                if (nearbyCrews.length === 0) {
                  // 빈 상태 - 크루 없음
                  return (
                    <div className="mx-6 p-8 bg-gray-100 rounded-2xl text-center">
                      <div className="text-7xl mb-4">🏕️</div>
                      <p className="text-gray-900 font-extrabold text-sm leading-5 sm:text-base mb-1">
                        아직 크루가 없어요
                      </p>
                      <p className="text-gray-600 text-xs sm:text-sm">
                        가까운 크루를 찾아볼까요?
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

            {/* 다가오는 일정 섹션 - 토스 스타일 */}
            <div className="bg-white rounded-3xl p-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-50 to-indigo-50 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#FF9B50]" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-xl leading-7 md:text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">다가오는 일정</h2>
                </div>
                <button
                  onClick={() => {
                    setScheduleFilter('joined')  // ← 중요: 참여한 일정만 보기
                    router.replace('/dashboard?page=schedules', { scroll: false })  // 독립적인 일정 페이지로 이동
                  }}
                  className="text-[#FF9B50] text-sm leading-5 font-extrabold hover:text-[#FF8A3D] active:scale-[0.99] transition-transform duration-200 ease-out px-3 py-2 rounded-lg hover:bg-orange-50"
                >
                  전체보기 →
                </button>
              </div>
              {mySchedules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4 text-7xl">📅</div>
                  <p className="text-gray-900 font-extrabold text-xl leading-7 md:text-xl mb-2">아직 예정된 일정이 없어요</p>
                  <p className="text-gray-800 text-base leading-6 font-medium">새로운 일정을 만들어볼까요?</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                      className="bg-[#FFFBF7] rounded-2xl p-6 hover:bg-[#F5F5F4] active:scale-[0.99] transition-transform duration-200 ease-out cursor-pointer border border-transparent hover:border-[#FF9B50]/20"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-xl md:text-2xl md:text-3xl tracking-tight text-gray-900 leading-tight">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-extrabold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <p className="text-gray-700 text-base leading-6 font-bold flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-[#FF9B50] flex-shrink-0" />
                          <span>{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="text-gray-700 text-base leading-6 font-bold flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-[#FF9B50] flex-shrink-0" />
                          <span>{schedule.location}</span>
                        </p>
                        <p className="text-gray-700 text-base leading-6 font-bold flex items-center gap-2">
                          <Target className="w-5 h-5 text-[#FF9B50] flex-shrink-0" />
                          <span>벙주: {schedule.createdBy}</span>
                        </p>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
                          <p className="text-gray-600 text-sm leading-5 font-bold"><Users className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />참여 인원
                          </p>
                          <p className="text-gray-900 text-xl leading-7 md:text-2xl font-extrabold">
                            {schedule.participants?.length || 0}<span className="text-gray-600">/{schedule.maxParticipants}</span>
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

      {/* Category Page - 토스 스타일 */}
      {currentPage === 'category' && (
        <div className="bg-[#FFFBF7] min-h-screen">
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-3 flex items-center justify-between">
              <h1 className="text-xl leading-7 font-extrabold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF9B50]" />
                카테고리
              </h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setSettingLocation(true)}>
                  <MapPin className="w-5 h-5 text-gray-600" />
                </button>
                <button onClick={() => router.push('/dashboard?page=home')}>
                  <Bell className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 검색창 추가 */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="크루명 또는 카테고리 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base leading-6 focus:outline-none focus:ring-2 focus:ring-[#FF9B50] focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* 카테고리 필터 칩 */}
          <div className="sticky top-[var(--header-height)] bg-white z-9 border-b border-gray-100">
            <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCategory('전체')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm leading-5 font-semibold transition-all ${
                    selectedCategory === '전체'
                      ? 'bg-[#FF9B50] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {CREW_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm leading-5 font-semibold transition-all ${
                      selectedCategory === category
                        ? 'bg-[#FF9B50] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 크루 리스트 */}
          <div className="px-4 py-4">
            {filteredCrews.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-7xl mb-6">🔍</div>
                <p className="text-xl leading-7 font-bold text-gray-900 mb-2">
                  검색 결과가 없어요
                </p>
                <p className="text-base leading-6 text-gray-600">
                  다른 검색어나 카테고리를 시도해보세요
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
                    className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 hover:border-[#FF9B50] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {org.avatar ? (
                          <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tent className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {org.subtitle && (
                          <p className="text-sm leading-5 font-extrabold text-gray-600 mb-1 truncate">
                            {org.subtitle}
                          </p>
                        )}
                        <h4 className="text-xl leading-7 md:text-2xl font-extrabold tracking-tight text-gray-900 mb-1 truncate">
                          {org.name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(org.categories || [org.category]).filter(Boolean).map((cat, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 bg-[#F5F5F4] text-gray-700 text-xs rounded-lg font-medium"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-[#FF9B50] text-xl leading-7 md:text-xl">→</div>
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
        <div className="bg-[#FFFBF7] min-h-screen">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-3">
              <h1 className="text-xl leading-7 font-extrabold text-gray-900 flex items-center gap-2">
                <Tent className="w-5 h-5 text-[#FF9B50]" />
                내 크루
              </h1>
            </div>
          </header>

          {/* 크루 목록 */}
          <div className="px-6 py-4 md:py-6">
            {organizations.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex justify-center mb-4 text-7xl">🏕️</div>
                <p className="text-base leading-6 font-extrabold text-gray-900 mb-2">아직 참여 중인 크루가 없어요</p>
                <p className="text-sm leading-5 text-gray-600">가까운 크루를 찾아볼까요?</p>
              </div>
            ) : (
              <div className="space-y-4">
                {organizations.map((org) => {
                  const memberCount = orgMemberCounts[org.id] || org.memberCount || 0
                  // 예정된 일정만 카운트 (오늘 포함, 그 이후)
                  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
                  const orgScheduleCount = schedules.filter(s => {
                    if (s.orgId !== org.id) return false
                    // dateISO 필드가 있으면 사용, 없으면 date 필드 사용 (마이그레이션 전 데이터 대응)
                    const scheduleDate = s.dateISO || s.date
                    return scheduleDate >= today
                  }).length

                  return (
                    <div
                      key={org.id}
                      onClick={() => {
                        router.replace(`/dashboard?page=mycrew&orgId=${org.id}`, { scroll: false })
                      }}
                      className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 hover:border-[#FF9B50] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {org.avatar ? (
                            <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Tent className="w-5 h-5 md:w-6 md:h-6 md:w-7 md:h-7 text-[#FF9B50]" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {org.subtitle && (
                            <p className="text-sm leading-5 font-extrabold text-gray-600 mb-1 truncate">{org.subtitle}</p>
                          )}
                          <h3 className="text-xl leading-7 md:text-2xl font-extrabold tracking-tight text-gray-900 mb-1 truncate">
                            {org.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm leading-5 text-gray-800">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                              <span className="font-bold">{memberCount}명</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                              <span className="font-bold">{orgScheduleCount}개 일정</span>
                            </span>
                          </div>
                          {(org.categories || [org.category]).filter(Boolean).length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              {(org.categories || [org.category]).filter(Boolean).slice(0, 3).map((cat, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 bg-[#F5F5F4] text-gray-700 text-xs rounded-lg font-medium">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-[#FF9B50]">
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
                className="w-full bg-gradient-to-r from-[#FF9B50] to-[#2563EB] rounded-2xl p-3 md:p-6 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="text-xl leading-7 md:text-2xl font-extrabold mb-1">새 크루 만들기</h3>
                    <p className="text-sm leading-5 opacity-90">나만의 크루를 시작하세요</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <Plus className="w-10 h-10 text-white" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Schedules Page - 다가오는 일정 전체보기 (독립 페이지) */}
      {currentPage === 'schedules' && (
        <div className="bg-[#FFFBF7] min-h-screen">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <h1 className="text-xl leading-7 font-extrabold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#FF9B50]" />
                  다가오는 일정
                </h1>
              </div>
              <button
                onClick={() => router.replace('/dashboard?page=home', { scroll: false })}
                className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out"
              >
                <X className="w-5 h-5 text-gray-700" strokeWidth={2} />
              </button>
            </div>

            {/* 필터 칩 */}
            <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-extrabold whitespace-nowrap transition-all flex-shrink-0 ${
                    scheduleFilter === 'all'
                      ? 'bg-[#FF9B50] text-white shadow-md'
                      : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  전체 ({upcomingSchedules.length})
                </button>
                <button
                  onClick={() => setScheduleFilter('joined')}
                  className={`px-4 py-2 rounded-full text-sm font-extrabold whitespace-nowrap transition-all flex-shrink-0 ${
                    scheduleFilter === 'joined'
                      ? 'bg-[#FF9B50] text-white shadow-md'
                      : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  참여 중 ({mySchedules.length})
                </button>
                <button
                  onClick={() => setScheduleFilter('not-joined')}
                  className={`px-4 py-2 rounded-full text-sm font-extrabold whitespace-nowrap transition-all flex-shrink-0 ${
                    scheduleFilter === 'not-joined'
                      ? 'bg-[#FF9B50] text-white shadow-md'
                      : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  미참여 ({upcomingSchedules.length - mySchedules.length})
                </button>
              </div>
            </div>
          </header>

          <div className="px-6 py-4 md:py-6 space-y-6">
            {(() => {
              // 필터 적용
              let filteredSchedules = upcomingSchedules
              const myName = userProfile?.name || user?.displayName || '익명'
              const myUid = user?.uid || ''

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
                  <div className="text-center py-16">
                    <div className="flex justify-center mb-4"><Calendar className="w-16 h-16 text-[#FF9B50]" /></div>
                    <p className="text-base leading-6 font-extrabold text-gray-600">
                      {scheduleFilter === 'all' && '다가오는 일정이 없습니다'}
                      {scheduleFilter === 'joined' && '참여 중인 일정이 없습니다'}
                      {scheduleFilter === 'not-joined' && '참여하지 않은 일정이 없습니다'}
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
                          <h2 className="text-xl leading-7 md:text-2xl font-extrabold text-gray-900">
                            {org?.name || '알 수 없는 크루'}
                          </h2>
                          <span className="text-sm leading-5 text-gray-600 font-bold">
                            {orgSchedules.length}개
                          </span>
                        </div>

                        {/* 일정 카드들 */}
                        <div className="space-y-4">
                          {orgSchedules.map((schedule) => {
                            const myName = userProfile?.name || user?.displayName || '익명'
                            const isParticipating = schedule.participants?.includes(myName)
                            return (
                              <div
                                key={schedule.id}
                                onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                                className={`bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer active:scale-[0.98] ${
                                  isParticipating ? 'border-[#FF9B50] shadow-md' : 'border-gray-200 hover:border-[#FF9B50] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)]'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <h3 className="font-bold text-xl leading-7 tracking-tight text-gray-900 flex-1">{schedule.title}</h3>
                                  <span className={`text-xs px-3 py-1.5 rounded-lg font-extrabold ${getTypeColor(schedule.type)}`}>
                                    {schedule.type}
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm leading-5 text-gray-800">
                                  <p className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                                    <span className="font-medium">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                                    <span className="font-medium">{schedule.location}</span>
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                                    <span className="font-medium">{schedule.participants?.length || 0}/{schedule.maxParticipants}명</span>
                                  </p>
                                </div>
                                {isParticipating && (
                                  <div className="mt-4 text-xs bg-[#E8F5E9] text-[#2E7D32] px-3 py-2 rounded-xl font-extrabold text-center">
                                    <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />참여 중</span>
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

      {/* Crew Detail Page - 토스 스타일 */}
      {currentPage === 'mycrew' && urlOrgId && (
        <div className="bg-[#FFFBF7] min-h-screen">
          {!selectedOrg ? (
            // organizations 로딩 중일 때 빈 화면 표시 (깜빡임 방지)
            <div className="bg-[#FFFBF7] min-h-screen" />
          ) : (
            <>
              {/* 헤더 */}
              <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => {
                        router.replace('/dashboard?page=mycrew', { scroll: false })
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl active:scale-[0.99] transition-transform duration-200 ease-out -ml-2"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
                    </button>
                    {canManageOrg(selectedOrg.id) && (
                      <button
                        onClick={() => router.push(`/crew/${selectedOrg.id}/settings`)}
                        className="px-3 py-1.5 bg-[#F5F5F4] text-gray-900 text-sm font-extrabold rounded-xl hover:bg-gray-200 active:scale-[0.99] transition-transform duration-200 ease-out"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Settings className="w-4 h-4" />
                          크루 관리
                        </span>
                      </button>
                    )}
                  </div>
                  <h1 className="text-xl leading-7 font-extrabold text-gray-900">{selectedOrg.name}</h1>
                  {selectedOrg.subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{selectedOrg.subtitle}</p>
                  )}
                </div>

            {/* 탭 전환 버튼 */}
            <div className="px-4 pb-3 flex gap-2">
              <button
                onClick={() => setCrewView('schedules')}
                className={`flex-1 py-3 rounded-xl font-extrabold text-base leading-6 transition-all ${
                  crewView === 'schedules'
                    ? 'bg-[#FF9B50] text-white shadow-md'
                    : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                }`}
              >
                📅 일정
              </button>
              <button
                onClick={() => setCrewView('photos')}
                className={`flex-1 py-3 rounded-xl font-extrabold text-base leading-6 transition-all ${
                  crewView === 'photos'
                    ? 'bg-[#FF9B50] text-white shadow-md'
                    : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                }`}
              >
                📸 사진첩
              </button>
            </div>

            {/* 통계 카드 - 일정 탭에서만 표시 */}
            {crewView === 'schedules' && (
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              <button
                onClick={() => setScheduleFilter('all')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'all'
                    ? 'bg-[#FF9B50] text-white shadow-md'
                    : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                }`}
              >
                <div className="text-3xl leading-9 font-extrabold tracking-tight">{upcomingSchedules.length}</div>
                <div className="text-sm leading-5 font-extrabold mt-1 opacity-80">전체</div>
              </button>
              <button
                onClick={() => setScheduleFilter('joined')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'joined'
                    ? 'bg-[#FF9B50] text-white shadow-md'
                    : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                }`}
              >
                <div className="text-3xl leading-9 font-extrabold tracking-tight">{mySchedules.length}</div>
                <div className="text-sm leading-5 font-extrabold mt-1 opacity-80">참여 일정</div>
              </button>
              <button
                onClick={() => setScheduleFilter('not-joined')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'not-joined'
                    ? 'bg-[#FF9B50] text-white shadow-md'
                    : 'bg-[#F5F5F4] text-gray-900 hover:bg-gray-200'
                }`}
              >
                <div className="text-3xl leading-9 font-extrabold tracking-tight">{upcomingSchedules.length - mySchedules.length}</div>
                <div className="text-sm leading-5 font-extrabold mt-1 opacity-80">미참여</div>
              </button>
            </div>
            )}
          </header>

          {/* 일정 뷰 */}
          {crewView === 'schedules' && (
          <div className="px-6 py-4 md:py-6 space-y-6 md:space-y-6">
            {/* 다가오는 일정 */}
            <div>
              <h3 className="text-xl leading-7 md:text-2xl font-extrabold tracking-tight text-gray-900 mb-4">다가오는 일정</h3>
              <div className="space-y-4">
                {(() => {
                  let filteredSchedules = upcomingSchedules
                  const myName = userProfile?.name || user?.displayName || '익명'
                  const myUid = user?.uid || ''

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
                      <div className="text-center py-16">
                        <div className="flex justify-center mb-4"><Calendar className="w-16 h-16 text-[#FF9B50]" /></div>
                        <p className="text-base leading-6 font-extrabold text-gray-600">다가오는 일정이 없습니다</p>
                      </div>
                    )
                  }

                  return filteredSchedules.map((schedule) => {
                  const scheduleIsParticipating = isParticipating(schedule)
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                      className={`bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer active:scale-[0.98] ${
                        scheduleIsParticipating ? 'border-[#FF9B50] shadow-md' : 'border-gray-200 hover:border-[#FF9B50] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-xl leading-7 tracking-tight text-gray-900 flex-1">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-extrabold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm leading-5 text-gray-800">
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                          <span className="font-medium">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                          <span className="font-medium">{schedule.location}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                          <span className="font-medium">{schedule.participants?.length || 0}/{schedule.maxParticipants}명</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />
                          <span className="font-medium">벙주: {schedule.createdBy}</span>
                        </p>
                      </div>
                      {isParticipating && (
                        <div className="mt-4 text-xs bg-[#E8F5E9] text-[#2E7D32] px-3 py-2 rounded-xl font-extrabold text-center">
                          <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />참여 중</span>
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
                <h3 className="text-xl leading-7 md:text-2xl font-extrabold text-gray-600 mb-3 px-2">지난 일정</h3>
                <div className="space-y-4">
                  {pastSchedules.map((schedule) => {
                    const isParticipating = schedule.participants?.includes(profile.name)
                    return (
                      <div
                        key={schedule.id}
                        onClick={() => router.push(`/schedules/${schedule.id}?from=${currentPage}${urlOrgId ? `&orgId=${urlOrgId}` : ''}`)}
                        className="bg-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer opacity-60"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-xl leading-7 text-gray-700">{schedule.title}</h3>
                          <span className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full font-bold">
                            {schedule.type}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm leading-5 text-gray-600">
                          <p><Calendar className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />{formatDateWithYear(schedule.date)} {schedule.time}</p>
                          <p><MapPin className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />{schedule.location}</p>
                          <p><Users className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />{schedule.participants?.length || 0}/{schedule.maxParticipants}명</p>
                          <p><Target className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />벙주: {schedule.createdBy}</p>
                        </div>
                        {isParticipating && (
                          <div className="mt-3 text-xs bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-extrabold text-center">
                            <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />참여함</span>
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
              {members.some(m => m.uid === user?.uid) && (
                <div className="mb-6">
                  <label className="w-full py-4 px-6 bg-[#FF9B50] hover:bg-[#FF8A3D] text-white rounded-2xl font-extrabold text-base leading-6 cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    {uploadingPhoto ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        사진 올리기
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
                <div className="text-center py-16">
                  <div className="flex justify-center mb-4">
                    <Camera className="w-16 h-16 text-[#FF9B50]" />
                  </div>
                  <p className="text-base leading-6 font-extrabold text-gray-600 mb-2">아직 사진이 없어요</p>
                  <p className="text-sm leading-5 text-gray-500">첫 번째 사진을 올려보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        // 크루 멤버만 상세 보기 가능
                        if (members.some(m => m.uid === user?.uid)) {
                          setSelectedPhoto(photo)
                        } else {
                          alert('크루 멤버만 사진을 자세히 볼 수 있어요.')
                        }
                      }}
                      className="aspect-square rounded-xl overflow-hidden bg-gray-200 hover:opacity-80 transition-opacity active:scale-[0.98]"
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
              {!members.some(m => m.uid === user?.uid) && photos.length > 0 && (
                <div className="mt-6 p-4 bg-[#FFF3E0] border border-[#FF9B50] rounded-xl">
                  <p className="text-sm leading-5 text-gray-700 text-center">
                    <Camera className="w-4 h-4 text-[#FF9B50] inline-block" /> 크루에 가입하면 사진을 자세히 보고 업로드할 수 있어요
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
              className="w-16 h-16 bg-white border-2 border-[#FF9B50] text-[#FF9B50] rounded-full shadow-lg active:scale-[0.99] transition-transform flex items-center justify-center"
            >
              <Users className="w-7 h-7" />
            </button>
            <button
              onClick={() => setShowCreateSchedule(true)}
              className="w-16 h-16 bg-[#FF9B50] hover:bg-[#FF8A3D] text-white rounded-full shadow-lg text-xl leading-7 md:text-xl md:text-2xl md:text-3xl font-extrabold active:scale-[0.99] transition-transform"
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
              {user && selectedPhoto.uploaderUid === user.uid && selectedOrg && (
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
                {members.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 md:py-8">멤버가 없습니다.</p>
                ) : (
                  members
                    .filter((member) => {
                      // 활동 경과일 필터 적용
                      if (memberActivityFilter === 'all') return true

                      const daysSinceLastParticipation = getMemberLastParticipationDays(member.name)

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
                      const daysSinceLastParticipation = getMemberLastParticipationDays(member.name)

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
                            <span className="font-bold">{member.name}</span>
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
                    {selectedSchedule.participants?.length || 0} / {selectedSchedule.maxParticipants}명
                  </div>
                </div>
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSchedule.participants.map((name) => (
                      <div key={name} className="bg-[#F5F5F4] px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition-all duration-200">
                        <span className="text-sm leading-5 font-extrabold text-gray-900">{name}</span>
                        {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
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
                {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
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
                {managingParticipants && members.filter(m => !selectedSchedule.participants?.includes(m.name)).length > 0 && (
                  <div className="mt-3 p-4 bg-[#FFFBF7] rounded-2xl max-h-40 overflow-y-auto">
                    <div className="text-sm leading-5 font-extrabold text-gray-600 mb-3">멤버를 클릭하여 추가</div>
                    <div className="flex flex-wrap gap-2">
                      {members.filter(m => !selectedSchedule.participants?.includes(m.name)).map(member => (
                        <button
                          key={member.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddParticipant(selectedSchedule, member.name)
                          }}
                          className="text-sm leading-5 font-extrabold bg-white px-4 py-2 rounded-xl hover:bg-[#FF9B50] hover:text-white border border-[#E5E8EB] active:scale-[0.99] transition-transform duration-200 ease-out"
                        >
                          + {member.name}
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
                          {(comment.userUid === user?.uid || userProfile?.role === 'captain' || userProfile?.role === 'staff') && (
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
              {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
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
                    className="flex-1 bg-[#FF9B50] text-white py-4 rounded-2xl font-extrabold hover:bg-[#FF8A3D] transition-all active:scale-[0.98] text-sm leading-5"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(selectedSchedule)}
                    className="flex-1 bg-[#F5F5F4] text-[#F04452] py-4 rounded-2xl font-extrabold hover:bg-[#FFE5E8] transition-all active:scale-[0.98] text-sm leading-5"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              )}

              <div>
                {selectedSchedule.participants?.includes(userProfile?.name || user?.displayName || '익명') ? (
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
                    disabled={selectedSchedule.participants.length >= selectedSchedule.maxParticipants}
                  >
                    {selectedSchedule.participants.length >= selectedSchedule.maxParticipants ? '정원 초과' : '참여하기'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Profile Page - 토스 스타일 */}
      {currentPage === 'myprofile' && (
        <div className="bg-[#FFFBF7] min-h-screen pb-20">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-3">
              <h1 className="text-xl leading-7 font-extrabold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#FF9B50]" />
                내 정보
              </h1>
            </div>
          </header>

          <div className="px-4 py-4 sm:px-5 sm:py-3 md:py-6 space-y-6 sm:space-y-4">
            {/* 내 동네 설정 섹션 */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-3 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0">
              <h3 className="text-base leading-6 sm:text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 mb-3 sm:mb-4">
                내 동네 설정
              </h3>
              <LocationVerification />
            </div>

            {/* 프로필 카드 */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-3 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0">
              <div className="text-center mb-5 sm:mb-6">
                <div className="relative w-16 h-16 md:w-20 md:h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 group">
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
                  {/* Hover 시 나타나는 변경 버튼 */}
                  <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleChangeAvatar(file)
                        }
                      }}
                    />
                    <span className="text-white text-xs sm:text-sm font-bold">
                      {uploadingAvatar ? '업로드 중...' : '사진 변경'}
                    </span>
                  </label>
                </div>
                <h2 className="text-xl leading-7 sm:text-xl md:text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 mb-1.5 sm:mb-2">{profile.name}</h2>
                <p className="text-xs sm:text-sm text-gray-600">{profile.email}</p>
              </div>

              {/* 정보 섹션 */}
              <div className="bg-[#FFFBF7] rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-6 sm:space-y-4">
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">생년월일</div>
                  <div className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">{profile.birthdate}</div>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">성별</div>
                  <div className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">{profile.gender}</div>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">지역</div>
                  <div className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">{profile.location}</div>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">MBTI</div>
                  <div className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">{profile.mbti || '-'}</div>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">관심 카테고리</div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(profile.interestCategories || []).length > 0 ? (
                      profile.interestCategories.map((category, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 sm:px-3 bg-[#FF9B50] text-white text-xs rounded-full font-medium">
                          {category}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">-</span>
                    )}
                  </div>
                </div>
                <div className="h-px bg-gray-200"></div>
                <div>
                  <div className="text-sm leading-5 font-extrabold text-gray-600 mb-1.5 sm:mb-2">가입일</div>
                  <div className="text-sm leading-5 sm:text-base font-extrabold text-gray-900">{formatTimestamp(profile.joinDate)}</div>
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
                className="w-full bg-[#FF9B50] text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm leading-5 sm:text-base font-extrabold hover:bg-[#FF8A3D] active:scale-[0.99] transition-transform duration-200 ease-out"
              >
                <span className="inline-flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  정보 수정
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-[#F5F5F4] text-[#F04452] py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm leading-5 sm:text-base font-extrabold hover:bg-[#FFE5E8] active:scale-[0.99] transition-transform duration-200 ease-out"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  로그아웃
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
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-100 active:scale-[0.99] transition-transform duration-200 ease-out">
                      📸 사진 촬영
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
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-100 active:scale-[0.99] transition-transform duration-200 ease-out">
                      🖼️ 갤러리
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#FF9B50] text-white p-6">
              <h2 className="text-xl leading-7 md:text-2xl font-extrabold">내 정보 바꾸기</h2>
            </div>

            <div className="p-3 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={myProfileForm.name}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">성별 *</label>
                <select
                  value={myProfileForm.gender}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, gender: e.target.value })}
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
                  value={myProfileForm.birthdate}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, birthdate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">지역 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value)
                      setSelectedDistrict('') // Reset district when city changes
                      setMyProfileForm({ ...myProfileForm, location: e.target.value })
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">구/군</option>
                    {selectedCity && getDistricts(selectedCity).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={myProfileForm.mbti}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9B50] focus:ring-offset-2"
                />
              </div>

              <div>
                <label className="block text-base leading-6 font-extrabold text-gray-700 mb-2">
                  관심 크루 카테고리 * (중복 선택 가능)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-300 rounded-lg bg-gray-50">
                  {CREW_CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-all duration-200">
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
                        className="w-4 h-4 text-[#FF9B50] border-gray-300 rounded focus:ring-[#FF9B50]"
                      />
                      <span className="text-sm leading-5 text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {myProfileForm.interestCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {myProfileForm.interestCategories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF9B50] text-white text-xs rounded-full">
                        {cat}
                        <button
                          type="button"
                          onClick={() => setMyProfileForm({
                            ...myProfileForm,
                            interestCategories: myProfileForm.interestCategories.filter(c => c !== cat)
                          })}
                          className="hover:text-red-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 md:p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMyProfile}
                className="flex-1 py-4 bg-[#FF9B50] text-white rounded-xl font-extrabold text-base leading-6 hover:bg-[#FF8A3D] transition-all duration-200"
              >
                저장
              </button>
              <button
                onClick={() => setEditingMyProfile(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-extrabold text-base leading-6 hover:bg-gray-300 transition-all duration-200"
              >
                취소
              </button>
            </div>
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

      {/* Bottom Navigation - 토스 스타일 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20 safe-bottom">
        <div className="max-w-md mx-auto flex h-14">
          {[
            { id: 'home' as Page, icon: Home, label: '홈' },
            { id: 'category' as Page, icon: Users, label: '카테고리' },
            { id: 'mycrew' as Page, icon: Calendar, label: '내크루' },
            { id: 'myprofile' as Page, icon: User, label: '내정보' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                // 탭 전환 시 스크롤을 맨 위로 리셋
                window.scrollTo({ top: 0, behavior: 'smooth' })

                // 탭 전환 시 URL만 업데이트 (currentPage는 URL에서 자동 계산됨)
                if (id === 'mycrew') {
                  router.replace('/dashboard?page=mycrew', { scroll: false })
                  fetchOrganizations() // 멤버 수 새로고침
                } else if (id === 'home' && organizations.length > 0) {
                  router.replace(`/dashboard?page=home&orgId=${organizations[0].id}`, { scroll: false })
                } else {
                  router.replace(`/dashboard?page=${id}`, { scroll: false })
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-transform duration-200 ease-out active:scale-[0.97] ${
                currentPage === id ? 'text-[#FF9B50]' : 'text-gray-600'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={currentPage === id ? 2.5 : 2} />
              <span className={`text-[10px] font-semibold ${currentPage === id ? 'font-extrabold' : ''}`}>{label}</span>
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
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-5xl">🏕️</span>
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
                <span>멤버 {orgMemberCounts[crew.id] || 0}명</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
