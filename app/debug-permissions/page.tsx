'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export default function DebugPermissionsPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        // 0. 사용자 프로필에서 이름 가져오기
        const userProfileDoc = await getDoc(doc(db, 'userProfiles', user.uid));
        if (userProfileDoc.exists()) {
          setUserName(userProfileDoc.data().name || user.displayName || '없음');
        } else {
          setUserName(user.displayName || '없음');
        }

        // 1. 모든 일정 가져오기
        const schedulesSnapshot = await getDocs(collection(db, 'org_schedules'));
        const schedulesData = schedulesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setSchedules(schedulesData);

        // 2. 모든 조직 정보 가져오기
        const orgIds = new Set(schedulesData.map((s: any) => s.organizationId).filter(Boolean));
        const orgsMap = new Map();

        for (const orgId of orgIds) {
          const orgDoc = await getDoc(doc(db, 'organizations', orgId));
          if (orgDoc.exists()) {
            orgsMap.set(orgId, orgDoc.data());
          }
        }

        setOrgs(orgsMap);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 권한 디버그 페이지</h1>

        {/* 현재 사용자 정보 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">👤 현재 로그인 사용자</h2>
          <div className="space-y-2 font-mono text-sm">
            <p><strong>UID:</strong> <span className="text-blue-600">{user.uid}</span></p>
            <p><strong>이름:</strong> {userName}</p>
            <p><strong>이메일:</strong> {user.email}</p>
          </div>
        </div>

        {/* 조직 정보 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">🏕️ 크루(조직) 정보</h2>
          <div className="space-y-4">
            {Array.from(orgs.entries()).map(([orgId, orgData]) => (
              <div key={orgId} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50">
                <p className="font-bold">{orgData.name}</p>
                <div className="font-mono text-sm space-y-1 mt-2">
                  <p><strong>조직 ID:</strong> {orgId}</p>
                  <p><strong>크루장 UID:</strong> <span className="text-purple-600">{orgData.ownerUid || '⚠️ 없음'}</span></p>
                  <p><strong>크루장 이름:</strong> {orgData.ownerName || '없음'}</p>
                  <p className="mt-2">
                    {orgData.ownerUid === user.uid ? (
                      <span className="text-green-600 font-bold">✅ 당신이 크루장입니다</span>
                    ) : (
                      <span className="text-red-600">❌ 크루장이 아닙니다</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 일정 목록 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📅 일정 목록 및 권한</h2>
          <div className="space-y-4">
            {schedules.map((schedule) => {
              const org = orgs.get(schedule.organizationId);
              const isCreator = schedule.createdByUid === user.uid;
              const isLeader = org?.ownerUid === user.uid;
              const hasPermission = isCreator || isLeader;

              return (
                <div
                  key={schedule.id}
                  className={`border-l-4 pl-4 py-3 ${
                    hasPermission ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <p className="font-bold text-lg">{schedule.title}</p>
                  <div className="font-mono text-sm space-y-1 mt-2">
                    <p><strong>일정 ID:</strong> {schedule.id}</p>
                    <p><strong>작성자 UID:</strong> <span className="text-orange-600">{schedule.createdByUid || '⚠️ 없음'}</span></p>
                    <p><strong>조직 ID:</strong> {schedule.organizationId || '없음'}</p>
                    <p><strong>조직명:</strong> {org?.name || '없음'}</p>

                    <div className="mt-3 space-y-1">
                      <p>
                        {isCreator ? (
                          <span className="text-green-600">✅ 일정 작성자입니다</span>
                        ) : (
                          <span className="text-gray-500">❌ 일정 작성자가 아닙니다</span>
                        )}
                      </p>
                      <p>
                        {isLeader ? (
                          <span className="text-green-600">✅ 크루장입니다</span>
                        ) : (
                          <span className="text-gray-500">❌ 크루장이 아닙니다</span>
                        )}
                      </p>
                      <p className="font-bold text-lg mt-2">
                        {hasPermission ? (
                          <span className="text-blue-600">🎯 수정/삭제 권한 있음</span>
                        ) : (
                          <span className="text-red-600">🚫 수정/삭제 권한 없음</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            대시보드로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
