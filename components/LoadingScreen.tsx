'use client'

import { Logo } from './Logo'

/**
 * MOKKOJI LoadingScreen - Kurly-inspired Design System
 *
 * Clean, minimal loading screen with purple brand color
 */
export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FAFAFA]">
      {/* 로딩 스피너 */}
      <div className="mb-6">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-[#5f0080] rounded-full animate-spin" />
      </div>

      {/* 브랜드명 */}
      <Logo size="lg" color="primary" />
    </div>
  )
}
