'use client'

import { useEffect } from 'react'
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

  useEffect(() => {
    const scheduleId = searchParams.get('schedule')
    if (scheduleId && schedules.length > 0 && !selectedSchedule) {
      const schedule = schedules.find(s => s.id === scheduleId)
      if (schedule) {
        setSelectedSchedule(schedule)
        // URL 파라미터 제거하여 깔끔하게 유지
        router.replace('/dashboard', { scroll: false })
      }
    }
  }, [searchParams, schedules, selectedSchedule, router, setSelectedSchedule])

  return null
}
