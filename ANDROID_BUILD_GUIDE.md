# 모꼬지 안드로이드 APK 빌드 가이드

## 사전 요구사항

1. **Android Studio 설치**
   - https://developer.android.com/studio 에서 다운로드
   - Android SDK 및 필요한 도구 자동 설치됨

2. **Java JDK 설치** (Android Studio에 포함되어 있음)
   - JDK 17 이상 권장

## 빌드 방법

### 방법 1: Android Studio 사용 (권장)

1. **Android Studio에서 프로젝트 열기**
   ```bash
   npm run cap:open:android
   ```
   또는
   ```bash
   open -a "Android Studio" android
   ```

2. **Android Studio에서 빌드**
   - 메뉴: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - 빌드 완료 후 알림에서 `locate` 클릭하면 APK 파일 위치 확인 가능
   - APK 위치: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Release APK 빌드** (배포용)
   - 메뉴: `Build` → `Generate Signed Bundle / APK`
   - APK 선택
   - Keystore 생성 또는 기존 Keystore 선택
   - Release variant 선택
   - 완료 후 APK 위치: `android/app/build/outputs/apk/release/app-release.apk`

### 방법 2: 명령줄 사용

1. **Debug APK 빌드**
   ```bash
   npm run android:build
   ```
   - APK 위치: `android/app/build/outputs/apk/debug/app-debug.apk`

2. **Release APK 빌드**
   ```bash
   npm run android:build:release
   ```
   - APK 위치: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
   - 주의: 배포를 위해서는 서명이 필요합니다

## 중요 사항

### 현재 앱 동작 방식
- 이 앱은 **Vercel에 배포된 웹 앱(https://mokoji.vercel.app)을 WebView로 표시**합니다
- 완전한 네이티브 앱이 아닌 "하이브리드 앱" 형태입니다
- 웹 앱을 업데이트하면 자동으로 모바일 앱에도 반영됩니다

### 앱 정보
- **앱 ID**: `com.mokoji.app`
- **앱 이름**: 모꼬지
- **웹 URL**: https://mokoji.vercel.app

## APK 설치 및 테스트

### 실제 기기에 설치
1. 개발자 옵션 활성화
   - 설정 → 휴대전화 정보 → 빌드 번호 7회 연속 탭
2. USB 디버깅 허용
   - 설정 → 개발자 옵션 → USB 디버깅 ON
3. USB로 기기 연결
4. Android Studio에서 Run 버튼 클릭 또는:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### 에뮬레이터에서 테스트
1. Android Studio에서 AVD Manager 열기
2. 가상 기기 생성 (없는 경우)
3. 가상 기기 실행
4. Android Studio에서 Run 버튼 클릭

## 앱 스토어 배포

### Google Play Console에 업로드
1. **Release APK 생성** (위의 방법 1-3 참조)
2. **Google Play Console** (https://play.google.com/console) 접속
3. 앱 생성 및 APK 업로드
4. 앱 정보, 스크린샷, 설명 등 작성
5. 검토 제출

### 중요: Keystore 관리
- Release APK 서명에 사용한 Keystore는 **절대 분실하지 마세요**
- 분실 시 앱 업데이트 불가능
- Keystore를 안전한 곳에 백업하세요

## 문제 해결

### Gradle 빌드 오류
```bash
cd android
./gradlew clean
cd ..
npm run android:build
```

### Android Studio SDK 오류
- Android Studio → Preferences → Appearance & Behavior → System Settings → Android SDK
- SDK Platforms에서 Android 13.0 (API 33) 이상 설치
- SDK Tools에서 Android SDK Build-Tools, Android Emulator 등 설치

### adb 명령 찾을 수 없음
```bash
export PATH=$PATH:~/Library/Android/sdk/platform-tools
```

## 향후 개선 사항

1. **네이티브 기능 추가**
   - 푸시 알림
   - 카메라 접근
   - 위치 정보
   - 파일 업로드

2. **오프라인 지원**
   - Service Worker 추가
   - 캐시 전략 구현

3. **앱 아이콘 및 스플래시 화면**
   - `android/app/src/main/res` 에 아이콘 추가
   - 스플래시 화면 커스터마이즈

## 유용한 명령어

```bash
# Capacitor 동기화 (웹 앱 변경사항 반영)
npm run cap:sync

# Android Studio 열기
npm run cap:open:android

# Debug APK 빌드
npm run android:build

# Release APK 빌드
npm run android:build:release

# 연결된 기기 확인
adb devices

# 로그 확인
adb logcat
```
