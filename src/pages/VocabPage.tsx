/**
 * Vocabulary Page (단어장)
 *
 * 두 가지 보기 모드:
 * 1. 플래시카드 보기 (기본): 앞면 한자 → 탭하면 뒤집어서 병음/뜻/발음 표시
 * 2. 리스트 보기: 기존 리스트 형태
 *
 * Requirements: 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 6.1, 6.2, 15.2
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getWords,
  searchByKorean,
  toggleFavorite,
  deleteWord,
  type VocabularyFilter,
} from '../services/vocabularyManager';
import { useSettingsStore } from '../stores/settingsStore';
import { speak } from '../services/ttsPlayer';
import { useAppStore } from '../stores/appStore';
import type { VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

type ViewMode = 'flashcard' | 'list';
type FilterTab = '전체' | '즐겨찾기' | '오늘' | '어려운 단어';

interface CardOptions {
  autoPlay: boolean;
  randomOrder: boolean;
  favoriteOnly: boolean;
  todayOnly: boolean;
}

// ============================================================
// Constants
// ============================================================

const FILTER_TABS: FilterTab[] = ['전체', '즐겨찾기', '오늘', '어려운 단어'];
const AUTO_PLAY_INTERVAL = 5000; // 5초

function filterTabToVocabularyFilter(tab: FilterTab): VocabularyFilter {
  switch (tab) {
    case '전체': return { type: 'all' };
    case '즐겨찾기': return { type: 'favorite' };
    case '오늘': return { type: 'today' };
    case '어려운 단어': return { type: 'difficult' };
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================
// VocabPage Component
// ============================================================

export function VocabPage() {
  const navigateTo = useAppStore((s) => s.navigateTo);
  const settings = useSettingsStore((s) => s.settings);

  const [viewMode, setViewMode] = useState<ViewMode>('flashcard');
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  // Flashcard state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardOptions, setCardOptions] = useState<CardOptions>({
    autoPlay: false,
    randomOrder: false,
    favoriteOnly: false,
    todayOnly: false,
  });

  // ─── Load Words ──────────────────────────────────────────────────────────────

  const loadWords = useCallback(async () => {
    let results: VocabularyWord[];

    if (searchQuery.trim().length > 0) {
      results = await searchByKorean(searchQuery);
    } else if (cardOptions.favoriteOnly) {
      results = await getWords({ type: 'favorite' });
    } else if (cardOptions.todayOnly) {
      results = await getWords({ type: 'today' });
    } else {
      const filter = filterTabToVocabularyFilter(activeTab);
      results = await getWords(filter);
    }

    if (cardOptions.randomOrder) {
      results = shuffleArray(results);
    }

    setWords(results);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [activeTab, searchQuery, cardOptions.favoriteOnly, cardOptions.todayOnly, cardOptions.randomOrder]);

  useEffect(() => { loadWords(); }, [loadWords]);

  // ─── Auto Play ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cardOptions.autoPlay || words.length === 0 || viewMode !== 'flashcard') return;

    const timer = setInterval(() => {
      setIsFlipped(false);
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [cardOptions.autoPlay, words.length, viewMode]);

  // ─── Flashcard Handlers ──────────────────────────────────────────────────────

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % words.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + words.length) % words.length);
  };

  const handleSpeak = async (text: string) => {
    try { await speak(text); } catch { /* silent */ }
  };

  const handleToggleFavorite = async (id: number) => {
    await toggleFavorite(id);
    await loadWords();
  };

  const handleDelete = async (id: number, hanzi: string) => {
    if (window.confirm(`"${hanzi}" 삭제하시겠습니까?`)) {
      await deleteWord(id);
      await loadWords();
    }
  };

  const currentWord = words[currentIndex] || null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-4 py-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <button onClick={() => navigateTo('home')} className="mr-3 p-2 rounded-lg hover:bg-gray-100" aria-label="홈으로">←</button>
          <h1 className="text-xl font-bold text-gray-800">단어장</h1>
          <span className="ml-2 text-sm text-gray-400">({words.length}개)</span>
        </div>
        {/* View Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setViewMode('flashcard')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'flashcard' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
          >🃏 카드</button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
          >📋 목록</button>
        </div>
      </header>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="한국어로 검색..."
        className="w-full mb-3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="한국어 검색"
      />

      {/* Filter Tabs (list mode) or Card Options (card mode) */}
      {viewMode === 'list' && searchQuery.trim().length === 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap ${
                activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{tab}</button>
          ))}
        </div>
      )}

      {/* Card Options */}
      {viewMode === 'flashcard' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <OptionToggle label="자동 넘기기" active={cardOptions.autoPlay} onClick={() => setCardOptions(o => ({ ...o, autoPlay: !o.autoPlay }))} />
          <OptionToggle label="랜덤 순서" active={cardOptions.randomOrder} onClick={() => setCardOptions(o => ({ ...o, randomOrder: !o.randomOrder }))} />
          <OptionToggle label="즐겨찾기만" active={cardOptions.favoriteOnly} onClick={() => setCardOptions(o => ({ ...o, favoriteOnly: !o.favoriteOnly, todayOnly: false }))} />
          <OptionToggle label="오늘 학습만" active={cardOptions.todayOnly} onClick={() => setCardOptions(o => ({ ...o, todayOnly: !o.todayOnly, favoriteOnly: false }))} />
        </div>
      )}

      {/* Empty State */}
      {words.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-center">
            {searchQuery ? '검색 결과가 없습니다' : '단어장이 비어 있습니다.\n입력기에서 단어를 추가하세요.'}
          </p>
        </div>
      )}

      {/* Flashcard View */}
      {viewMode === 'flashcard' && words.length > 0 && currentWord && (
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Card */}
          <div
            onClick={handleFlip}
            className="w-full max-w-sm cursor-pointer select-none"
            role="button"
            aria-label={isFlipped ? '카드 뒷면' : '카드를 탭하여 뒤집기'}
          >
            <div
              className="relative w-full min-h-[320px] md:min-h-[400px] rounded-2xl shadow-lg border border-gray-100 bg-white flex items-center justify-center p-8 transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front - 한자만 크게 */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-8"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="text-hanzi-lg md:text-hanzi-xl font-bold text-gray-900">
                  {currentWord.hanzi}
                </span>
                <span className="mt-4 text-xs text-gray-400">탭하여 뒤집기</span>
              </div>

              {/* Back - 모든 정보 */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-3"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <span className="text-4xl md:text-5xl font-bold text-gray-900">
                  {currentWord.hanzi}
                </span>
                <span className="text-xl text-blue-600 font-medium">
                  {currentWord.pinyin}
                </span>
                <span className="text-lg text-gray-700">
                  {currentWord.meaning}
                </span>
                {currentWord.koreanPronunciation && (
                  <span className="text-sm text-gray-500">
                    [발음] {currentWord.koreanPronunciation}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleSpeak(currentWord.hanzi); }}
                  className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  🔊 발음 듣기
                </button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={handlePrev}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xl transition-colors"
              aria-label="이전 카드"
            >◀</button>
            <span className="text-sm text-gray-500 font-medium">
              {currentIndex + 1} / {words.length}
            </span>
            <button
              onClick={handleNext}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xl transition-colors"
              aria-label="다음 카드"
            >▶</button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleToggleFavorite(currentWord.id!)}
              className={`px-3 py-1.5 rounded-lg text-sm ${currentWord.isFavorite ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {currentWord.isFavorite ? '⭐ 즐겨찾기 해제' : '☆ 즐겨찾기'}
            </button>
            <button
              onClick={() => handleDelete(currentWord.id!, currentWord.hanzi)}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-red-500 hover:bg-red-50"
            >🗑️ 삭제</button>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && words.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {words.map((word) => (
            <div key={word.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-3xl font-bold text-gray-900">{word.hanzi}</span>
                  {!settings.hidePinyin && <p className="text-sm text-blue-600 mt-1">{word.pinyin}</p>}
                  {!settings.hideMeaning && <p className="text-sm text-gray-700 mt-1">{word.meaning}</p>}
                  {!settings.hideKoreanPronunciation && word.koreanPronunciation && (
                    <p className="text-xs text-gray-500 mt-1">[발음] {word.koreanPronunciation}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleSpeak(word.hanzi)} className="p-2 rounded-lg hover:bg-gray-100">🔊</button>
                  <button onClick={() => handleToggleFavorite(word.id!)} className={`p-2 rounded-lg ${word.isFavorite ? 'text-yellow-500' : 'text-gray-300'}`}>⭐</button>
                  <button onClick={() => handleDelete(word.id!, word.hanzi)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// OptionToggle Component
// ============================================================

function OptionToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >{label}</button>
  );
}

export default VocabPage;
