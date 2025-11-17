'use client'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
      {/* 브랜드 로고 - 모이는 사람들 */}
      <div className="relative w-32 h-32 mb-8">
        {/* 큰 테두리 원 */}
        <div className="absolute inset-0 rounded-full border-4 border-orange-500" />

        {/* 중앙 동그라미 (주황) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-orange-500" />

        {/* 위 (연두) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-green-400" />

        {/* 오른쪽 (코랄) */}
        <div className="absolute top-1/2 right-2 -translate-y-1/2 w-6 h-6 rounded-full bg-coral-500" />

        {/* 아래 (주황) */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-orange-500 opacity-80" />

        {/* 왼쪽 (연두) */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 w-6 h-6 rounded-full bg-green-400 opacity-80" />

        {/* 우상 (주황) */}
        <div className="absolute top-6 right-6 w-5 h-5 rounded-full bg-orange-400" />

        {/* 우하 (연두) */}
        <div className="absolute bottom-6 right-6 w-5 h-5 rounded-full bg-green-300" />

        {/* 좌하 (코랄) */}
        <div className="absolute bottom-6 left-6 w-5 h-5 rounded-full bg-coral-400" />

        {/* 좌상 (주황) */}
        <div className="absolute top-6 left-6 w-5 h-5 rounded-full bg-orange-300" />
      </div>

      {/* 브랜드명 */}
      <h1 className="text-3xl font-bold text-gray-900">
        모꼬지
      </h1>

      {/* 슬로건 */}
      <p className="mt-2 text-orange-600 text-sm font-medium">
        놀 땐 모꼬지
      </p>
    </div>
  )
}
