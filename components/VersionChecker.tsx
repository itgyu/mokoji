'use client'

import { useEffect, useState } from 'react'

export default function VersionChecker() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)

  useEffect(() => {
    // 초기 버전 저장
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        const data = await response.json()

        if (!currentVersion) {
          // 처음 접속 시 현재 버전 저장
          setCurrentVersion(data.version)
          localStorage.setItem('app-version', data.version)
        } else if (data.version !== currentVersion) {
          // 버전이 다르면 업데이트 배너 표시
          setShowUpdateBanner(true)
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

    // 3분마다 버전 체크
    const interval = setInterval(checkVersion, 3 * 60 * 1000)

    return () => clearInterval(interval)
  }, [currentVersion])

  const handleReload = () => {
    // 캐시 완전히 무시하고 새로고침
    window.location.reload()
  }

  if (!showUpdateBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <div>
            <p className="font-semibold">새로운 버전이 출시되었습니다!</p>
            <p className="text-sm text-white/90">새로고침하여 최신 기능을 사용하세요.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReload}
            className="bg-white text-emerald-600 font-semibold px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={() => setShowUpdateBanner(false)}
            className="text-white/80 hover:text-white px-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
