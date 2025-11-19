import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFF9F5 0%, #FFE8D6 100%)',
        }}
      >
        {/* 큰 원 테두리 */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: '6px solid #FF9B50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* 중앙 동그라미 */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#FF9B50',
              position: 'absolute',
            }}
          />

          {/* 위 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#A8D08D',
              position: 'absolute',
              top: 10,
            }}
          />

          {/* 오른쪽 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#FF6B6B',
              position: 'absolute',
              right: 10,
            }}
          />

          {/* 아래 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#FF9B50',
              position: 'absolute',
              bottom: 10,
              opacity: 0.8,
            }}
          />

          {/* 왼쪽 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#A8D08D',
              position: 'absolute',
              left: 10,
              opacity: 0.8,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
