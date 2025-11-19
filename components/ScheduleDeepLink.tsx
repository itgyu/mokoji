'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

interface Schedule {
  id: string
  orgId?: string
  [key: string]: any
}

interface Organization {
  id: string
  name: string
  [key: string]: any
}

interface ScheduleDeepLinkProps {
  schedules: Schedule[]
  selectedSchedule: Schedule | null
  setSelectedSchedule: (schedule: Schedule) => void
  organizations: Organization[]
  setSelectedOrg: (org: Organization) => void
}

export default function ScheduleDeepLink({
  schedules,
  selectedSchedule,
  setSelectedSchedule,
  organizations,
  setSelectedOrg
}: ScheduleDeepLinkProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const [notFoundMessage, setNotFoundMessage] = useState('')

  // URL에서 scheduleId를 가져와서 Firestore에서 일정 조회 후 해당 크루 선택
  useEffect(() => {
    const scheduleId = searchParams.get('schedule')
    if (scheduleId && !targetScheduleId && organizations.length > 0) {
      console.log('🔗 Deep link detected:', scheduleId)
      setTargetScheduleId(scheduleId)
      setShowLoading(true)

      // Firestore에서 일정 문서 직접 조회
      const fetchScheduleAndSelectOrg = async () => {
        try {
          const scheduleDoc = await getDoc(doc(db, 'org_schedules', scheduleId))
          if (scheduleDoc.exists()) {
            const scheduleData = scheduleDoc.data()
            const orgId = scheduleData.orgId
            console.log('📅 일정의 orgId:', orgId)

            // 해당 orgId의 크루 찾기
            const targetOrg = organizations.find(org => org.id === orgId)
            if (targetOrg) {
              console.log('🎯 크루 선택:', targetOrg.name)
              setSelectedOrg(targetOrg)
            } else {
              console.log('⚠️ 해당 크루를 찾을 수 없음')
              setNotFoundMessage('크루를 찾을 수 없습니다.')
              setShowLoading(false)
              setTargetScheduleId(null)
            }
          } else {
            console.log('⚠️ 일정 문서가 존재하지 않음')
            setNotFoundMessage('일정을 찾을 수 없습니다.')
            setShowLoading(false)
            setTargetScheduleId(null)
          }
        } catch (error) {
          console.error('❌ 일정 조회 오류:', error)
          setNotFoundMessage('일정을 불러오는 중 오류가 발생했습니다.')
          setShowLoading(false)
          setTargetScheduleId(null)
        }
      }

      fetchScheduleAndSelectOrg()

      // URL 파라미터를 즉시 제거하여 깔끔하게 유지
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, targetScheduleId, organizations, setSelectedOrg, router])

  // schedules가 로드되면 해당 일정 열기
  useEffect(() => {
    if (targetScheduleId && schedules.length > 0 && !selectedSchedule) {
      console.log('📅 Looking for schedule:', targetScheduleId, 'in', schedules.length, 'schedules')
      const schedule = schedules.find(s => s.id === targetScheduleId)
      if (schedule) {
        console.log('✅ Schedule found, opening modal')
        setSelectedSchedule(schedule)
        setTargetScheduleId(null)
        setShowLoading(false)
      } else {
        console.log('⚠️ Schedule not found in loaded schedules')
      }
    }
  }, [targetScheduleId, schedules, selectedSchedule, setSelectedSchedule])

  // 10초 후에도 찾지 못하면 타임아웃
  useEffect(() => {
    if (targetScheduleId && showLoading) {
      const timeout = setTimeout(() => {
        if (targetScheduleId) {
          console.log('⏱️ Timeout: Schedule not found after 10 seconds')
          setNotFoundMessage('일정을 찾을 수 없습니다. 페이지를 새로고침해보세요.')
          setShowLoading(false)
          setTargetScheduleId(null)
        }
      }, 10000) // 10초

      return () => clearTimeout(timeout)
    }
  }, [targetScheduleId, showLoading])

  if (showLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 m-4 max-w-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-emerald-500"></div>
            <p className="text-gray-700 font-medium">일정을 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (notFoundMessage) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50">
        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
          <span>{notFoundMessage}</span>
          <button
            onClick={() => setNotFoundMessage('')}
            className="ml-2 text-white hover:text-red-100"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}
