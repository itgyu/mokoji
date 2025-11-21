import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { CrewSettingsClient } from './CrewSettingsClient';

export default async function CrewSettingsPage({
  params,
}: {
  params: { crewId: string };
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    redirect('/auth');
  }

  try {
    // 세션 검증
    const decodedClaims = await adminAuth.verifySessionCookie(session, true);
    const uid = decodedClaims.uid;

    // 크루 정보 가져오기
    const crewDoc = await adminDb.collection('organizations').doc(params.crewId).get();

    if (!crewDoc.exists) {
      redirect('/dashboard');
    }

    const crewData = crewDoc.data();

    // 크루장 권한 확인
    if (crewData?.ownerUid !== uid) {
      redirect('/dashboard');
    }

    // 크루 멤버 목록 가져오기
    const membersSnapshot = await adminDb
      .collection('members')
      .where('orgId', '==', params.crewId)
      .get();

    const members = membersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 사용자 정보 가져오기
    const userDoc = await adminDb.collection('userProfiles').doc(uid).get();
    const userData = userDoc.data();

    return (
      <CrewSettingsClient
        crewId={params.crewId}
        crewData={{
          id: crewDoc.id,
          ...crewData,
        }}
        members={members}
        currentUserId={uid}
        currentUserName={userData?.name || '사용자'}
      />
    );
  } catch (error) {
    console.error('Error loading crew settings:', error);
    redirect('/dashboard');
  }
}
