'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
      // 크루 정보 가져오기
      const crewDoc = await getDoc(doc(db, 'organizations', unwrappedParams.crewId));

      if (!crewDoc.exists()) {
        alert('크루를 찾을 수 없습니다.');
        router.push('/dashboard');
        return;
      }

      // JSON 직렬화로 Timestamp 객체 완전히 제거
      const crewRawData = JSON.parse(JSON.stringify(crewDoc.data()));

      // 필요한 필드만 추출
      const crew = {
        id: crewDoc.id,
        name: crewRawData.name || '',
        subtitle: crewRawData.subtitle || '',
        description: crewRawData.description || '',
        imageUrl: crewRawData.imageUrl || '',
        avatar: crewRawData.avatar || '',
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
        query(collection(db, 'members'), where('orgId', '==', unwrappedParams.crewId))
      );

      // JSON 직렬화로 Timestamp 제거
      const membersList = membersSnapshot.docs.map((doc) => {
        const data = JSON.parse(JSON.stringify(doc.data()));
        return {
          id: doc.id,
          uid: data.uid || '',
          name: data.name || '',
          email: data.email || '',
          avatar: data.avatar || '',
          orgId: data.orgId || '',
          role: data.role || 'member',
          joinedAt: data.joinedAt || '',
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
      crewId={unwrappedParams.crewId}
      crewData={crewData}
      members={members}
      currentUserId={user.uid}
      currentUserName={userProfile.name || '사용자'}
    />
  );
}
