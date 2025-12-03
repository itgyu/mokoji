'use client';

/**
 * CONVERSION NOTE: Firebase → DynamoDB Migration
 *
 * This file has been converted from Firebase/Firestore to AWS DynamoDB.
 *
 * Major changes:
 * 1. Imports: Removed Firebase imports, added DynamoDB library imports
 * 2. Database operations:
 *    - handleSaveCrew: Uses organizationsDB.update() instead of updateDoc
 *    - handleSaveRole: Uses membersDB.update() instead of updateDoc
 *    - handleRemoveMember: Uses membersDB.delete() and usersDB.update()
 *    - handleDeleteCrew: Uses schedulesDB and membersDB queries, then delete operations
 * 3. Timestamps: new Date() → Date.now()
 * 4. All Firestore references removed
 *
 * Known limitations:
 * - No real-time updates (client needs to refresh to see changes)
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { organizationsAPI, membersAPI, usersAPI, schedulesAPI } from '@/lib/api-client';
import { Button, Card, CardBody, Avatar } from '@/components/ui';
import { ChevronLeft, Users, Trash2, Settings, Camera, X, Shield, ImageIcon, Save, MapPin } from 'lucide-react';
import LocationSettings from '@/components/LocationSettings';
import { uploadToS3 } from '@/lib/s3-client';
import { addDuplicateNameSuffixes } from '@/lib/name-utils';

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

  // initialMembers가 업데이트되면 members 상태도 업데이트
  useEffect(() => {
    console.log('🔄 CrewSettingsClient - initialMembers 업데이트:', initialMembers.length, '명');
    setMembers(initialMembers);
  }, [initialMembers]);

  // 동명이인 처리: 같은 이름에 A, B, C... 접미사 추가
  const membersWithDisplayNames = useMemo(() => {
    return addDuplicateNameSuffixes(members)
  }, [members]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<{ member: any; newRole: string } | null>(null);
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [crewRegion, setCrewRegion] = useState(crewData.region || null);

  const [editForm, setEditForm] = useState({
    name: crewData.name || '',
    subtitle: crewData.subtitle || '',
    description: crewData.description || '',
  });

  // 이미지 파일 선택 핸들러
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 크루 정보 수정
  const handleSaveCrew = async () => {
    if (!editForm.name.trim()) {
      alert('크루 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        updatedAt: Date.now(),
      };

      // 서브타이틀 업데이트
      if (editForm.subtitle && editForm.subtitle.trim()) {
        updateData.subtitle = editForm.subtitle.trim();
      } else {
        updateData.subtitle = '';
      }

      // 이미지 업로드
      if (imageFile) {
        const avatarUrl = await uploadToS3(imageFile, `organizations/${crewId}`);
        updateData.avatar = avatarUrl;
        updateData.imageUrl = avatarUrl; // 기존 필드 호환성
      }

      await organizationsAPI.update(crewId, updateData);

      alert('크루 정보가 수정되었습니다.');
      setIsEditing(false);
      setImageFile(null);
      setImagePreview(null);
      router.refresh();
    } catch (error) {
      console.error('Error updating crew:', error);
      alert('크루 정보 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 크루 지역 저장
  const handleSaveRegion = async (location: {
    address: string;
    dong: string;
    latitude: number;
    longitude: number;
    radius: number;
  }) => {
    try {
      const regionData = {
        address: location.address,
        dong: location.dong,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
      };

      await organizationsAPI.update(crewId, {
        region: regionData,
        updatedAt: Date.now(),
      });

      setCrewRegion(regionData);
      alert('크루 지역이 설정되었습니다.');
    } catch (error) {
      console.error('Error saving crew region:', error);
      alert('크루 지역 설정에 실패했습니다.');
    }
  };

  // 멤버 역할 변경 모달 열기
  const handleOpenRoleEdit = (member: any) => {
    setEditingRole({
      member,
      newRole: member.role,
    });
  };

  // 운영진 권한 토글
  const handleToggleAdmin = () => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      newRole: editingRole.newRole === 'admin' ? 'member' : 'admin',
    });
  };

  // 멤버 역할 변경 저장
  const handleSaveRole = async () => {
    if (!editingRole) return;

    const { member, newRole } = editingRole;

    if (newRole === member.role) {
      setEditingRole(null);
      return;
    }

    try {
      await membersAPI.update(member.id, {
        role: newRole,
        updatedAt: Date.now(),
      });

      // 로컬 상태 업데이트
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );

      alert(
        `${member.name}님의 역할이 ${newRole === 'admin' ? '운영진' : '일반 멤버'}로 변경되었습니다.`
      );
      setEditingRole(null);
    } catch (error) {
      console.error('Error changing role:', error);
      alert('역할 변경에 실패했습니다.');
    }
  };

  // 멤버 제거
  const handleRemoveMember = async (memberId: string, memberName: string, memberUid: string) => {
    if (!confirm(`${memberName}님을 크루에서 내보낼까요?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      // members 테이블에서 삭제
      await membersAPI.delete(memberId);

      // users의 organizations 배열에서 제거
      const userResponse = await usersAPI.get(memberUid);
      const userProfile = userResponse?.user || userResponse;

      if (userProfile) {
        const currentOrgs = userProfile.organizations || [];
        const updatedOrgs = currentOrgs.filter((orgId: string) => orgId !== crewId);
        await usersAPI.update(memberUid, {
          organizations: updatedOrgs,
        });
      }

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
      const schedulesResponse: any = await schedulesAPI.getByOrganization(crewId);
      const schedules = schedulesResponse?.schedules || schedulesResponse || [];

      for (const schedule of schedules) {
        await schedulesAPI.delete(schedule.scheduleId);
      }

      // 크루의 모든 멤버 삭제
      for (const member of members) {
        await membersAPI.delete(member.id);
      }

      // 크루 삭제
      await organizationsAPI.delete(crewId);

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
          <h1 className="text-lg font-bold">크루 관리</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* 크루 정보 섹션 */}
        <Card padding="lg">
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
                  <label className="block text-sm font-medium mb-2">크루 서브타이틀</label>
                  <input
                    type="text"
                    value={editForm.subtitle}
                    onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    placeholder="예: OUTDOOR LIFE"
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
                  <label className="block text-sm font-medium mb-2">크루 메인 사진</label>
                  <div className="space-y-2">
                    {(imagePreview || crewData.imageUrl || crewData.avatar) && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={imagePreview || crewData.imageUrl || crewData.avatar}
                          alt="크루 이미지"
                          className="w-full h-full object-cover"
                        />
                        {imageFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 py-2.5 px-4 bg-white border border-border text-foreground rounded-lg font-medium text-center cursor-pointer hover:bg-muted active:scale-[0.99] transition-transform duration-200 flex items-center justify-center gap-2">
                        <Camera className="w-4 h-4" strokeWidth={1.5} />
                        사진 촬영
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect(file);
                          }}
                          className="hidden"
                        />
                      </label>
                      <label className="flex-1 py-2.5 px-4 bg-white border border-border text-foreground rounded-lg font-medium text-center cursor-pointer hover:bg-muted active:scale-[0.99] transition-transform duration-200 flex items-center justify-center gap-2">
                        <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                        갤러리
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">※ 5MB 이하 권장</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveCrew}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: crewData.name || '',
                        subtitle: crewData.subtitle || '',
                        description: crewData.description || '',
                      });
                      setImageFile(null);
                      setImagePreview(null);
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
                {(crewData.imageUrl || crewData.avatar) && (
                  <img
                    src={crewData.imageUrl || crewData.avatar}
                    alt={crewData.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">크루 이름</p>
                  <p className="font-semibold">{crewData.name}</p>
                </div>
                {crewData.subtitle && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">크루 서브타이틀</p>
                    <p className="font-medium">{crewData.subtitle}</p>
                  </div>
                )}
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

        {/* 크루 지역 설정 섹션 */}
        <Card padding="lg">
          <CardBody className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              크루 지역 설정
            </h2>

            <p className="text-sm text-muted-foreground">
              크루의 활동 지역을 설정하세요. 해당 지역 근처의 회원들에게 크루가 노출됩니다.
            </p>

            {crewRegion ? (
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-bold">{crewRegion.dong}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{crewRegion.address}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    활동 반경: {crewRegion.radius >= 1000 ? `${crewRegion.radius / 1000}km` : `${crewRegion.radius}m`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowLocationSettings(true)}
                  className="w-full"
                >
                  지역 변경하기
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowLocationSettings(true)}
                className="w-full"
              >
                <MapPin className="w-4 h-4 mr-2" />
                크루 지역 설정하기
              </Button>
            )}
          </CardBody>
        </Card>

        {/* 멤버 관리 섹션 */}
        <Card padding="lg">
          <CardBody className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              멤버 관리 ({members.length}명)
            </h2>

            <div className="space-y-2">
              {membersWithDisplayNames
                .sort((a, b) => {
                  // 크루장이 맨 위
                  if (a.uid === currentUserId) return -1;
                  if (b.uid === currentUserId) return 1;
                  // 운영진이 그 다음
                  if (a.role === 'admin' && b.role !== 'admin') return -1;
                  if (a.role !== 'admin' && b.role === 'admin') return 1;
                  // 나머지는 이름순
                  return a.displayName.localeCompare(b.displayName);
                })
                .map((member) => {
                  const isOwner = member.uid === currentUserId;
                  const role = isOwner ? 'owner' : member.role;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={member.avatar}
                          alt={member.displayName}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium whitespace-nowrap">{member.displayName}</p>
                            {role === 'owner' && (
                              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                크루장
                              </span>
                            )}
                            {role === 'admin' && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                운영진
                              </span>
                            )}
                          </div>
                          {member.joinedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              가입: {
                                member.joinedAt.seconds
                                  ? new Date(member.joinedAt.seconds * 1000).toLocaleDateString('ko-KR')
                                  : new Date(member.joinedAt).toLocaleDateString('ko-KR')
                              }
                            </p>
                          )}
                          {member.birthdate && (
                            <p className="text-xs text-muted-foreground mt-0.5">생년월일: {member.birthdate}</p>
                          )}
                        </div>
                      </div>

                      {!isOwner && (
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRoleEdit(member)}
                            className="flex items-center gap-1 text-xs px-2 py-1 whitespace-nowrap"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            역할
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.name, member.uid)}
                            className="flex items-center gap-1 text-xs px-2 py-1 whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            내보내기
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>

        {/* 위험 구역 */}
        <Card padding="lg">
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
                {isDeleting ? '삭제 중...' : '크루 영구 삭제'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 역할 변경 모달 */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">멤버 역할 변경</h2>
              <button
                onClick={() => setEditingRole(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar
                  src={editingRole.member.avatar}
                  alt={editingRole.member.name}
                  size="md"
                />
                <div>
                  <p className="font-medium">{editingRole.member.name}</p>
                  <p className="text-sm text-muted-foreground">
                    현재: {editingRole.member.role === 'admin' ? '운영진' : '일반 멤버'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">권한 관리</p>

                <div className="p-4 border border-border rounded-lg space-y-4">
                  {/* 운영진 권한 토글 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">운영진 권한</p>
                        <p className="text-xs text-muted-foreground">일정 생성/수정/삭제</p>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleAdmin}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editingRole.newRole === 'admin' ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editingRole.newRole === 'admin' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 상태 표시 */}
                  <div className={`p-3 rounded-lg ${
                    editingRole.newRole === 'admin' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <p className="text-sm">
                      {editingRole.newRole === 'admin' ? (
                        <span className="text-blue-700">
                          ✓ 운영진 권한이 <strong>부여</strong>됩니다
                        </span>
                      ) : (
                        <span className="text-gray-600">
                          일반 멤버 권한만 유지됩니다
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveRole}
                className="flex-1"
              >
                저장
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setEditingRole(null)}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 지역 설정 모달 */}
      <LocationSettings
        isOpen={showLocationSettings}
        onClose={() => setShowLocationSettings(false)}
        onSave={handleSaveRegion}
        initialLocation={crewRegion ? {
          latitude: crewRegion.latitude,
          longitude: crewRegion.longitude,
          radius: crewRegion.radius,
        } : undefined}
      />
    </div>
  );
}
