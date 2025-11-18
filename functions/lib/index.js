"use strict";
/**
 * 모꼬지 Cloud Functions
 *
 * Firebase Functions Entry Point
 *
 * 이 파일은 모든 Cloud Functions 트리거를 통합합니다.
 */
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
exports.onChatMessage = exports.onScheduleUpdate = exports.onRSVPChange = void 0;
const admin = __importStar(require("firebase-admin"));
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
var onRSVPChange_1 = require("./triggers/onRSVPChange");
Object.defineProperty(exports, "onRSVPChange", { enumerable: true, get: function () { return onRSVPChange_1.onRSVPChange; } });
/**
 * 일정 정보 변경 시 시스템 메시지 생성
 *
 * Trigger: org_schedules/{scheduleId} onUpdate
 * Purpose: 제목, 시간, 장소, 상태 변경 시 자동으로 시스템 메시지 생성
 */
var onScheduleUpdate_1 = require("./triggers/onScheduleUpdate");
Object.defineProperty(exports, "onScheduleUpdate", { enumerable: true, get: function () { return onScheduleUpdate_1.onScheduleUpdate; } });
/**
 * 새로운 채팅 메시지 생성 시 처리
 *
 * Trigger: schedule_chats/{messageId} onCreate
 * Purpose: 채팅 메시지 생성 시 일정 문서 업데이트 및 알림 발송
 */
var onChatMessage_1 = require("./triggers/onChatMessage");
Object.defineProperty(exports, "onChatMessage", { enumerable: true, get: function () { return onChatMessage_1.onChatMessage; } });
// ============================================
// Future Functions
// ============================================
// TODO: Push Notification 발송 함수
// export { sendPushNotification } from './notifications/sendPush';
// TODO: 일정 시작 알림 함수 (Scheduled Function)
// export { scheduleStartReminder } from './scheduled/startReminder';
// TODO: 이미지 업로드 처리 함수
// export { processUploadedImage } from './storage/processImage';
//# sourceMappingURL=index.js.map