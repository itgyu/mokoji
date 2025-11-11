'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Schedule {
  id: string
  [key: string]: any
}

interface ScheduleDeepLinkProps {
  schedules: Schedule[]
  selectedSchedule: Schedule | null
  setSelectedSchedule: (schedule: Schedule) => void
}

export default function ScheduleDeepLink({
  schedules,
  selectedSchedule,
  setSelectedSchedule
}: ScheduleDeepLinkProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null)

  // URL에서 scheduleId를 가져와서 저장
  useEffect(() => {
    const scheduleId = searchParams.get('schedule')
    if (scheduleId && !targetScheduleId) {
      console.log('🔗 Deep link detected:', scheduleId)
      setTargetScheduleId(scheduleId)
      // URL 파라미터를 즉시 제거하여 깔끔하게 유지
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, targetScheduleId, router])

  // schedules가 로드되면 해당 일정 열기
  useEffect(() => {
    if (targetScheduleId && schedules.length > 0 && !selectedSchedule) {
      console.log('📅 Looking for schedule:', targetScheduleId)
      const schedule = schedules.find(s => s.id === targetScheduleId)
      if (schedule) {
        console.log('✅ Schedule found, opening modal')
        setSelectedSchedule(schedule)
        setTargetScheduleId(null) // 성공적으로 열었으면 초기화
      } else {
        console.log('⚠️ Schedule not found in loaded schedules')
      }
    }
  }, [targetScheduleId, schedules, selectedSchedule, setSelectedSchedule])

  return null
}
