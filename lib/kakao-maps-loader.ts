/**
 * Kakao Maps SDK 로더
 * layout.tsx에서 autoload=false로 로드된 스크립트를 수동 초기화
 */

// 초기화 상태 추적
let isLoading = false;
let isLoaded = false;

export async function loadKakaoMaps(): Promise<void> {
  // 이미 초기화 완료되었으면 바로 반환
  if (isLoaded && window.kakao?.maps?.services) {
    console.log('✅ Kakao Maps already loaded and initialized');
    return Promise.resolve();
  }

  // 이미 로딩 중이면 완료될 때까지 대기
  if (isLoading) {
    return new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isLoaded && window.kakao?.maps?.services) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Kakao Maps 초기화 대기 시간 초과'));
      }, 10000);
    });
  }

  isLoading = true;

  return new Promise<void>((resolve, reject) => {
    // kakao 객체가 로드될 때까지 대기
    let attempts = 0;
    const maxAttempts = 50; // 5초 (100ms * 50)

    const waitForKakao = () => {
      attempts++;

      if (window.kakao?.maps) {
        // autoload=false이므로 수동으로 load 호출
        window.kakao.maps.load(() => {
          console.log('✅ Kakao Maps fully initialized with services');
          isLoaded = true;
          isLoading = false;
          resolve();
        });
      } else if (attempts >= maxAttempts) {
        console.error('❌ Kakao Maps 로드 시간 초과');
        isLoading = false;
        reject(new Error('Kakao Maps SDK 로드 시간 초과. 페이지를 새로고침해주세요.'));
      } else {
        setTimeout(waitForKakao, 100);
      }
    };

    waitForKakao();
  });
}
