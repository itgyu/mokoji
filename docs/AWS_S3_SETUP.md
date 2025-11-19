# AWS S3 CORS 설정 가이드

채팅 이미지/영상 업로드를 위한 S3 CORS 설정 방법입니다.

---

## 🔴 필수 작업 (5분)

### 1. AWS S3 Console 접속
```
https://s3.console.aws.amazon.com/s3/buckets/its-campers
```

### 2. CORS 설정 편집

1. **"권한" 탭** 클릭
2. 아래로 스크롤 → **"CORS(Cross-origin 리소스 공유)"** 섹션
3. **"편집"** 버튼 클릭

### 3. CORS JSON 입력

기존 내용 전부 삭제하고 다음 붙여넣기:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://mokoji.vercel.app",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag", "x-amz-server-side-encryption"]
  }
]
```

### 4. 저장

**"변경 사항 저장"** 클릭

---

## ✅ 설정 완료 확인

1. 저장 성공 메시지 확인
2. CORS 섹션에 설정이 표시됨

---

## 📝 CORS 설정 설명

- **AllowedHeaders**: 모든 헤더 허용 (`*`)
- **AllowedMethods**: GET, PUT, POST, HEAD 요청 허용
- **AllowedOrigins**:
  - `http://localhost:3000` - 로컬 개발 환경
  - `https://mokoji.vercel.app` - 프로덕션 환경
  - `https://*.vercel.app` - Vercel 프리뷰 배포
- **ExposeHeaders**: ETag, x-amz-server-side-encryption 헤더 노출

---

## 🧪 테스트 방법

1. 로컬 개발 서버 실행: `npm run dev`
2. 일정 상세 페이지 접속
3. 채팅 입력창 왼쪽 **📎 버튼** 클릭
4. 이미지 또는 영상 파일 선택
5. **전송** 버튼 클릭
6. 브라우저 콘솔(F12)에서 업로드 로그 확인

### 성공 로그 예시:
```
[uploadToS3] 업로드 성공: https://its-campers.s3.ap-northeast-2.amazonaws.com/schedule_chats/...
[uploadChatMedia] 업로드 완료: {...}
```

### 실패 시 확인 사항:
- CORS 설정이 제대로 저장되었는지 확인
- `.env.local`에 AWS credentials가 올바른지 확인
- S3 버킷 권한 설정 확인 (Public Access 차단 해제 필요 시)

---

완료! 이제 채팅에서 파일 업로드가 가능합니다. 🚀
