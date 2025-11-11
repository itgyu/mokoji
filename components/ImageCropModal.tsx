'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Area, Point } from 'react-easy-crop/types'

interface ImageCropModalProps {
  imageUrl: string
  onComplete: (croppedBlob: Blob) => void
  onCancel: () => void
  aspectRatio?: number
  title?: string
}

export default function ImageCropModal({
  imageUrl,
  onComplete,
  onCancel,
  aspectRatio = 1,
  title = '이미지 자르기'
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) {
      console.error('크롭 영역이 선택되지 않았습니다')
      return
    }

    try {
      const image = await createImage(imageUrl)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        console.error('Canvas context를 가져올 수 없습니다')
        return
      }

      // 크롭 영역 크기로 캔버스 설정
      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height

      // 이미지를 캔버스에 그리기
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      )

      // 캔버스를 Blob으로 변환
      return new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('크롭된 이미지 생성 완료:', blob.size, 'bytes')
            onComplete(blob)
            resolve()
          } else {
            console.error('Blob 생성 실패')
            resolve()
          }
        }, 'image/jpeg', 0.95)
      })
    } catch (error) {
      console.error('이미지 크롭 중 오류:', error)
      alert('이미지 크롭 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-[#3182F6] text-white p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <button
          onClick={onCancel}
          className="text-white text-2xl hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        >
          ×
        </button>
      </div>

      {/* 크롭 영역 */}
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      {/* 컨트롤 */}
      <div className="bg-white p-6 space-y-4">
        {/* 줌 슬라이더 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            확대/축소
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={createCroppedImage}
            className="flex-1 py-3 bg-[#3182F6] text-white rounded-lg font-semibold hover:bg-[#1B64DA] transition-colors"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

// 이미지 로드 헬퍼 함수
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })
