'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { Home, Users, Calendar, User, MapPin, Bell, Settings } from 'lucide-react'

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
  category: string
  avatar?: string
  memberCount?: number
}

export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
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
    mbti: ''
  })
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchOrganizations()
    }
  }, [user])

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
    if (selectedSchedule) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedSchedule])

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

  const fetchMembers = async (orgId: string) => {
    try {
      console.log('🔍 ===== 멤버 조회 시작 =====')
      console.log('orgId:', orgId)

      // userProfiles의 organizations 배열로 크루 멤버 찾기
      const userProfilesRef = collection(db, 'userProfiles')
      const userProfilesSnapshot = await getDocs(userProfilesRef)

      const memberUids: string[] = []
      userProfilesSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.organizations && Array.isArray(data.organizations) && data.organizations.includes(orgId)) {
          memberUids.push(doc.id)
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
          fetchedMembers.push({ id: doc.id, ...data } as Member)
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
        setEditForm({
          name: member.name || '',
          gender: data.gender || '',
          birthdate: data.birthdate || '',
          location: data.location || '',
          mbti: data.mbti || ''
        })
      } else {
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

  const handleUpdateMyProfile = async () => {
    if (!user) return

    try {
      // userProfiles 업데이트
      const userProfileRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, {
        name: myProfileForm.name,
        gender: myProfileForm.gender,
        birthdate: myProfileForm.birthdate,
        location: myProfileForm.location,
        mbti: myProfileForm.mbti.toUpperCase()
      })

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
    const shareText = `⛺ ${schedule.title}

📅 일시: ${formatDateWithYear(schedule.date)} ${schedule.time}
📍 장소: ${schedule.location}
🎯 벙주: ${schedule.createdBy || '정보 없음'}
👥 참여 인원: ${schedule.participants?.length || 0} / ${schedule.maxParticipants}명

It's Campers와 함께하는 캠핑 일정에 참여하세요!`

    // Web Share API 사용 (모바일에서 카카오톡 포함 공유 가능)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `⛺ ${schedule.title}`,
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
        return 'bg-emerald-100 text-emerald-700' // 기본값 (기존 데이터용)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500 mx-auto mb-4"></div>
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
      {/* Home Page */}
      {currentPage === 'home' && (
        <div>
          <header className="sticky top-0 bg-white shadow-sm z-10 safe-top">
            <div className="px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-emerald-600" />
                <span className="font-bold text-xl">{profile.location}</span>
              </div>
              <div className="flex gap-2">
                <button className="p-3 hover:bg-gray-100 rounded-full active:scale-95 transition-transform">
                  <Bell className="w-6 h-6" />
                </button>
                <button className="p-3 hover:bg-gray-100 rounded-full active:scale-95 transition-transform">
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-4 space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Home className="w-6 h-6" />
                내 지역 모임
              </h2>
              <p className="text-gray-600 text-base leading-relaxed">
                내 지역과 관심사를 기반으로<br />
                맞춤 모임을 추천해드립니다.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  다가오는 일정
                </h2>
                <button
                  onClick={() => setCurrentPage('mycrew')}
                  className="text-emerald-600 text-sm font-bold hover:underline active:scale-95 transition-transform px-2 py-1"
                >
                  전체보기 →
                </button>
              </div>
              {mySchedules.length === 0 ? (
                <p className="text-gray-400 text-center py-8">참여 중인 일정이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {mySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className="border-2 border-gray-200 rounded-2xl p-5 active:border-emerald-500 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <p className="text-base text-gray-600 mb-1">📅 {formatDateWithYear(schedule.date)} {schedule.time}</p>
                      <p className="text-base text-gray-600 mb-1">📍 {schedule.location}</p>
                      <p className="text-base text-gray-600 mb-1">🎯 벙주: {schedule.createdBy}</p>
                      <p className="text-base text-gray-600 mt-3">
                        👥 {schedule.participants?.length || 0}/{schedule.maxParticipants}명
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Page */}
      {currentPage === 'category' && (
        <div>
          <header className="sticky top-0 bg-white shadow-sm z-10 safe-top">
            <div className="px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-emerald-600" />
                <span className="font-bold text-xl">{profile.location}</span>
              </div>
              <div className="flex gap-2">
                <button className="p-3 hover:bg-gray-100 rounded-full active:scale-95 transition-transform">
                  <Bell className="w-6 h-6" />
                </button>
                <button className="p-3 hover:bg-gray-100 rounded-full active:scale-95 transition-transform">
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            </div>
          </header>

          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">카테고리</h2>
            <div className="space-y-3">
              {[
                { icon: '⛺', title: '캠핑', desc: '오토캠핑, 백패킹, 노지캠핑' },
                { icon: '🏃', title: '러닝', desc: '조깅, 마라톤, 트레일 러닝' },
                { icon: '📚', title: '독서', desc: '독서 모임, 작가와의 만남' }
              ].map((category, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <h3 className="text-xl font-bold mb-2">
                    <span className="mr-2">{category.icon}</span>
                    {category.title}
                  </h3>
                  <p className="text-gray-600 text-sm">{category.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My Crew Page */}
      {currentPage === 'mycrew' && !selectedOrg && (
        <div>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
            <h1 className="text-2xl font-bold tracking-wide">MY CREW</h1>
            <p className="text-sm opacity-90 mt-1">가입한 크루 목록</p>
          </div>

          <div className="p-4 space-y-3">
            {organizations.length === 0 ? (
              <p className="text-gray-400 text-center py-8">가입한 크루가 없습니다.</p>
            ) : (
              organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => {
                    console.log('🖱️ 크루 선택됨:', org.name, 'ID:', org.id)
                    setSelectedOrg(org)
                  }}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-3xl overflow-hidden">
                      {org.avatar ? (
                        <img src={org.avatar} alt={org.name} className="w-full h-full object-cover" />
                      ) : (
                        '⛺'
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1">{org.name}</h3>
                      <p className="text-sm text-gray-600">{org.description || org.category}</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        👥 {orgMemberCounts[org.id] !== undefined ? orgMemberCounts[org.id] : '계산중...'}명
                        {console.log('화면 렌더링:', org.name, 'ID:', org.id, '카운트:', orgMemberCounts[org.id], '전체:', orgMemberCounts)}
                      </p>
                    </div>
                    <div className="text-gray-400">→</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Crew Detail Page */}
      {currentPage === 'mycrew' && selectedOrg && (
        <div>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
            <button
              onClick={() => setSelectedOrg(null)}
              className="text-white text-2xl mb-4"
            >
              ←
            </button>
            <p className="text-sm opacity-90 mb-1 tracking-wide">OUTDOOR LIFE</p>
            <h1 className="text-2xl font-bold tracking-wide">{selectedOrg.name.toUpperCase()}</h1>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <button
                onClick={() => setScheduleFilter('all')}
                className={`rounded-xl p-4 text-center transition-all ${
                  scheduleFilter === 'all' ? 'bg-white/20 border-2 border-white/50' : 'bg-white/10 hover:bg-white/15'
                }`}
              >
                <div className="text-3xl font-bold">{upcomingSchedules.length}</div>
                <div className="text-sm mt-1">전체</div>
              </button>
              <button
                onClick={() => setScheduleFilter('joined')}
                className={`rounded-xl p-4 text-center transition-all ${
                  scheduleFilter === 'joined' ? 'bg-white/20 border-2 border-white/50' : 'bg-white/10 hover:bg-white/15'
                }`}
              >
                <div className="text-3xl font-bold">{mySchedules.length}</div>
                <div className="text-sm mt-1">참여 일정</div>
              </button>
              <button
                onClick={() => setScheduleFilter('not-joined')}
                className={`rounded-xl p-4 text-center transition-all ${
                  scheduleFilter === 'not-joined' ? 'bg-white/20 border-2 border-white/50' : 'bg-white/10 hover:bg-white/15'
                }`}
              >
                <div className="text-3xl font-bold">{upcomingSchedules.length - mySchedules.length}</div>
                <div className="text-sm mt-1">미참여 일정</div>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* 다가오는 일정 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 px-2">다가오는 일정</h3>
              <div className="space-y-3">
                {(() => {
                  let filteredSchedules = upcomingSchedules
                  if (scheduleFilter === 'joined') {
                    filteredSchedules = upcomingSchedules.filter(s => s.participants?.includes(profile.name))
                  } else if (scheduleFilter === 'not-joined') {
                    filteredSchedules = upcomingSchedules.filter(s => !s.participants?.includes(profile.name))
                  }

                  if (filteredSchedules.length === 0) {
                    return <p className="text-gray-400 text-center py-8">다가오는 일정이 없습니다.</p>
                  }

                  return filteredSchedules.map((schedule) => {
                  const isParticipating = schedule.participants?.includes(profile.name)
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => setSelectedSchedule(schedule)}
                      className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                        isParticipating ? 'border-2 border-emerald-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg">{schedule.title}</h3>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getTypeColor(schedule.type)}`}>
                          {schedule.type}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>📅 {formatDateWithYear(schedule.date)} {schedule.time}</p>
                        <p>📍 {schedule.location}</p>
                        <p>👥 {schedule.participants?.length || 0}/{schedule.maxParticipants}명</p>
                        <p>🎯 벙주: {schedule.createdBy}</p>
                      </div>
                      {isParticipating && (
                        <div className="mt-3 text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg font-semibold text-center">
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
              className="w-16 h-16 bg-white border-2 border-emerald-500 text-emerald-600 rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center"
            >
              <Users className="w-7 h-7" />
            </button>
            <button
              onClick={() => setShowCreateSchedule(true)}
              className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg text-3xl font-bold active:scale-95 transition-transform"
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
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
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
                          onClick={() => member.avatar && setSelectedAvatarUrl(member.avatar)}
                          className={`w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xl overflow-hidden ${member.avatar ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400' : ''}`}
                        >
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{member.name}</span>
                            {member.isCaptain && (
                              <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
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
                          <p className="text-xs text-gray-600 mt-0.5">
                            {daysSinceLastParticipation === null ? (
                              <span className="text-red-500">참여 이력 없음</span>
                            ) : daysSinceLastParticipation === 0 ? (
                              <span className="text-emerald-600 font-semibold">오늘 참여</span>
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
                              className="px-2 py-1 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
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

      {/* 일정 상세 모달 */}
      {selectedSchedule && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 py-8 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSchedule(null)
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold">{selectedSchedule.title}</h2>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  className="text-white text-2xl hover:opacity-80"
                >
                  ×
                </button>
              </div>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                {selectedSchedule.type}
              </span>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <div className="text-sm text-gray-500 mb-1">📅 일시</div>
                <div className="font-semibold">{formatDateWithYear(selectedSchedule.date)} {selectedSchedule.time}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-1">📍 장소</div>
                <div className="font-semibold">{selectedSchedule.location}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-1">🎯 벙주</div>
                <div className="font-semibold">{selectedSchedule.createdBy || '정보 없음'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-1">👥 참여 인원</div>
                <div className="font-semibold">
                  {selectedSchedule.participants?.length || 0} / {selectedSchedule.maxParticipants}명
                </div>
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSchedule.participants.map((name) => (
                      <div key={name} className="text-xs bg-gray-100 px-3 py-2 rounded flex items-center gap-2">
                        <span>{name}</span>
                        {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveParticipant(selectedSchedule, name)
                            }}
                            className="text-red-500 hover:text-red-700 font-bold text-base min-w-[20px] min-h-[20px] flex items-center justify-center"
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
                    className="mt-2 text-sm text-emerald-600 hover:underline font-medium py-1"
                  >
                    {managingParticipants ? '관리 종료' : '참석자 추가하기'}
                  </button>
                )}
                {managingParticipants && members.filter(m => !selectedSchedule.participants?.includes(m.name)).length > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto">
                    <div className="text-xs text-gray-600 mb-2">멤버를 클릭하여 추가:</div>
                    {members.filter(m => !selectedSchedule.participants?.includes(m.name)).map(member => (
                      <button
                        key={member.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddParticipant(selectedSchedule, member.name)
                        }}
                        className="text-sm bg-white px-3 py-2 rounded mr-2 mb-2 hover:bg-emerald-50 border border-gray-300 active:scale-95 transition-transform"
                      >
                        + {member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 댓글 섹션 */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">💬 댓글 ({selectedSchedule.comments?.length || 0})</div>
                {selectedSchedule.comments && selectedSchedule.comments.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                    {selectedSchedule.comments.map((comment, index) => (
                      <div key={`${comment.id}-${index}`} className="bg-gray-50 p-2 rounded text-sm relative">
                        <div className="flex justify-between items-start">
                          <div className="font-bold text-xs text-emerald-600">{comment.userName || '익명'}</div>
                          {(comment.userUid === user?.uid || userProfile?.role === 'captain' || userProfile?.role === 'staff') && (
                            <button
                              onClick={() => handleDeleteComment(selectedSchedule, comment.id)}
                              className="text-gray-400 hover:text-red-500 text-lg leading-none"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <div className="mt-1">{comment.text}</div>
                        <div className="text-xs text-gray-400 mt-1">
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => handleAddComment(selectedSchedule)}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600"
                  >
                    등록
                  </button>
                </div>
              </div>

              {/* 카카오톡 공유하기 버튼 */}
              <div className="pt-4 border-t">
                <button
                  onClick={() => handleShareSchedule(selectedSchedule)}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 py-3 rounded-lg font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md"
                >
                  <span className="text-xl">💬</span>
                  <span>카카오톡 공유하기</span>
                </button>
              </div>

              {/* 마스터(크루장/운영진) 또는 벙주만 수정/삭제 가능 */}
              {(userProfile?.role === 'captain' || userProfile?.role === 'staff' || selectedSchedule.createdByUid === user?.uid) && (
                <div className="pt-4 flex gap-2 border-t">
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
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors text-sm"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(selectedSchedule)}
                    className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              )}

              <div className="pt-4">
                {selectedSchedule.participants?.includes(profile.name) ? (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                  >
                    참여 취소
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleToggleParticipation(selectedSchedule)
                      setSelectedSchedule(null)
                    }}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-colors"
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

      {/* My Profile Page */}
      {currentPage === 'myprofile' && (
        <div>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
            <h1 className="text-2xl font-bold tracking-wide">MY PAGE</h1>
          </div>

          <div className="p-4">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-4xl overflow-hidden">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-1">{profile.name}</h2>
                <p className="text-gray-600 text-sm">{profile.email}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">생년월일</div>
                  <div className="font-semibold">{profile.birthdate}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">성별</div>
                  <div className="font-semibold">{profile.gender}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">지역</div>
                  <div className="font-semibold">{profile.location}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">MBTI</div>
                  <div className="font-semibold">{profile.mbti || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">가입일</div>
                  <div className="font-semibold">{profile.joinDate}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setMyProfileForm({
                      name: profile.name,
                      gender: profile.gender,
                      birthdate: profile.birthdate,
                      location: profile.location,
                      mbti: profile.mbti || ''
                    })
                    setEditingMyProfile(true)
                  }}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-lg font-semibold hover:bg-emerald-600"
                >
                  ✏️ 정보 수정
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600"
                >
                  🚪 로그아웃
                </button>
              </div>
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
                className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
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
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
              <h2 className="text-xl font-bold">멤버 정보 수정</h2>
              <p className="text-sm opacity-90 mt-1">{editingMemberInfo.name}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="서울 강남구"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={editForm.mbti}
                  onChange={(e) => setEditForm({ ...editForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMemberInfo}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-colors"
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

      {/* 내 프로필 수정 모달 */}
      {editingMyProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
              <h2 className="text-xl font-bold">내 프로필 수정</h2>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={myProfileForm.name}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성별 *</label>
                <select
                  value={myProfileForm.gender}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  type="text"
                  value={myProfileForm.location}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, location: e.target.value })}
                  placeholder="서울 강남구"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MBTI</label>
                <input
                  type="text"
                  value={myProfileForm.mbti}
                  onChange={(e) => setMyProfileForm({ ...myProfileForm, mbti: e.target.value })}
                  placeholder="ENFP"
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleUpdateMyProfile}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-colors"
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
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">장소 *</label>
                <input
                  type="text"
                  value={createScheduleForm.location}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, location: e.target.value })}
                  placeholder="예: 한강공원 뚝섬유원지"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={createScheduleForm.type}
                  onChange={(e) => setCreateScheduleForm({ ...createScheduleForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleCreateSchedule}
                disabled={!createScheduleForm.title || !createScheduleForm.date || !createScheduleForm.time || !createScheduleForm.location || !createScheduleForm.type}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-bottom">
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
              className={`flex-1 py-4 flex flex-col items-center gap-1.5 active:scale-95 transition-all ${
                currentPage === id ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <Icon className="w-7 h-7" strokeWidth={currentPage === id ? 2.5 : 2} />
              <span className={`text-xs ${currentPage === id ? 'font-semibold' : ''}`}>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
