/**
 * 모꼬지 Firestore 유틸리티
 *
 * 안전한 Firestore 작업을 위한 유틸 함수
 *
 * ⚠️ 중요 원칙:
 * - ❌ 물리 삭제(Hard Delete)는 절대 금지!
 * - ✅ Soft Delete만 사용
 * - ✅ 모든 쿼리는 isDeleted: false 필터 적용
 */

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Query,
  DocumentReference,
  CollectionReference,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS, FIELDS, DocumentStatus } from '@/types/firestore';

// ============================================
// Soft Delete 함수들
// ============================================

/**
 * 문서를 논리적으로 삭제합니다 (Soft Delete)
 *
 * 물리적으로 삭제하지 않고 isDeleted 플래그만 설정합니다.
 * 이후 복구가 가능하며, 데이터 무결성을 유지합니다.
 *
 * @param collectionPath - 컬렉션 경로 (예: 'org_schedules')
 * @param docId - 문서 ID
 * @param userId - 삭제를 실행한 사용자 ID
 * @param reason - 삭제 사유 (선택)
 *
 * @example
 * ```typescript
 * await softDeleteDocument('org_schedules', scheduleId, currentUserId, '일정 취소');
 * ```
 */
export async function softDeleteDocument(
  collectionPath: string,
  docId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);

  await updateDoc(docRef, {
    [FIELDS.IS_DELETED]: true,
    [FIELDS.DELETED_AT]: serverTimestamp(),
    [FIELDS.DELETED_BY]: userId,
    ...(reason && { deleteReason: reason }),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 문서를 복구합니다 (Soft Delete 취소)
 *
 * @param collectionPath - 컬렉션 경로
 * @param docId - 문서 ID
 * @param userId - 복구를 실행한 사용자 ID
 *
 * @example
 * ```typescript
 * await restoreDocument('org_schedules', scheduleId, adminUserId);
 * ```
 */
export async function restoreDocument(
  collectionPath: string,
  docId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);

  await updateDoc(docRef, {
    [FIELDS.IS_DELETED]: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    restoredAt: serverTimestamp(),
    restoredBy: userId,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

// ============================================
// 쿼리 헬퍼 함수들
// ============================================

/**
 * 활성 문서만 가져오는 쿼리를 생성합니다
 *
 * isDeleted === false인 문서만 반환
 *
 * @param collectionPath - 컬렉션 경로
 * @returns Firestore Query
 *
 * @example
 * ```typescript
 * const q = getActiveDocumentsQuery('org_schedules');
 * const snapshot = await getDocs(q);
 * ```
 */
export function getActiveDocumentsQuery(collectionPath: string): Query {
  const collectionRef = collection(db, collectionPath);
  return query(collectionRef, where(FIELDS.IS_DELETED, '==', false));
}

/**
 * 특정 상태의 활성 문서만 가져오는 쿼리
 *
 * isDeleted === false && status === [원하는 상태]
 *
 * @param collectionPath - 컬렉션 경로
 * @param status - 원하는 상태 (기본: 'active')
 * @returns Firestore Query
 *
 * @example
 * ```typescript
 * const q = getActiveStatusDocumentsQuery('org_schedules', 'scheduled');
 * const upcomingSchedules = await getDocs(q);
 * ```
 */
export function getActiveStatusDocumentsQuery(
  collectionPath: string,
  status: DocumentStatus | string = 'active'
): Query {
  const collectionRef = collection(db, collectionPath);
  return query(
    collectionRef,
    where(FIELDS.IS_DELETED, '==', false),
    where(FIELDS.STATUS, '==', status)
  );
}

/**
 * 삭제된 문서만 가져오는 쿼리 (관리자용)
 *
 * @param collectionPath - 컬렉션 경로
 * @returns Firestore Query
 */
export function getDeletedDocumentsQuery(collectionPath: string): Query {
  const collectionRef = collection(db, collectionPath);
  return query(collectionRef, where(FIELDS.IS_DELETED, '==', true));
}

// ============================================
// 상태 관리 함수들
// ============================================

/**
 * 문서를 아카이브합니다 (삭제는 아니지만 숨김)
 *
 * @param collectionPath - 컬렉션 경로
 * @param docId - 문서 ID
 * @param userId - 아카이브를 실행한 사용자 ID
 *
 * @example
 * ```typescript
 * await archiveDocument('organizations', orgId, adminUserId);
 * ```
 */
export async function archiveDocument(
  collectionPath: string,
  docId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);

  await updateDoc(docRef, {
    [FIELDS.STATUS]: 'archived',
    archivedAt: serverTimestamp(),
    archivedBy: userId,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 아카이브된 문서를 활성화합니다
 *
 * @param collectionPath - 컬렉션 경로
 * @param docId - 문서 ID
 * @param userId - 활성화를 실행한 사용자 ID
 */
export async function unarchiveDocument(
  collectionPath: string,
  docId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);

  await updateDoc(docRef, {
    [FIELDS.STATUS]: 'active',
    archivedAt: null,
    archivedBy: null,
    unarchivedAt: serverTimestamp(),
    unarchivedBy: userId,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 문서 상태를 변경합니다
 *
 * @param collectionPath - 컬렉션 경로
 * @param docId - 문서 ID
 * @param newStatus - 새로운 상태
 * @param userId - 변경을 실행한 사용자 ID
 */
export async function updateDocumentStatus(
  collectionPath: string,
  docId: string,
  newStatus: DocumentStatus | string,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionPath, docId);

  await updateDoc(docRef, {
    [FIELDS.STATUS]: newStatus,
    statusChangedAt: serverTimestamp(),
    statusChangedBy: userId,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

// ============================================
// 사용자 관리 함수들
// ============================================

/**
 * 사용자를 차단합니다
 *
 * @param userId - 차단할 사용자 ID
 * @param adminId - 차단을 실행한 관리자 ID
 * @param reason - 차단 사유 (선택)
 *
 * @example
 * ```typescript
 * await blockUser(badUserId, adminId, '부적절한 행동');
 * ```
 */
export async function blockUser(
  userId: string,
  adminId: string,
  reason?: string
): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, userId);

  await updateDoc(userRef, {
    [FIELDS.STATUS]: 'blocked',
    blockedAt: serverTimestamp(),
    blockedBy: adminId,
    ...(reason && { blockReason: reason }),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 사용자 차단을 해제합니다
 *
 * @param userId - 차단 해제할 사용자 ID
 * @param adminId - 차단 해제를 실행한 관리자 ID
 */
export async function unblockUser(userId: string, adminId: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, userId);

  await updateDoc(userRef, {
    [FIELDS.STATUS]: 'active',
    blockedAt: null,
    blockedBy: null,
    blockReason: null,
    unblockedAt: serverTimestamp(),
    unblockedBy: adminId,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

// ============================================
// 채팅 관련 유틸 함수들
// ============================================

/**
 * 일정의 채팅을 활성화합니다
 *
 * @param scheduleId - 일정 ID
 */
export async function enableScheduleChat(scheduleId: string): Promise<void> {
  const scheduleRef = doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleId);

  await updateDoc(scheduleRef, {
    hasChat: true,
    chatEnabledAt: serverTimestamp(),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 일정의 채팅을 비활성화합니다
 *
 * @param scheduleId - 일정 ID
 */
export async function disableScheduleChat(scheduleId: string): Promise<void> {
  const scheduleRef = doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleId);

  await updateDoc(scheduleRef, {
    hasChat: false,
    chatDisabledAt: serverTimestamp(),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

/**
 * 채팅 메시지의 최신 정보를 일정에 업데이트합니다
 *
 * @param scheduleId - 일정 ID
 * @param messagePreview - 메시지 미리보기
 * @param messageTimestamp - 메시지 시간
 */
export async function updateScheduleLastMessage(
  scheduleId: string,
  messagePreview: string,
  messageTimestamp?: Timestamp
): Promise<void> {
  const scheduleRef = doc(db, COLLECTIONS.ORG_SCHEDULES, scheduleId);

  await updateDoc(scheduleRef, {
    lastChatMessageAt: messageTimestamp || serverTimestamp(),
    lastChatMessagePreview: messagePreview,
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  });
}

// ============================================
// ⚠️ 절대 만들지 말 것!
// ============================================

/**
 * ❌ 금지된 함수들 (절대 구현하지 않음)
 *
 * 다음 함수들은 데이터 보호 원칙에 위배되므로 절대 만들지 않습니다:
 *
 * - hardDeleteDocument() - 물리 삭제
 * - permanentlyDeleteUser() - 사용자 영구 삭제
 * - deleteCollection() - 컬렉션 삭제
 * - purgeOldData() - 오래된 데이터 삭제
 * - clearAllMessages() - 모든 메시지 삭제
 *
 * ✅ 대신 Soft Delete 사용!
 */

// ============================================
// 타입 가드 함수들
// ============================================

/**
 * 문서가 삭제되었는지 확인
 */
export function isDocumentDeleted(doc: any): boolean {
  return doc?.[FIELDS.IS_DELETED] === true;
}

/**
 * 문서가 활성 상태인지 확인
 */
export function isDocumentActive(doc: any): boolean {
  return !isDocumentDeleted(doc) && doc?.[FIELDS.STATUS] === 'active';
}

/**
 * 문서가 아카이브되었는지 확인
 */
export function isDocumentArchived(doc: any): boolean {
  return !isDocumentDeleted(doc) && doc?.[FIELDS.STATUS] === 'archived';
}
