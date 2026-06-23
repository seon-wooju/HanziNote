/**
 * Home Page
 *
 * 메인 메뉴 그리드 표시: 각 기능별 아이콘 카드와 오늘의 복습 카드 수를 보여줌.
 *
 * Requirements: 14.1, 10.8
 */

import { useEffect } from 'react';
import { useAppStore, type PageType } from '../stores/appStore';
import { useFlashcardStore } from '../stores/flashcardStore';

// ============================================================
// Types
// ============================================================

interface MenuCard {
  page: PageType;
  label: string;
  icon: string;
  showDueBadge?: boolean;
}

// ============================================================
// Menu Items
// ============================================================

const MENU_ITEMS: MenuCard[] = [
  { page: 'input', label: '입력기', icon: '⌨️' },
  { page: 'vocab', label: '단어장', icon: '📖', showDueBadge: true },
  { page: 'pronunciation', label: '발음 연습', icon: '🎤' },
  { page: 'writing', label: '쓰기 연습', icon: '✍️' },
  { page: 'stats', label: '통계', icon: '📊' },
  { page: 'settings', label: '설정', icon: '⚙️' },
];

// ============================================================
// HomePage Component
// ============================================================

export function HomePage() {
  const navigateTo = useAppStore((state) => state.navigateTo);
  const dueCount = useFlashcardStore((state) => state.dueCount);
  const loadDueCards = useFlashcardStore((state) => state.loadDueCards);

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  return (
    <div className="flex flex-col items-center px-4 py-8 max-w-3xl mx-auto">
      {/* App Title */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">HanziNote</h1>
        <p className="text-sm text-gray-500 mt-1">중국어 학습 노트</p>
      </header>

      {/* Due Card Badge */}
      {dueCount > 0 && (
        <div className="mb-6 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-medium">
          오늘 복습: {dueCount}장
        </div>
      )}

      {/* Menu Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.page}
            onClick={() => navigateTo(item.page)}
            className="relative flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 border border-gray-100"
            aria-label={item.label}
          >
            <span className="text-4xl" aria-hidden="true">
              {item.icon}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {item.label}
            </span>

            {/* Due count badge on vocabulary card */}
            {item.showDueBadge && dueCount > 0 && (
              <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                {dueCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default HomePage;
