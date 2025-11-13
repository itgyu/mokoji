/**
 * 위치 기반 유틸리티 함수 모음
 * - GPS 위치 가져오기
 * - 역지오코딩 (좌표 → 주소 변환)
 * - 거리 계산
 * - 인증 만료 확인
 */

/**
 * 현재 위치 가져오기 (Geolocation API)
 * @returns {Promise<{latitude: number, longitude: number}>}
 * @throws {Error} 위치 권한 거부, GPS 사용 불가 등
 */
export async function getCurrentPosition(): Promise<{
  latitude: number
  longitude: number
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('위치 서비스를 지원하지 않는 브라우저입니다.'))
      return
    }

    console.log('📍 위치 정보 요청 중...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ 위치 정보 획득 성공:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.error('❌ 위치 정보 획득 실패:', error)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('위치 정보를 사용할 수 없습니다. GPS가 켜져 있는지 확인해주세요.'))
            break
          case error.TIMEOUT:
            reject(new Error('위치 정보 요청 시간이 초과되었습니다. 다시 시도해주세요.'))
            break
          default:
            reject(new Error('알 수 없는 오류가 발생했습니다.'))
        }
      },
      {
        enableHighAccuracy: true, // 높은 정확도 요청
        timeout: 10000, // 10초 타임아웃
        maximumAge: 0, // 캐시 사용 안 함
      }
    )
  })
}

/**
 * 카카오 지도 API로 좌표를 주소로 변환 (역지오코딩)
 * @param {number} latitude - 위도
 * @param {number} longitude - 경도
 * @returns {Promise<{address: string, sido: string, sigungu: string, dong: string}>}
 * @throws {Error} API 로드 실패, 주소 변환 실패 등
 */
export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<{
  address: string
  sido: string
  sigungu: string
  dong: string
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.kakao) {
      reject(new Error('Kakao Maps API가 로드되지 않았습니다.'))
      return
    }

    console.log('🗺️ 주소 변환 시작:', { latitude, longitude })

    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder()

      geocoder.coord2Address(longitude, latitude, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const address = result[0].address

          console.log('✅ 주소 변환 성공:', {
            full: address.address_name,
            sido: address.region_1depth_name,
            sigungu: address.region_2depth_name,
            dong: address.region_3depth_name,
          })

          resolve({
            address: address.address_name,
            sido: address.region_1depth_name,
            sigungu: address.region_2depth_name,
            dong: address.region_3depth_name,
          })
        } else {
          console.error('❌ 주소 변환 실패:', status)
          reject(new Error('주소 변환에 실패했습니다. 다시 시도해주세요.'))
        }
      })
    })
  })
}

/**
 * 두 좌표 사이의 거리 계산 (Haversine Formula)
 * @param {number} lat1 - 위도 1
 * @param {number} lon1 - 경도 1
 * @param {number} lat2 - 위도 2
 * @param {number} lon2 - 경도 2
 * @returns {number} 거리 (km)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

/**
 * 각도를 라디안으로 변환
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * 거리를 읽기 쉬운 문자열로 변환
 * @param {number} distanceKm - 거리 (km)
 * @returns {string} "500m" 또는 "2.3km"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`
  }
  return `${distanceKm.toFixed(1)}km`
}

/**
 * 인증 만료 여부 확인 (30일 기준)
 * @param {Date} verifiedAt - 인증 시각
 * @returns {boolean} 만료 여부
 */
export function isLocationExpired(verifiedAt: Date): boolean {
  const now = new Date()
  const diffDays = (now.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 30
}

/**
 * 재인증까지 남은 일수 계산
 * @param {Date} verifiedAt - 인증 시각
 * @returns {number} 남은 일수
 */
export function getDaysUntilExpiry(verifiedAt: Date): number {
  const now = new Date()
  const diffDays = (now.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  const remaining = 30 - Math.floor(diffDays)
  return remaining > 0 ? remaining : 0
}
