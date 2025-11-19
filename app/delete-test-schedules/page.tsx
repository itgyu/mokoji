'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function DeleteTestSchedulesPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);

  const findTestSchedules = async () => {
    setLoading(true);
    setStatus('일정 찾는 중...');

    try {
      const schedulesSnapshot = await getDocs(collection(db, 'org_schedules'));
      const testSchedules = schedulesSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.title && data.title.includes('테스트 등산 모임');
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      setSchedules(testSchedules);
      setStatus(`✅ ${testSchedules.length}개의 "테스트 등산 모임" 일정을 찾았습니다.`);
      setLoading(false);
    } catch (error: any) {
      console.error('Error:', error);
      setStatus(`❌ 오류: ${error.message}`);
      setLoading(false);
    }
  };

  const deleteAllTestSchedules = async () => {
    if (!window.confirm(`정말 ${schedules.length}개의 "테스트 등산 모임" 일정을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setStatus('삭제 중...');

    try {
      let deletedCount = 0;

      for (const schedule of schedules) {
        await deleteDoc(doc(db, 'org_schedules', schedule.id));
        deletedCount++;
        setStatus(`삭제 중... (${deletedCount}/${schedules.length})`);
      }

      setStatus(`🎉 완료! ${deletedCount}개의 일정을 삭제했습니다.`);
      setSchedules([]);
      setLoading(false);
    } catch (error: any) {
      console.error('Error:', error);
      setStatus(`❌ 오류: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-4">🗑️ 테스트 일정 삭제</h1>

        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ "테스트 등산 모임" 제목이 포함된 모든 일정을 삭제합니다.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={findTestSchedules}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
          >
            {loading ? '찾는 중...' : '테스트 일정 찾기'}
          </button>

          {schedules.length > 0 && (
            <>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <h3 className="font-bold mb-2">삭제할 일정 목록:</h3>
                <ul className="space-y-2">
                  {schedules.map((schedule) => (
                    <li key={schedule.id} className="text-sm border-l-4 border-red-500 pl-3 py-1">
                      <strong>{schedule.title}</strong>
                      <br />
                      <span className="text-gray-500 text-xs">ID: {schedule.id}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={deleteAllTestSchedules}
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
              >
                {loading ? '삭제 중...' : `${schedules.length}개 일정 모두 삭제`}
              </button>
            </>
          )}
        </div>

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
          href="/dashboard"
          className="block mt-4 text-center text-blue-600 hover:underline"
        >
          대시보드로 돌아가기
        </a>
      </div>
    </div>
  );
}
