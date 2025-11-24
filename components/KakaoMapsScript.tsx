'use client';

import { useEffect } from 'react';

export default function KakaoMapsScript() {
  useEffect(() => {
    // 이미 로드되어 있으면 무시
    if (window.kakao?.maps) {
      console.log('✅ Kakao Maps already loaded');
      return;
    }

    // 이미 스크립트가 추가되어 있으면 무시
    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existingScript) {
      console.log('⏳ Kakao Maps script already in DOM, waiting...');
      return;
    }

    // autoload=false로 스크립트 추가 후 수동 초기화
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=ff364c3f44129afc87e31935ac353ba2&libraries=services&autoload=false';

    script.onload = () => {
      console.log('✅ Kakao Maps script loaded, initializing...');
      // autoload=false이므로 수동으로 초기화
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          console.log('✅ Kakao Maps fully initialized with services');
        });
      }
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Kakao Maps script:', error);
    };

    document.head.appendChild(script);
    console.log('🔧 Kakao Maps script added to head');
  }, []);

  return null;
}
