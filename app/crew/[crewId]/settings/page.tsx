'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CrewSettingsClient } from './CrewSettingsClient';
import LoadingScreen from '@/components/LoadingScreen';

export default function CrewSettingsPage({
  params,
}: {
  params: { crewId: string };
}) {
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
  }, [user, authLoading, params.crewId]);

  const loadCrewData = async () => {
    try {
      // 크루 정보 가져오기
      const crewDoc = await getDoc(doc(db, 'organizations', params.crewId));

      if (!crewDoc.exists()) {
        alert('크루를 찾을 수 없습니다.');
        router.push('/dashboard');
        return;
      }

      const crewRawData = crewDoc.data();

      // Timestamp 필드를 안전하게 처리
      const crew = {
        id: crewDoc.id,
        name: crewRawData.name || '',
        description: crewRawData.description || '',
        imageUrl: crewRawData.imageUrl || '',
        ownerUid: crewRawData.ownerUid || '',
        ownerName: crewRawData.ownerName || '',
        categories: crewRawData.categories || [],
        memberCount: crewRawData.memberCount || 0,
      };

      // 크루장 권한 확인
      if (crew.ownerUid !== user!.uid) {
        alert('크루장만 접근할 수 있습니다.');
        router.push('/dashboard');
        return;
      }

      setCrewData(crew);

      // 크루 멤버 목록 가져오기
      const membersSnapshot = await getDocs(
        query(collection(db, 'members'), where('orgId', '==', params.crewId))
      );

      const membersList = membersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid || '',
          name: data.name || '',
          email: data.email || '',
          avatar: data.avatar || '',
          orgId: data.orgId || '',
        };
      });

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
      crewId={params.crewId}
      crewData={crewData}
      members={members}
      currentUserId={user.uid}
      currentUserName={userProfile.name || '사용자'}
    />
  );
}
