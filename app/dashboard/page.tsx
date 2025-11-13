'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { Home, Users, Calendar, User, MapPin, Bell, Settings } from 'lucide-react'
import { uploadToS3 } from '@/lib/s3-utils'
import ScheduleDeepLink from '@/components/ScheduleDeepLink'
import { getCities, getDistricts } from '@/lib/locations'
import ImageCropModal from '@/components/ImageCropModal'
import { CREW_CATEGORIES } from '@/lib/constants'
import LocationVerification from '@/components/LocationVerification'
import { getCurrentPosition, getAddressFromCoords, calculateDistance, formatDistance } from '@/lib/location-utils'

type Page = 'home' | 'category' | 'mycrew' | 'myprofile'

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
  date: string
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
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([]) // 내가 가입한 크루
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]) // 모든 크루 (크루 찾기용)
  const [recommendedOrgs, setRecommendedOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
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
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
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
  const [showCreateCrew, setShowCreateCrew] = useState(false)  // 크루 생성 모달
  const [orgAvatarFile, setOrgAvatarFile] = useState<File | null>(null)
  const [myProfileAvatarFile, setMyProfileAvatarFile] = useState<File | null>(null)

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

  // 홈 화면에서 모든 크루의 일정을 가져오기
  useEffect(() => {
    console.log('🔄 useEffect [user, organizations, currentPage, selectedOrg] 실행됨 (홈용)')
    console.log('  - currentPage:', currentPage)
    console.log('  - selectedOrg:', selectedOrg ? 'exists' : 'null')
    console.log('  - organizations:', organizations.length)

    let unsubscribe: (() => void) | undefined

    // 홈 화면이고 특정 크루가 선택되지 않은 경우, 모든 크루의 일정을 가져옴
    if (user && currentPage === 'home' && !selectedOrg && organizations.length > 0) {
      console.log('✅ 홈 화면 조건 충족: 모든 크루의 일정 리스너 설정 시작...')
      const orgIds = organizations.map(org => org.id)
      unsubscribe = fetchAllUserSchedules(orgIds)
    }

    return () => {
      if (unsubscribe) {
        console.log('🔌 홈 화면 일정 리스너 해제')
        unsubscribe()
      }
    }
  }, [user, organizations, currentPage, selectedOrg])

  // 특정 크루 선택 시 해당 크루의 일정과 멤버 가져오기
  useEffect(() => {
    console.log('🔄 useEffect [user, selectedOrg] 실행됨')
    console.log('  - user:', user ? user.uid : 'null')
    console.log('  - selectedOrg:', selectedOrg ? `${selectedOrg.name} (${selectedOrg.id})` : 'null')

    let unsubscribe: (() => void) | undefined

    if (user && selectedOrg) {
      console.log('✅ 조건 충족: 일정 실시간 리스너 설정 시작...')
      // 실시간 리스너 설정
      unsubscribe = fetchSchedules(selectedOrg.id)
      fetchMembers(selectedOrg.id)
    } else {
      console.log('⚠️ 조건 불충족: user 또는 selectedOrg가 없음')
    }

    // Cleanup: 컴포넌트 언마운트 또는 selectedOrg 변경 시 리스너 해제
    return () => {
      if (unsubscribe) {
        console.log('🔌 일정 실시간 리스너 해제')
        unsubscribe()
      }
    }
  }, [user, selectedOrg])

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
      showCreateCrew

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

  const fetchOrganizations = async () => {
    try {
      if (!user) return

      // 1. userProfiles에서 사용자가 가입한 크루 ID 목록 가져오기
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      const userProfileSnap = await getDoc(userProfileRef)

      let userOrgIds: string[] = []
      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data()
        userOrgIds = data.organizations || []
        console.log('사용자가 가입한 크루 ID 목록:', userOrgIds)
      }

      if (userOrgIds.length === 0) {
        console.log('가입한 크루가 없습니다.')
        setOrganizations([])
        return
      }

      // 2. organizations 컬렉션에서 크루 정보 가져오기
      const orgsRef = collection(db, 'organizations')
      const orgsSnapshot = await getDocs(orgsRef)

      const fetchedOrgs: Organization[] = []
      orgsSnapshot.forEach((doc) => {
        if (userOrgIds.includes(doc.id)) {
          fetchedOrgs.push({ id: doc.id, ...doc.data() } as Organization)
        }
      })

      console.log('가입한 크루 목록:', fetchedOrgs)
      setOrganizations(fetchedOrgs)

      // 3. 각 크루의 멤버 수 가져오기 (userProfiles 사용)
      const counts: { [key: string]: number } = {}

      // userProfiles 컬렉션에서 모든 멤버 조회
      const userProfilesRef = collection(db, 'userProfiles')
      const userProfilesSnapshot = await getDocs(userProfilesRef)

      console.log('🔍 전체 userProfiles 문서 수:', userProfilesSnapshot.size)

      for (const org of fetchedOrgs) {
        console.log(`\n🔍 크루 "${org.name}" (ID: ${org.id}) 멤버 카운트 시작`)

        let memberCount = 0
        userProfilesSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.organizations && Array.isArray(data.organizations) && data.organizations.includes(org.id)) {
            memberCount++
          }
        })

        counts[org.id] = memberCount
        console.log(`  ✅ 최종 멤버: ${memberCount}명`)
      }

      console.log('\n📊 모든 크루 멤버 카운트:', counts)
      setOrgMemberCounts(counts)
      console.log('✅ State 업데이트 완료')
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  // 모든 크루 가져오기 (크루 찾기용)
  const fetchAllOrganizations = async () => {
    try {
      console.log('📥 모든 크루 데이터 가져오기 시작')

      const orgsRef = collection(db, 'organizations')
      const orgsSnapshot = await getDocs(orgsRef)

      const allOrgs: Organization[] = []
      orgsSnapshot.forEach((doc) => {
        allOrgs.push({ id: doc.id, ...doc.data() } as Organization)
      })

      console.log(`✅ 총 ${allOrgs.length}개의 크루를 가져왔습니다`)
      console.log('크루 목록:', allOrgs.map(org => ({
        name: org.name,
        hasLocation: !!org.location,
        description: org.description
      })))

      setAllOrganizations(allOrgs)
    } catch (error) {
      console.error('Error fetching all organizations:', error)
    }
  }

  const fetchRecommendedOrganizations = async () => {
    try {
      if (!user || !userProfile) return

      console.log('🔍 추천 크루 검색 시작')
      console.log('  - 관심 카테고리:', userProfile.interestCategories)

      // 사용자의 관심 카테고리 확인
      const userInterests = userProfile.interestCategories || []

      if (userInterests.length === 0) {
        console.log('⚠️ 사용자의 관심 카테고리가 없습니다.')
        setRecommendedOrgs([])
        return
      }

      // 사용자가 인증한 위치 확인
      if (!userProfile.locations || userProfile.locations.length === 0) {
        console.log('⚠️ 인증된 위치가 없습니다.')
        setRecommendedOrgs([])
        return
      }

      // 선택된 위치 또는 첫 번째 위치 가져오기
      const selectedLocation = userProfile.locations.find(
        loc => loc.id === userProfile.selectedLocationId
      ) || userProfile.locations[0]

      console.log('  - 인증된 위치:', `${selectedLocation.sigungu} ${selectedLocation.dong}`)
      console.log('  - GPS 좌표:', { lat: selectedLocation.latitude, lng: selectedLocation.longitude })

      // 사용자가 이미 가입한 크루 ID 가져오기
      const userOrgIds = userProfile.organizations || []
      console.log('  - 이미 가입한 크루:', userOrgIds)

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
            console.log(`  ✅ 추천: ${org.name} - 카테고리: ${orgCategories.join(', ')} - 거리: ${distance.toFixed(1)}km`)
          }
        }
        // GPS 좌표가 없는 경우: 텍스트 기반 지역 매칭 (fallback)
        else {
          const hasMatchingLocation = org.description?.includes(selectedLocation.sigungu) ||
                                      org.description?.includes(selectedLocation.dong) ||
                                      org.description?.includes(selectedLocation.sido)

          if (hasMatchingLocation) {
            recommended.push({ ...org, distance: 999 })
            console.log(`  ✅ 추천 (텍스트 매칭): ${org.name} - 카테고리: ${orgCategories.join(', ')}`)
          }
        }
      })

      // 거리순으로 정렬
      recommended.sort((a, b) => a.distance - b.distance)

      console.log(`\n🎯 총 ${recommended.length}개의 크루를 추천합니다.`)
      setRecommendedOrgs(recommended)
    } catch (error) {
      console.error('Error fetching recommended organizations:', error)
    }
  }

  const fetchSchedules = (orgId: string) => {
    try {
      console.log('📡 fetchSchedules 시작 - orgId:', orgId)

      // schedules 컬렉션에서 해당 크루의 일정을 실시간으로 감지 (서버 사이드 필터링)
      const q = query(
        collection(db, 'schedules'),
        where('orgId', '==', orgId)
      )
      console.log('📡 Query 객체 생성 완료 (orgId 필터 적용)')

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        console.log('🔔 onSnapshot 콜백 실행!')
        console.log('  - 필터링된 문서 수:', querySnapshot.size)

        const fetchedSchedules: Schedule[] = []

        querySnapshot.forEach((doc) => {
          const data = doc.data()
          console.log(`  - 문서 ${doc.id}: orgId=${data.orgId}`)
          fetchedSchedules.push({ id: doc.id, ...data } as Schedule)
        })

        console.log(`✅ 일정 실시간 업데이트: ${fetchedSchedules.length}개`)
        setSchedules(fetchedSchedules)
      }, (error) => {
        console.error('❌ 일정 실시간 감지 오류:', error)
      })

      console.log('✅ onSnapshot 리스너 등록 완료')
      return unsubscribe
    } catch (error) {
      console.error('❌ Error setting up schedule listener:', error)
      return () => {}
    }
  }

  // 모든 크루의 일정을 가져오는 함수 (홈 화면용)
  const fetchAllUserSchedules = (orgIds: string[]) => {
    try {
      console.log('📡 fetchAllUserSchedules 시작 - orgIds:', orgIds)

      if (orgIds.length === 0) {
        console.log('⚠️ 가입한 크루가 없어 일정을 불러올 수 없습니다.')
        setSchedules([])
        return () => {}
      }

      // 각 크루별로 리스너를 설정하고, 모든 일정을 합쳐서 관리
      const unsubscribers: (() => void)[] = []
      const allSchedulesMap = new Map<string, Schedule>()

      orgIds.forEach((orgId) => {
        const q = query(
          collection(db, 'schedules'),
          where('orgId', '==', orgId)
        )

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          console.log(`🔔 크루 ${orgId}의 일정 업데이트: ${querySnapshot.size}개`)

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
          console.log(`✅ 전체 일정 업데이트: ${allSchedules.length}개`)
          setSchedules(allSchedules)
        }, (error) => {
          console.error(`❌ 크루 ${orgId} 일정 감지 오류:`, error)
        })

        unsubscribers.push(unsubscribe)
      })

      console.log(`✅ ${orgIds.length}개 크루의 일정 리스너 등록 완료`)

      // 모든 리스너를 해제하는 함수 반환
      return () => {
        console.log('🔌 모든 일정 리스너 해제')
        unsubscribers.forEach(unsub => unsub())
      }
    } catch (error) {
      console.error('❌ Error setting up all schedules listeners:', error)
      return () => {}
    }
  }

  const fetchMembers = async (orgId: string) => {
    try {
      console.log('🔍 ===== 멤버 조회 시작 =====')
      console.log('orgId:', orgId)

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
      console.log(`✅ userProfiles에서 찾은 멤버 UID: ${memberUids.length}개`)

      if (memberUids.length === 0) {
        console.log('⚠️ 해당 크루에 멤버가 없습니다.')
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
          console.log(`✅ ${data.name}: joinDate=${data.joinDate}, role=${data.role}, isCaptain=${data.isCaptain}, isStaff=${data.isStaff}`)
          // userProfiles에서 location 정보 가져와서 병합
          const userProfile = userProfilesMap[data.uid]
          fetchedMembers.push({
            id: doc.id,
            ...data,
            location: userProfile?.location || undefined
          } as Member)
        }
      })

      console.log(`✅ 최종 매칭된 멤버 수: ${fetchedMembers.length}`)
      console.log('👥 멤버 상세 정보:')
      fetchedMembers.forEach(m => {
        console.log(`   - ${m.name}: role=${m.role}, joinDate=${m.joinDate}, avatar=${m.avatar ? '있음' : '없음'}`)
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

  const handleRemoveMember = async (member: Member) => {
    if (!selectedOrg) return

    const confirmRemove = window.confirm(`${member.name}님을 크루에서 추방하시겠습니까?`)
    if (!confirmRemove) return

    try {
      console.log('🚫 추방 시작:', member.name, 'uid:', member.uid, 'orgId:', selectedOrg.id)

      // userProfiles의 organizations 배열에서 제거
      const userProfileRef = doc(db, 'userProfiles', member.uid)
      const userProfileSnap = await getDoc(userProfileRef)

      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data()
        const updatedOrgs = (data.organizations || []).filter((id: string) => id !== selectedOrg.id)
        await updateDoc(userProfileRef, { organizations: updatedOrgs })
        console.log('✅ userProfiles에서 제거 완료')
      } else {
        console.error('❌ userProfile을 찾을 수 없습니다.')
        alert('멤버 프로필을 찾을 수 없습니다.')
        return
      }

      alert(`${member.name}님이 크루에서 제거되었습니다.`)

      // 멤버 리스트 새로고침
      console.log('🔄 멤버 리스트 새로고침 시작')
      await fetchMembers(selectedOrg.id)
      await fetchOrganizations() // 멤버 카운트도 업데이트
      console.log('✅ 멤버 리스트 새로고침 완료')
    } catch (error) {
      console.error('❌ Error removing member:', error)
      alert('멤버 제거 중 오류가 발생했습니다.')
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
      alert('역할 변경 중 오류가 발생했습니다.')
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
      alert('멤버 정보를 불러오는 중 오류가 발생했습니다.')
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

      alert('멤버 정보가 수정되었습니다.')
      setEditingMemberInfo(null)

      // 멤버 리스트 새로고침
      if (selectedOrg) {
        await fetchMembers(selectedOrg.id)
      }
    } catch (error) {
      console.error('Error updating member info:', error)
      alert('멤버 정보 수정 중 오류가 발생했습니다.')
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
      alert('프로필 사진 변경 중 오류가 발생했습니다.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateMyProfile = async () => {
    if (!user) return

    // 관심 카테고리 검증
    if (myProfileForm.interestCategories.length === 0) {
      alert('최소 1개 이상의 관심 카테고리를 선택해주세요.')
      return
    }

    try {
      console.log('🔄 프로필 수정 시작')
      console.log('  - User UID:', user.uid)
      console.log('  - 폼 데이터:', myProfileForm)

      // Update 객체 생성 (아바타 제외)
      const updateData: any = {
        name: myProfileForm.name,
        gender: myProfileForm.gender,
        birthdate: myProfileForm.birthdate,
        location: myProfileForm.location,
        mbti: myProfileForm.mbti.toUpperCase(),
        interestCategories: myProfileForm.interestCategories
      }

      console.log('💾 Firestore 업데이트 데이터:', updateData)

      // userProfiles 업데이트
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      console.log('📝 userProfiles 업데이트 중...')
      await updateDoc(userProfileRef, updateData)
      console.log('✅ userProfiles 업데이트 완료')

      // members 컬렉션도 이름 업데이트
      const membersRef = collection(db, 'members')
      const membersQuery = query(membersRef, where('uid', '==', user.uid))
      const membersSnapshot = await getDocs(membersQuery)

      const memberUpdatePromises = membersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { name: myProfileForm.name })
      )
      await Promise.all(memberUpdatePromises)

      alert('프로필이 수정되었습니다.')
      setEditingMyProfile(false)

      // AuthContext에서 프로필 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error updating my profile:', error)
      alert('프로필 수정 중 오류가 발생했습니다.')
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

  const handleUpdateOrg = async () => {
    if (!editingOrg) return

    try {
      let avatarUrl = editingOrg.avatar || ''

      // 새 이미지가 선택된 경우 S3에 업로드
      if (orgAvatarFile) {
        avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${editingOrg.id}`)
      }

      // Update 객체 생성 - undefined 값 제외
      const updateData: any = {
        name: orgForm.name,
        description: orgForm.description,
        avatar: avatarUrl,
        categories: orgForm.categories  // 다중 카테고리
      }

      // subtitle은 값이 있을 때만 추가
      if (orgForm.subtitle && orgForm.subtitle.trim()) {
        updateData.subtitle = orgForm.subtitle
      }

      // organizations 컬렉션 업데이트
      const orgRef = doc(db, 'organizations', editingOrg.id)
      await updateDoc(orgRef, updateData)

      alert('크루 정보가 수정되었습니다.')
      setEditingOrg(null)
      setOrgAvatarFile(null)

      // 크루 목록 새로고침
      await fetchOrganizations()
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('크루 정보 수정 중 오류가 발생했습니다.')
    }
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
      alert(error.message || '위치 설정에 실패했습니다.')
    } finally {
      setSettingLocation(false)
    }
  }

  const handleCreateCrew = async () => {
    if (!user || !userProfile) return

    // 필수값 검증
    if (!orgForm.name.trim()) {
      alert('크루 이름을 입력해주세요.')
      return
    }
    if (!orgForm.description.trim()) {
      alert('크루 설명을 입력해주세요.')
      return
    }
    if (orgForm.categories.length === 0) {
      alert('최소 1개 이상의 카테고리를 선택해주세요.')
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

      console.log('🆕 크루 생성 시작:', orgData)

      const docRef = await addDoc(collection(db, 'organizations'), orgData)
      console.log('✅ 크루 문서 생성 완료:', docRef.id)

      // 2. 이미지가 있으면 S3에 업로드하고 URL 업데이트
      if (orgAvatarFile) {
        const avatarUrl = await uploadToS3(orgAvatarFile, `organizations/${docRef.id}`)
        await updateDoc(docRef, { avatar: avatarUrl })
        console.log('✅ 크루 아바타 업로드 완료:', avatarUrl)
      }

      // 3. 사용자 프로필의 organizations 배열에 추가
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, {
        organizations: arrayUnion(docRef.id)
      })
      console.log('✅ 사용자 프로필에 크루 추가 완료')

      alert('크루가 생성되었습니다!')
      setShowCreateCrew(false)
      setOrgForm({ name: '', subtitle: '', description: '', categories: [], location: null })
      setOrgAvatarFile(null)

      // 크루 목록 새로고침
      await fetchOrganizations()

      // 새로 생성한 크루를 선택
      const newOrg = await getDoc(docRef)
      if (newOrg.exists()) {
        setSelectedOrg({ id: newOrg.id, ...newOrg.data() } as Organization)
      }
    } catch (error) {
      console.error('❌ 크루 생성 실패:', error)
      alert('크루 생성 중 오류가 발생했습니다.')
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
    console.log('🔍 getNearbyOrganizations 호출')
    console.log('  - 전체 크루 수:', allOrganizations.length)

    // 임시: 일단 모든 크루를 보여줌 (위치 필터링 없이)
    // TODO: 모든 크루에 location 데이터가 입력되면 10km 필터링 활성화
    const nearby: OrganizationWithDistance[] = allOrganizations.map(org => ({
      ...org,
      distance: 0 // 거리 정보 없음
    }))

    console.log('  ✅ 표시할 크루 수:', nearby.length)
    console.log('  📋 크루 목록:', nearby.map(org => org.name))

    return nearby
  }

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
        alert('이미 가입 신청하셨습니다.')
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

      alert('가입 신청이 완료되었습니다! 크루장의 승인을 기다려주세요.')
      fetchOrganizations()

    } catch (error) {
      console.error('가입 신청 실패:', error)
      alert('가입 신청에 실패했습니다. 다시 시도해주세요.')
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

      // userProfiles의 joinedOrganizations에 추가
      await updateDoc(userRef, {
        joinedOrganizations: arrayUnion(orgId)
      })

      alert(`${member.name}님이 크루에 가입되었습니다!`)
      fetchOrganizations()

      // 현재 선택된 크루 정보 새로고침
      if (selectedOrg) {
        const updatedOrg = await getDoc(orgRef)
        setSelectedOrg({ id: updatedOrg.id, ...updatedOrg.data() } as Organization)
      }

    } catch (error) {
      console.error('승인 실패:', error)
      alert('승인에 실패했습니다. 다시 시도해주세요.')
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

      alert(`${member.name}님의 가입 신청이 거절되었습니다.`)
      fetchOrganizations()

      // 현재 선택된 크루 정보 새로고침
      if (selectedOrg) {
        const updatedOrg = await getDoc(orgRef)
        setSelectedOrg({ id: updatedOrg.id, ...updatedOrg.data() } as Organization)
      }

    } catch (error) {
      console.error('거절 실패:', error)
      alert('거절에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const handleCreateSchedule = async () => {
    if (!selectedOrg || !user) return

    // 필수값 검증
    if (!createScheduleForm.title.trim()) {
      alert('일정 제목을 입력해주세요.')
      return
    }
    if (!createScheduleForm.date) {
      alert('날짜를 선택해주세요.')
      return
    }
    if (!createScheduleForm.time) {
      alert('시간을 선택해주세요.')
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

      await addDoc(collection(db, 'schedules'), {
        title: createScheduleForm.title,
        date: createScheduleForm.date,
        time: createScheduleForm.time,
        location: createScheduleForm.location,
        type: createScheduleForm.type,
        maxParticipants: createScheduleForm.maxParticipants,
        participants: [],
        createdBy: profile.name,
        createdByUid: user.uid,
        orgId: selectedOrg.id,
        comments: [],
        createdAt: new Date().toISOString()
      })

      alert('일정이 생성되었습니다.')
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
      alert('일정 생성 중 오류가 발생했습니다.')
    }
  }

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return

    // 필수값 검증
    if (!editScheduleForm.title.trim()) {
      alert('일정 제목을 입력해주세요.')
      return
    }
    if (!editScheduleForm.date) {
      alert('날짜를 선택해주세요.')
      return
    }
    if (!editScheduleForm.time) {
      alert('시간을 선택해주세요.')
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
      const scheduleRef = doc(db, 'schedules', editingSchedule.id)
      await updateDoc(scheduleRef, {
        title: editScheduleForm.title,
        date: editScheduleForm.date,
        time: editScheduleForm.time,
        location: editScheduleForm.location,
        type: editScheduleForm.type,
        maxParticipants: editScheduleForm.maxParticipants
      })

      alert('일정이 수정되었습니다.')
      setEditingSchedule(null)
      setSelectedSchedule(null)
    } catch (error) {
      console.error('Error updating schedule:', error)
      alert('일정 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return

    try {
      const { deleteDoc } = await import('firebase/firestore')
      const scheduleRef = doc(db, 'schedules', schedule.id)
      await deleteDoc(scheduleRef)

      alert('일정이 삭제되었습니다.')
      setSelectedSchedule(null)
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleAddParticipant = async (schedule: Schedule, memberName: string) => {
    try {
      // 정원 체크
      if (schedule.participants.length >= schedule.maxParticipants) {
        alert('정원이 초과되었습니다.')
        return
      }

      const scheduleRef = doc(db, 'schedules', schedule.id)
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
      alert('참석자 추가 중 오류가 발생했습니다.')
    }
  }

  const handleRemoveParticipant = async (schedule: Schedule, memberName: string) => {
    try {
      const scheduleRef = doc(db, 'schedules', schedule.id)
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
      alert('참석자 제거 중 오류가 발생했습니다.')
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

It's Campers와 함께하는 캠핑 일정에 참여하세요!

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
      alert('클립보드 복사에 실패했습니다.')
    })
  }

  const handleAddComment = async (schedule: Schedule) => {
    if (!commentText.trim() || !user) return

    try {
      const scheduleRef = doc(db, 'schedules', schedule.id)
      const newComment: Comment = {
        id: Date.now().toString(),
        userName: profile.name,
        userUid: user.uid,
        text: commentText,
        createdAt: new Date().toISOString()
      }
      const updatedComments = [...(schedule.comments || []), newComment]
      await updateDoc(scheduleRef, { comments: updatedComments })
      setCommentText('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('댓글 추가 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteComment = async (schedule: Schedule, commentId: string) => {
    if (!window.confirm('정말 이 댓글을 삭제하시겠습니까?')) return

    try {
      const scheduleRef = doc(db, 'schedules', schedule.id)
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
        return 'bg-blue-50 text-[#3182F6]' // 기본값 (기존 데이터용)
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

  // 멤버의 마지막 참여일로부터 경과일 계산 함수
  const getMemberLastParticipationDays = (memberName: string): number | null => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // 시간 부분 제거

    // 멤버가 참여한 과거 일정만 찾기 (미래 일정 제외)
    const participatedSchedules = schedules.filter(schedule => {
      if (!schedule.participants.includes(memberName)) {
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

      const scheduleRef = doc(db, 'schedules', schedule.id)
      const isParticipating = schedule.participants?.includes(profile.name)

      let updatedParticipants: string[]
      if (isParticipating) {
        // 참여 취소
        updatedParticipants = schedule.participants.filter(name => name !== profile.name)
      } else {
        // 참여
        if (schedule.participants.length >= schedule.maxParticipants) {
          alert('정원이 초과되었습니다.')
          return
        }
        updatedParticipants = [...schedule.participants, profile.name]
      }

      await updateDoc(scheduleRef, {
        participants: updatedParticipants
      })

      // 실시간 리스너가 자동으로 업데이트하므로 로컬 상태 업데이트 불필요
      console.log('✅ 참여 상태 변경 완료 - 실시간으로 반영됩니다')
    } catch (error) {
      console.error('Error toggling participation:', error)
      alert('참여 상태 변경에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#3182F6] mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
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

  // 다가오는 일정과 지난 일정 구분
  const upcomingSchedules = schedules
    .filter(s => !isSchedulePast(s.date))
    .sort((a, b) => parseScheduleDate(a.date).getTime() - parseScheduleDate(b.date).getTime()) // 날짜 오름차순 (가까운 순)

  const pastSchedules = schedules
    .filter(s => isSchedulePast(s.date))
    .sort((a, b) => parseScheduleDate(b.date).getTime() - parseScheduleDate(a.date).getTime()) // 날짜 내림차순 (최근 순)

  // 디버깅 (필요시에만 활성화)
  // console.log('===== 일정 분류 =====')
  // console.log('전체 일정:', schedules.length)
  // console.log('다가오는 일정:', upcomingSchedules.length)
  // console.log('지난 일정:', pastSchedules.length)

  // 참여자는 이름으로 저장되어 있음
  const mySchedules = upcomingSchedules.filter(s => s.participants?.includes(profile.name))

  return (
    <div className="min-h-screen bg-gray-50 pb-28 max-w-md mx-auto">
      {/* URL 파라미터로 공유된 일정 자동 열기 */}
      <Suspense fallback={null}>
        <ScheduleDeepLink
          schedules={schedules}
          selectedSchedule={selectedSchedule}
          setSelectedSchedule={setSelectedSchedule}
          organizations={organizations}
          setSelectedOrg={setSelectedOrg}
        />
      </Suspense>

      {/* Home Page */}
      {currentPage === 'home' && (
        <div className="bg-[#F9FAFB]">
          {/* 토스 스타일 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top">
            <div className="px-4 py-5 sm:px-5 sm:py-6 flex justify-between items-center border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-[#3182F6]" strokeWidth={2.5} />
                <span className="font-bold text-xl sm:text-2xl tracking-tight text-[#191F28]">
                  {userProfile?.locations && userProfile.locations.length > 0
                    ? `${(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).sigungu} ${(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).dong}`
                    : profile.location}
                </span>
              </div>
              <div className="flex gap-1">
                <button className="p-3 hover:bg-gray-50 rounded-xl active:scale-95 transition-all">
                  <Bell className="w-6 h-6 text-[#4E5968]" strokeWidth={2} />
                </button>
                <button className="p-3 hover:bg-gray-50 rounded-xl active:scale-95 transition-all">
                  <Settings className="w-6 h-6 text-[#4E5968]" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-6 space-y-5">
            {/* 내 동네 크루 섹션 - 당근마켓 스타일 */}
            <div className="mb-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3 px-4 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">📍</span>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">내 동네 크루</h2>
                  {userProfile?.locations && userProfile.locations.length > 0 && (
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-orange-50 text-orange-600 text-xs sm:text-sm font-semibold rounded-full">
                      {(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).dong}
                    </span>
                  )}
                </div>

                {/* 동네 인증 버튼 (미인증 시) */}
                {(!userProfile?.locations || userProfile.locations.length === 0) && (
                  <button
                    onClick={() => setCurrentPage('myprofile')}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-orange-600 active:scale-95 transition-all"
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
                    <div className="mx-4 sm:mx-5 p-6 sm:p-8 bg-gray-50 rounded-xl sm:rounded-2xl text-center">
                      <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">📍</div>
                      <p className="text-gray-900 font-semibold text-sm sm:text-base mb-1">
                        동네 인증이 필요해요
                      </p>
                      <p className="text-gray-500 text-xs sm:text-sm">
                        동네를 인증하면 주변 크루를 찾을 수 있어요
                      </p>
                    </div>
                  )
                }

                if (nearbyCrews.length === 0) {
                  // 빈 상태 - 크루 없음
                  return (
                    <div className="mx-4 sm:mx-5 p-6 sm:p-8 bg-gray-50 rounded-xl sm:rounded-2xl text-center">
                      <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🏕️</div>
                      <p className="text-gray-900 font-semibold text-sm sm:text-base mb-1">
                        내 동네에 아직 크루가 없어요
                      </p>
                      <p className="text-gray-500 text-xs sm:text-sm">
                        첫 번째 크루를 만들어보세요!
                      </p>
                    </div>
                  )
                }

                // 크루 카드 가로 스크롤
                return (
                  <div className="overflow-x-auto hide-scrollbar">
                    <div className="flex gap-3 px-4 sm:px-5 pb-2">
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
                              setSelectedOrg(crew)
                              setCurrentPage('mycrew')
                            }}
                            className="flex-shrink-0 w-[240px] sm:w-[280px] bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 hover:shadow-md transition-all hover:scale-[1.02] active:scale-95"
                          >
                            {/* 크루 이미지 */}
                            <div className="relative w-full h-[140px] sm:h-[160px] bg-gradient-to-br from-orange-400 to-pink-500">
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
                                  <span className="text-5xl sm:text-6xl">🏕️</span>
                                </div>
                              )}

                              {/* 거리 배지 */}
                              {crew.distance > 0 && (
                                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
                                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                                    {formatDistance(crew.distance)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 크루 정보 */}
                            <div className="p-3 sm:p-4 text-left">
                              {/* 크루 이름 */}
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2 truncate">
                                {crew.name}
                              </h3>

                              {/* 위치 */}
                              <div className="flex items-center gap-1 text-gray-600 text-xs sm:text-sm mb-2">
                                <span>📍</span>
                                <span className="truncate">
                                  {crew.location?.dong || crew.description?.split(' ').slice(0, 2).join(' ') || '위치 미설정'}
                                </span>
                              </div>

                              {/* 카테고리 */}
                              {categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                                  {categories.map((cat, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md"
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                  {totalCategories > 2 && (
                                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-md">
                                      +{totalCategories - 2}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* 멤버 수 */}
                              <div className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm">
                                <span>👥</span>
                                <span>멤버 {orgMemberCounts[crew.id] || 0}명</span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
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
            <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#3182F6]" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#191F28]">다가오는 일정</h2>
                </div>
                <button
                  onClick={() => setCurrentPage('mycrew')}
                  className="text-[#3182F6] text-sm font-bold hover:text-[#1B64DA] active:scale-95 transition-all px-3 py-2 rounded-lg hover:bg-blue-50"
                >
                  전체보기 →
                </button>
              </div>
              {mySchedules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <p className="text-[#191F28] font-bold text-xl mb-2">등록된 일정이 없어요</p>
                  <p className="text-[#6B7684] text-base font-medium">첫 일정을 만들어보세요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      onClick={() => setSelectedSchedule(schedule)}
                      className="bg-[#F9FAFB] rounded-2xl p-6 hover:bg-[#F2F4F6] active:scale-[0.98] transition-all cursor-pointer border border-transparent hover:border-[#3182F6]/20"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-xl tracking-tight text-[#191F28] leading-tight">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        <p className="text-[#4E5968] text-base font-medium flex items-center gap-2">
                          <span className="text-lg">📅</span>
                          <span>{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="text-[#4E5968] text-base font-medium flex items-center gap-2">
                          <span className="text-lg">📍</span>
                          <span>{schedule.location}</span>
                        </p>
                        <p className="text-[#4E5968] text-base font-medium flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <span>벙주: {schedule.createdBy}</span>
                        </p>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
                          <p className="text-[#8B95A1] text-sm font-bold">
                            👥 참여 인원
                          </p>
                          <p className="text-[#191F28] text-lg font-bold">
                            {schedule.participants?.length || 0}<span className="text-[#8B95A1]">/{schedule.maxParticipants}</span>
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
        <div className="bg-[#F9FAFB] min-h-screen">
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-5 sm:px-6 sm:py-6 flex justify-between items-center">
              <div className="flex items-center gap-2 sm:gap-3">
                <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-[#3182F6]" strokeWidth={2.5} />
                <span className="font-bold text-xl sm:text-2xl tracking-tight text-[#191F28]">
                  {userProfile?.locations && userProfile.locations.length > 0
                    ? `${(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).sigungu} ${(userProfile.locations.find(loc => loc.id === userProfile.selectedLocationId) || userProfile.locations[0]).dong}`
                    : profile.location}
                </span>
              </div>
              <div className="flex gap-1">
                <button className="p-3 hover:bg-gray-50 rounded-xl active:scale-95 transition-all">
                  <Bell className="w-6 h-6 text-[#4E5968]" strokeWidth={2} />
                </button>
                <button className="p-3 hover:bg-gray-50 rounded-xl active:scale-95 transition-all">
                  <Settings className="w-6 h-6 text-[#4E5968]" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#191F28] mb-5">크루 찾기</h2>

            {/* 추천 크루 섹션 */}
            {recommendedOrgs.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-lg font-bold tracking-tight text-[#191F28]">
                    ✨ 나를 위한 추천 크루
                  </h3>
                  <span className="text-xs font-bold text-[#3182F6] bg-blue-50 px-3 py-1 rounded-full">
                    {recommendedOrgs.length}개
                  </span>
                </div>
                <div className="space-y-3">
                  {recommendedOrgs.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org)
                        setCurrentPage('mycrew')
                      }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-[#3182F6] hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {org.avatar ? (
                            <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">⛺</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {org.subtitle && (
                            <p className="text-xs font-bold text-[#8B95A1] mb-1 truncate">{org.subtitle}</p>
                          )}
                          <h4 className="text-lg font-bold tracking-tight text-[#191F28] mb-1 truncate">
                            {org.name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(org.categories || [org.category]).filter(Boolean).map((cat, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 bg-[#F2F4F6] text-[#4E5968] text-xs rounded-lg font-medium">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-[#3182F6] text-xl">→</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 크루 목록 - 10km 반경 내 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-lg font-bold tracking-tight text-[#191F28]">
                  🌟 내 반경 내 전체 크루
                </h3>
                <span className="text-xs font-bold text-[#6B7684] bg-gray-100 px-3 py-1 rounded-full">
                  {(() => {
                    const nearby = getNearbyOrganizations()
                    return nearby.length
                  })()}개
                </span>
              </div>
              {(() => {
                const nearby = getNearbyOrganizations()
                if (!userProfile?.locations || userProfile.locations.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-8 text-center">
                      <div className="text-5xl mb-3">📍</div>
                      <p className="text-base font-bold text-[#191F28] mb-1">동네 인증이 필요해요</p>
                      <p className="text-sm text-[#6B7684]">내 동네를 인증하고 주변 크루를 만나보세요</p>
                    </div>
                  )
                }
                if (nearby.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-8 text-center">
                      <div className="text-5xl mb-3">🔍</div>
                      <p className="text-base font-bold text-[#191F28] mb-1">10km 이내 크루가 없어요</p>
                      <p className="text-sm text-[#6B7684]">새로운 크루를 만들어보세요!</p>
                    </div>
                  )
                }
                return (
                  <div className="space-y-3">
                    {nearby.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org)
                        setCurrentPage('mycrew')
                      }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-[#3182F6] hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {org.avatar ? (
                            <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">⛺</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {org.subtitle && (
                            <p className="text-xs font-bold text-[#8B95A1] mb-1 truncate">{org.subtitle}</p>
                          )}
                          <h4 className="text-lg font-bold tracking-tight text-[#191F28] mb-1 truncate">
                            {org.name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(org.categories || [org.category]).filter(Boolean).map((cat, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 bg-[#F2F4F6] text-[#4E5968] text-xs rounded-lg font-medium">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-[#3182F6] text-xl">→</div>
                      </div>
                    </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* 크루 생성 버튼 - 하단으로 이동 */}
            <button
              onClick={() => {
                setShowCreateCrew(true)
                setOrgForm({ name: '', subtitle: '', description: '', categories: [] })
                setOrgAvatarFile(null)
              }}
              className="w-full bg-gradient-to-r from-[#3182F6] to-[#2563EB] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] text-white"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-xl font-bold mb-1">새 크루 만들기</h3>
                  <p className="text-sm opacity-90">나만의 크루를 시작하세요</p>
                </div>
                <div className="text-4xl">➕</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* My Crew Page - 토스 스타일 */}
      {currentPage === 'mycrew' && !selectedOrg && (
        <div className="bg-[#F9FAFB] min-h-screen">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-6 py-6">
              <h1 className="text-2xl font-bold tracking-tight text-[#191F28]">내 크루</h1>
              <p className="text-sm text-[#8B95A1] mt-1">가입한 크루 목록</p>
            </div>
          </header>

          <div className="px-5 py-6 space-y-3">
            {organizations.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">⛺</div>
                <p className="text-base font-bold text-[#8B95A1]">가입한 크루가 없습니다</p>
              </div>
            ) : (
              organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => {
                    console.log('🖱️ 크루 선택됨:', org.name, 'ID:', org.id)
                    setSelectedOrg(org)
                  }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-[#3182F6] hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                      <img
                        src={org.avatar || '/default-avatar.svg'}
                        alt={org.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          if (target.src !== `${window.location.origin}/default-avatar.svg`) {
                            target.src = '/default-avatar.svg'
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {org.subtitle && (
                        <p className="text-xs font-bold text-[#8B95A1] mb-1 truncate">{org.subtitle}</p>
                      )}
                      <h3 className="text-xl font-bold tracking-tight text-[#191F28] mb-1 truncate">{org.name}</h3>
                      <p className="text-sm text-[#6B7684] mb-2 truncate">{org.description || org.category}</p>
                      <div className="inline-flex items-center gap-1.5 bg-[#F2F4F6] px-3 py-1 rounded-lg">
                        <span className="text-sm">👥</span>
                        <span className="text-sm font-bold text-[#191F28]">
                          {orgMemberCounts[org.id] !== undefined ? orgMemberCounts[org.id] : '...'}명
                        </span>
                        {console.log('화면 렌더링:', org.name, 'ID:', org.id, '카운트:', orgMemberCounts[org.id], '전체:', orgMemberCounts)}
                      </div>
                    </div>
                    <div className="text-[#8B95A1] flex-shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Crew Detail Page - 토스 스타일 */}
      {currentPage === 'mycrew' && selectedOrg && (
        <div className="bg-[#F9FAFB] min-h-screen">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedOrg(null)}
                  className="text-[#191F28] text-2xl p-2 hover:bg-gray-50 rounded-xl active:scale-95 transition-all -ml-2"
                >
                  ←
                </button>
                {userProfile?.role === 'captain' && (
                  <button
                    onClick={() => handleOpenOrgEdit(selectedOrg)}
                    className="px-4 py-2 bg-[#F2F4F6] text-[#191F28] text-sm font-semibold rounded-xl hover:bg-[#E5E8EB] active:scale-95 transition-all"
                  >
                    ⚙️ 크루 정보 수정
                  </button>
                )}
              </div>
              {selectedOrg.subtitle && (
                <p className="text-sm font-bold text-[#8B95A1] mb-1">{selectedOrg.subtitle}</p>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-[#191F28]">{selectedOrg.name}</h1>
            </div>

            {/* 통계 카드 */}
            <div className="px-6 pb-6 grid grid-cols-3 gap-3">
              <button
                onClick={() => setScheduleFilter('all')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'all'
                    ? 'bg-[#3182F6] text-white shadow-md'
                    : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                }`}
              >
                <div className="text-3xl font-bold tracking-tight">{upcomingSchedules.length}</div>
                <div className="text-xs font-bold mt-1 opacity-80">전체</div>
              </button>
              <button
                onClick={() => setScheduleFilter('joined')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'joined'
                    ? 'bg-[#3182F6] text-white shadow-md'
                    : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                }`}
              >
                <div className="text-3xl font-bold tracking-tight">{mySchedules.length}</div>
                <div className="text-xs font-bold mt-1 opacity-80">참여 일정</div>
              </button>
              <button
                onClick={() => setScheduleFilter('not-joined')}
                className={`rounded-2xl p-4 text-center transition-all ${
                  scheduleFilter === 'not-joined'
                    ? 'bg-[#3182F6] text-white shadow-md'
                    : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                }`}
              >
                <div className="text-3xl font-bold tracking-tight">{upcomingSchedules.length - mySchedules.length}</div>
                <div className="text-xs font-bold mt-1 opacity-80">미참여</div>
              </button>
            </div>
          </header>

          <div className="px-5 py-6 space-y-6">
            {/* 다가오는 일정 */}
            <div>
              <h3 className="text-lg font-bold tracking-tight text-[#191F28] mb-4">다가오는 일정</h3>
              <div className="space-y-3">
                {(() => {
                  let filteredSchedules = upcomingSchedules
                  if (scheduleFilter === 'joined') {
                    filteredSchedules = upcomingSchedules.filter(s => s.participants?.includes(profile.name))
                  } else if (scheduleFilter === 'not-joined') {
                    filteredSchedules = upcomingSchedules.filter(s => !s.participants?.includes(profile.name))
                  }

                  if (filteredSchedules.length === 0) {
                    return (
                      <div className="text-center py-16">
                        <div className="text-6xl mb-4">📅</div>
                        <p className="text-base font-bold text-[#8B95A1]">다가오는 일정이 없습니다</p>
                      </div>
                    )
                  }

                  return filteredSchedules.map((schedule) => {
                  const isParticipating = schedule.participants?.includes(profile.name)
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => setSelectedSchedule(schedule)}
                      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all cursor-pointer active:scale-[0.98] ${
                        isParticipating ? 'border-[#3182F6] shadow-md' : 'border-gray-100 hover:border-[#3182F6] hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg tracking-tight text-[#191F28] flex-1">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-bold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-[#6B7684]">
                        <p className="flex items-center gap-2">
                          <span>📅</span>
                          <span className="font-medium">{formatDateWithYear(schedule.date)} {schedule.time}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span>📍</span>
                          <span className="font-medium">{schedule.location}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span>👥</span>
                          <span className="font-medium">{schedule.participants?.length || 0}/{schedule.maxParticipants}명</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span>🎯</span>
                          <span className="font-medium">벙주: {schedule.createdBy}</span>
                        </p>
                      </div>
                      {isParticipating && (
                        <div className="mt-4 text-xs bg-[#E8F5E9] text-[#2E7D32] px-3 py-2 rounded-xl font-bold text-center">
                          ✓ 참여 중
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
                <h3 className="text-lg font-bold text-gray-500 mb-3 px-2">지난 일정</h3>
                <div className="space-y-3">
                  {pastSchedules.map((schedule) => {
                    const isParticipating = schedule.participants?.includes(profile.name)
                    return (
                      <div
                        key={schedule.id}
                        onClick={() => setSelectedSchedule(schedule)}
                        className="bg-gray-50 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-60"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-lg text-gray-600">{schedule.title}</h3>
                          <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-semibold">
                            {schedule.type}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                          <p>📅 {formatDateWithYear(schedule.date)} {schedule.time}</p>
                          <p>📍 {schedule.location}</p>
                          <p>👥 {schedule.participants?.length || 0}/{schedule.maxParticipants}명</p>
                          <p>🎯 벙주: {schedule.createdBy}</p>
                        </div>
                        {isParticipating && (
                          <div className="mt-3 text-xs bg-gray-200 text-gray-600 px-3 py-2 rounded-lg font-semibold text-center">
                            ✓ 참여함
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-32 right-5 flex flex-col gap-4 z-30">
            <button
              onClick={() => setShowMemberList(true)}
              className="w-16 h-16 bg-white border-2 border-[#3182F6] text-[#3182F6] rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center"
            >
              <Users className="w-7 h-7" />
            </button>
            <button
              onClick={() => setShowCreateSchedule(true)}
              className="w-16 h-16 bg-[#3182F6] hover:bg-[#1B64DA] text-white rounded-full shadow-lg text-3xl font-bold active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* 멤버 리스트 모달 */}
      {showMemberList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#3182F6] text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">CREW MEMBERS</h2>
                  <button
                    onClick={() => selectedOrg && fetchMembers(selectedOrg.id)}
                    className="text-white text-lg hover:opacity-80 bg-white/20 px-3 py-1 rounded-lg"
                  >
                    ↻
                  </button>
                </div>
                <button
                  onClick={() => setShowMemberList(false)}
                  className="text-white text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm opacity-90">총 {members.length}명</p>

              {/* 활동 경과일 필터 */}
              <div className="mt-3">
                <select
                  value={memberActivityFilter}
                  onChange={(e) => setMemberActivityFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/20 text-white rounded-lg text-sm border border-white/30"
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
              <div className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">멤버가 없습니다.</p>
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
                      if (a.isStaff && !b.isStaff) return -1
                      if (!a.isStaff && b.isStaff) return 1

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
                        className="bg-gray-50 rounded-lg p-4 flex items-center gap-3"
                      >
                        <div
                          onClick={(e) => {
                            const img = e.currentTarget.querySelector('img')
                            if (img && img.src && !img.src.includes('default-avatar.svg')) {
                              setSelectedAvatarUrl(img.src)
                            }
                          }}
                          className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#3182F6] bg-gray-200"
                        >
                          <img
                            src={member.avatar || '/default-avatar.svg'}
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
                              <span className="text-xs bg-[#3182F6] text-white px-2 py-0.5 rounded-full">
                                크루장
                              </span>
                            )}
                            {member.isStaff && !member.isCaptain && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                운영진
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">가입일: {member.joinDate}</p>
                          {(member as any).location && (
                            <p className="text-xs text-gray-500 mt-0.5">지역: {(member as any).location}</p>
                          )}
                          <p className="text-xs text-gray-600 mt-0.5">
                            {daysSinceLastParticipation === null ? (
                              <span className="text-red-500">참여 이력 없음</span>
                            ) : daysSinceLastParticipation === 0 ? (
                              <span className="text-[#3182F6] font-semibold">오늘 참여</span>
                            ) : (
                              <span className={daysSinceLastParticipation >= 90 ? 'text-red-500' : daysSinceLastParticipation >= 60 ? 'text-orange-500' : 'text-gray-600'}>
                                마지막 참여: {daysSinceLastParticipation}일 전
                              </span>
                            )}
                          </p>
                        </div>

                        {/* 크루장 전용 관리 버튼 */}
                        {isCaptain && !isCurrentUser && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenMemberInfoEdit(member)}
                              className="px-2 py-1 text-xs bg-[#3182F6] text-white rounded-lg hover:bg-[#1B64DA]"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => setEditingMember(member)}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                              역할
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member)}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                              추방
                            </button>
                          </div>
                        )}
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
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold tracking-tight text-[#191F28] leading-tight mb-2">
                    {selectedSchedule.title}
                  </h2>
                  <span className="inline-block text-xs font-bold bg-[#F2F4F6] text-[#4E5968] px-3 py-1.5 rounded-lg">
                    {selectedSchedule.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl active:scale-95 transition-all -mr-2"
                >
                  <span className="text-2xl text-[#8B95A1]">×</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* 일정 정보 카드 */}
              <div className="bg-[#F9FAFB] rounded-2xl p-5 space-y-4">
                <div>
                  <div className="text-sm font-bold text-[#8B95A1] mb-2">📅 일시</div>
                  <div className="text-base font-bold text-[#191F28]">
                    {formatDateWithYear(selectedSchedule.date)} {selectedSchedule.time}
                  </div>
                </div>

                <div className="h-px bg-[#E5E8EB]"></div>

                <div>
                  <div className="text-sm font-bold text-[#8B95A1] mb-2">📍 장소</div>
                  <div className="text-base font-bold text-[#191F28]">{selectedSchedule.location}</div>
                </div>

                <div className="h-px bg-[#E5E8EB]"></div>

                <div>
                  <div className="text-sm font-bold text-[#8B95A1] mb-2">🎯 벙주</div>
                  <div className="text-base font-bold text-[#191F28]">{selectedSchedule.createdBy || '정보 없음'}</div>
                </div>
              </div>

              {/* 참여 인원 섹션 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-base font-bold text-[#191F28]">👥 참여 인원</div>
                  <div className="text-base font-bold text-[#3182F6]">
                    {selectedSchedule.participants?.length || 0} / {selectedSchedule.maxParticipants}명
                  </div>
                </div>
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSchedule.participants.map((name) => (
                      <div key={name} className="bg-[#F2F4F6] px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#E5E8EB] transition-colors">
                        <span className="text-sm font-bold text-[#191F28]">{name}</span>
                        {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveParticipant(selectedSchedule, name)
                            }}
                            className="text-[#8B95A1] hover:text-red-500 font-bold text-lg leading-none active:scale-95 transition-all"
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
                    className="mt-3 text-sm text-[#3182F6] hover:text-[#1B64DA] font-bold py-1 active:scale-95 transition-all"
                  >
                    {managingParticipants ? '관리 종료' : '+ 참석자 추가하기'}
                  </button>
                )}
                {managingParticipants && members.filter(m => !selectedSchedule.participants?.includes(m.name)).length > 0 && (
                  <div className="mt-3 p-4 bg-[#F9FAFB] rounded-2xl max-h-40 overflow-y-auto">
                    <div className="text-xs font-bold text-[#8B95A1] mb-3">멤버를 클릭하여 추가</div>
                    <div className="flex flex-wrap gap-2">
                      {members.filter(m => !selectedSchedule.participants?.includes(m.name)).map(member => (
                        <button
                          key={member.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddParticipant(selectedSchedule, member.name)
                          }}
                          className="text-sm font-bold bg-white px-4 py-2 rounded-xl hover:bg-[#3182F6] hover:text-white border border-[#E5E8EB] active:scale-95 transition-all"
                        >
                          + {member.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 댓글 섹션 */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold text-[#191F28]">💬 댓글</span>
                  <span className="text-sm font-bold text-[#8B95A1]">({selectedSchedule.comments?.length || 0})</span>
                </div>
                {selectedSchedule.comments && selectedSchedule.comments.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {selectedSchedule.comments.map((comment, index) => (
                      <div key={`${comment.id}-${index}`} className="bg-[#F9FAFB] p-4 rounded-2xl">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-sm text-[#3182F6]">{comment.userName || '익명'}</div>
                          {(comment.userUid === user?.uid || userProfile?.role === 'captain' || userProfile?.role === 'staff') && (
                            <button
                              onClick={() => handleDeleteComment(selectedSchedule, comment.id)}
                              className="text-[#8B95A1] hover:text-red-500 text-xl leading-none active:scale-95 transition-all"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-[#191F28] leading-relaxed mb-2">{comment.text}</div>
                        <div className="text-xs font-medium text-[#8B95A1]">
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
                    className="flex-1 px-4 py-3 border-2 border-[#E5E8EB] rounded-xl text-sm focus:border-[#3182F6] focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => handleAddComment(selectedSchedule)}
                    className="px-5 py-3 bg-[#3182F6] text-white rounded-xl text-sm font-bold hover:bg-[#1B64DA] active:scale-95 transition-all"
                  >
                    등록
                  </button>
                </div>
              </div>

              {/* 카카오톡 공유하기 버튼 */}
              <div className="border-t border-gray-100 pt-5">
                <button
                  onClick={() => handleShareSchedule(selectedSchedule)}
                  className="w-full bg-[#FEE500] text-[#191F28] py-4 rounded-2xl font-bold hover:bg-[#FDD835] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="text-xl">💬</span>
                  <span>카카오톡 공유하기</span>
                </button>
              </div>

              {/* 마스터(크루장/운영진) 또는 벙주만 수정/삭제 가능 */}
              {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditScheduleForm({
                        title: selectedSchedule.title || '',
                        date: selectedSchedule.date || '',
                        time: selectedSchedule.time || '',
                        location: selectedSchedule.location || '',
                        type: selectedSchedule.type || '',
                        maxParticipants: selectedSchedule.maxParticipants || 10
                      })
                      setEditingSchedule(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="flex-1 bg-[#3182F6] text-white py-3.5 rounded-xl font-bold hover:bg-[#1B64DA] transition-all active:scale-[0.98] text-sm"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(selectedSchedule)}
                    className="flex-1 bg-[#F2F4F6] text-[#F04452] py-3.5 rounded-xl font-bold hover:bg-[#FFE5E8] transition-all active:scale-[0.98] text-sm"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              )}

              <div>
                {selectedSchedule.participants?.includes(profile.name) ? (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-[#F2F4F6] text-[#F04452] py-4 rounded-2xl font-bold hover:bg-[#FFE5E8] transition-all active:scale-[0.98]"
                  >
                    참여 취소
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-[#3182F6] text-white py-4 rounded-2xl font-bold hover:bg-[#1B64DA] disabled:bg-[#E5E8EB] disabled:text-[#8B95A1] transition-all active:scale-[0.98]"
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
        <div className="bg-[#F9FAFB] min-h-screen pb-20">
          {/* 헤더 */}
          <header className="sticky top-0 bg-white z-10 safe-top border-b border-gray-100">
            <div className="px-4 py-4 sm:px-6 sm:py-5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#191F28]">내 정보</h1>
            </div>
          </header>

          <div className="px-4 py-4 sm:px-5 sm:py-6 space-y-3 sm:space-y-4">
            {/* 내 동네 설정 섹션 */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#191F28] mb-3 sm:mb-4">
                내 동네 설정
              </h3>
              <LocationVerification />
            </div>

            {/* 프로필 카드 */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
              <div className="text-center mb-5 sm:mb-6">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 group">
                  <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center text-3xl sm:text-4xl overflow-hidden">
                    <img
                      src={profile.avatar || '/default-avatar.svg'}
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
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#191F28] mb-1.5 sm:mb-2">{profile.name}</h2>
                <p className="text-xs sm:text-sm text-[#8B95A1]">{profile.email}</p>
              </div>

              {/* 정보 섹션 */}
              <div className="bg-[#F9FAFB] rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4">
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">생년월일</div>
                  <div className="text-sm sm:text-base font-bold text-[#191F28]">{profile.birthdate}</div>
                </div>
                <div className="h-px bg-[#E5E8EB]"></div>
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">성별</div>
                  <div className="text-sm sm:text-base font-bold text-[#191F28]">{profile.gender}</div>
                </div>
                <div className="h-px bg-[#E5E8EB]"></div>
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">지역</div>
                  <div className="text-sm sm:text-base font-bold text-[#191F28]">{profile.location}</div>
                </div>
                <div className="h-px bg-[#E5E8EB]"></div>
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">MBTI</div>
                  <div className="text-sm sm:text-base font-bold text-[#191F28]">{profile.mbti || '-'}</div>
                </div>
                <div className="h-px bg-[#E5E8EB]"></div>
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">관심 카테고리</div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(profile.interestCategories || []).length > 0 ? (
                      profile.interestCategories.map((category, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 sm:px-3 bg-[#3182F6] text-white text-xs rounded-full font-medium">
                          {category}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm sm:text-base font-bold text-[#191F28]">-</span>
                    )}
                  </div>
                </div>
                <div className="h-px bg-[#E5E8EB]"></div>
                <div>
                  <div className="text-xs font-bold text-[#8B95A1] mb-1.5 sm:mb-2">가입일</div>
                  <div className="text-sm sm:text-base font-bold text-[#191F28]">{profile.joinDate}</div>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-2.5 sm:space-y-3">
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
                className="w-full bg-[#3182F6] text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold hover:bg-[#1B64DA] active:scale-[0.98] transition-all"
              >
                ✏️ 정보 수정
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-[#F2F4F6] text-[#F04452] py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold hover:bg-[#FFE5E8] active:scale-[0.98] transition-all"
              >
                🚪 로그아웃
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
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full text-white text-2xl flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 멤버 역할 수정 모달 */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
              <h2 className="text-xl font-bold">멤버 역할 변경</h2>
              <p className="text-sm opacity-90 mt-1">{editingMember.name}</p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'captain')}
                className="w-full py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors"
              >
                크루장으로 변경
              </button>
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'staff')}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                운영진으로 변경
              </button>
              <button
                onClick={() => handleUpdateMemberRole(editingMember, 'member')}
                className="w-full py-3 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                일반 멤버로 변경
              </button>
              <button
                onClick={() => setEditingMember(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 정보 수정 모달 */}
      {editingMemberInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#3182F6] text-white p-6">
              <h2 className="text-xl font-bold">멤버 정보 수정</h2>
              <p className="text-sm opacity-90 mt-1">{editingMemberInfo.name}</p>
              <p className="text-xs opacity-75 mt-1">로그인 계정: {editingMemberInfo.email}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                  value={editForm.birthdate}
                  onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCityForMemberEdit}
                    onChange={(e) => {
                      setSelectedCityForMemberEdit(e.target.value)
                      setSelectedDistrictForMemberEdit('') // Reset district when city changes
                      setEditForm({ ...editForm, location: e.target.value })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">구/군</option>
                    {selectedCityForMemberEdit && getDistricts(selectedCityForMemberEdit).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={editForm.mbti}
                  onChange={(e) => setEditForm({ ...editForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMemberInfo}
                className="flex-1 py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors"
              >
                저장
              </button>
              <button
                onClick={() => setEditingMemberInfo(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 정보 수정 모달 */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#3182F6] text-white p-6">
              <h2 className="text-xl font-bold">크루 정보 수정</h2>
              <p className="text-sm opacity-90 mt-1">{editingOrg.name}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루명 *</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="우리 크루"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루 소제목</label>
                <input
                  type="text"
                  value={orgForm.subtitle}
                  onChange={(e) => setOrgForm({ ...orgForm, subtitle: e.target.value })}
                  placeholder="함께하는 아웃도어 라이프"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루 설명 *</label>
                <textarea
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  placeholder="크루 소개를 입력하세요"
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 * (중복 선택 가능)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                  {CREW_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
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
                        className="w-4 h-4 text-[#3182F6] border-gray-300 rounded focus:ring-[#3182F6]"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {orgForm.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {orgForm.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#3182F6] text-white text-xs rounded-full">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">크루 활동 지역 (선택)</label>
                <div className="space-y-2">
                  {orgForm.location ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-900">{orgForm.location.dong}</p>
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
                      className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {settingLocation ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          위치 가져오는 중...
                        </span>
                      ) : (
                        '📍 현재 위치로 설정'
                      )}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">※ 내 동네 크루 필터링에 사용됩니다</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">크루 메인사진</label>
                <div className="space-y-2">
                  {orgAvatarFile && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📷</span>
                        <span className="text-sm text-gray-700">{orgAvatarFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrgAvatarFile(null)}
                        className="text-red-500 text-sm font-medium"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all">
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
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all">
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
                  <p className="text-xs text-gray-500">※ 5MB 이하 권장</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateOrg}
                className="flex-1 py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setEditingOrg(null)
                  setOrgAvatarFile(null)
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 생성 모달 */}
      {showCreateCrew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#3182F6] to-[#2563EB] text-white p-6">
              <h2 className="text-xl font-bold">새 크루 만들기</h2>
              <p className="text-sm opacity-90 mt-1">나만의 캠핑 크루를 시작하세요</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루명 *</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="예: 서울 캠핑 크루"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루 소제목</label>
                <input
                  type="text"
                  value={orgForm.subtitle}
                  onChange={(e) => setOrgForm({ ...orgForm, subtitle: e.target.value })}
                  placeholder="예: 함께하는 아웃도어 라이프"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">크루 설명 *</label>
                <textarea
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  placeholder="크루 소개를 입력하세요"
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 * (중복 선택 가능)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-lg">
                  {CREW_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
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
                        className="w-4 h-4 text-[#3182F6] border-gray-300 rounded focus:ring-[#3182F6]"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {orgForm.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {orgForm.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#3182F6] text-white text-xs rounded-full">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">크루 활동 지역 (선택)</label>
                <div className="space-y-2">
                  {orgForm.location ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-900">{orgForm.location.dong}</p>
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
                      className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {settingLocation ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          위치 가져오는 중...
                        </span>
                      ) : (
                        '📍 현재 위치로 설정'
                      )}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">※ 내 동네 크루 필터링에 사용됩니다</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">크루 메인사진</label>
                <div className="space-y-2">
                  {orgAvatarFile && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📷</span>
                        <span className="text-sm text-gray-700">{orgAvatarFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrgAvatarFile(null)}
                        className="text-red-500 text-sm font-medium"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all">
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
                    <label className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all">
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
                  <p className="text-xs text-gray-500">※ 5MB 이하 권장</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleCreateCrew}
                className="flex-1 py-3 bg-gradient-to-r from-[#3182F6] to-[#2563EB] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                크루 생성
              </button>
              <button
                onClick={() => {
                  setShowCreateCrew(false)
                  setOrgForm({ name: '', subtitle: '', description: '', categories: [], location: null })
                  setOrgAvatarFile(null)
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내 프로필 수정 모달 */}
      {editingMyProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#3182F6] text-white p-6">
              <h2 className="text-xl font-bold">내 프로필 수정</h2>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={myProfileForm.name}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={myProfileForm.gender}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                  value={myProfileForm.birthdate}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, birthdate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                      setMyProfileForm({ ...myProfileForm, location: e.target.value })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6] disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  value={myProfileForm.mbti}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
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
                        className="w-4 h-4 text-[#3182F6] border-gray-300 rounded focus:ring-[#3182F6]"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {myProfileForm.interestCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {myProfileForm.interestCategories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-[#3182F6] text-white text-xs rounded-full">
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

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMyProfile}
                className="flex-1 py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors"
              >
                저장
              </button>
              <button
                onClick={() => setEditingMyProfile(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 수정 모달 */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold">일정 수정</h2>
                <button
                  onClick={() => setEditingSchedule(null)}
                  className="text-white text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm opacity-90">{selectedOrg?.name}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={editScheduleForm.title}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value)
                    const days = ['일', '월', '화', '수', '목', '금', '토']
                    const month = selectedDate.getMonth() + 1
                    const day = selectedDate.getDate()
                    const dayOfWeek = days[selectedDate.getDay()]
                    const formattedDate = `${month}/${day}(${dayOfWeek})`
                    setEditScheduleForm({ ...editScheduleForm, date: formattedDate })
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {editScheduleForm.date && (
                  <p className="text-sm text-gray-600 mt-1">현재 날짜: {editScheduleForm.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시간 *</label>
                <input
                  type="time"
                  value={editScheduleForm.time}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">장소 *</label>
                <input
                  type="text"
                  value={editScheduleForm.location}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={editScheduleForm.type}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="오토캠핑">오토캠핑</option>
                  <option value="노지캠핑">노지캠핑</option>
                  <option value="백패킹">백패킹</option>
                  <option value="일반모임">일반모임</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">최대 인원 *</label>
                <input
                  type="number"
                  value={editScheduleForm.maxParticipants}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, maxParticipants: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateSchedule}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-colors"
              >
                수정 완료
              </button>
              <button
                onClick={() => setEditingSchedule(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 생성 모달 */}
      {showCreateSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-[#3182F6] text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold">일정 생성</h2>
                <button
                  onClick={() => setShowCreateSchedule(false)}
                  className="text-white text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <p className="text-sm opacity-90">{selectedOrg?.name}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={createScheduleForm.title}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, title: e.target.value })}
                  placeholder="예: 한강 캠핑"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={createScheduleForm.date}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value)
                    const days = ['일', '월', '화', '수', '목', '금', '토']
                    const month = selectedDate.getMonth() + 1
                    const day = selectedDate.getDate()
                    const dayOfWeek = days[selectedDate.getDay()]
                    const formattedDate = `${month}/${day}(${dayOfWeek})`
                    setCreateScheduleForm({ ...createScheduleForm, date: formattedDate })
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
                {createScheduleForm.date && (
                  <p className="text-sm text-gray-600 mt-1">선택된 날짜: {createScheduleForm.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시간 *</label>
                <input
                  type="time"
                  value={createScheduleForm.time}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">장소 *</label>
                <input
                  type="text"
                  value={createScheduleForm.location}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, location: e.target.value })}
                  placeholder="예: 한강공원 뚝섬유원지"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={createScheduleForm.type}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                >
                  <option value="">선택</option>
                  <option value="오토캠핑">오토캠핑</option>
                  <option value="노지캠핑">노지캠핑</option>
                  <option value="백패킹">백패킹</option>
                  <option value="일반모임">일반모임</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">최대 인원 *</label>
                <input
                  type="number"
                  value={createScheduleForm.maxParticipants}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, maxParticipants: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleCreateSchedule}
                disabled={!createScheduleForm.title || !createScheduleForm.date || !createScheduleForm.time || !createScheduleForm.location || !createScheduleForm.type}
                className="flex-1 py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                생성
              </button>
              <button
                onClick={() => setShowCreateSchedule(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - 토스 스타일 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E8EB] z-20 safe-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <div className="max-w-md mx-auto flex">
          {[
            { id: 'home' as Page, icon: Home, label: '홈' },
            { id: 'category' as Page, icon: Users, label: '크루찾기' },
            { id: 'mycrew' as Page, icon: Calendar, label: '내크루' },
            { id: 'myprofile' as Page, icon: User, label: '내정보' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                setCurrentPage(id)
                // 내크루 탭을 누르면 선택 초기화하여 크루 목록 표시 + 멤버 수 새로고침
                if (id === 'mycrew') {
                  setSelectedOrg(null)
                  fetchOrganizations() // 멤버 수 새로고침
                }
                // 홈 탭을 누르면 첫 번째 크루 자동 선택
                if (id === 'home' && organizations.length > 0 && !selectedOrg) {
                  setSelectedOrg(organizations[0])
                }
              }}
              className={`flex-1 py-3 flex flex-col items-center gap-1 active:scale-95 transition-all ${
                currentPage === id ? 'text-[#3182F6]' : 'text-[#8B95A1]'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={currentPage === id ? 2.5 : 2} />
              <span className={`text-[10px] ${currentPage === id ? 'font-bold' : 'font-medium'}`}>{label}</span>
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
    </div>
  )
}
