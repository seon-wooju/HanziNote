/**
 * Pinyin Input Page
 *
 * 병음 또는 한글 뜻으로 중국어 단어를 검색하고, 후보 선택 시 자동 저장.
 * - 병음 모드: 병음 입력 → 성조 변환 → 한자 후보 표시
 * - 한글 모드: 한국어 뜻 입력 → 사전에서 매칭되는 한자 검색
 *
 * Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5, 3.1, 4.1, 5.1, 6.1
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import { speak } from '../services/ttsPlayer';
import { searchByMeaning, type HanziCandidate } from '../services/chineseConverter';

// ============================================================
// Types
// ============================================================

type InputMode = 'pinyin' | 'korean';

// ============================================================
// InputPage Component
// ============================================================

export function InputPage() {
  const pinyinInput = useAppStore((s) => s.pinyinInput);
  const setPinyinInput = useAppStore((s) => s.setPinyinInput);
  const conversionResult = useAppStore((s) => s.conversionResult);
  const convertPinyin = useAppStore((s) => s.convertPinyin);
  const hanziCandidates = useAppStore((s) => s.hanziCandidates);
  const selectCandidate = useAppStore((s) => s.selectCandidate);
  const selectedCandidate = useAppStore((s) => s.selectedCandidate);

  const settings = useSettingsStore((s) => s.settings);
  const addToast = useToastStore((s) => s.addToast);

  const [inputMode, setInputMode] = useState<InputMode>('pinyin');
  const [koreanInput, setKoreanInput] = useState('');
  const [koreanCandidates, setKoreanCandidates] = useState<HanziCandidate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [playingHanzi, setPlayingHanzi] = useState<string | null>(null);
  const [savedHanzi, setSavedHanzi] = useState<string | null>(null);

  // Determine if input has any invalid syllables
  const hasInvalidSyllable =
    inputMode === 'pinyin' &&
    conversionResult !== null &&
    conversionResult.syllables.length > 0 &&
    !conversionResult.isValid;

  // Font size classes based on settings
  const fontSizeClass = settings.extraLargeFontMode
    ? 'text-4xl'
    : settings.largeFontMode
      ? 'text-3xl'
      : 'text-2xl';

  // Current candidates based on mode
  const candidates = inputMode === 'pinyin' ? hanziCandidates : koreanCandidates;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handlePinyinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPinyinInput(e.target.value);
    setSavedHanzi(null);
  };

  const handleKoreanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKoreanInput(e.target.value);
    setSavedHanzi(null);
  };

  const handleConvert = () => {
    if (inputMode === 'pinyin') {
      convertPinyin();
    } else {
      // 한글 뜻으로 사전 검색
      if (koreanInput.trim()) {
        const results = searchByMeaning(koreanInput.trim());
        setKoreanCandidates(results);
      } else {
        setKoreanCandidates([]);
      }
    }
  };

  const handleSelectCandidate = useCallback(async (candidate: HanziCandidate) => {
    selectCandidate(candidate);
    setSavedHanzi(null);
    setIsSaving(true);
    try {
      const { saveWord } = await import('../services/vocabularyManager');
      const { createCardsForWord } = await import('../services/flashcardEngine');
      const { recordStudyActivity } = await import('../services/statisticsManager');
      const { checkAvailability } = await import('../services/ttsPlayer');
      const { db } = await import('../db/database');

      const result = await saveWord({
        hanzi: candidate.hanzi,
        pinyin: candidate.pinyin,
        tone: [candidate.tone],
        meaning: candidate.meaning,
        koreanPronunciation: candidate.koreanPronunciation,
        isFavorite: false,
        tags: [],
        hskLevel: null,
      });

      if (result.success && result.word) {
        const ttsAvailable = checkAvailability();
        const cards = createCardsForWord(result.word, ttsAvailable);
        await db.flashcards.bulkAdd(cards);
        await recordStudyActivity('flashcard', result.word.id!);
        setSavedHanzi(candidate.hanzi);
        addToast({
          code: 'VOCAB_SAVED',
          message: `"${candidate.hanzi}" 단어장에 저장되었습니다`,
          severity: 'info',
          recoverable: false,
        });
      } else if (result.isDuplicate) {
        addToast({
          code: 'VOCAB_DUPLICATE',
          message: `"${candidate.hanzi}" 이미 등록된 단어입니다`,
          severity: 'warning',
          recoverable: false,
        });
      }
    } catch {
      addToast({
        code: 'SAVE_ERROR',
        message: '저장에 실패했습니다',
        severity: 'error',
        recoverable: false,
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectCandidate, addToast]);

  const handleSpeak = async (hanzi: string) => {
    setPlayingHanzi(hanzi);
    try {
      await speak(hanzi);
    } catch {
      // TTS unavailable
    } finally {
      setPlayingHanzi(null);
    }
  };

  const handleModeSwitch = (mode: InputMode) => {
    setInputMode(mode);
    setSavedHanzi(null);
    setKoreanCandidates([]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col px-4 py-6 max-w-2xl mx-auto w-full">
      {/* Page Title */}
      <h2 className="text-xl font-bold text-gray-800 mb-4">단어 입력기</h2>

      {/* Mode Tabs */}
      <div className="flex mb-4 rounded-lg overflow-hidden border border-gray-200">
        <button
          onClick={() => handleModeSwitch('pinyin')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            inputMode === 'pinyin'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          병음으로 검색
        </button>
        <button
          onClick={() => handleModeSwitch('korean')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            inputMode === 'korean'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          한글 뜻으로 검색
        </button>
      </div>

      {/* Pinyin Mode */}
      {inputMode === 'pinyin' && (
        <>
          <div className="mb-4">
            <label htmlFor="pinyin-input" className="block text-sm font-medium text-gray-600 mb-1">
              병음 입력 (예: ni3 hao3)
            </label>
            <div className="relative">
              <input
                id="pinyin-input"
                type="text"
                value={pinyinInput}
                onChange={handlePinyinInputChange}
                placeholder="병음을 입력하세요..."
                className={`w-full px-4 py-3 pr-10 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                  hasInvalidSyllable
                    ? 'border-red-400 ring-1 ring-red-300'
                    : 'border-gray-300'
                }`}
                aria-invalid={hasInvalidSyllable}
                maxLength={200}
              />
              {pinyinInput && (
                <button
                  onClick={() => { setPinyinInput(''); setSavedHanzi(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-xs"
                  aria-label="입력 지우기"
                >✕</button>
              )}
            </div>
            {hasInvalidSyllable && (
              <p className="text-red-500 text-xs mt-1">유효하지 않은 병음이 포함되어 있습니다</p>
            )}
          </div>

          {/* Live Conversion Preview */}
          {conversionResult && conversionResult.toned && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 block mb-1">변환 미리보기</span>
              <span className={`${fontSizeClass} font-medium text-gray-800`}>
                {conversionResult.toned}
              </span>
            </div>
          )}
        </>
      )}

      {/* Korean Mode */}
      {inputMode === 'korean' && (
        <div className="mb-4">
          <label htmlFor="korean-input" className="block text-sm font-medium text-gray-600 mb-1">
            한국어 뜻 입력 (예: 배구, 사랑, 학교)
          </label>
          <div className="relative">
            <input
              id="korean-input"
              type="text"
              value={koreanInput}
              onChange={handleKoreanInputChange}
              placeholder="한국어 뜻을 입력하세요..."
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
              maxLength={50}
            />
            {koreanInput && (
              <button
                onClick={() => { setKoreanInput(''); setKoreanCandidates([]); setSavedHanzi(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-xs"
                aria-label="입력 지우기"
              >✕</button>
            )}
          </div>
        </div>
      )}

      {/* Search Button */}
      <button
        onClick={handleConvert}
        disabled={inputMode === 'pinyin' ? !pinyinInput.trim() : !koreanInput.trim()}
        className="mb-6 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {inputMode === 'pinyin' ? '변환' : '검색'}
      </button>

      {/* No results message */}
      {candidates.length === 0 && (
        (inputMode === 'pinyin' && pinyinInput.trim() && conversionResult && conversionResult.toned) ||
        (inputMode === 'korean' && koreanInput.trim() && koreanCandidates.length === 0 && koreanInput.length > 0)
      ) && (
        <p className="text-gray-500 text-sm text-center mb-4">
          {inputMode === 'pinyin' ? '변환 결과가 없습니다' : '검색 결과가 없습니다'}
        </p>
      )}

      {/* Candidates List */}
      {candidates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-600">
            {inputMode === 'pinyin' ? '한자 후보' : '검색 결과'} ({candidates.length}개)
          </h3>
          <ul className="space-y-2" role="list" aria-label="한자 후보 목록">
            {candidates.map((candidate) => (
              <li key={`${candidate.hanzi}-${candidate.pinyin}`}>
                <button
                  onClick={() => handleSelectCandidate(candidate)}
                  disabled={isSaving}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    savedHanzi === candidate.hanzi
                      ? 'border-green-500 bg-green-50'
                      : selectedCandidate?.hanzi === candidate.hanzi
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {/* Hanzi - Large */}
                      <span className={`${fontSizeClass} font-bold text-gray-900 block`}>
                        {candidate.hanzi}
                        {savedHanzi === candidate.hanzi && (
                          <span className="ml-2 text-green-500 text-base">✅</span>
                        )}
                      </span>

                      {/* Pinyin + Tone */}
                      {!settings.hidePinyin && (
                        <span className="text-sm text-blue-600 block mt-1">
                          {candidate.pinyin}
                        </span>
                      )}

                      {/* Korean Pronunciation */}
                      {!settings.hideKoreanPronunciation && candidate.koreanPronunciation && (
                        <span className="text-xs text-gray-500 block mt-0.5">
                          <span className="text-gray-400">[발음]</span>{' '}
                          {candidate.koreanPronunciation}
                        </span>
                      )}

                      {/* Meaning */}
                      {!settings.hideMeaning && (
                        <span className="text-sm text-gray-600 block mt-1">
                          {/^[a-zA-Z(]/.test(candidate.meaning) && (
                            <span className="text-xs text-gray-400 mr-1">(영)</span>
                          )}
                          {candidate.meaning}
                        </span>
                      )}
                    </div>

                    {/* TTS Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(candidate.hanzi);
                      }}
                      className={`ml-3 p-2 rounded-full transition-colors ${
                        playingHanzi === candidate.hanzi
                          ? 'bg-blue-100 text-blue-600 animate-pulse'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      aria-label={`${candidate.hanzi} 발음 듣기`}
                    >
                      🔊
                    </button>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tip */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        후보를 탭하면 자동으로 단어장에 저장됩니다
      </p>
    </div>
  );
}

export default InputPage;
