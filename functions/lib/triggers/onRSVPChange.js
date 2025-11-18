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
exports.onRSVPChange = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
/**
 * org_schedules 문서의 participants 배열이 변경될 때
 * 자동으로 시스템 메시지를 생성합니다.
 *
 * Cloud Function Trigger:
 * - Collection: org_schedules
 * - Event: onUpdate
 * - Purpose: RSVP 변경 시 시스템 메시지 자동 생성
 */
exports.onRSVPChange = (0, firestore_1.onDocumentUpdated)('org_schedules/{scheduleId}', async (event) => {
    const scheduleId = event.params.scheduleId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) {
        return;
    }
    console.log('[onRSVPChange] 트리거 시작:', scheduleId);
    // 채팅이 활성화되지 않았으면 무시
    if (!after.hasChat) {
        console.log('[onRSVPChange] 채팅 비활성 상태, 무시');
        return;
    }
    // participants 배열 비교
    const beforeParticipants = before.participants || [];
    const afterParticipants = after.participants || [];
    // 변경 사항 찾기
    const changes = findParticipantChanges(beforeParticipants, afterParticipants);
    if (changes.length === 0) {
        console.log('[onRSVPChange] 참석 변경 없음');
        return;
    }
    console.log('[onRSVPChange] 참석 변경 감지:', changes.length, '건');
    // 시스템 메시지 생성
    const db = admin.firestore();
    const messagesRef = db.collection('schedule_chats');
    const batch = db.batch();
    for (const change of changes) {
        // 상태 텍스트 변환
        const statusText = {
            going: '참석',
            maybe: '미정',
            declined: '불참',
        }[change.newStatus] || change.newStatus;
        // 사용자 이름 (participants 배열에 이미 있음)
        const participant = afterParticipants.find((p) => p.userId === change.userId);
        const userName = participant?.userName || '알 수 없는 사용자';
        // 시스템 메시지 문서 생성
        const messageRef = messagesRef.doc();
        batch.set(messageRef, {
            scheduleId,
            senderId: null, // 시스템 메시지
            senderName: null,
            senderAvatar: null,
            content: `${userName}님이 ${statusText}으로 변경했습니다.`,
            type: 'system',
            systemType: 'rsvp_change',
            systemPayload: {
                userId: change.userId,
                userName,
                oldStatus: change.oldStatus,
                newStatus: change.newStatus,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isDeleted: false,
        });
        console.log(`[onRSVPChange] 시스템 메시지 추가: ${userName} → ${statusText}`);
    }
    await batch.commit();
    console.log('[onRSVPChange] 시스템 메시지 생성 완료:', changes.length, '건');
});
/**
 * 참여자 배열에서 변경 사항 찾기
 *
 * @param before - 변경 전 participants 배열
 * @param after - 변경 후 participants 배열
 * @returns 변경된 참여자 목록
 */
function findParticipantChanges(before, after) {
    const changes = [];
    // 변경 전 상태를 Map으로 변환 (빠른 조회)
    const beforeMap = new Map(before.map((p) => [p.userId, p.status]));
    // 변경 후 참여자들을 순회하며 변경 사항 찾기
    for (const participant of after) {
        const oldStatus = beforeMap.get(participant.userId);
        // 신규 참가자 또는 상태 변경
        if (!oldStatus) {
            // 신규 참가자
            changes.push({
                userId: participant.userId,
                oldStatus: undefined,
                newStatus: participant.status,
            });
        }
        else if (oldStatus !== participant.status) {
            // 상태 변경
            changes.push({
                userId: participant.userId,
                oldStatus,
                newStatus: participant.status,
            });
        }
    }
    return changes;
}
//# sourceMappingURL=onRSVPChange.js.map