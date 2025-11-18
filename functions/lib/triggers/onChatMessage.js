"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onChatMessage = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
/**
 * 새로운 채팅 메시지가 생성될 때 트리거
 *
 * Cloud Function Trigger:
 * - Collection: schedule_chats
 * - Event: onCreate
 * - Purpose: 채팅 메시지 생성 시 자동 처리
 *   1. 일정 문서의 lastChatMessage 필드 업데이트
 *   2. (향후) 푸시 알림 발송
 */
exports.onChatMessage = (0, firestore_1.onDocumentCreated)('schedule_chats/{messageId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log('[onChatMessage] No data');
        return;
    }
    const messageId = event.params.messageId;
    const message = snapshot.data();
    console.log('[onChatMessage] 새 메시지 생성:', messageId);
    // 시스템 메시지는 알림 제외
    if (message.type === 'system') {
        console.log('[onChatMessage] 시스템 메시지, 알림 스킵');
        return;
    }
    // 삭제된 메시지는 무시
    if (message.isDeleted) {
        console.log('[onChatMessage] 삭제된 메시지, 무시');
        return;
    }
    const scheduleId = message.scheduleId;
    if (!scheduleId) {
        console.error('[onChatMessage] scheduleId가 없음');
        return;
    }
    try {
        // 1. 일정 문서의 lastChatMessage 필드 업데이트
        const db = admin.firestore();
        const scheduleRef = db.collection('org_schedules').doc(scheduleId);
        await scheduleRef.update({
            lastChatMessageAt: message.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            lastChatMessagePreview: truncateMessage(message.content, 50),
        });
        console.log('[onChatMessage] 일정 문서 업데이트 완료:', scheduleId);
        // 2. (향후) 푸시 알림 발송
        // TODO: 참석자들에게 푸시 알림 발송
        // - 발신자 제외
        // - 알림 설정이 켜져있는 사용자만
        // - 최근 1분 내 메시지는 배치 처리 (도배 방지)
        /*
        const schedule = await scheduleRef.get();
        const scheduleData = schedule.data();
  
        if (scheduleData) {
          const participants = scheduleData.participants || [];
          const notificationTargets = participants
            .filter((p: any) => p.userId !== message.senderId) // 발신자 제외
            .filter((p: any) => p.notificationsEnabled !== false); // 알림 켜진 사용자만
  
          // FCM 토큰 조회 및 알림 발송
          // await sendPushNotifications(notificationTargets, {
          //   title: scheduleData.title,
          //   body: `${message.senderName}: ${truncateMessage(message.content, 100)}`,
          //   data: {
          //     type: 'chat_message',
          //     scheduleId,
          //     messageId,
          //   },
          // });
        }
        */
    }
    catch (error) {
        console.error('[onChatMessage] 에러 발생:', error);
    }
});
/**
 * 메시지 텍스트를 지정된 길이로 자르기
 *
 * @param text - 원본 텍스트
 * @param maxLength - 최대 길이
 * @returns 잘린 텍스트
 */
function truncateMessage(text, maxLength) {
    if (!text)
        return '';
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength) + '...';
}
//# sourceMappingURL=onChatMessage.js.map