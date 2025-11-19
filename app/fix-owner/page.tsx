'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function FixOwnerPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const fixOwner = async () => {
    setLoading(true);
    setStatus('처리 중...');

    try {
      const targetUid = 'Ng2AroWF0BgRDP6nrR1WXqf4ImA3';

      // userProfiles에서 이름 가져오기
      const userProfileDoc = await getDoc(doc(db, 'userProfiles', targetUid));
      const targetName = userProfileDoc.exists() ? userProfileDoc.data().name : '이태규';

      // 1. "it's campers" 조직 찾기
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));

      let found = false;

      for (const orgDoc of orgsSnapshot.docs) {
        const orgData = orgDoc.data();

        // "it's campers" 조직만 업데이트
        if (orgData.name === "it's campers" || orgData.name === "it's campers" || orgData.name.toLowerCase().includes("it's campers")) {
          setStatus(`처리 중: ${orgData.name}...`);

          await updateDoc(doc(db, 'organizations', orgDoc.id), {
            ownerUid: targetUid,
            ownerName: targetName,
            updatedAt: new Date(),
          });

          setStatus(`✅ ${orgData.name} - 크루장 업데이트 완료`);
          found = true;
          break;
        }
      }

      if (found) {
        setStatus(`🎉 완료! "it's campers" 크루의 크루장으로 설정되었습니다.`);
      } else {
        setStatus(`❌ "it's campers" 크루를 찾을 수 없습니다.`);
      }
      setLoading(false);

    } catch (error: any) {
      console.error('Error:', error);
      setStatus(`❌ 오류: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">🔧 크루장 설정</h1>

        <div className="mb-6 p-4 bg-blue-50 rounded">
          <p className="text-sm font-mono">
            <strong>UID:</strong> Ng2AroWF0BgRDP6nrR1WXqf4ImA3<br/>
            <strong>이메일:</strong> itgyu@kakao.com
          </p>
        </div>

        <button
          onClick={fixOwner}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
        >
          {loading ? '처리 중...' : `"it's campers" 크루장으로 설정`}
        </button>

        {status && (
          <div className={`mt-4 p-4 rounded ${
            status.includes('❌') ? 'bg-red-50 text-red-700' :
            status.includes('🎉') ? 'bg-green-50 text-green-700' :
            'bg-gray-50 text-gray-700'
          }`}>
            <pre className="text-sm whitespace-pre-wrap">{status}</pre>
          </div>
        )}

        <a
          href="/debug-permissions"
          className="block mt-4 text-center text-blue-600 hover:underline"
        >
          디버그 페이지에서 확인하기
        </a>
      </div>
    </div>
  );
}
