/**
 * Navigation Component
 *
 * 반응형 네비게이션 바:
 * - 모바일 (< 768px): 하단 고정 네비게이션
 * - 데스크톱 (>= 768px): 좌측 사이드 네비게이션
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { useAppStore, type PageType } from '../stores/appStore';

// ============================================================
// Types
// ============================================================

interface NavItem {
  page: PageType;
  label: string;
  icon: string;
}

// ============================================================
// Navigation Items
// ============================================================

const NAV_ITEMS: NavItem[] = [
  { page: 'home', label: '홈', icon: '🏠' },
  { page: 'input', label: '입력기', icon: '⌨️' },
  { page: 'vocab', label: '단어장', icon: '📖' },
  { page: 'pronunciation', label: '발음 연습', icon: '🎤' },
  { page: 'writing', label: '쓰기 연습', icon: '✍️' },
  { page: 'stats', label: '통계', icon: '📊' },
  { page: 'settings', label: '설정', icon: '⚙️' },
];

// ============================================================
// Navigation Component
// ============================================================

export function Navigation() {
  const currentPage = useAppStore((state) => state.currentPage);
  const navigateTo = useAppStore((state) => state.navigateTo);

  return (
    <>
      {/* Desktop Side Navigation (>= 768px) */}
      <nav
        className="hidden md:flex md:flex-col md:w-56 md:min-h-screen md:bg-white md:border-r md:border-gray-200 md:shadow-sm md:fixed md:left-0 md:top-0 md:z-40"
        aria-label="메인 네비게이션"
      >
        {/* Back/Home button header */}
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors w-full text-left"
            aria-label="홈으로 돌아가기"
          >
            <span className="text-lg">←</span>
            <span className="text-sm font-medium">홈으로</span>
          </button>
        </div>

        {/* Nav items */}
        <ul className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.page}>
              <button
                onClick={() => navigateTo(item.page)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                  currentPage === item.page
                    ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                }`}
                aria-current={currentPage === item.page ? 'page' : undefined}
              >
                <span className="text-xl" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile Bottom Navigation (< 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40"
        aria-label="메인 네비게이션"
      >
        <ul className="flex justify-around items-center h-16 px-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.page}>
              <button
                onClick={() => navigateTo(item.page)}
                className={`flex flex-col items-center justify-center px-1 py-1 min-w-[44px] rounded-lg transition-colors ${
                  currentPage === item.page
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-blue-500'
                }`}
                aria-current={currentPage === item.page ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                <span
                  className={`text-[10px] mt-0.5 leading-tight ${
                    currentPage === item.page ? 'font-semibold' : 'font-normal'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export default Navigation;
