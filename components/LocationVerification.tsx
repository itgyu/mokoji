'use client'

import { useState } from 'react'
import { getCurrentPosition, getAddressFromCoords, getDaysUntilExpiry, isLocationExpired } from '@/lib/location-utils'
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth, type UserLocation } from '@/contexts/AuthContext'

export default function LocationVerification({
  onSuccess,
  onOpenMap
}: {
  onSuccess?: () => void
  onOpenMap?: () => void
}) {
  const { user, userProfile, refreshUserProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState<{ dong: string } | null>(null)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

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

      console.log('📍 Step 1: GPS로 현재 위치 가져오기...')
      const { latitude, longitude } = await getCurrentPosition()
      console.log('✅ GPS 위치 획득:', { latitude, longitude })

      console.log('🗺️ Step 2: 카카오 API로 주소 변환 중...')
      const { address, sido, sigungu, dong } = await getAddressFromCoords(
        latitude,
        longitude
      )
      console.log('✅ 주소 변환 완료:', { address, sido, sigungu, dong })

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

      // 성공 메시지 표시
      setSuccessMessage({ dong })

      // 3초 후 자동으로 메시지 숨김
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)

      if (onSuccess) {
        onSuccess()
      }

    } catch (error: any) {
      console.error('❌ 위치 인증 실패:', error)

      // 에러 메시지를 명확하게
      let errorMessage = error.message || '위치 인증에 실패했습니다.'

      if (error.message?.includes('권한')) {
        errorMessage = '위치 권한이 거부되었습니다.\n브라우저 설정에서 위치 권한을 허용해주세요.'
      } else if (error.message?.includes('Kakao') || error.message?.includes('API')) {
        errorMessage = 'Kakao Maps API 로드에 실패했습니다.\n.env.local 파일의 NEXT_PUBLIC_KAKAO_MAP_API_KEY를 확인하거나\n페이지를 새로고침 후 다시 시도해주세요.'
      } else if (error.message?.includes('시간')) {
        errorMessage = '위치 정보 요청 시간이 초과되었습니다.\n다시 시도해주세요.'
      }

      setError(errorMessage)
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

  const handleStartEdit = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId)
    setEditingName(currentName)
  }

  const handleCancelEdit = () => {
    setEditingLocationId(null)
    setEditingName('')
  }

  const handleSaveLocationName = async (locationId: string) => {
    if (!user || !userProfile?.locations || !editingName.trim()) return

    try {
      setLoading(true)

      // 새 이름으로 업데이트된 지역 배열 생성
      const updatedLocations = userProfile.locations.map(loc => {
        if (loc.id === locationId) {
          return {
            ...loc,
            name: editingName.trim(),
            verifiedAt: Timestamp.fromDate(loc.verifiedAt)
          }
        }
        return {
          ...loc,
          verifiedAt: Timestamp.fromDate(loc.verifiedAt)
        }
      })

      const userRef = doc(db, 'userProfiles', user.uid)
      await updateDoc(userRef, {
        locations: updatedLocations
      })

      await refreshUserProfile()
      setEditingLocationId(null)
      setEditingName('')
    } catch (error: any) {
      console.error('❌ 지역 이름 수정 실패:', error)
      setError('지역 이름 수정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 인증 완료 메시지 - 당근마켓 스타일 */}
      {successMessage && (
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-400 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg animate-[slideDown_0.3s_ease-out]">
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-emerald-200/20 rounded-full -mr-12 sm:-mr-16 -mt-12 sm:-mt-16"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 sm:w-24 sm:h-24 bg-green-200/20 rounded-full -ml-10 sm:-ml-12 -mb-10 sm:-mb-12"></div>
          <div className="relative flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-emerald-900 mb-0.5 sm:mb-1">
                {successMessage.dong} 인증완료!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-700 font-medium">
                내 동네로 설정되었습니다
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 등록된 지역 목록 */}
      {userProfile?.locations && userProfile.locations.length > 0 && (
        <div className="space-y-2.5 sm:space-y-3">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">내 동네</h3>
          {userProfile.locations.map((location) => {
            const expired = isLocationExpired(location.verifiedAt)
            const daysLeft = getDaysUntilExpiry(location.verifiedAt)
            const isSelected = location.id === userProfile.selectedLocationId

            return (
              <div
                key={location.id}
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      {editingLocationId === location.id ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveLocationName(location.id)
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            className="text-xs sm:text-sm font-semibold text-gray-900 px-2 py-1 border-2 border-blue-500 rounded-md sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                            placeholder="ex) 집, 회사, 실험실"
                            autoFocus
                            maxLength={10}
                          />
                          <button
                            onClick={() => handleSaveLocationName(location.id)}
                            disabled={!editingName.trim() || loading}
                            className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 bg-green-50 hover:bg-green-100 rounded-md sm:rounded-lg transition-colors disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="text-xs font-medium text-gray-600 hover:text-gray-700 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-md sm:rounded-lg transition-colors disabled:opacity-50"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">
                            {location.name}
                          </span>
                          <button
                            onClick={() => handleStartEdit(location.id, location.name)}
                            className="text-xs text-gray-500 hover:text-gray-700 p-0.5 sm:p-1 hover:bg-gray-100 rounded transition-colors"
                            title="이름 수정"
                          >
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </>
                      )}
                      {isSelected && (
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                          선택됨
                        </span>
                      )}
                      {expired && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                          재인증 필요
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 mb-1.5 sm:mb-2">{location.dong}</p>
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
                  {editingLocationId !== location.id && (
                    <div className="flex gap-1.5 sm:gap-2 ml-2">
                      {!isSelected && (
                        <button
                          onClick={() => handleSelectLocation(location.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md sm:rounded-lg transition-colors whitespace-nowrap"
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
                        className="text-xs font-medium text-red-600 hover:text-red-700 px-2 sm:px-3 py-1 sm:py-1.5 bg-red-50 hover:bg-red-100 rounded-md sm:rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg sm:rounded-xl">
          <p className="text-xs sm:text-sm text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {/* 새 지역 인증 버튼 */}
      {(!userProfile?.locations || userProfile.locations.length < 2) && (
        <button
          onClick={onOpenMap || handleVerifyLocation}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3.5 sm:py-4 px-5 sm:px-6 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 text-sm sm:text-base"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>위치 인증 중...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg sm:text-xl">🗺️</span>
              <span>{onOpenMap ? '지도에서 위치 선택하기' : `현재 위치로 ${userProfile?.locations?.length === 0 ? '첫 ' : ''}동네 인증하기`}</span>
            </div>
          )}
        </button>
      )}

      {/* 안내 문구 */}
      <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl">
        <p className="text-xs text-blue-800 leading-relaxed">
          ℹ️ 내 동네 인증은 GPS를 통해 현재 위치를 확인하고, 카카오 맵 API로 자동으로 주소를 변환합니다.
          실제로 해당 지역에 있어야만 인증할 수 있으며, 인증은 30일마다 갱신이 필요합니다.
          최대 2개 지역까지 등록 가능합니다.
        </p>
      </div>
    </div>
  )
}
