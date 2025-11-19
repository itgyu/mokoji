import { User } from 'lucide-react'
import { iconStyles } from '@/lib/design-system'

interface IconUserProps {
  size?: keyof typeof iconStyles.size
  className?: string
}

export function IconUser({ size = 'md', className }: IconUserProps) {
  return (
    <User
      className={`${iconStyles.size[size]} text-[#FF9B50] ${className || ''}`}
      strokeWidth={2}
    />
  )
}
