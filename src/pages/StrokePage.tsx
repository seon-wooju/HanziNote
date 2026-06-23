/**
 * Stroke Learning Page
 *
 * 단어장에서 한자를 선택하여 획순 애니메이션을 학습하는 페이지.
 * - 단어장에서 단어 선택
 * - 현재 획 번호 / 전체 획 수 표시
 * - 모드 선택: auto | step-by-step | repeat
 * - 속도 제어: normal | slow (50%)
 * - 재생, 다음 획, 일시정지, 처음부터 컨트롤
 * - 지원하지 않는 문자에 대한 폴백 (정적 표시 + 메시지)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createStrokeViewer,
  animateCharacter,
  animateNextStroke,
  pauseAnimation,
  resetAnimation,
  isCharacterSupported,
} from '../services/strokeViewer';
import type { HanziWriterInstance } from '../services/strokeViewer';
import { getWords } from '../services/vocabularyManager';
import type { VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

type StrokeMode = 'auto' | 'step' | 'repeat';
type SpeedSetting = 'normal' | 'slow';

// ============================================================
// StrokePage Component
// ============================================================

export function StrokePage() {
  // Word list and selection
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  // Stroke viewer state
  const [mode, setMode] = useState<StrokeMode>('auto');
  const [speed, setSpeed] = useState<SpeedSetting>('normal');
  const [currentStroke, setCurrentStroke] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<HanziWriterInstance | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============================================================
  // Load vocabulary words on mount
  // ============================================================

  useEffect(() => {
    async function loadWords() {
      const allWords = await getWords({ type: 'all' });
      setWords(allWords);
      if (allWords.length > 0 && allWords[0] !== undefined) {
        setSelectedWord(allWords[0]);
      }
    }
    loadWords();
  }, []);

  // ============================================================
  // Current character derived from selected word
  // ============================================================

  const currentChar = selectedWord
    ? selectedWord.hanzi[currentCharIndex] ?? selectedWord.hanzi[0] ?? ''
    : '';

  // ============================================================
  // Create/recreate stroke viewer when character, mode, or speed changes
  // ============================================================

  useEffect(() => {
    // Cleanup previous instance
    if (instanceRef.current) {
      pauseAnimation(instanceRef.current);
      instanceRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Reset state
    setCurrentStroke(0);
    setTotalStrokes(0);
    setIsPlaying(false);

    if (!currentChar) {
      setSupported(false);
      return;
    }

    // Check if character is supported
    const charSupported = isCharacterSupported(currentChar);
    setSupported(charSupported);

    if (!charSupported || !containerRef.current) {
      return;
    }

    // Create new stroke viewer
    const instance = createStrokeViewer({
      character: currentChar,
      container: containerRef.current,
      speed,
      mode,
    });

    instanceRef.current = instance;

    // Poll state to update UI (since hanzi-writer is async)
    pollRef.current = setInterval(() => {
      if (instanceRef.current) {
        setCurrentStroke(instanceRef.current.state.currentStroke);
        setTotalStrokes(instanceRef.current.state.totalStrokes);
        setIsPlaying(instanceRef.current.state.isPlaying);
      }
    }, 200);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (instanceRef.current) {
        pauseAnimation(instanceRef.current);
        instanceRef.current = null;
      }
    };
  }, [currentChar, mode, speed]);

  // ============================================================
  // Control Handlers
  // ============================================================

  const handlePlay = useCallback(async () => {
    if (!instanceRef.current || isPlaying) return;
    resetAnimation(instanceRef.current);
    await animateCharacter(instanceRef.current);
  }, [isPlaying]);

  const handleNextStroke = useCallback(async () => {
    if (!instanceRef.current) return;
    await animateNextStroke(instanceRef.current);
  }, []);

  const handlePause = useCallback(() => {
    if (!instanceRef.current) return;
    pauseAnimation(instanceRef.current);
  }, []);

  const handleReset = useCallback(() => {
    if (!instanceRef.current) return;
    resetAnimation(instanceRef.current);
  }, []);

  // ============================================================
  // Character navigation (for multi-character words)
  // ============================================================

  const characters = selectedWord ? selectedWord.hanzi.split('') : [];
  const hasMultipleChars = characters.length > 1;

  const handleCharSelect = useCallback((index: number) => {
    setCurrentCharIndex(index);
  }, []);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex flex-col items-center px-4 py-6 max-w-2xl mx-auto">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">획순 학습</h1>

      {/* Empty state: no words */}
      {words.length === 0 && (
        <div className="text-center text-gray-500 mt-12">
          <p className="text-lg">단어장에 단어가 없습니다.</p>
          <p className="text-sm mt-2">먼저 입력기에서 단어를 저장해주세요.</p>
        </div>
      )}

      {words.length > 0 && (
        <>
          {/* Word Selector */}
          <div className="w-full mb-4">
            <label
              htmlFor="stroke-word-selector"
              className="block text-sm font-medium text-gray-600 mb-2"
            >
              학습할 단어 선택
            </label>
            <select
              id="stroke-word-selector"
              value={selectedWord?.id ?? ''}
              onChange={(e) => {
                const word = words.find((w) => w.id === Number(e.target.value));
                setSelectedWord(word ?? null);
                setCurrentCharIndex(0);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {words.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.hanzi} - {w.pinyin} ({w.meaning})
                </option>
              ))}
            </select>
          </div>

          {/* Character Selector (for multi-character words) */}
          {hasMultipleChars && (
            <div className="flex gap-2 mb-4">
              {characters.map((char, index) => (
                <button
                  key={index}
                  onClick={() => handleCharSelect(index)}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 transition-colors ${
                    currentCharIndex === index
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  aria-label={`문자 ${char} 선택`}
                >
                  {char}
                </button>
              ))}
            </div>
          )}

          {/* Stroke Counter */}
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600">
              획{' '}
              <span className="font-bold text-lg text-gray-800">
                {currentStroke}
              </span>
              {' / '}
              <span className="font-bold text-lg text-gray-800">
                {totalStrokes}
              </span>
            </p>
          </div>

          {/* Stroke Viewer Container / Fallback */}
          {supported ? (
            <div
              ref={containerRef}
              className="w-[300px] h-[300px] border-2 border-gray-200 rounded-xl bg-white mb-6 flex items-center justify-center"
              aria-label={`${currentChar} 획순 애니메이션`}
            />
          ) : (
            <div className="w-[300px] h-[300px] border-2 border-gray-200 rounded-xl bg-gray-50 mb-6 flex flex-col items-center justify-center">
              <span className="text-8xl text-gray-700 mb-4">{currentChar}</span>
              <p className="text-sm text-orange-600 text-center px-4">
                이 한자의 획순 데이터를 사용할 수 없습니다
              </p>
            </div>
          )}

          {/* Mode Selector */}
          <div className="w-full mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              재생 모드
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              <button
                onClick={() => setMode('auto')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'auto'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                자동 재생
              </button>
              <button
                onClick={() => setMode('step')}
                className={`flex-1 py-2 text-sm font-medium border-l border-r border-gray-300 transition-colors ${
                  mode === 'step'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                한 획씩
              </button>
              <button
                onClick={() => setMode('repeat')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'repeat'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                반복 재생
              </button>
            </div>
          </div>

          {/* Speed Control */}
          <div className="w-full mb-6">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              재생 속도
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              <button
                onClick={() => setSpeed('normal')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  speed === 'normal'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                보통
              </button>
              <button
                onClick={() => setSpeed('slow')}
                className={`flex-1 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                  speed === 'slow'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                느리게 (50%)
              </button>
            </div>
          </div>

          {/* Animation Controls */}
          {supported && (
            <div className="flex flex-wrap gap-3 justify-center">
              {/* Play button (auto/repeat mode) */}
              {(mode === 'auto' || mode === 'repeat') && (
                <button
                  onClick={handlePlay}
                  disabled={isPlaying}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  aria-label="재생"
                >
                  <span aria-hidden="true">▶️</span>
                  <span className="text-sm">재생</span>
                </button>
              )}

              {/* Next stroke button (step mode) */}
              {mode === 'step' && (
                <button
                  onClick={handleNextStroke}
                  disabled={currentStroke >= totalStrokes && totalStrokes > 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  aria-label="다음 획"
                >
                  <span aria-hidden="true">⏭️</span>
                  <span className="text-sm">다음 획</span>
                </button>
              )}

              {/* Pause button */}
              <button
                onClick={handlePause}
                disabled={!isPlaying}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                aria-label="일시정지"
              >
                <span aria-hidden="true">⏸️</span>
                <span className="text-sm">일시정지</span>
              </button>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                aria-label="처음부터"
              >
                <span aria-hidden="true">🔄</span>
                <span className="text-sm">처음부터</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default StrokePage;
