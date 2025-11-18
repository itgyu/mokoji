/**
 * 모꼬지 Cloud Functions
 *
 * Firebase Functions Entry Point
 *
 * 이 파일은 모든 Cloud Functions 트리거를 통합합니다.
 */

import * as admin from 'firebase-admin';

// Firebase Admin 초기화
admin.initializeApp();

// ============================================
// Firestore Triggers
// ============================================

/**
 * RSVP 변경 시 시스템 메시지 생성
 *
 * Trigger: org_schedules/{scheduleId} onUpdate
 * Purpose: 참석 응답 변경 시 자동으로 시스템 메시지 생성
 */
export { onRSVPChange } from './triggers/onRSVPChange';

/**
 * 일정 정보 변경 시 시스템 메시지 생성
 *
 * Trigger: org_schedules/{scheduleId} onUpdate
 * Purpose: 제목, 시간, 장소, 상태 변경 시 자동으로 시스템 메시지 생성
 */
export { onScheduleUpdate } from './triggers/onScheduleUpdate';

/**
 * 새로운 채팅 메시지 생성 시 처리
 *
 * Trigger: schedule_chats/{messageId} onCreate
 * Purpose: 채팅 메시지 생성 시 일정 문서 업데이트 및 알림 발송
 */
export { onChatMessage } from './triggers/onChatMessage';

// ============================================
// Future Functions
// ============================================

// TODO: Push Notification 발송 함수
// export { sendPushNotification } from './notifications/sendPush';

// TODO: 일정 시작 알림 함수 (Scheduled Function)
// export { scheduleStartReminder } from './scheduled/startReminder';

// TODO: 이미지 업로드 처리 함수
// export { processUploadedImage } from './storage/processImage';
