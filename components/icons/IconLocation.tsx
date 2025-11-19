import { MapPin } from 'lucide-react'
import { iconStyles } from '@/lib/design-system'

interface IconLocationProps {
  size?: keyof typeof iconStyles.size
  className?: string
}

export function IconLocation({ size = 'md', className }: IconLocationProps) {
  return (
    <MapPin
      className={`${iconStyles.size[size]} text-[#FF9B50] ${className || ''}`}
      strokeWidth={2}
    />
  )
}
