/**
 * Integration Tests - End-to-End Flows
 *
 * Tests full workflows across services and stores using fake-indexeddb.
 * No mocks — exercises real Dexie database interactions.
 *
 * Validates: Requirements 3.1, 3.6, 10.1, 10.11, 15.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { useAppStore } from '../stores/appStore';
import { useFlashcardStore } from '../stores/flashcardStore';
import { useSettingsStore } from '../stores/settingsStore';
import * as vocabularyManager from '../services/vocabularyManager';
import type { HanziCandidate } from '../services/chineseConverter';

// ============================================================
// Helpers
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock HanziCandidate for testing.
 */
function createCandidate(overrides: Partial<HanziCandidate> = {}): HanziCandidate {
  return {
    hanzi: '你好',
    pinyin: 'nǐhǎo',
    tone: 3,
    meaning: '안녕하세요',
    koreanPronunciation: '니하오',
    frequency: 100,
    ...overrides,
  };
}

// ============================================================
// Test Suite
// ============================================================

describe('Integration: End-to-End Flows', () => {
  beforeEach(async () => {
    // Clear ALL database tables before each test
    await db.vocabulary.clear();
    await db.flashcards.clear();
    await db.studyEvents.clear();
    await db.dailyStats.clear();
    await db.settings.clear();

    // Reset stores to initial state
    useAppStore.setState({
      pinyinInput: '',
      conversionResult: null,
      hanziCandidates: [],
      selectedCandidate: null,
      currentPage: 'home',
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Test 1: Save Word → Flashcard Creation → Review → Delete Cascade
  // ─────────────────────────────────────────────────────────────
  describe('Save Word → Flashcard Creation → Review → Delete Cascade', () => {
    it('should complete the full lifecycle of a word', async () => {
      const appStore = useAppStore.getState();
      const flashcardStore = useFlashcardStore.getState();

      // Step 1: Set a selected candidate and save to vocabulary
      const candidate = createCandidate();
      useAppStore.setState({ selectedCandidate: candidate });

      const saveResult = await useAppStore.getState().saveToVocabulary();

      // Verify save was successful
      expect(saveResult.success).toBe(true);
      expect(saveResult.isDuplicate).toBe(false);
      expect(saveResult.word).toBeDefined();

      const wordId = saveResult.word!.id!;

      // Step 2: Verify the word is in db.vocabulary
      const savedWord = await db.vocabulary.get(wordId);
      expect(savedWord).toBeDefined();
      expect(savedWord!.hanzi).toBe('你好');
      expect(savedWord!.pinyin).toBe('nǐhǎo');

      // Step 3: Verify flashcards were auto-generated
      // TTS is not available in test environment, so expect 3 cards
      const cards = await db.flashcards.where('wordId').equals(wordId).toArray();
      expect(cards.length).toBe(3);

      // Verify card types
      const cardTypes = cards.map((c) => c.cardType).sort();
      expect(cardTypes).toEqual(
        ['hanzi-to-meaning', 'meaning-to-hanzi', 'pinyin-to-hanzi']
      );

      // Verify each card has initial intervalDays of 1
      for (const card of cards) {
        expect(card.intervalDays).toBe(1);
        expect(card.studyCount).toBe(0);
      }

      // Step 4: Verify a studyEvent was recorded
      const events = await db.studyEvents.where('wordId').equals(wordId).toArray();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('flashcard');

      // Step 5: Load due cards (cards are due tomorrow, so set nextReviewDate to now)
      // Manually adjust nextReviewDate to make cards due now for testing
      for (const card of cards) {
        await db.flashcards.update(card.id!, { nextReviewDate: new Date() });
      }

      await useFlashcardStore.getState().loadDueCards();
      const { currentCard, dueCount } = useFlashcardStore.getState();

      expect(dueCount).toBeGreaterThan(0);
      expect(currentCard).not.toBeNull();

      // Step 6: Review a card with 'easy' difficulty
      await useFlashcardStore.getState().reviewCard('easy');

      // Step 7: Verify the card's intervalDays was updated
      const reviewedCard = await db.flashcards.get(currentCard!.id!);
      expect(reviewedCard!.intervalDays).toBeGreaterThan(1);
      expect(reviewedCard!.studyCount).toBe(1);
      expect(reviewedCard!.easyCount).toBe(1);

      // Step 8: Verify another studyEvent was recorded (total: 2)
      const eventsAfterReview = await db.studyEvents
        .where('wordId')
        .equals(wordId)
        .toArray();
      expect(eventsAfterReview.length).toBe(2);

      // Step 9: Delete the word using vocabularyManager
      await vocabularyManager.deleteWord(wordId);

      // Step 10: Verify db.vocabulary has 0 records for that word
      const deletedWord = await db.vocabulary.get(wordId);
      expect(deletedWord).toBeUndefined();

      // Step 11: Verify db.flashcards has 0 records for that wordId
      const remainingCards = await db.flashcards
        .where('wordId')
        .equals(wordId)
        .toArray();
      expect(remainingCards.length).toBe(0);

      // Step 12: Verify db.studyEvents has 0 records for that wordId
      const remainingEvents = await db.studyEvents
        .where('wordId')
        .equals(wordId)
        .toArray();
      expect(remainingEvents.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Test 2: Settings Change → Persistence
  // ─────────────────────────────────────────────────────────────
  describe('Settings Change → Persistence', () => {
    it('should persist settings changes and reload them correctly', async () => {
      const settingsStore = useSettingsStore.getState();

      // Verify initial state
      expect(settingsStore.settings.largeFontMode).toBe(false);

      // Step 1: Update a setting
      useSettingsStore.getState().updateSetting('largeFontMode', true);

      // Step 2: Wait for debounce (500ms debounce + buffer)
      await delay(600);

      // Step 3: Verify db.settings has the updated value
      const record = await db.settings.get('largeFontMode');
      expect(record).toBeDefined();
      expect(record!.value).toBe(true);

      // Step 4: Reset the store state to defaults (simulating app restart)
      useSettingsStore.setState({
        settings: {
          largeFontMode: false,
          extraLargeFontMode: false,
          hidePinyin: false,
          hideMeaning: false,
          showStrokeOrder: false,
          hideKoreanPronunciation: false,
        },
        isLoaded: false,
      });

      // Step 5: Load settings from DB
      await useSettingsStore.getState().loadSettings();

      // Step 6: Verify loaded settings reflect the persisted change
      const loadedSettings = useSettingsStore.getState().settings;
      expect(loadedSettings.largeFontMode).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Test 3: Duplicate Word Prevention
  // ─────────────────────────────────────────────────────────────
  describe('Duplicate Word Prevention', () => {
    it('should prevent saving the same hanzi twice', async () => {
      const candidate = createCandidate({ hanzi: '学习' });

      // Step 1: Save a word
      useAppStore.setState({ selectedCandidate: candidate });
      const firstResult = await useAppStore.getState().saveToVocabulary();

      expect(firstResult.success).toBe(true);
      expect(firstResult.isDuplicate).toBe(false);

      // Verify vocabulary count is 1
      const countAfterFirst = await db.vocabulary.count();
      expect(countAfterFirst).toBe(1);

      // Step 2: Attempt to save the same hanzi again
      useAppStore.setState({ selectedCandidate: candidate });
      const secondResult = await useAppStore.getState().saveToVocabulary();

      // Step 3: Verify it returns isDuplicate: true
      expect(secondResult.success).toBe(false);
      expect(secondResult.isDuplicate).toBe(true);

      // Step 4: Verify vocabulary count is still 1
      const countAfterSecond = await db.vocabulary.count();
      expect(countAfterSecond).toBe(1);
    });
  });
});
