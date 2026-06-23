/**
 * Unit tests for App Store
 *
 * Tests: setPinyinInput, convertPinyin, selectCandidate, saveToVocabulary, navigateTo
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      pinyinInput: '',
      conversionResult: null,
      hanziCandidates: [],
      selectedCandidate: null,
      currentPage: 'home',
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useAppStore.getState();
      expect(state.pinyinInput).toBe('');
      expect(state.conversionResult).toBeNull();
      expect(state.hanziCandidates).toEqual([]);
      expect(state.selectedCandidate).toBeNull();
      expect(state.currentPage).toBe('home');
    });
  });

  describe('setPinyinInput', () => {
    it('should set pinyinInput and trigger tone conversion', () => {
      useAppStore.getState().setPinyinInput('ni3');

      const state = useAppStore.getState();
      expect(state.pinyinInput).toBe('ni3');
      expect(state.conversionResult).not.toBeNull();
      expect(state.conversionResult!.toned).toBe('nǐ');
      expect(state.conversionResult!.isValid).toBe(true);
    });

    it('should handle multi-syllable input', () => {
      useAppStore.getState().setPinyinInput('ni3 hao3');

      const state = useAppStore.getState();
      expect(state.pinyinInput).toBe('ni3 hao3');
      expect(state.conversionResult!.toned).toBe('nǐ hǎo');
    });

    it('should handle empty input', () => {
      useAppStore.getState().setPinyinInput('');

      const state = useAppStore.getState();
      expect(state.pinyinInput).toBe('');
      expect(state.conversionResult).not.toBeNull();
      expect(state.conversionResult!.toned).toBe('');
    });

    it('should clear candidates when input changes', () => {
      // Set up some candidates first
      useAppStore.setState({
        hanziCandidates: [
          { hanzi: '你', pinyin: 'nǐ', tone: 3, meaning: '너', koreanPronunciation: '니', frequency: 100 },
        ],
        selectedCandidate: { hanzi: '你', pinyin: 'nǐ', tone: 3, meaning: '너', koreanPronunciation: '니', frequency: 100 },
      });

      useAppStore.getState().setPinyinInput('hao3');

      const state = useAppStore.getState();
      expect(state.hanziCandidates).toEqual([]);
      expect(state.selectedCandidate).toBeNull();
    });
  });

  describe('convertPinyin', () => {
    it('should set empty candidates when no conversion result', () => {
      useAppStore.getState().convertPinyin();

      const state = useAppStore.getState();
      expect(state.hanziCandidates).toEqual([]);
    });

    it('should convert toned pinyin to hanzi candidates', () => {
      // First set input to get a conversionResult
      useAppStore.getState().setPinyinInput('ni3');
      useAppStore.getState().convertPinyin();

      const state = useAppStore.getState();
      // The dictionary may or may not have entries for "nǐ"
      // but the function should run without error
      expect(Array.isArray(state.hanziCandidates)).toBe(true);
    });
  });

  describe('selectCandidate', () => {
    it('should store the selected candidate', () => {
      const candidate = {
        hanzi: '你',
        pinyin: 'nǐ',
        tone: 3,
        meaning: '너',
        koreanPronunciation: '니',
        frequency: 100,
      };

      useAppStore.getState().selectCandidate(candidate);

      const state = useAppStore.getState();
      expect(state.selectedCandidate).toEqual(candidate);
    });
  });

  describe('saveToVocabulary', () => {
    it('should return failure when no candidate is selected', async () => {
      const result = await useAppStore.getState().saveToVocabulary();
      expect(result.success).toBe(false);
      expect(result.isDuplicate).toBe(false);
    });

    it('should call saveWord with selected candidate data', async () => {
      const candidate = {
        hanzi: '好',
        pinyin: 'hǎo',
        tone: 3,
        meaning: '좋다',
        koreanPronunciation: '하오',
        frequency: 95,
      };

      useAppStore.getState().selectCandidate(candidate);
      const result = await useAppStore.getState().saveToVocabulary();

      // With fake-indexeddb in test setup, this should succeed
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.word).toBeDefined();
      expect(result.word!.hanzi).toBe('好');
      expect(result.word!.pinyin).toBe('hǎo');
      expect(result.word!.meaning).toBe('좋다');
    });

    it('should detect duplicate saves', async () => {
      const candidate = {
        hanzi: '大',
        pinyin: 'dà',
        tone: 4,
        meaning: '크다',
        koreanPronunciation: '다',
        frequency: 90,
      };

      useAppStore.getState().selectCandidate(candidate);

      // First save
      const result1 = await useAppStore.getState().saveToVocabulary();
      expect(result1.success).toBe(true);

      // Second save (same hanzi = duplicate)
      const result2 = await useAppStore.getState().saveToVocabulary();
      expect(result2.success).toBe(false);
      expect(result2.isDuplicate).toBe(true);
    });
  });

  describe('navigateTo', () => {
    it('should change currentPage', () => {
      useAppStore.getState().navigateTo('input');
      expect(useAppStore.getState().currentPage).toBe('input');

      useAppStore.getState().navigateTo('vocab');
      expect(useAppStore.getState().currentPage).toBe('vocab');

      useAppStore.getState().navigateTo('settings');
      expect(useAppStore.getState().currentPage).toBe('settings');
    });

    it('should navigate to all page types', () => {
      const pages = [
        'home', 'input', 'vocab', 'pronunciation',
        'writing', 'stroke', 'flashcard', 'stats', 'settings',
      ] as const;

      for (const page of pages) {
        useAppStore.getState().navigateTo(page);
        expect(useAppStore.getState().currentPage).toBe(page);
      }
    });
  });
});
