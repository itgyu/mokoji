import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mokoji.app',
  appName: '모꼬지',
  webDir: 'out',
  server: {
    // 개발 중에는 Vercel 배포 URL 사용
    url: 'https://mokoji.vercel.app',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
