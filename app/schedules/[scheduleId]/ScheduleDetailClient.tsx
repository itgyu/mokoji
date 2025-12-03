'use client';

/**
 * CONVERSION NOTE: Firebase → DynamoDB Migration
 *
 * This file has been converted from Firebase/Firestore to AWS DynamoDB.
 *
 * Major changes:
 * 1. Imports: Removed Firestore imports, added DynamoDB library imports
 * 2. Database operations:
 *    - updateDoc() → schedulesDB.update()
 *    - deleteDoc() → schedulesDB.delete()
 *    - getDocs(query()) → membersDB.getByOrganization() & usersDB.get()
 *    - runTransaction() → manual updates with Date.now()
 *    - addDoc() → removed (no subcollections in DynamoDB)
 * 3. Timestamps: serverTimestamp() → Date.now()
 * 4. Array operations: arrayRemove replaced with manual filtering
 *
 * Known limitations:
 * - No subcollections (messages table would need separate implementation)
 * - No transactions (implemented as sequential updates)
 * - System messages not created (addDoc removed)
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { schedulesAPI, organizationsAPI, membersAPI, usersAPI } from '@/lib/api-client';
import { ScheduleSummaryCard } from './components/ScheduleSummaryCard';
import { RSVPButtons } from './components/RSVPButtons';
import { ParticipantStrip } from './components/ParticipantStrip';
import { InlineChatSection } from './components/InlineChatSection';
import { useScheduleChat } from '@/hooks/useScheduleChat';
import { canUseScheduleChat, logFeatureFlags } from '@/lib/feature-flags';
import type { OrgSchedule } from '@/types/firestore';
import { ChevronLeft, Pencil, X, UserPlus, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui';

interface ScheduleDetailClientProps {
  schedule: OrgSchedule;
  scheduleId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
}

/**
 * 일정 상세 클라이언트 컴포넌트
 *
 * 모든 인터랙티브한 기능을 담당:
 * - 참석 응답 변경
 * - 채팅 메시지 전송/수신
 * - 실시간 업데이트
 */
