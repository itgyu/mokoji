'use client'

import { useEffect, useState } from 'react'

export default function VersionChecker() {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(true)

  useEffect(() => {
    // 초기 버전 저장
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })
        const data = await response.json()

        if (!currentVersion) {
          // 처음 접속 시 현재 버전 저장
          setCurrentVersion(data.version)
          localStorage.setItem('app-version', data.version)
        } else if (data.version !== currentVersion) {
          // 버전이 다르면 업데이트 모달 표시
          setShowUpdateModal(true)
          setCountdown(10)
          setAutoReloadEnabled(true)
        }
      } catch (error) {
        console.error('버전 체크 실패:', error)
      }
    }

    // localStorage에서 저장된 버전 가져오기
    const savedVersion = localStorage.getItem('app-version')
    if (savedVersion) {
      setCurrentVersion(savedVersion)
    }

    // 초기 체크
    checkVersion()

    // 30초마다 버전 체크 (더 빠른 업데이트 감지)
    const interval = setInterval(checkVersion, 30 * 1000)

    return () => clearInterval(interval)
  }, [currentVersion])

  // 자동 새로고침 카운트다운
  useEffect(() => {
    if (showUpdateModal && autoReloadEnabled && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (showUpdateModal && autoReloadEnabled && countdown === 0) {
      handleReload()
    }
  }, [showUpdateModal, countdown, autoReloadEnabled])

  const handleReload = () => {
    // localStorage 업데이트 후 새로고침
    window.location.reload()
  }

  const handleCancel = () => {
    setAutoReloadEnabled(false)
    setShowUpdateModal(false)
  }

  if (!showUpdateModal) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm" />

      {/* 업데이트 모달 */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-slideUp">
          {/* 아이콘 */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF9B50] to-[#FF8A3D] flex items-center justify-center shadow-lg">
              <span className="text-4xl">✨</span>
            </div>
          </div>

          {/* 제목 */}
          <h2 className="text-2xl font-bold text-center text-[#292524] mb-3">
            새로운 버전이 있어요!
          </h2>

          {/* 설명 */}
          <p className="text-center text-[#78716C] mb-6">
            모꼬지가 업데이트되었습니다.<br />
            최신 기능을 사용하려면 새로고침이 필요해요.
          </p>

          {/* 카운트다운 */}
          {autoReloadEnabled && (
            <div className="bg-[#FFF5ED] rounded-2xl p-4 mb-6 text-center">
              <p className="text-sm text-[#CC5A18] font-semibold">
                {countdown}초 후 자동으로 새로고침됩니다
              </p>
              <div className="mt-3 h-2 bg-[#FFE8D5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF9B50] to-[#FF8A3D] transition-all duration-1000"
                  style={{ width: `${(10 - countdown) * 10}%` }}
                />
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-3 rounded-xl border-2 border-[#E7E5E4] text-[#78716C] font-semibold hover:bg-[#F5F5F4] transition-colors"
            >
              나중에
            </button>
            <button
              onClick={handleReload}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF9B50] to-[#FF8A3D] text-white font-semibold hover:shadow-lg transition-all active:scale-95"
            >
              지금 새로고침
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
