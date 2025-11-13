'use client'

import { useEffect, useState } from 'react'

export default function KakaoScriptLoader() {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || ''
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // SSR 체크
    if (typeof window === 'undefined') {
      console.log('⏭️ SSR 환경 - 스크립트 로드 건너뜀')
      return
    }

    // 이미 로드된 경우
    if ((window as any).kakao && (window as any).kakao.maps) {
      console.log('✅ Kakao Maps SDK 이미 로드됨')
      setIsLoaded(true)
      return
    }

    // 이미 스크립트 태그가 존재하는 경우
    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]')
    if (existingScript) {
      console.log('ℹ️ Kakao 스크립트 태그가 이미 존재함 - 로드 대기 중...')
      // 로드 완료 대기 (최대 5초)
      let checkCount = 0
      const checkInterval = setInterval(() => {
        checkCount++
        if ((window as any).kakao && (window as any).kakao.maps) {
          console.log('✅ 기존 스크립트 로드 완료!')
          setIsLoaded(true)
          clearInterval(checkInterval)
        } else if (checkCount >= 50) {
          console.error('⏱️ 기존 스크립트 로드 타임아웃 (5초 초과)')
          clearInterval(checkInterval)
          // 기존 스크립트 제거 후 재시도
          existingScript.remove()
          setLoadAttempt(prev => prev + 1)
        }
      }, 100)
      return
    }

    console.log(`🔄 Kakao Maps SDK 동적 로드 시작 (시도 ${loadAttempt + 1}/3)`)
    console.log('   API Key (앞 10자):', apiKey?.substring(0, 10) + '...')

    if (!apiKey || apiKey === 'YOUR_KAKAO_MAP_API_KEY_HERE') {
      console.error('❌ Kakao Maps API Key가 없습니다!')
      console.error('   .env.local 파일에 NEXT_PUBLIC_KAKAO_MAP_API_KEY를 설정하세요')
      return
    }

    // 동적 스크립트 추가
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`
    script.async = true
    script.defer = true

    script.onload = () => {
      console.log('✅✅✅ Kakao Maps SDK 스크립트 로드 완료!')
      console.log('   window.kakao:', typeof (window as any).kakao)

      if ((window as any).kakao && (window as any).kakao.maps) {
        console.log('   window.kakao.maps:', typeof (window as any).kakao.maps)

        // autoload=false이므로 수동으로 로드
        ;(window as any).kakao.maps.load(() => {
          console.log('🎉🎉🎉 Kakao Maps API 초기화 완료!')
          console.log('   services.Geocoder:', typeof (window as any).kakao.maps.services?.Geocoder)
          setIsLoaded(true)
        })
      } else {
        console.error('⚠️ 스크립트는 로드되었지만 window.kakao가 없습니다!')
        console.error('   ❗ 카카오 개발자 콘솔 확인 필요:')
        console.error('   1. https://developers.kakao.com/console/app')
        console.error('   2. 앱 선택 → 플랫폼 → Web 플랫폼 등록')
        console.error('   3. 사이트 도메인: http://localhost:3000 추가')
        console.error('   4. JavaScript 키 확인: ' + apiKey?.substring(0, 10) + '...')

        // 재시도 (최대 3번)
        if (loadAttempt < 2) {
          setTimeout(() => {
            script.remove()
            setLoadAttempt(prev => prev + 1)
          }, 2000)
        }
      }
    }

    script.onerror = (error) => {
      console.error('❌❌❌ Kakao Maps SDK 스크립트 로드 실패!')
      console.error('   Script src:', script.src)
      console.error('   Error:', error)
      console.error('   ❗ 체크리스트:')
      console.error('   1. 인터넷 연결 확인')
      console.error('   2. API 키 유효성 확인')
      console.error('   3. 카카오 개발자 콘솔에서 localhost:3000 플랫폼 등록 확인')
      console.error('   4. 브라우저 콘솔에서 네트워크 탭 확인')

      // 재시도 (최대 3번)
      if (loadAttempt < 2) {
        console.log(`   🔄 ${2 - loadAttempt}초 후 재시도...`)
        setTimeout(() => {
          script.remove()
          setLoadAttempt(prev => prev + 1)
        }, 2000)
      } else {
        console.error('   ❌ 최대 재시도 횟수 초과 (3회)')
        console.error('   ⚠️ 카카오 개발자 콘솔 설정을 확인하세요!')
      }
    }

    document.head.appendChild(script)

    // 클린업
    return () => {
      // 컴포넌트 언마운트 시 스크립트는 유지 (재사용을 위해)
    }
  }, [apiKey, loadAttempt])

  // 로드 상태 UI (선택적)
  if (!isLoaded && typeof window !== 'undefined') {
    console.log('⏳ Kakao Maps SDK 로딩 중...')
  }

  return null
}
