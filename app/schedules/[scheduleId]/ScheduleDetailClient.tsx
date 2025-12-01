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

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { schedulesDB, membersDB, usersDB, organizationsDB } from '@/lib/dynamodb';
import { ScheduleSummaryCard } from './components/ScheduleSummaryCard';
import { RSVPButtons } from './components/RSVPButtons';
import { ParticipantStrip } from './components/ParticipantStrip';
import { InlineChatSection } from './components/InlineChatSection';
import { useScheduleChat } from '@/hooks/useScheduleChat';
import { canUseScheduleChat, logFeatureFlags } from '@/lib/feature-flags';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui';
import type { OrgSchedule } from '@/types/firestore';
import { Users, ChevronLeft } from 'lucide-react'
import { addDuplicateNameSuffixes } from '@/lib/name-utils'

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

  // 동명이인 처리: 참석자 이름에 A, B, C... 접미사 추가
  const participantsWithDisplayNames = useMemo(() => {
    const participantsWithNames = localSchedule.participants.map(p => ({
      ...p,
      name: p.userName,
      joinedAt: p.respondedAt
    }))
    return addDuplicateNameSuffixes(participantsWithNames)
  }, [localSchedule.participants])

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
  const [showManageParticipants, setShowManageParticipants] = useState(false);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

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
          const orgData = await organizationsDB.get(localSchedule.organizationId);
          if (orgData) {
            setOrgData(orgData);
          }
        } catch (error) {
          console.error('Error fetching organization:', error);
        }
      }
    };
    fetchOrgData();
  }, [localSchedule.organizationId]);

  // 권한 체크: 일정 작성자(벙주) 또는 크루장만 수정 가능
  const isScheduleCreator = localSchedule.createdByUid === currentUserId;
  const isCrewLeader = orgData?.ownerUid === currentUserId;
  const canDelete = isScheduleCreator || isCrewLeader;

  console.log('[Permission Check]', {
    scheduleTitle: localSchedule.title,
    currentUserId,
    createdByUid: localSchedule.createdByUid,
    ownerUid: orgData?.ownerUid,
    isScheduleCreator,
    isCrewLeader,
    canDelete
  });

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
      const updatedParticipants = prev.participants.filter(
        (p) => p.userId !== currentUserId
      );

      updatedParticipants.push({
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        status: newStatus,
        respondedAt: { toDate: () => new Date() } as any,
      });

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
      await schedulesDB.update(scheduleId, {
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

  // 일정 삭제 핸들러
  const handleDelete = async () => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return;

    setIsDeleting(true);

    try {
      await schedulesDB.delete(scheduleId);

      alert('일정이 삭제되었습니다.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('일정 삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
    }
  };

  // 크루 멤버 가져오기
  const fetchOrgMembers = async () => {
    setIsLoadingMembers(true);
    try {
      // organizationMembers 조회
      const orgMembersData = await membersDB.getByOrganization(localSchedule.organizationId);

      // 멤버 리스트 생성 (각 멤버의 userProfile 정보 가져오기)
      const members = await Promise.all(
        orgMembersData.map(async (orgMemberData) => {
          const userProfile = await usersDB.get(orgMemberData.userId);

          return {
            id: orgMemberData.memberId,
            uid: orgMemberData.userId,
            name: userProfile?.name || '알 수 없음',
            email: userProfile?.email || '',
            avatar: userProfile?.avatar || userProfile?.photoURL || '',
            orgId: orgMemberData.organizationId,
            role: orgMemberData.role || 'member',
          };
        })
      );

      setOrgMembers(members);
    } catch (error) {
      console.error('Error fetching members:', error);
      alert('멤버 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // 참석자 추가 핸들러
  const handleAddParticipant = async (member: any, status: 'going' | 'waiting' | 'declined' = 'going') => {
    try {
      // 현재 스케줄 데이터 가져오기
      const currentSchedule = await schedulesDB.get(scheduleId);

      if (!currentSchedule) {
        throw new Error('일정을 찾을 수 없습니다.');
      }

      const participants = (currentSchedule.participants || [])
        .filter((p: any) => typeof p === 'object' && p !== null && p.userId);

      // 이미 참석자인지 확인
      const alreadyParticipant = participants.some((p: any) => p.userId === member.uid);
      if (alreadyParticipant) {
        throw new Error('이미 참석자 목록에 있습니다.');
      }

      // 새 참석자 추가
      const newParticipant = {
        userId: member.uid,
        userName: member.name,
        userAvatar: member.avatar || null,
        status,
        respondedAt: Date.now(),
      };

      await schedulesDB.update(scheduleId, {
        participants: [...participants, newParticipant],
      });

      // 로컬 상태 업데이트
      setLocalSchedule((prev) => ({
        ...prev,
        participants: [
          ...prev.participants,
          {
            userId: member.uid,
            userName: member.name,
            userAvatar: member.avatar,
            status,
            respondedAt: { toDate: () => new Date() } as any,
          },
        ],
      }));

      alert(`${member.name}님을 추가했습니다.`);
    } catch (error: any) {
      console.error('Error adding participant:', error);
      alert(error.message || '참석자 추가에 실패했습니다.');
    }
  };

  // 참석자 제거 핸들러 (벙주 또는 크루장만)
  const handleRemoveParticipant = async (userId: string) => {
    try {
      // DynamoDB에서 현재 데이터 가져오기
      const scheduleData = await schedulesDB.get(scheduleId);
      if (!scheduleData) {
        throw new Error('일정을 찾을 수 없습니다.');
      }

      const participants = scheduleData.participants || [];

      // 제거할 참석자를 DynamoDB 데이터에서 찾기
      const removedUser = participants.find((p: any) => p.userId === userId);
      if (!removedUser) {
        throw new Error('참석자를 찾을 수 없습니다.');
      }

      // DynamoDB에서 참석자 제거 (필터링을 통해 구현)
      const updatedParticipants = participants.filter((p: any) => p.userId !== userId);

      await schedulesDB.update(scheduleId, {
        participants: updatedParticipants,
      });

      // 로컬 상태 업데이트
      setLocalSchedule(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.userId !== userId)
      }));

      // 참고: DynamoDB에는 subcollections이 없으므로 시스템 메시지를 저장하지 않습니다.
      // 필요시 별도의 messages 테이블에 저장 가능

      alert(`${removedUser.userName}님을 참석자에서 제외했습니다.`);
    } catch (error) {
      console.error('참석자 제거 실패:', error);
      alert('참석자를 제거하는 중에 문제가 생겼어요');
    }
  };


  return (
    <>
      {/* 고정 뒤로가기 버튼 */}
      <button
        onClick={handleBack}
        className="fixed top-4 left-4 z-50 w-10 h-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-all active:scale-95"
        aria-label="뒤로 가기"
      >
        <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
      </button>

    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* 일정 정보 */}
      {!isEditing ? (
        <>
          <ScheduleSummaryCard schedule={localSchedule} />

          {/* 수정/참석자 관리 버튼 (작성자만) */}
          {canDelete && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsEditing(true)}
                className="flex-1"
              >
                ✏️ 일정 수정
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowManageParticipants(!showManageParticipants);
                  if (!showManageParticipants && orgMembers.length === 0) {
                    fetchOrgMembers();
                  }
                }}
                className="flex-1"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  참석자 관리
                </span>
              </Button>
            </div>
          )}

          {/* 참석자 관리 패널 */}
          {showManageParticipants && canDelete && (
            <Card variant="elevated" padding="lg">
              <CardBody className="space-y-4">
                <h3 className="text-heading-3 font-bold">참석자 관리</h3>

                {isLoadingMembers ? (
                  <p className="text-center text-muted-foreground">로딩 중...</p>
                ) : (
                  <div className="space-y-4">
                    {/* 현재 참석자 목록 */}
                    {participantsWithDisplayNames.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">현재 참석자 ({participantsWithDisplayNames.length}명)</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {participantsWithDisplayNames.map((participant) => (
                            <div
                              key={participant.userId}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {participant.userAvatar && (
                                  <img
                                    src={participant.userAvatar}
                                    alt={participant.displayName}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                )}
                                <div>
                                  <span className="font-medium">{participant.displayName}</span>
                                  {participant.userId === currentUserId && (
                                    <span className="ml-2 text-xs text-muted-foreground">(나)</span>
                                  )}
                                </div>
                              </div>
                              {participant.userId !== currentUserId && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleRemoveParticipant(participant.userId)}
                                >
                                  제외
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 추가 가능한 멤버 목록 */}
                    {orgMembers.filter((member) => !localSchedule.participants.some((p) => p.userId === member.uid)).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          추가 가능한 멤버 ({orgMembers.filter((member) => !localSchedule.participants.some((p) => p.userId === member.uid)).length}명)
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {orgMembers
                            .filter((member) => !localSchedule.participants.some((p) => p.userId === member.uid))
                            .map((member) => (
                              <div
                                key={member.uid}
                                className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted-dark transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {member.avatar && (
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  )}
                                  <span className="font-medium">{member.name}</span>
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAddParticipant(member)}
                                >
                                  추가
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {orgMembers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">크루 멤버가 없습니다.</p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card variant="elevated" padding="lg">
          <CardBody className="space-y-4">
            <h3 className="text-heading-3 font-bold">일정 수정</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">제목 *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">날짜 *</label>
                  <input
                    type="date"
                    value={editForm.dateISO}
                    onChange={(e) => setEditForm({ ...editForm, dateISO: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">시간</label>
                  <input
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">장소</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">설명</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">최대 참석자 수</label>
                <input
                  type="number"
                  value={editForm.maxParticipants || ''}
                  onChange={(e) => setEditForm({ ...editForm, maxParticipants: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleUpdate}
                className="flex-1"
              >
                💾 저장
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsEditing(false)}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 참석 응답 버튼 */}
      <RSVPButtons
        scheduleId={scheduleId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        currentStatus={currentStatus}
        maxParticipants={localSchedule.maxParticipants}
        currentGoingCount={currentGoingCount}
        onStatusChange={handleStatusChange}
      />

      {/* 참여자 리스트 */}
      <ParticipantStrip
        participants={localSchedule.participants}
        currentUserId={currentUserId}
        scheduleOwnerId={localSchedule.createdByUid}
        crewOwnerId={orgData?.ownerUid}
      />

      {/* 채팅 섹션 - 모든 일정에 활성화 */}
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


      {/* 삭제 버튼 (작성자만) */}
      {canDelete && (
        <div className="pt-4 border-t border-border">
          <Button
            variant="danger"
            size="md"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full"
          >
            {isDeleting ? '삭제 중...' : '🗑️ 일정 삭제'}
          </Button>
        </div>
      )}
    </div>
    </>
  );
}
