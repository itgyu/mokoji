/**
 * Kakao Maps SDK 동적 로더
 * 여러 컴포넌트에서 공유하여 사용
 */

let loadingPromise: Promise<void> | null = null;

export async function loadKakaoMaps(): Promise<void> {
  // 이미 로드되어 있으면 바로 반환
  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  // 이미 로딩 중이면 같은 Promise 반환
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    // 스크립트가 이미 추가되어 있는지 확인
    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');

    if (existingScript) {
      // 스크립트는 있지만 window.kakao가 없는 경우, 로드 대기
      const checkInterval = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(checkInterval);
          loadingPromise = null;
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        loadingPromise = null;
        reject(new Error('Kakao Maps SDK 로드 시간 초과'));
      }, 10000);
      return;
    }

    // 새로운 스크립트 추가
    const script = document.createElement('script');
    const apiKey = 'ff364c3f44129afc87e31935ac353ba2';
    // autoload=false 제거 - 기본 autoload 사용
    const scriptUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services`;

    console.log('🔧 Kakao Maps 스크립트 로드 시작:', scriptUrl);

    script.type = 'text/javascript';
    script.src = scriptUrl;

    script.onload = () => {
      console.log('✅ Kakao Maps 스크립트 로드 완료');
      // autoload=true (기본값)이므로 바로 사용 가능할 때까지 대기
      const checkReady = setInterval(() => {
        if (window.kakao?.maps) {
          console.log('✅ Kakao Maps 초기화 완료');
          clearInterval(checkReady);
          loadingPromise = null;
          resolve();
        }
      }, 50);

      // 5초 타임아웃
      setTimeout(() => {
        clearInterval(checkReady);
        if (!window.kakao?.maps) {
          console.error('❌ 스크립트는 로드되었으나 window.kakao.maps가 없음');
          loadingPromise = null;
          reject(new Error('Kakao Maps SDK가 로드되지 않았습니다'));
        }
      }, 5000);
    };

    script.onerror = (error) => {
      console.error('❌ Kakao Maps 스크립트 로드 실패:', error);
      console.error('Script URL:', scriptUrl);
      loadingPromise = null;
      reject(new Error('Kakao Maps 스크립트 로드 실패'));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}
