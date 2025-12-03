'use client';

/**
 * CONVERSION NOTE: Firebase → DynamoDB Migration
 *
 * This file has been converted from Firebase/Firestore to AWS DynamoDB.
 *
 * Major changes:
 * 1. Imports: Removed Firebase imports, added DynamoDB library imports
 * 2. Database operations:
 *    - loadCrewData: Uses organizationsDB.get() instead of Firestore doc query
 *    - Member loading: Uses membersDB.getByOrganization() and usersDB.get()
 * 3. Timestamps: serverTimestamp() replaced with Date.now()
 * 4. JSON serialization removed (not needed for DynamoDB)
 *
 * Known limitations:
 * - No real-time updates (client needs to refresh to see changes)
 */

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { organizationsAPI, membersAPI, usersAPI } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { CrewSettingsClient } from './CrewSettingsClient';
import LoadingScreen from '@/components/LoadingScreen';

export default function CrewSettingsPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  // Next.js 15+ params는 Promise이므로 use()로 unwrap
  const unwrappedParams = use(params);
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [crewData, setCrewData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth');
      return;
    }

    loadCrewData();
  }, [user, authLoading, unwrappedParams.crewId]);

  const loadCrewData = async () => {
    try {
      // 크루 정보 가져오기 (API를 통해)
      const response = await organizationsAPI.get(unwrappedParams.crewId);
      const crewDoc = response?.organization || response;

      if (!crewDoc) {
        alert('크루를 찾을 수 없습니다.');
        router.push('/dashboard');
        return;
      }

      // 필요한 필드만 추출
      const crew = {
        id: crewDoc.organizationId,
        name: crewDoc.name || '',
        subtitle: crewDoc.subtitle || '',
        description: crewDoc.description || '',
        imageUrl: crewDoc.imageUrl || '',
        avatar: crewDoc.avatar || '',
        ownerUid: crewDoc.ownerUid || '',
        ownerName: crewDoc.ownerName || '',
        categories: crewDoc.categories || [],
        memberCount: crewDoc.memberCount || 0,
      };

      // 크루장 권한 확인
      if (crew.ownerUid !== user!.sub) {
        alert('크루장만 접근할 수 있습니다.');
        router.push('/dashboard');
        return;
      }

      setCrewData(crew);

      // 크루 멤버 목록 가져오기 (API를 통해)
      console.log('🔍 멤버 조회 시작:', unwrappedParams.crewId);

      const membersResponse: any = await membersAPI.getByOrganization(unwrappedParams.crewId);
      const orgMembers = membersResponse?.members || membersResponse || [];

      console.log('📊 organizationMembers 조회 결과:', orgMembers.length, '명');

      // 멤버 리스트 생성
      const membersList = await Promise.all(
        orgMembers.map(async (orgMemberData: any) => {
          try {
            const userResponse = await usersAPI.get(orgMemberData.userId);
            const userProfile = userResponse?.user || userResponse;

            return {
              id: orgMemberData.memberId,
              uid: orgMemberData.userId,
              name: userProfile?.name || orgMemberData.userId,
              email: userProfile?.email || '',
              avatar: userProfile?.avatar || userProfile?.photoURL || '',
              birthdate: userProfile?.birthdate || undefined,
              orgId: orgMemberData.organizationId,
              role: orgMemberData.role || 'member',
              joinedAt: orgMemberData.joinedAt || null,
            };
          } catch (error) {
            console.error(`Error fetching user ${orgMemberData.userId}:`, error);
            return {
              id: orgMemberData.memberId,
              uid: orgMemberData.userId,
              name: orgMemberData.userId,
              email: '',
              avatar: '',
              birthdate: undefined,
              orgId: orgMemberData.organizationId,
              role: orgMemberData.role || 'member',
              joinedAt: orgMemberData.joinedAt || null,
            };
          }
        })
      );

      console.log('✅ 최종 멤버 리스트:', membersList.length, '명');
      setMembers(membersList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading crew data:', error);
      alert('크루 정보를 불러오는데 실패했습니다.');
      router.push('/dashboard');
    }
  };

  if (loading || authLoading) {
    return <LoadingScreen />;
  }

  if (!crewData || !user || !userProfile) {
    return null;
  }

  return (
    <CrewSettingsClient
      crewId={unwrappedParams.crewId}
      crewData={crewData}
      members={members}
      currentUserId={user.sub}
      currentUserName={userProfile.name || '사용자'}
    />
  );
}
