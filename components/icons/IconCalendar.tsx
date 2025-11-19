import { Calendar } from 'lucide-react'
import { iconStyles } from '@/lib/design-system'

interface IconCalendarProps {
  size?: keyof typeof iconStyles.size
  className?: string
}

export function IconCalendar({ size = 'md', className }: IconCalendarProps) {
  return (
    <Calendar
      className={`${iconStyles.size[size]} text-[#FF9B50] ${className || ''}`}
      strokeWidth={2}
    />
  )
}
