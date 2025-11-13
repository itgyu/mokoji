'use client'

import { useState } from 'react'
import { getCurrentPosition, getAddressFromCoords, getDaysUntilExpiry, isLocationExpired } from '@/lib/location-utils'
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth, type UserLocation } from '@/contexts/AuthContext'

export default function LocationVerification({ onSuccess }: { onSuccess?: () => void }) {
  const { user, userProfile, refreshUserProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerifyLocation = async () => {
    if (!user) {
      setError('로그인이 필요합니다.')
      return
    }

    // 최대 2개까지만 등록 가능
    if (userProfile?.locations && userProfile.locations.length >= 2) {
      setError('최대 2개 지역까지만 등록 가능합니다.')
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('📍 Step 1: 현재 위치 가져오기...')
      const { latitude, longitude } = await getCurrentPosition()

      console.log('🗺️ Step 2: 주소 변환 중...')
      const { address, sido, sigungu, dong } = await getAddressFromCoords(
        latitude,
        longitude
      )

      // 지역 이름 결정
      const locationName = !userProfile?.locations || userProfile.locations.length === 0
        ? '집'
        : '직장'

      // Firestore에 저장할 데이터
      const locationData: UserLocation = {
        id: `loc_${Date.now()}`,
        name: locationName,
        address,
        sido,
        sigungu,
        dong,
        latitude,
        longitude,
        verifiedAt: new Date(),
        isPrimary: !userProfile?.locations || userProfile.locations.length === 0,
      }

      console.log('💾 Step 3: Firestore에 저장 중...')
      const userRef = doc(db, 'userProfiles', user.uid)

      await updateDoc(userRef, {
        locations: arrayUnion({
          ...locationData,
          verifiedAt: Timestamp.fromDate(locationData.verifiedAt)
        }),
        // 첫 번째 지역이면 자동으로 선택
        ...((!userProfile?.locations || userProfile.locations.length === 0) && {
          selectedLocationId: locationData.id
        })
      })

      console.log('✅ 위치 인증 완료!')

      // 프로필 새로고침
      await refreshUserProfile()

      if (onSuccess) {
        onSuccess()
      }

      alert(`✅ 인증 완료!\n\n"${dong}"가 내 동네로 설정되었습니다.`)

    } catch (error: any) {
      console.error('❌ 위치 인증 실패:', error)
      setError(error.message || '위치 인증에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!user || !userProfile?.locations) return

    try {
      setLoading(true)
      setError('')

      const newLocations = userProfile.locations
        .filter(loc => loc.id !== locationId)
        .map(loc => ({
          ...loc,
          verifiedAt: Timestamp.fromDate(loc.verifiedAt)
        }))

      const userRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userRef, {
        locations: newLocations,
        // 삭제한 지역이 선택된 지역이면 첫 번째 지역으로 변경
        ...(userProfile.selectedLocationId === locationId && newLocations.length > 0 && {
          selectedLocationId: newLocations[0].id
        })
      })

      await refreshUserProfile()
      alert('지역이 삭제되었습니다.')

    } catch (error: any) {
      console.error('❌ 지역 삭제 실패:', error)
      setError('지역 삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLocation = async (locationId: string) => {
    if (!user) return

    try {
      const userRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userRef, {
        selectedLocationId: locationId
      })
      await refreshUserProfile()
    } catch (error) {
      console.error('❌ 지역 선택 실패:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* 등록된 지역 목록 */}
      {userProfile?.locations && userProfile.locations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">내 동네</h3>
          {userProfile.locations.map((location) => {
            const expired = isLocationExpired(location.verifiedAt)
            const daysLeft = getDaysUntilExpiry(location.verifiedAt)
            const isSelected = location.id === userProfile.selectedLocationId

            return (
              <div
                key={location.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {location.name}
                      </span>
                      {isSelected && (
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          선택됨
                        </span>
                      )}
                      {expired && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          재인증 필요
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{location.dong}</p>
                    <p className="text-xs text-gray-500">
                      {expired ? (
                        <span className="text-red-600 font-medium">
                          인증 만료 (30일 경과)
                        </span>
                      ) : (
                        `${daysLeft}일 후 재인증 필요`
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!isSelected && (
                      <button
                        onClick={() => handleSelectLocation(location.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        선택
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('이 지역을 삭제하시겠습니까?')) {
                          handleDeleteLocation(location.id)
                        }
                      }}
                      disabled={loading}
                      className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 새 지역 인증 버튼 */}
      {(!userProfile?.locations || userProfile.locations.length < 2) && (
        <button
          onClick={handleVerifyLocation}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>위치 인증 중...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">📍</span>
              <span>현재 위치로 {userProfile?.locations?.length === 0 ? '첫 ' : ''}동네 인증하기</span>
            </div>
          )}
        </button>
      )}

      {/* 안내 문구 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-xs text-blue-800 leading-relaxed">
          ℹ️ 내 동네 인증은 현재 위치를 기반으로 진행되며, 실제로 해당 지역에 있어야만 인증할 수 있습니다.
          인증은 30일마다 갱신이 필요하며, 최대 2개 지역까지 등록 가능합니다.
        </p>
      </div>
    </div>
  )
}
