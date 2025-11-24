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

    // 스크립트 추가
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=ff364c3f44129afc87e31935ac353ba2&libraries=services';
    script.async = true;

    script.onload = () => {
      console.log('✅ Kakao Maps script loaded successfully');
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Kakao Maps script:', error);
    };

    document.head.appendChild(script);
    console.log('🔧 Kakao Maps script added to head');
  }, []);

  return null;
}
