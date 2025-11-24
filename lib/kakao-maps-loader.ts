/**
 * Kakao Maps SDK 로더
 * layout.tsx에서 전역으로 로드된 스크립트가 준비될 때까지 대기
 */

export async function loadKakaoMaps(): Promise<void> {
  // 이미 로드되어 있으면 바로 반환
  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  // layout.tsx에서 로드한 스크립트가 준비될 때까지 대기
  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // 5초 (100ms * 50)

    const checkInterval = setInterval(() => {
      attempts++;

      if (window.kakao?.maps) {
        clearInterval(checkInterval);
        console.log('✅ Kakao Maps 준비 완료');
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('❌ Kakao Maps 로드 시간 초과');
        reject(new Error('Kakao Maps SDK 로드 시간 초과. 페이지를 새로고침해주세요.'));
      }
    }, 100);
  });
}
