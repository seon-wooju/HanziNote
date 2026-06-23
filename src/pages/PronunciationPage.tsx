/**
 * Pronunciation Practice Page
 *
 * 단어장에서 단어를 선택하여 TTS로 듣고, 녹음 후 발음 정확도를 평가받는 페이지.
 * - 단어장에서 단어 선택
 * - TTS 재생 (일반/느리게/반복)
 * - 녹음 (시각적 표시 + 60초 타이머)
 * - 음절별 점수(0-100) 및 전체 점수 표시
 * - 마이크 권한 거부 / 음성 미감지 에러 상태 처리
 *
 * Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { speak, speakRepeat, checkAvailability } from '../services/ttsPlayer';
import {
  startRecording,
  stopRecording,
  evaluatePronunciation,
  checkMicrophonePermission,
  MicrophonePermissionDeniedError,
} from '../services/pronunciationTrainer';
import type { PronunciationResult } from '../services/pronunciationTrainer';
import { getWords } from '../services/vocabularyManager';
import { recordStudyActivity } from '../services/statisticsManager';
import type { VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

type PageState = 'idle' | 'recording' | 'evaluating' | 'result' | 'error';
type ErrorType = 'mic-denied' | 'no-speech' | null;

// ============================================================
// Constants
// ============================================================

const MAX_RECORDING_SECONDS = 60;

// ============================================================
// Helper: Score Color
// ============================================================

function getScoreColor(score: number): string {
  if (score > 80) return 'text-green-600';
  if (score > 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score > 80) return 'bg-green-50 border-green-200';
  if (score > 50) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

// ============================================================
// PronunciationPage Component
// ============================================================

export function PronunciationPage() {
  // Word list and selection
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);

  // TTS state
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Recording state
  const [pageState, setPageState] = useState<PageState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result state
  const [result, setResult] = useState<PronunciationResult | null>(null);

  // Error state
  const [errorType, setErrorType] = useState<ErrorType>(null);

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
  // Check TTS availability
  // ============================================================

  useEffect(() => {
    setTtsAvailable(checkAvailability());
  }, []);

  // ============================================================
  // Timer cleanup
  // ============================================================

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ============================================================
  // TTS Handlers
  // ============================================================

  const handleSpeak = useCallback(async () => {
    if (!selectedWord || !ttsAvailable || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(selectedWord.hanzi, 1.0);
    } finally {
      setIsSpeaking(false);
    }
  }, [selectedWord, ttsAvailable, isSpeaking]);

  const handleSpeakSlow = useCallback(async () => {
    if (!selectedWord || !ttsAvailable || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(selectedWord.hanzi, 0.5);
    } finally {
      setIsSpeaking(false);
    }
  }, [selectedWord, ttsAvailable, isSpeaking]);

  const handleSpeakRepeat = useCallback(async () => {
    if (!selectedWord || !ttsAvailable || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speakRepeat(selectedWord.hanzi, 3, 1.0);
    } finally {
      setIsSpeaking(false);
    }
  }, [selectedWord, ttsAvailable, isSpeaking]);

  // ============================================================
  // Recording Handlers
  // ============================================================

  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev >= MAX_RECORDING_SECONDS - 1) {
          // Auto-stop will be triggered by pronunciationTrainer
          return MAX_RECORDING_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!selectedWord) return;

    // Reset states
    setResult(null);
    setErrorType(null);

    // Check mic permission first
    const permState = await checkMicrophonePermission();
    if (permState === 'denied') {
      setPageState('error');
      setErrorType('mic-denied');
      return;
    }

    try {
      await startRecording();
      setPageState('recording');
      startTimer();
    } catch (error) {
      if (error instanceof MicrophonePermissionDeniedError) {
        setPageState('error');
        setErrorType('mic-denied');
      } else {
        setPageState('error');
        setErrorType('mic-denied');
      }
    }
  }, [selectedWord, startTimer]);

  const handleStopRecording = useCallback(async () => {
    if (pageState !== 'recording' || !selectedWord) return;

    stopTimer();
    setPageState('evaluating');

    try {
      const audioBlob = await stopRecording();
      const pronunciationResult = await evaluatePronunciation(
        audioBlob,
        selectedWord.pinyin
      );

      // Check if no speech was detected (all scores are 0 and no recognized text)
      const noSpeech = pronunciationResult.syllableScores.every(
        (s) => s.recognized === '' && s.score === 0
      );

      if (noSpeech) {
        setPageState('error');
        setErrorType('no-speech');
        return;
      }

      setResult(pronunciationResult);
      setPageState('result');

      // Record study activity
      if (selectedWord.id !== undefined) {
        await recordStudyActivity('pronunciation', selectedWord.id);
      }
    } catch {
      setPageState('error');
      setErrorType('no-speech');
    }
  }, [pageState, selectedWord, stopTimer]);

  // ============================================================
  // Reset / Retry
  // ============================================================

  const handleReset = useCallback(() => {
    setPageState('idle');
    setResult(null);
    setErrorType(null);
    setElapsedSeconds(0);
    stopTimer();
  }, [stopTimer]);

  // ============================================================
  // Format time
  // ============================================================

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex flex-col items-center px-4 py-6 max-w-2xl mx-auto">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">발음 연습</h1>

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
          <div className="w-full mb-6">
            <label
              htmlFor="word-selector"
              className="block text-sm font-medium text-gray-600 mb-2"
            >
              연습할 단어 선택
            </label>
            <select
              id="word-selector"
              value={selectedWord?.id ?? ''}
              onChange={(e) => {
                const word = words.find((w) => w.id === Number(e.target.value));
                setSelectedWord(word ?? null);
                handleReset();
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

          {/* Selected Word Display */}
          {selectedWord && (
            <div className="text-center mb-6">
              <p className="text-5xl font-bold text-gray-900 mb-2">
                {selectedWord.hanzi}
              </p>
              <p className="text-xl text-gray-600">{selectedWord.pinyin}</p>
              <p className="text-sm text-gray-400 mt-1">{selectedWord.meaning}</p>
            </div>
          )}

          {/* TTS Controls */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={handleSpeak}
              disabled={!ttsAvailable || isSpeaking}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="재생"
            >
              <span aria-hidden="true">🔊</span>
              <span className="text-sm">재생</span>
            </button>
            <button
              onClick={handleSpeakSlow}
              disabled={!ttsAvailable || isSpeaking}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="느리게 재생"
            >
              <span aria-hidden="true">🐢</span>
              <span className="text-sm">느리게</span>
            </button>
            <button
              onClick={handleSpeakRepeat}
              disabled={!ttsAvailable || isSpeaking}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="반복 재생"
            >
              <span aria-hidden="true">🔁</span>
              <span className="text-sm">반복</span>
            </button>
          </div>

          {/* TTS Unavailable Warning */}
          {!ttsAvailable && (
            <p className="text-sm text-orange-600 mb-4">
              TTS를 사용할 수 없습니다. 브라우저가 중국어 음성을 지원하지 않습니다.
            </p>
          )}

          {/* Recording Section */}
          <div className="w-full flex flex-col items-center mb-8">
            {/* Record Button */}
            {(pageState === 'idle' || pageState === 'result') && (
              <button
                onClick={handleStartRecording}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center shadow-lg transition-all"
                aria-label="녹음 시작"
              >
                <span className="text-3xl text-white" aria-hidden="true">
                  🎤
                </span>
              </button>
            )}

            {/* Recording State */}
            {pageState === 'recording' && (
              <div className="flex flex-col items-center">
                {/* Pulsing indicator + stop button */}
                <button
                  onClick={handleStopRecording}
                  className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg animate-pulse"
                  aria-label="녹음 중지"
                >
                  <span className="text-3xl text-white" aria-hidden="true">
                    ⏹️
                  </span>
                </button>
                {/* Timer */}
                <p className="mt-3 text-lg font-mono text-red-600">
                  {formatTime(elapsedSeconds)} / {formatTime(MAX_RECORDING_SECONDS)}
                </p>
                <p className="text-sm text-gray-500 mt-1">녹음 중... 클릭하여 중지</p>
              </div>
            )}

            {/* Evaluating State */}
            {pageState === 'evaluating' && (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center animate-pulse">
                  <span className="text-2xl">⏳</span>
                </div>
                <p className="mt-3 text-sm text-gray-500">발음을 평가하는 중...</p>
              </div>
            )}
          </div>

          {/* Result Display */}
          {pageState === 'result' && result && (
            <div className="w-full">
              {/* Overall Score */}
              <div
                className={`text-center p-6 rounded-xl border mb-4 ${getScoreBgColor(result.overallScore)}`}
              >
                <p className="text-sm text-gray-600 mb-1">전체 점수</p>
                <p className={`text-5xl font-bold ${getScoreColor(result.overallScore)}`}>
                  {result.overallScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">/ 100</p>
              </div>

              {/* Syllable Scores */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-3">음절별 점수</h3>
                <div className="space-y-2">
                  {result.syllableScores.map((syllable, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50"
                    >
                      <div className="flex gap-3 items-center">
                        <span className="text-sm text-gray-500 w-6">
                          {index + 1}.
                        </span>
                        <span className="font-medium text-gray-800">
                          {syllable.expected}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-600">
                          {syllable.recognized || '-'}
                        </span>
                      </div>
                      <span
                        className={`font-bold ${getScoreColor(syllable.score)}`}
                      >
                        {syllable.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Retry Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  다시 연습하기
                </button>
              </div>
            </div>
          )}

          {/* Error States */}
          {pageState === 'error' && errorType === 'mic-denied' && (
            <div className="w-full text-center p-6 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-lg font-medium text-red-700 mb-2">
                마이크 권한이 필요합니다
              </p>
              <p className="text-sm text-red-600 mb-4">
                브라우저 설정에서 마이크 접근 권한을 허용해주세요.
              </p>
              <p className="text-xs text-gray-500">
                주소창 왼쪽의 자물쇠 아이콘 → 사이트 설정 → 마이크 → 허용
              </p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                돌아가기
              </button>
            </div>
          )}

          {pageState === 'error' && errorType === 'no-speech' && (
            <div className="w-full text-center p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-lg font-medium text-yellow-700 mb-2">
                음성이 감지되지 않았습니다
              </p>
              <p className="text-sm text-yellow-600">다시 녹음해주세요.</p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PronunciationPage;
