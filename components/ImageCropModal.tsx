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
  cropShape?: 'rect' | 'round'
}

export default function ImageCropModal({
  imageUrl,
  onComplete,
  onCancel,
  aspectRatio = 1,
  title = '사진 편집',
  cropShape = 'round'
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) {
      console.error('크롭 영역이 선택되지 않았습니다')
      return
    }

    setIsProcessing(true)
    try {
      const image = await createImage(imageUrl)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        console.error('Canvas context를 가져올 수 없습니다')
        return
      }

      // 출력 사이즈 (400x400 정사각형으로 최적화)
      const outputSize = 400
      canvas.width = outputSize
      canvas.height = outputSize

      ctx.imageSmoothingQuality = 'high'

      // 이미지를 캔버스에 그리기
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        outputSize,
        outputSize
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
        }, 'image/jpeg', 0.9)
      })
    } catch (error) {
      console.error('이미지 크롭 중 오류:', error)
      alert('이미지 크롭 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-mokkoji-primary text-white px-4 py-3 flex items-center justify-between safe-area-top">
        <button
          onClick={onCancel}
          className="text-white/90 hover:text-white text-sm font-medium px-2 py-1"
        >
          취소
        </button>
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          onClick={createCroppedImage}
          disabled={isProcessing}
          className="text-white font-semibold text-sm px-2 py-1 disabled:opacity-50"
        >
          {isProcessing ? '처리중...' : '완료'}
        </button>
      </div>

      {/* 크롭 영역 */}
      <div className="flex-1 relative bg-black">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          style={{
            containerStyle: {
              background: '#000',
            },
            cropAreaStyle: {
              border: '2px solid #5f0080',
            },
          }}
        />
      </div>

      {/* 컨트롤 */}
      <div className="bg-white px-6 py-5 space-y-4 safe-area-bottom">
        {/* 줌 슬라이더 */}
        <div className="flex items-center gap-4">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-mokkoji-primary"
          />
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </div>

        <p className="text-xs text-gray-400 text-center">
          드래그하여 위치 조정, 슬라이더로 확대/축소
        </p>
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
