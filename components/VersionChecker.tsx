'use client'

import { useEffect, useState, useRef } from 'react'

export default function VersionChecker() {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(true)

  // ref로 버전 관리 (re-render 방지)
  const currentVersionRef = useRef<string | null>(null)
  const hasShownModalRef = useRef(false)
  const isCheckingRef = useRef(false)

  useEffect(() => {
    const checkVersion = async () => {
      // 이미 체크 중이거나 모달이 표시되었으면 스킵
      if (isCheckingRef.current || hasShownModalRef.current) return

      isCheckingRef.current = true

      try {
        const response = await fetch('/version.json?' + Date.now(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })
        const data = await response.json()
        const serverVersion = data.version

        if (!currentVersionRef.current) {
          // 처음 접속 시 현재 버전 저장
          currentVersionRef.current = serverVersion
          localStorage.setItem('app-version', serverVersion)
        } else if (serverVersion !== currentVersionRef.current && !hasShownModalRef.current) {
          // 버전이 다르고 아직 모달을 안 보여줬으면 업데이트 모달 표시
          hasShownModalRef.current = true
          setShowUpdateModal(true)
          setCountdown(10)
          setAutoReloadEnabled(true)
        }
      } catch (error) {
        console.error('버전 체크 실패:', error)
      } finally {
        isCheckingRef.current = false
      }
    }

    // localStorage에서 저장된 버전 가져오기 (처음 한 번만)
    if (!currentVersionRef.current) {
      const savedVersion = localStorage.getItem('app-version')
      if (savedVersion) {
        currentVersionRef.current = savedVersion
      }
    }

    // 초기 체크
    checkVersion()

    // 10초마다 버전 체크
    const interval = setInterval(checkVersion, 10 * 1000)

    return () => clearInterval(interval)
  }, []) // dependency 없음 - 한 번만 실행

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
    // 새 버전으로 localStorage 업데이트 (새로고침 후 또 모달 뜨는 것 방지)
    fetch('/version.json?' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        localStorage.setItem('app-version', data.version)
      })
      .finally(() => {
        // 캐시 완전 삭제 후 새로고침
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name))
          })
        }
        // 하드 리로드 (캐시 무시)
        window.location.reload()
      })
  }

  const handleCancel = () => {
    setAutoReloadEnabled(false)
    setShowUpdateModal(false)
    // 취소해도 다시 안 뜨도록
    hasShownModalRef.current = true
  }

  if (!showUpdateModal) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/50 z-[100]" />

      {/* 업데이트 모달 */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-slideUp">
          {/* 헤더 */}
          <div className="bg-[#5f0080] px-5 py-4">
            <h2 className="text-lg font-semibold text-white">새로운 버전이 있어요!</h2>
          </div>

          {/* 컨텐츠 */}
          <div className="p-5">
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              모꼬지가 업데이트되었습니다.<br />
              최신 기능을 사용하려면 새로고침이 필요해요.
            </p>

            {/* 카운트다운 */}
            {autoReloadEnabled && (
              <div className="bg-[#f3e8f7] rounded-xl p-4 mb-4">
                <p className="text-sm text-[#5f0080] font-medium text-center mb-2">
                  {countdown}초 후 자동으로 새로고침됩니다
                </p>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5f0080] transition-all duration-1000 ease-linear"
                    style={{ width: `${(10 - countdown) * 10}%` }}
                  />
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                나중에
              </button>
              <button
                onClick={handleReload}
                className="flex-1 h-12 rounded-xl bg-[#5f0080] text-sm font-medium text-white hover:bg-[#4a0066] active:scale-[0.98] transition-all"
              >
                지금 새로고침
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
