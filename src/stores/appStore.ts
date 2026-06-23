/**
 * App Store (Zustand)
 *
 * 중앙 상태 관리 스토어: 병음 입력, 변환 결과, 한자 후보, 페이지 네비게이션 관리.
 *
 * Requirements: 1.1, 2.1, 2.3, 3.1, 3.2, 10.1, 14.2
 */

import { create } from 'zustand';
import { convertTone, type ToneConversionResult } from '../services/toneConverter';
import { convertPinyinToHanzi, type HanziCandidate } from '../services/chineseConverter';
import { saveWord, type SaveResult } from '../services/vocabularyManager';
import { createCardsForWord } from '../services/flashcardEngine';
import { recordStudyActivity } from '../services/statisticsManager';
import { checkAvailability } from '../services/ttsPlayer';
import { db } from '../db/database';

// ============================================================
// Types
// ============================================================

export type PageType =
  | 'home'
  | 'input'
  | 'vocab'
  | 'pronunciation'
  | 'writing'
  | 'stroke'
  | 'flashcard'
  | 'stats'
  | 'settings';

export interface AppState {
  // Input state
  pinyinInput: string;
  conversionResult: ToneConversionResult | null;
  hanziCandidates: HanziCandidate[];
  selectedCandidate: HanziCandidate | null;

  // Navigation
  currentPage: PageType;

  // Actions
  setPinyinInput: (input: string) => void;
  convertPinyin: () => void;
  selectCandidate: (candidate: HanziCandidate) => void;
  saveToVocabulary: () => Promise<SaveResult>;
  navigateTo: (page: PageType) => void;
}

// ============================================================
// Store
// ============================================================

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Initial State ────────────────────────────────────────────────────────────

  pinyinInput: '',
  conversionResult: null,
  hanziCandidates: [],
  selectedCandidate: null,
  currentPage: 'home',

  // ─── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Set the pinyin input and immediately trigger tone conversion.
   * Stores the conversion result for display.
   */
  setPinyinInput: (input: string) => {
    const result = convertTone(input);
    set({
      pinyinInput: input,
      conversionResult: result,
      // Clear candidates when input changes
      hanziCandidates: [],
      selectedCandidate: null,
    });
  },

  /**
   * Convert the current toned pinyin to hanzi candidates.
   * Uses the toned result from the last conversion.
   */
  convertPinyin: () => {
    const { conversionResult } = get();
    if (!conversionResult || !conversionResult.toned) {
      set({ hanziCandidates: [] });
      return;
    }

    const result = convertPinyinToHanzi(conversionResult.toned);
    set({ hanziCandidates: result.candidates });
  },

  /**
   * Select a candidate from the hanzi candidates list.
   * Stores it for later saving to vocabulary.
   */
  selectCandidate: (candidate: HanziCandidate) => {
    set({ selectedCandidate: candidate });
  },

  /**
   * Save the currently selected candidate to the vocabulary.
   * On success: auto-generates flashcards and records a study event.
   * Returns a SaveResult indicating success/duplicate/failure.
   */
  saveToVocabulary: async (): Promise<SaveResult> => {
    const { selectedCandidate } = get();

    if (!selectedCandidate) {
      return { success: false, isDuplicate: false };
    }

    const result = await saveWord({
      hanzi: selectedCandidate.hanzi,
      pinyin: selectedCandidate.pinyin,
      tone: [selectedCandidate.tone],
      meaning: selectedCandidate.meaning,
      koreanPronunciation: selectedCandidate.koreanPronunciation,
      isFavorite: false,
      tags: [],
      hskLevel: null,
    });

    // If save was successful, auto-generate flashcards and record study event
    if (result.success && result.word) {
      const ttsAvailable = checkAvailability();
      const cards = createCardsForWord(result.word, ttsAvailable);
      await db.flashcards.bulkAdd(cards);
      await recordStudyActivity('flashcard', result.word.id!);
    }

    return result;
  },

  /**
   * Navigate to a different page.
   */
  navigateTo: (page: PageType) => {
    set({ currentPage: page });
  },
}));
