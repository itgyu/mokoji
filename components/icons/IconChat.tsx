import { MessageCircle } from 'lucide-react'
import { iconStyles } from '@/lib/design-system'

interface IconChatProps {
  size?: keyof typeof iconStyles.size
  className?: string
}

export function IconChat({ size = 'md', className }: IconChatProps) {
  return (
    <MessageCircle
      className={`${iconStyles.size[size]} text-[#FF9B50] ${className || ''}`}
      strokeWidth={2}
    />
  )
}
