/**
 * App Shell
 *
 * 메인 애플리케이션 셸: 라우팅, 네비게이션, 토스트 알림을 관리.
 * state-based navigation으로 currentPage에 따라 페이지 컴포넌트를 렌더링.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { useEffect } from 'react';
import { useAppStore, type PageType } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { loadExtendedDictionary } from './services/chineseConverter';
import Navigation from './components/Navigation';
import ToastContainer from './components/ToastContainer';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { HomePage } from './pages/HomePage';
import { PronunciationPage } from './pages/PronunciationPage';
import { WritingPage } from './pages/WritingPage';
import { InputPage } from './pages/InputPage';
import { FlashcardPage } from './pages/FlashcardPage';
import { VocabPage } from './pages/VocabPage';
import { StrokePage } from './pages/StrokePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

function PlaceholderPage({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <span className="text-5xl mb-4">{icon}</span>
      <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
      <p className="text-gray-400 mt-2">이 페이지는 준비 중입니다</p>
    </div>
  );
}

// ============================================================
// Page Renderer
// ============================================================

function PageRenderer({ currentPage }: { currentPage: PageType }) {
  switch (currentPage) {
    case 'home':
      return <HomePage />;
    case 'input':
      return <InputPage />;
    case 'vocab':
      return <VocabPage />;
    case 'pronunciation':
      return <PronunciationPage />;
    case 'writing':
      return <WritingPage />;
    case 'stroke':
      return <StrokePage />;
    case 'flashcard':
      return <FlashcardPage />;
    case 'stats':
      return <StatsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
}

// ============================================================
// App Component
// ============================================================

function App() {
  const currentPage = useAppStore((state) => state.currentPage);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadExtendedDictionary(); // 확장 사전 비동기 로드
  }, [loadSettings]);

  const isHomePage = currentPage === 'home';

  return (
    <div className="min-h-screen bg-gray-50 min-w-[320px] max-w-[1920px] mx-auto">
      {/* Network status banner */}
      <NetworkStatusBanner />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Navigation (hidden on home page) */}
      {!isHomePage && <Navigation />}

      {/* Main content area */}
      <main
        className={`${
          !isHomePage
            ? 'pb-20 md:pb-0 md:ml-56'
            : ''
        }`}
      >
        <PageRenderer currentPage={currentPage} />
      </main>
    </div>
  );
}

export default App;
