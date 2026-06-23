/**
 * Flashcard Page
 *
 * Anki 스타일 플래시카드 학습 화면.
 * 카드 앞면(cardType별 표시) → 탭하여 뒤집기 → 난이도 선택 → 다음 카드.
 *
 * Requirements: 10.4, 10.9, 10.10, 15.2
 */

import { useEffect, useState, useCallback } from 'react';
import { useFlashcardStore } from '../stores/flashcardStore';
import { useSettingsStore } from '../stores/settingsStore';
import { speak } from '../services/ttsPlayer';
import { db } from '../db/database';
import type { VocabularyWord } from '../db/database';
import type { Difficulty } from '../services/flashcardEngine';

// ============================================================
// Types
// ============================================================

interface WordDetails {
  hanzi: string;
  pinyin: string;
  meaning: string;
}

// ============================================================
// FlashcardPage Component
// ============================================================

export function FlashcardPage() {
  const currentCard = useFlashcardStore((state) => state.currentCard);
  const dueCount = useFlashcardStore((state) => state.dueCount);
  const isShowingAnswer = useFlashcardStore((state) => state.isShowingAnswer);
  const flipCard = useFlashcardStore((state) => state.flipCard);
  const reviewCard = useFlashcardStore((state) => state.reviewCard);
  const loadDueCards = useFlashcardStore((state) => state.loadDueCards);

  const settings = useSettingsStore((state) => state.settings);

  const [wordDetails, setWordDetails] = useState<WordDetails | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // ─── Load due cards on mount ──────────────────────────────────────────────────

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  // ─── Look up word details when currentCard changes ────────────────────────────

  useEffect(() => {
    async function fetchWordDetails() {
      if (!currentCard) {
        setWordDetails(null);
        return;
      }
      try {
        const word = await db.vocabulary.get(currentCard.wordId) as VocabularyWord | undefined;
        if (word) {
          setWordDetails({
            hanzi: word.hanzi,
            pinyin: word.pinyin,
            meaning: word.meaning,
          });
        } else {
          setWordDetails(null);
        }
      } catch {
        setWordDetails(null);
      }
    }
    fetchWordDetails();
  }, [currentCard]);

  // ─── Reset flip animation when card changes ───────────────────────────────────

  useEffect(() => {
    setIsFlipped(false);
  }, [currentCard?.id]);

  // ─── Play TTS for audio card type ─────────────────────────────────────────────

  useEffect(() => {
    if (currentCard?.cardType === 'audio-to-hanzi' && wordDetails?.hanzi && !isShowingAnswer) {
      speak(wordDetails.hanzi).catch(() => {
        // TTS failure is non-critical
      });
    }
  }, [currentCard?.cardType, currentCard?.id, wordDetails?.hanzi, isShowingAnswer]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleFlip = useCallback(() => {
    if (!isShowingAnswer) {
      setIsFlipped(true);
      flipCard();
    }
  }, [isShowingAnswer, flipCard]);

  const handleDifficulty = useCallback(async (difficulty: Difficulty) => {
    await reviewCard(difficulty);
  }, [reviewCard]);

  const handleAudioReplay = useCallback(() => {
    if (wordDetails?.hanzi) {
      speak(wordDetails.hanzi).catch(() => {});
    }
  }, [wordDetails?.hanzi]);

  // ─── Font size based on settings ──────────────────────────────────────────────

  const getFontSizeClass = (): string => {
    if (settings.extraLargeFontMode) return 'text-base scale-[2]';
    if (settings.largeFontMode) return 'text-base scale-[1.5]';
    return '';
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderCardFront = () => {
    if (!currentCard || !wordDetails) return null;

    switch (currentCard.cardType) {
      case 'meaning-to-hanzi':
        return (
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-gray-500">뜻을 보고 한자를 떠올리세요</p>
            <p className={`text-2xl md:text-3xl font-medium text-gray-800 ${getFontSizeClass()}`}>
              {wordDetails.meaning}
            </p>
          </div>
        );

      case 'hanzi-to-meaning':
        return (
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-gray-500">한자를 보고 뜻을 떠올리세요</p>
            <p className="text-hanzi-lg md:text-hanzi-xl font-bold text-gray-900">
              {wordDetails.hanzi}
            </p>
          </div>
        );

      case 'pinyin-to-hanzi':
        return (
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-gray-500">병음을 보고 한자를 떠올리세요</p>
            <p className={`text-2xl md:text-3xl font-medium text-gray-800 ${getFontSizeClass()}`}>
              {wordDetails.pinyin}
            </p>
          </div>
        );

      case 'audio-to-hanzi':
        return (
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-gray-500">발음을 듣고 한자를 떠올리세요</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAudioReplay();
              }}
              className="text-6xl hover:scale-110 active:scale-95 transition-transform"
              aria-label="발음 다시 듣기"
            >
              🔊
            </button>
            <p className="text-sm text-gray-400 mt-2">탭하여 다시 듣기</p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderCardBack = () => {
    if (!wordDetails) return null;

    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <p className="text-hanzi-lg md:text-hanzi-xl font-bold text-gray-900">
          {wordDetails.hanzi}
        </p>
        {!settings.hidePinyin && (
          <p className={`text-xl text-blue-600 ${getFontSizeClass()}`}>
            {wordDetails.pinyin}
          </p>
        )}
        {!settings.hideMeaning && (
          <p className={`text-lg text-gray-700 ${getFontSizeClass()}`}>
            {wordDetails.meaning}
          </p>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!currentCard) return null;

    return (
      <div className="text-xs text-gray-400 text-center mt-4">
        학습 {currentCard.studyCount}회 | 쉬움 {currentCard.easyCount} | 보통 {currentCard.normalCount} | 어려움 {currentCard.hardCount}
      </div>
    );
  };

  // ─── Empty state ──────────────────────────────────────────────────────────────

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center px-4 py-8 max-w-xl mx-auto">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8 w-full">
          <h1 className="text-2xl font-bold text-gray-800">플래시카드</h1>
          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
            {dueCount}
          </span>
        </header>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4" aria-hidden="true">🎉</span>
          <p className="text-lg font-medium text-gray-700">복습할 카드가 없습니다</p>
          <p className="text-sm text-gray-500 mt-2">
            모든 복습을 완료했거나 단어장에 단어를 추가해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center px-4 py-8 max-w-xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8 w-full">
        <h1 className="text-2xl font-bold text-gray-800">플래시카드</h1>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
          {dueCount}
        </span>
      </header>

      {/* Card */}
      <div
        className="relative w-full perspective-1000"
        style={{ perspective: '1000px' }}
      >
        <div
          onClick={handleFlip}
          className={`
            relative w-full min-h-[280px] md:min-h-[320px] cursor-pointer
            transition-transform duration-500 transform-style-preserve-3d
            ${isFlipped ? 'rotate-y-180' : ''}
          `}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s ease-in-out',
          }}
          role="button"
          aria-label={isShowingAnswer ? '카드 뒷면' : '카드를 탭하여 뒤집기'}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFlip(); }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex items-center justify-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {renderCardFront()}
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex items-center justify-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {renderCardBack()}
          </div>
        </div>
      </div>

      {/* Tap hint */}
      {!isShowingAnswer && (
        <p className="text-sm text-gray-400 mt-4 animate-pulse">
          카드를 탭하여 정답 확인
        </p>
      )}

      {/* Difficulty buttons (shown after flip) */}
      {isShowingAnswer && (
        <div className="flex gap-3 mt-6 w-full max-w-sm">
          <button
            onClick={() => handleDifficulty('easy')}
            className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-medium rounded-xl transition-colors"
          >
            쉬움
          </button>
          <button
            onClick={() => handleDifficulty('normal')}
            className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            보통
          </button>
          <button
            onClick={() => handleDifficulty('hard')}
            className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium rounded-xl transition-colors"
          >
            어려움
          </button>
        </div>
      )}

      {/* Stats */}
      {renderStats()}
    </div>
  );
}

export default FlashcardPage;