export function ScheduleDetailClient({
  schedule,
  scheduleId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: ScheduleDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: schedule.title,
    dateISO: schedule.dateISO || '',
    time: schedule.time || '',
    location: schedule.location || '',
    description: schedule.description || '',
    maxParticipants: schedule.maxParticipants || 0,
  });
  const [orgData, setOrgData] = useState<any>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  // 뒤로가기 핸들러 - 브라우저 히스토리 사용
  const handleBack = () => {
    router.back();
  };

  // 현재 사용자의 참석 상태 찾기
  const myParticipation = localSchedule.participants.find(
    (p) => p.userId === currentUserId
  );
  const currentStatus = myParticipation?.status;

  // 참석자 수 계산
  const currentGoingCount = localSchedule.participants.filter(
    (p) => p.status === 'going'
  ).length;

  // Feature Flag: 채팅 기능 사용 가능 여부
  const canAccessChat = canUseScheduleChat(currentUserId, localSchedule.organizationId);

  // 개발 환경에서 Feature Flag 상태 로깅
  useEffect(() => {
    logFeatureFlags(currentUserId, localSchedule.organizationId);
  }, [currentUserId, localSchedule.organizationId]);

  // 크루 정보 가져오기 (크루장 확인용)
  useEffect(() => {
    const fetchOrgData = async () => {
      if (localSchedule.organizationId) {
        try {
          console.log('[fetchOrgData] 조직 정보 조회:', localSchedule.organizationId);
          const response = await organizationsAPI.get(localSchedule.organizationId);
          console.log('[fetchOrgData] API 응답:', response);
          const orgData = response?.organization || response;
          console.log('[fetchOrgData] orgData:', orgData);
          console.log('[fetchOrgData] ownerUid:', orgData?.ownerUid);
          if (orgData) {
            setOrgData(orgData);
          }
        } catch (error) {
          console.error('[fetchOrgData] Error:', error);
        }
      }
    };
    fetchOrgData();
  }, [localSchedule.organizationId]);

  // 권한 체크: 일정 작성자(벙주) 또는 크루장만 수정 가능
  // createdByUid가 없으면 hostUid, userId 등 대체 필드 확인
  const scheduleCreatorId = localSchedule.createdByUid || (localSchedule as any).hostUid || (localSchedule as any).userId;
  const isScheduleCreator = scheduleCreatorId === currentUserId;
  const isCrewLeader = orgData?.ownerUid === currentUserId;
  const canDelete = isScheduleCreator || isCrewLeader;

  // 실시간 채팅 Hook
  const {
    messages,
    isLoading: isLoadingMessages,
    error: chatError,
    isSending,
    sendMessage,
    sendMedia,
    retryFailedMessage,
  } = useScheduleChat(
    scheduleId,
    currentUserId,
    currentUserName,
    currentUserAvatar
  );

  // 참석 응답 변경 핸들러
  const handleStatusChange = (newStatus: any) => {
    // 로컬 상태 업데이트 (Optimistic UI)
    setLocalSchedule((prev) => {
      // 현재 사용자를 제외한 참석자 목록
      const updatedParticipants = prev.participants.filter(
        (p) => p.userId !== currentUserId
      );

      // newStatus가 있을 때만 참석자 추가 (취소인 경우 undefined)
      if (newStatus) {
        updatedParticipants.push({
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUserAvatar,
          status: newStatus,
          respondedAt: { toDate: () => new Date() } as any,
        });
      }

      return {
        ...prev,
        participants: updatedParticipants,
        participantCount: updatedParticipants.length,
      };
    });
  };

  // 일정 수정 핸들러
  const handleUpdate = async () => {
    if (!editForm.title.trim()) {
      alert('일정 제목을 입력해주세요.');
      return;
    }

    try {
      await schedulesAPI.update(scheduleId, {
        title: editForm.title,
        dateISO: editForm.dateISO,
        time: editForm.time,
        location: editForm.location,
        description: editForm.description,
        maxParticipants: editForm.maxParticipants || null,
      });

      // 로컬 상태 업데이트
      setLocalSchedule((prev) => ({
        ...prev,
        title: editForm.title,
        dateISO: editForm.dateISO,
        time: editForm.time,
        location: editForm.location,
        description: editForm.description,
        maxParticipants: editForm.maxParticipants,
      }));

      setIsEditing(false);
      alert('일정이 수정되었습니다.');
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('일정 수정 중 오류가 발생했습니다.');
    }
  };

  // 참석자 관리 모달 열기
  const handleOpenParticipantModal = async () => {
    setShowParticipantModal(true);
    setIsLoadingMembers(true);

    try {
      // 크루 멤버 목록 가져오기
      const response = await membersAPI.getByOrganization(localSchedule.organizationId);
      const members = response?.members || response || [];

      // 각 멤버의 프로필 정보 가져오기
      const membersWithProfiles = await Promise.all(
        members.map(async (member: any) => {
          try {
            const userResponse = await usersAPI.get(member.userId);
            const user = userResponse?.user || userResponse;
            return {
              ...member,
              name: user?.name || member.name || '익명',
              avatar: user?.avatar || user?.photoURL,
            };
          } catch {
            return {
              ...member,
              name: member.name || '익명',
              avatar: null,
            };
          }
        })
      );

      setOrgMembers(membersWithProfiles);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // 참석자 추가
  const handleAddParticipant = async (member: any) => {
    // 이미 참석자인지 확인
    const alreadyParticipant = localSchedule.participants.some(
      (p) => p.userId === member.userId
    );
    if (alreadyParticipant) {
      alert('이미 참석자로 등록되어 있습니다.');
      return;
    }

    setIsAddingParticipant(true);
    try {
      // 새 참석자 객체 생성
      const newParticipant = {
        userId: member.userId,
        userName: member.name,
        userAvatar: member.avatar,
        status: 'going' as const,
        respondedAt: Date.now(),
      };

      // 기존 participants에 새 참석자 추가
      const updatedParticipants = [
        ...localSchedule.participants.map(p => ({
          userId: p.userId,
          userName: p.userName,
          userAvatar: p.userAvatar,
          status: p.status,
          respondedAt: typeof p.respondedAt === 'object' && p.respondedAt?.toDate
            ? p.respondedAt.toDate().getTime()
            : p.respondedAt,
        })),
        newParticipant,
      ];

      await schedulesAPI.update(scheduleId, {
        participants: updatedParticipants,
      });

      // 로컬 상태 업데이트
      setLocalSchedule((prev) => ({
        ...prev,
        participants: [
          ...prev.participants,
          {
            ...newParticipant,
            respondedAt: { toDate: () => new Date() } as any,
          },
        ],
      }));

      alert(`${member.name}님을 참석자로 추가했습니다.`);
    } catch (error) {
      console.error('Error adding participant:', error);
      alert('참석자 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAddingParticipant(false);
    }
  };

  // 참석자 제거
  const handleRemoveParticipant = async (userId: string, userName: string) => {
    if (!window.confirm(`${userName}님을 참석자에서 제거하시겠습니까?`)) return;

    try {
      // 참석자 목록에서 제거
      const updatedParticipants = localSchedule.participants
        .filter((p) => p.userId !== userId)
        .map(p => ({
          userId: p.userId,
          userName: p.userName,
          userAvatar: p.userAvatar,
          status: p.status,
          respondedAt: typeof p.respondedAt === 'object' && p.respondedAt?.toDate
            ? p.respondedAt.toDate().getTime()
            : p.respondedAt,
        }));

      await schedulesAPI.update(scheduleId, {
        participants: updatedParticipants,
      });

      // 로컬 상태 업데이트
      setLocalSchedule((prev) => ({
        ...prev,
        participants: prev.participants.filter((p) => p.userId !== userId),
      }));

      alert(`${userName}님을 참석자에서 제거했습니다.`);
    } catch (error) {
      console.error('Error removing participant:', error);
      alert('참석자 제거 중 오류가 발생했습니다.');
    }
  };

  // 일정 삭제 핸들러
  const handleDelete = async () => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return;

    setIsDeleting(true);

    try {
      await schedulesAPI.delete(scheduleId);

      alert('일정이 삭제되었습니다.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('일정 삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
          </button>
          {canDelete && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 -mr-2"
              aria-label="일정 수정"
            >
              <Pencil className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>

      {/* 일정 정보 */}
      {!isEditing ? (
        <>
          {/* 일정 정보 카드 */}
          <ScheduleSummaryCard schedule={localSchedule} />

          {/* 내 참석 상태 */}
          <RSVPButtons
            scheduleId={scheduleId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            currentStatus={currentStatus}
            participants={localSchedule.participants}
            maxParticipants={localSchedule.maxParticipants}
            currentGoingCount={currentGoingCount}
            onStatusChange={handleStatusChange}
          />

          {/* 참석자 목록 */}
          <ParticipantStrip
            participants={localSchedule.participants}
            currentUserId={currentUserId}
            scheduleOwnerId={scheduleCreatorId}
            crewOwnerId={orgData?.ownerUid}
            onManageClick={canDelete ? handleOpenParticipantModal : undefined}
          />

          {/* 채팅 섹션 */}
          {canAccessChat && (
            <InlineChatSection
              scheduleId={scheduleId}
              scheduleTitle={localSchedule.title}
              messages={messages}
              isLoading={isLoadingMessages}
              currentUserId={currentUserId}
              onSendMessage={sendMessage}
              onSendMedia={sendMedia}
              onRetryMessage={retryFailedMessage}
            />
          )}

          {/* 일정 삭제 (작성자만) */}
          {canDelete && (
            <div className="bg-white border-t border-gray-200 px-4 py-4">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '일정 삭제'}
              </button>
            </div>
          )}
        </>
      ) : (
        /* 일정 수정 폼 */
        <div className="bg-white px-4 py-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">일정 수정</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={editForm.dateISO}
                  onChange={(e) => setEditForm({ ...editForm, dateISO: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 참석자</label>
              <input
                type="number"
                value={editForm.maxParticipants || ''}
                onChange={(e) => setEditForm({ ...editForm, maxParticipants: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5f0080]"
                min="0"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-3 text-sm font-medium rounded-lg border border-gray-200 text-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleUpdate}
              className="flex-1 py-3 text-sm font-medium rounded-lg bg-[#5f0080] text-white"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 참석자 관리 모달 */}
      {showParticipantModal && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={() => setShowParticipantModal(false)}
          />

          {/* 모달 */}
          <div className="fixed inset-x-0 bottom-0 z-[101] bg-white rounded-t-2xl max-h-[80vh] flex flex-col animate-slideUp">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">참석자 관리</h2>
              <button
                onClick={() => setShowParticipantModal(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="flex-1 overflow-y-auto">
              {/* 현재 참석자 목록 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  현재 참석자 ({localSchedule.participants.filter(p => p.status === 'going').length}명)
                </h3>
                {localSchedule.participants.filter(p => p.status === 'going').length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">아직 참석자가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {localSchedule.participants
                      .filter(p => p.status === 'going')
                      .map((participant) => (
                        <div
                          key={participant.userId}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={participant.userAvatar}
                              alt={participant.userName}
                              size="sm"
                            />
                            <span className="text-sm text-gray-900">{participant.userName}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveParticipant(participant.userId, participant.userName)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 크루 멤버에서 추가 */}
              <div className="px-4 py-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  크루 멤버에서 추가
                </h3>
                {isLoadingMembers ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-[#5f0080] border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orgMembers
                      .filter(m => !localSchedule.participants.some(p => p.userId === m.userId))
                      .map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={member.avatar}
                              alt={member.name}
                              size="sm"
                            />
                            <span className="text-sm text-gray-900">{member.name}</span>
                          </div>
                          <button
                            onClick={() => handleAddParticipant(member)}
                            disabled={isAddingParticipant}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#5f0080] hover:bg-[#f3e8f7] rounded-lg disabled:opacity-50"
                          >
                            <UserPlus className="w-4 h-4" />
                            추가
                          </button>
                        </div>
                      ))}
                    {orgMembers.filter(m => !localSchedule.participants.some(p => p.userId === m.userId)).length === 0 && (
                      <p className="text-sm text-gray-400 py-2">추가할 수 있는 멤버가 없습니다</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 닫기 버튼 */}
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setShowParticipantModal(false)}
                className="w-full py-3 text-sm font-medium rounded-lg bg-[#5f0080] text-white"
              >
                완료
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
