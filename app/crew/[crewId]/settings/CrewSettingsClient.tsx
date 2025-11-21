'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button, Card, CardBody, Avatar } from '@/components/ui';
import { ChevronLeft, Users, Trash2, Settings } from 'lucide-react';

interface CrewSettingsClientProps {
  crewId: string;
  crewData: any;
  members: any[];
  currentUserId: string;
  currentUserName: string;
}

export function CrewSettingsClient({
  crewId,
  crewData,
  members: initialMembers,
  currentUserId,
  currentUserName,
}: CrewSettingsClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [members, setMembers] = useState(initialMembers);

  const [editForm, setEditForm] = useState({
    name: crewData.name || '',
    description: crewData.description || '',
    imageUrl: crewData.imageUrl || '',
  });

  // 크루 정보 수정
  const handleSaveCrew = async () => {
    if (!editForm.name.trim()) {
      alert('크루 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const crewRef = doc(db, 'organizations', crewId);
      await updateDoc(crewRef, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        imageUrl: editForm.imageUrl.trim(),
        updatedAt: new Date(),
      });

      alert('크루 정보가 수정되었습니다.');
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating crew:', error);
      alert('크루 정보 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 멤버 제거
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 크루에서 내보낼까요?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      // members 컬렉션에서 삭제
      await deleteDoc(doc(db, 'members', memberId));

      // 로컬 상태 업데이트
      setMembers((prev) => prev.filter((m) => m.id !== memberId));

      alert(`${memberName}님을 크루에서 내보냈습니다.`);
    } catch (error) {
      console.error('Error removing member:', error);
      alert('멤버 제거에 실패했습니다.');
    }
  };

  // 크루 삭제
  const handleDeleteCrew = async () => {
    const confirmText = prompt(
      `정말로 "${crewData.name}" 크루를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 일정과 멤버 정보가 삭제됩니다.\n\n삭제하려면 크루 이름을 입력하세요:`
    );

    if (confirmText !== crewData.name) {
      if (confirmText !== null) {
        alert('크루 이름이 일치하지 않습니다.');
      }
      return;
    }

    setIsDeleting(true);
    try {
      // 크루의 모든 일정 삭제
      const schedulesSnapshot = await getDocs(
        query(collection(db, 'org_schedules'), where('organizationId', '==', crewId))
      );

      for (const scheduleDoc of schedulesSnapshot.docs) {
        await deleteDoc(scheduleDoc.ref);
      }

      // 크루의 모든 멤버 삭제
      for (const member of members) {
        await deleteDoc(doc(db, 'members', member.id));
      }

      // 크루 삭제
      await deleteDoc(doc(db, 'organizations', crewId));

      alert('크루가 삭제되었습니다.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting crew:', error);
      alert('크루 삭제에 실패했습니다.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">크루 관리</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* 크루 정보 섹션 */}
        <Card variant="elevated" padding="lg">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                크루 정보
              </h2>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  수정
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">크루 이름 *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    placeholder="크루 이름을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">크루 설명</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    placeholder="크루를 소개해주세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">크루 이미지 URL</label>
                  <input
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveCrew}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? '저장 중...' : '💾 저장'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: crewData.name || '',
                        description: crewData.description || '',
                        imageUrl: crewData.imageUrl || '',
                      });
                    }}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {crewData.imageUrl && (
                  <img
                    src={crewData.imageUrl}
                    alt={crewData.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">크루 이름</p>
                  <p className="font-semibold">{crewData.name}</p>
                </div>
                {crewData.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">크루 설명</p>
                    <p className="whitespace-pre-wrap">{crewData.description}</p>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 멤버 관리 섹션 */}
        <Card variant="elevated" padding="lg">
          <CardBody className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              멤버 관리 ({members.length}명)
            </h2>

            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={member.avatar}
                      alt={member.name}
                      fallback={member.name}
                      size="md"
                    />
                    <div>
                      <p className="font-medium">{member.name}</p>
                      {member.uid === currentUserId && (
                        <span className="text-xs text-muted-foreground">크루장</span>
                      )}
                    </div>
                  </div>

                  {member.uid !== currentUserId && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id, member.name)}
                    >
                      내보내기
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 위험 구역 */}
        <Card variant="elevated" padding="lg">
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-red-500 flex items-center gap-2 mb-2">
                <Trash2 className="w-5 h-5" />
                위험 구역
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                크루를 삭제하면 모든 일정, 멤버 정보가 영구적으로 삭제됩니다.
              </p>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteCrew}
                disabled={isDeleting}
                className="w-full"
              >
                {isDeleting ? '삭제 중...' : '🗑️ 크루 영구 삭제'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
