/**
 * StatsPage
 *
 * 학습 통계 페이지: 전체 통계(총 학습/필기/발음 횟수, 최근 학습일)와
 * 오늘의 단어별 학습 현황을 표시.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { useEffect, useState } from 'react';
import {
  getTodayStats,
  getOverallStats,
  type DailyStats,
  type OverallStats,
} from '../services/statisticsManager';

// ============================================================
// Helper
// ============================================================

function formatDate(date: Date | null): string {
  if (!date) return '없음';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// Component
// ============================================================

export function StatsPage() {
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [daily, setDaily] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [overallData, dailyData] = await Promise.all([
          getOverallStats(),
          getTodayStats(),
        ]);
        setOverall(overallData);
        setDaily(dailyData);
      } catch {
        // On error, leave stats as null (zero state will render)
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">통계 로딩 중...</p>
      </div>
    );
  }

  const isFirstLaunch =
    overall !== null &&
    overall.totalStudyCount === 0 &&
    overall.totalWritingCount === 0 &&
    overall.totalPronunciationCount === 0 &&
    overall.lastStudiedAt === null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">학습 통계</h1>

      {/* First launch zero state message */}
      {isFirstLaunch && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-blue-700">
            아직 학습 기록이 없습니다. 입력기에서 단어를 저장하고 학습을 시작해보세요!
          </p>
        </div>
      )}

      {/* Overall stats cards */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon="📚"
            label="총 학습"
            value={`${overall?.totalStudyCount ?? 0}회`}
          />
          <StatCard
            icon="✍️"
            label="총 필기"
            value={`${overall?.totalWritingCount ?? 0}회`}
          />
          <StatCard
            icon="🎤"
            label="총 발음"
            value={`${overall?.totalPronunciationCount ?? 0}회`}
          />
          <StatCard
            icon="📅"
            label="최근 학습"
            value={formatDate(overall?.lastStudiedAt ?? null)}
          />
        </div>
      </section>

      {/* Today's stats section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          오늘의 학습{' '}
          <span className="text-sm font-normal text-gray-400">
            ({getTodayDateLabel()})
          </span>
        </h2>

        {daily && daily.wordStats.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 divide-y divide-gray-100">
            {daily.wordStats.map((ws) => (
              <div
                key={ws.wordId}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-lg font-medium text-gray-800">
                  {ws.hanzi}
                </span>
                <span className="text-sm text-gray-500">{ws.count}회</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-gray-400">오늘 학습 기록이 없습니다</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Sub-component: StatCard
// ============================================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
