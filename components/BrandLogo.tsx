/**
 * 모꼬지 브랜드 로고 컴포넌트
 * 전문적이고 세련된 로고 디자인
 */

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'white'
}

export function BrandLogo({ size = 'md', variant = 'default' }: BrandLogoProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  }

  const iconSize = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-[#FF9B50] to-[#FF8A3D] flex items-center justify-center shadow-lg relative overflow-hidden`}>
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
          <circle cx="20" cy="20" r="15" fill="white" />
          <circle cx="80" cy="80" r="15" fill="white" />
          <circle cx="50" cy="50" r="20" fill="white" opacity="0.5" />
        </svg>
      </div>

      {/* 모임 아이콘 - 사람들이 모이는 모습 */}
      <svg
        className={`${iconSize[size]} ${variant === 'white' ? 'text-white' : 'text-white'} relative z-10`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 000 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0020 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
      </svg>
    </div>
  )
}
