/**
 * Writing Practice Page (쓰기 연습)
 *
 * hanzi-writer quiz 모드 기반:
 * - 따라 쓰기: 가이드 있는 quiz (showOutline + showHintAfterMisses)
 * - 빈칸 쓰기: 뜻/병음 힌트만 보고 quiz
 * - 받아쓰기: TTS 재생 후 quiz로 획순 판정
 *
 * 성공 시 학습 횟수 증가 + 연속 성공 기록
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import HanziWriter from 'hanzi-writer';
import { speak } from '../services/ttsPlayer';
import { getWords } from '../services/vocabularyManager';
import { recordStudyActivity } from '../services/statisticsManager';
import type { VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

type WritingMode = 'trace' | 'blank' | 'dictation';

interface QuizResult {
  status: 'idle' | 'in-progress' | 'success' | 'failed';
  mistakes: number;
  strokesCompleted: number;
  totalStrokes: number;
}

// ============================================================
// Constants
// ============================================================

const MODE_TABS: { mode: WritingMode; label: string }[] = [
  { mode: 'trace', label: '따라 쓰기' },
  { mode: 'blank', label: '빈칸 쓰기' },
  { mode: 'dictation', label: '받아쓰기' },
];

// ============================================================
// WritingPage Component
// ============================================================

export function WritingPage() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<WritingMode>('trace');
  const [quizResult, setQuizResult] = useState<QuizResult>({ status: 'idle', mistakes: 0, strokesCompleted: 0, totalStrokes: 0 });
  const [streak, setStreak] = useState(0);
  const [totalSuccess, setTotalSuccess] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const characters = selectedWord ? selectedWord.hanzi.split('') : [];
  const currentChar = characters[currentCharIndex] || '';
  const canvasSize = typeof window !== 'undefined' && window.innerWidth >= 768 ? 350 : 280;

  // ─── Load Words ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadWords() {
      const allWords = await getWords({ type: 'all' });
      setWords(allWords);
      if (allWords.length > 0) setSelectedWord(allWords[0]);
    }
    loadWords();
  }, []);

  // ─── Initialize hanzi-writer quiz ──────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !currentChar) return;

    // Cleanup
    containerRef.current.innerHTML = '';
    writerRef.current = null;
    setQuizResult({ status: 'idle', mistakes: 0, strokesCompleted: 0, totalStrokes: 0 });

    const showOutline = currentMode === 'trace';

    const writer = HanziWriter.create(containerRef.current, currentChar, {
      width: canvasSize,
      height: canvasSize,
      padding: 10,
      showCharacter: false,
      showOutline: showOutline,
      strokeColor: '#333',
      outlineColor: '#ddd',
      drawingColor: '#1d4ed8',
      highlightColor: '#22c55e',
      showHintAfterMisses: currentMode === 'trace' ? 2 : 3,
      highlightOnComplete: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 300,
      // 관대한 판정: 위치/크기 허용 범위를 최대한 넓힘
      // 기본 1.0, 높을수록 관대 (획순/방향은 여전히 체크)
      leniency: 1.8,
      // 매칭에 필요한 최소 획 길이를 줄임
      drawingWidth: 30,
      acceptBackwardsStrokes: true,
    });

    writerRef.current = writer;

    // Auto-play TTS for dictation mode
    if (currentMode === 'dictation' && selectedWord) {
      speak(selectedWord.hanzi).catch(() => {});
    }

    // Start quiz automatically
    startQuiz(writer);

    return () => {
      containerRef.current && (containerRef.current.innerHTML = '');
      writerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChar, currentMode, canvasSize]);

  // ─── Start Quiz ─────────────────────────────────────────────────────────────

  const startQuiz = useCallback((writer: HanziWriter) => {
    setQuizResult({ status: 'in-progress', mistakes: 0, strokesCompleted: 0, totalStrokes: 0 });

    writer.quiz({
      onMistake: (strokeData: any) => {
        setQuizResult(prev => ({
          ...prev,
          mistakes: prev.mistakes + 1,
          totalStrokes: strokeData.totalStrokes || 0,
        }));
      },
      onCorrectStroke: (strokeData: any) => {
        setQuizResult(prev => ({
          ...prev,
          strokesCompleted: (strokeData.strokeNum || 0) + 1,
          totalStrokes: strokeData.totalStrokes || 0,
        }));
      },
      onComplete: (summaryData: any) => {
        const mistakes = summaryData.totalMistakes || 0;
        const totalStrokes = summaryData.totalStrokes || summaryData.character?.strokes?.length || 1;
        const maxMistakes = Math.max(5, Math.floor(totalStrokes * 0.6));
        const success = mistakes <= maxMistakes;

        setQuizResult({
          status: success ? 'success' : 'failed',
          mistakes,
          strokesCompleted: totalStrokes,
          totalStrokes,
        });

        if (success) {
          setStreak(prev => prev + 1);
          setTotalSuccess(prev => prev + 1);

          // 학습 기록
          if (selectedWord?.id !== undefined) {
            recordStudyActivity('writing', selectedWord.id).catch(() => {});
          }
        } else {
          setStreak(0);
        }
      },
    });
  }, [selectedWord]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleRetry = () => {
    if (writerRef.current && containerRef.current) {
      containerRef.current.innerHTML = '';
      writerRef.current = null;

      const showOutline = currentMode === 'trace';
      const writer = HanziWriter.create(containerRef.current, currentChar, {
        width: canvasSize,
        height: canvasSize,
        padding: 10,
        showCharacter: false,
        showOutline: showOutline,
        strokeColor: '#333',
        outlineColor: '#ddd',
        drawingColor: '#1d4ed8',
        highlightColor: '#22c55e',
        showHintAfterMisses: currentMode === 'trace' ? 2 : 3,
        highlightOnComplete: true,
        leniency: 1.8,
        drawingWidth: 30,
        acceptBackwardsStrokes: true,
      });
      writerRef.current = writer;
      startQuiz(writer);
    }
  };

  const handleNextChar = () => {
    if (currentCharIndex < characters.length - 1) {
      setCurrentCharIndex(currentCharIndex + 1);
    } else {
      setCurrentCharIndex(0); // 처음으로
    }
  };

  const handleReplay = () => {
    if (selectedWord) {
      speak(selectedWord.hanzi).catch(() => {});
    }
  };

  const handleWordChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const word = words.find((w) => w.id === Number(e.target.value)) || null;
    setSelectedWord(word);
    setCurrentCharIndex(0);
    setStreak(0);
  };

  const handleModeChange = (mode: WritingMode) => {
    setCurrentMode(mode);
    setStreak(0);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center px-4 py-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">쓰기 연습</h2>

      {/* Word Selector */}
      <div className="w-full mb-4">
        <select
          value={selectedWord?.id ?? ''}
          onChange={handleWordChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {words.length === 0 && <option value="" disabled>단어장에 단어를 추가하세요</option>}
          {words.map((word) => (
            <option key={word.id} value={word.id}>{word.hanzi} - {word.meaning}</option>
          ))}
        </select>
      </div>

      {/* Multi-character navigation */}
      {characters.length > 1 && (
        <div className="flex gap-2 mb-3">
          {characters.map((char, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentCharIndex(idx)}
              className={`w-10 h-10 text-xl rounded-lg border-2 ${
                currentCharIndex === idx ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}
            >{char}</button>
          ))}
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 mb-4">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => handleModeChange(tab.mode)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              currentMode === tab.mode ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Hint area (blank / dictation mode) */}
      {currentMode === 'blank' && selectedWord && (
        <div className="mb-3 text-center">
          <span className="text-sm text-gray-600">{selectedWord.meaning} / {selectedWord.pinyin}</span>
        </div>
      )}
      {currentMode === 'dictation' && (
        <div className="mb-3 text-center">
          <span className="text-sm text-gray-500">소리를 듣고 한자를 써보세요</span>
        </div>
      )}

      {/* hanzi-writer Canvas */}
      {selectedWord && currentChar ? (
        <div
          ref={containerRef}
          className="border-2 border-gray-300 rounded-xl bg-white"
          style={{ width: canvasSize, height: canvasSize }}
        />
      ) : (
        <div
          className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-400"
          style={{ width: canvasSize, height: canvasSize }}
        >
          <p className="text-center px-4">단어를 추가한 후 시작하세요</p>
        </div>
      )}

      {/* Progress */}
      {quizResult.status === 'in-progress' && quizResult.totalStrokes > 0 && (
        <div className="mt-3 text-sm text-gray-500">
          획 {quizResult.strokesCompleted} / {quizResult.totalStrokes}
          {quizResult.mistakes > 0 && <span className="ml-2 text-red-500">실수 {quizResult.mistakes}회</span>}
        </div>
      )}

      {/* Result */}
      {quizResult.status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-center w-full">
          <p className="text-lg font-bold text-green-700">✅ 성공!</p>
          <p className="text-sm text-green-600 mt-1">실수 {quizResult.mistakes}회</p>
          <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
            <span>연속 성공: {streak}회</span>
            <span>총 성공: {totalSuccess}회</span>
          </div>
        </div>
      )}

      {quizResult.status === 'failed' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center w-full">
          <p className="text-lg font-bold text-red-700">다시 도전!</p>
          <p className="text-sm text-red-600 mt-1">실수 {quizResult.mistakes}회 — 3회 이하면 성공</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {(quizResult.status === 'success' || quizResult.status === 'failed') && (
          <button onClick={handleRetry} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
            🔄 다시 쓰기
          </button>
        )}

        {(quizResult.status === 'success' && characters.length > 1) && (
          <button onClick={handleNextChar} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
            ⏭️ 다음 글자
          </button>
        )}

        {currentMode === 'dictation' && (
          <button onClick={handleReplay} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm">
            🔊 다시 듣기
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 text-xs text-gray-400 text-center">
        <p>🔥 연속 성공: {streak}회 | 📝 총 성공: {totalSuccess}회</p>
        <p className="mt-1">횟수 제한 없이 반복 연습하세요</p>
      </div>
    </div>
  );
}

export default WritingPage;
