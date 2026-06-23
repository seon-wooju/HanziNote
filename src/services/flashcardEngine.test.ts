import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import type { FlashCard, VocabularyWord } from '../db/database';
import {
  calculateNextInterval,
  createCardsForWord,
  getDueCards,
  getDueCardCount,
  reviewCard,
  deleteCardsForWord,
  EASY_INTERVALS,
  NORMAL_INTERVALS,
  MAX_NEW_CARDS_PER_DAY,
} from './flashcardEngine';

// Helper to create a test word in the DB
async function createTestWord(overrides: Partial<VocabularyWord> = {}): Promise<VocabularyWord> {
  const word: VocabularyWord = {
    hanzi: '你',
    pinyin: 'nǐ',
    tone: [3],
    meaning: '너',
    koreanPronunciation: '니',
    isFavorite: false,
    tags: [],
    hskLevel: 1,
    createdAt: new Date('2024-01-01'),
    lastStudiedAt: null,
    studyCount: 0,
    ...overrides,
  };
  const id = await db.vocabulary.add(word);
  return { ...word, id };
}

describe('flashcardEngine', () => {
  beforeEach(async () => {
    await db.flashcards.clear();
    await db.vocabulary.clear();
  });

  describe('calculateNextInterval', () => {
    it('should return next easy interval for each step', () => {
      const makeCard = (intervalDays: number): FlashCard => ({
        id: 1,
        wordId: 1,
        cardType: 'hanzi-to-meaning',
        intervalDays,
        nextReviewDate: new Date(),
        studyCount: 1,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      });

      expect(calculateNextInterval(makeCard(1), 'easy')).toBe(3);
      expect(calculateNextInterval(makeCard(3), 'easy')).toBe(7);
      expect(calculateNextInterval(makeCard(7), 'easy')).toBe(14);
      expect(calculateNextInterval(makeCard(14), 'easy')).toBe(30);
      expect(calculateNextInterval(makeCard(30), 'easy')).toBe(30); // capped
    });

    it('should return next normal interval for each step', () => {
      const makeCard = (intervalDays: number): FlashCard => ({
        id: 1,
        wordId: 1,
        cardType: 'hanzi-to-meaning',
        intervalDays,
        nextReviewDate: new Date(),
        studyCount: 1,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      });

      expect(calculateNextInterval(makeCard(1), 'normal')).toBe(2);
      expect(calculateNextInterval(makeCard(2), 'normal')).toBe(4);
      expect(calculateNextInterval(makeCard(4), 'normal')).toBe(7);
      expect(calculateNextInterval(makeCard(7), 'normal')).toBe(7); // capped
    });

    it('should always return 1 for hard', () => {
      const makeCard = (intervalDays: number): FlashCard => ({
        id: 1,
        wordId: 1,
        cardType: 'hanzi-to-meaning',
        intervalDays,
        nextReviewDate: new Date(),
        studyCount: 1,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      });

      expect(calculateNextInterval(makeCard(1), 'hard')).toBe(1);
      expect(calculateNextInterval(makeCard(7), 'hard')).toBe(1);
      expect(calculateNextInterval(makeCard(30), 'hard')).toBe(1);
    });

    it('should return max interval for unrecognized interval values', () => {
      const makeCard = (intervalDays: number): FlashCard => ({
        id: 1,
        wordId: 1,
        cardType: 'hanzi-to-meaning',
        intervalDays,
        nextReviewDate: new Date(),
        studyCount: 1,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      });

      // intervalDays=5 is not in EASY_INTERVALS, so indexOf returns -1 → return 30
      expect(calculateNextInterval(makeCard(5), 'easy')).toBe(30);
      // intervalDays=5 is not in NORMAL_INTERVALS → return 7
      expect(calculateNextInterval(makeCard(5), 'normal')).toBe(7);
    });
  });

  describe('createCardsForWord', () => {
    it('should create 4 card types when TTS is available', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);

      expect(cards).toHaveLength(4);
      const types = cards.map((c) => c.cardType);
      expect(types).toContain('meaning-to-hanzi');
      expect(types).toContain('hanzi-to-meaning');
      expect(types).toContain('pinyin-to-hanzi');
      expect(types).toContain('audio-to-hanzi');
    });

    it('should create 3 card types when TTS is unavailable', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, false);

      expect(cards).toHaveLength(3);
      const types = cards.map((c) => c.cardType);
      expect(types).toContain('meaning-to-hanzi');
      expect(types).toContain('hanzi-to-meaning');
      expect(types).toContain('pinyin-to-hanzi');
      expect(types).not.toContain('audio-to-hanzi');
    });

    it('should set initial intervalDays to 1', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);

      for (const card of cards) {
        expect(card.intervalDays).toBe(1);
      }
    });

    it('should set nextReviewDate to createdAt + 1 day', async () => {
      const createdAt = new Date('2024-01-15T10:00:00Z');
      const word = await createTestWord({ createdAt });
      const cards = createCardsForWord(word, true);

      const expectedReviewDate = new Date('2024-01-16T10:00:00Z');
      for (const card of cards) {
        expect(card.nextReviewDate.getTime()).toBe(expectedReviewDate.getTime());
      }
    });

    it('should initialize all counters to 0', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);

      for (const card of cards) {
        expect(card.studyCount).toBe(0);
        expect(card.easyCount).toBe(0);
        expect(card.normalCount).toBe(0);
        expect(card.hardCount).toBe(0);
        expect(card.lastStudiedAt).toBeNull();
      }
    });
  });

  describe('getDueCards', () => {
    it('should return cards with nextReviewDate <= given date', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);

      // Mark cards as studied (studyCount > 0) so they count as review cards
      for (const card of cards) {
        card.studyCount = 1;
      }
      await db.flashcards.bulkAdd(cards);

      const today = new Date('2024-01-17');
      const dueCards = await getDueCards(today);
      // nextReviewDate is 2024-01-02 (createdAt 2024-01-01 + 1 day), which is <= 2024-01-17
      expect(dueCards.length).toBe(4);
    });

    it('should not return cards with nextReviewDate > given date', async () => {
      const word = await createTestWord({ createdAt: new Date('2024-01-15') });
      const cards = createCardsForWord(word, true);
      await db.flashcards.bulkAdd(cards);

      // nextReviewDate is 2024-01-16, query with date before that
      const dueCards = await getDueCards(new Date('2024-01-15'));
      expect(dueCards.length).toBe(0);
    });

    it('should limit new cards to MAX_NEW_CARDS_PER_DAY', async () => {
      // Create more than 50 new cards
      for (let i = 0; i < 60; i++) {
        const word = await createTestWord({
          hanzi: `字${i}`,
          createdAt: new Date('2024-01-01'),
        });
        const cards = createCardsForWord(word, false); // 3 cards each = 180 total
        await db.flashcards.bulkAdd(cards);
      }

      const dueCards = await getDueCards(new Date('2024-01-05'));
      // All cards have studyCount=0, so they are new cards, limited to 50
      expect(dueCards.length).toBe(MAX_NEW_CARDS_PER_DAY);
    });

    it('should not limit review cards (studyCount > 0)', async () => {
      // Create 60 review cards
      for (let i = 0; i < 60; i++) {
        await db.flashcards.add({
          wordId: i + 1,
          cardType: 'hanzi-to-meaning',
          intervalDays: 1,
          nextReviewDate: new Date('2024-01-02'),
          studyCount: 1,
          easyCount: 0,
          normalCount: 0,
          hardCount: 0,
          lastStudiedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        });
      }

      const dueCards = await getDueCards(new Date('2024-01-05'));
      expect(dueCards.length).toBe(60); // no limit on review cards
    });
  });

  describe('getDueCardCount', () => {
    it('should return correct count respecting new card limit', async () => {
      // Add 10 review cards + 60 new cards
      for (let i = 0; i < 10; i++) {
        await db.flashcards.add({
          wordId: i + 1,
          cardType: 'hanzi-to-meaning',
          intervalDays: 1,
          nextReviewDate: new Date('2024-01-02'),
          studyCount: 1,
          easyCount: 0,
          normalCount: 0,
          hardCount: 0,
          lastStudiedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        });
      }
      for (let i = 0; i < 60; i++) {
        await db.flashcards.add({
          wordId: i + 100,
          cardType: 'meaning-to-hanzi',
          intervalDays: 1,
          nextReviewDate: new Date('2024-01-02'),
          studyCount: 0,
          easyCount: 0,
          normalCount: 0,
          hardCount: 0,
          lastStudiedAt: null,
          createdAt: new Date('2024-01-01'),
        });
      }

      const count = await getDueCardCount(new Date('2024-01-05'));
      // 10 review cards + min(60, 50) new cards = 60
      expect(count).toBe(60);
    });
  });

  describe('reviewCard', () => {
    it('should increment studyCount and difficulty counter', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      const cardId = (await db.flashcards.add(cards[0])) as number;

      const result = await reviewCard(cardId, 'easy');
      expect(result.studyCount).toBe(1);
      expect(result.easyCount).toBe(1);
      expect(result.normalCount).toBe(0);
      expect(result.hardCount).toBe(0);
    });

    it('should update intervalDays based on difficulty', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      const cardId = (await db.flashcards.add(cards[0])) as number;

      const result = await reviewCard(cardId, 'easy');
      // Initial interval is 1, easy advances to 3
      expect(result.intervalDays).toBe(3);
    });

    it('should set lastStudiedAt to current time', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      const cardId = (await db.flashcards.add(cards[0])) as number;

      const before = new Date();
      const result = await reviewCard(cardId, 'normal');
      const after = new Date();

      expect(result.lastStudiedAt).not.toBeNull();
      expect(result.lastStudiedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastStudiedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set nextReviewDate to today + new interval', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      const cardId = (await db.flashcards.add(cards[0])) as number;

      const result = await reviewCard(cardId, 'easy');
      // New interval is 3 days
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const expectedDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      expect(result.nextReviewDate.getTime()).toBe(expectedDate.getTime());
    });

    it('should throw for non-existent card', async () => {
      await expect(reviewCard(99999, 'easy')).rejects.toThrow('Card not found: 99999');
    });

    it('should persist changes to the database', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      const cardId = (await db.flashcards.add(cards[0])) as number;

      await reviewCard(cardId, 'normal');

      const dbCard = await db.flashcards.get(cardId);
      expect(dbCard!.studyCount).toBe(1);
      expect(dbCard!.normalCount).toBe(1);
      expect(dbCard!.intervalDays).toBe(2); // 1 → 2 for normal
    });
  });

  describe('deleteCardsForWord', () => {
    it('should delete all cards for a given wordId', async () => {
      const word = await createTestWord();
      const cards = createCardsForWord(word, true);
      await db.flashcards.bulkAdd(cards);

      const countBefore = await db.flashcards.where('wordId').equals(word.id!).count();
      expect(countBefore).toBe(4);

      await deleteCardsForWord(word.id!);

      const countAfter = await db.flashcards.where('wordId').equals(word.id!).count();
      expect(countAfter).toBe(0);
    });

    it('should not delete cards for other words', async () => {
      const word1 = await createTestWord({ hanzi: '一' });
      const word2 = await createTestWord({ hanzi: '二' });

      await db.flashcards.bulkAdd(createCardsForWord(word1, true));
      await db.flashcards.bulkAdd(createCardsForWord(word2, true));

      await deleteCardsForWord(word1.id!);

      const remainingCards = await db.flashcards.where('wordId').equals(word2.id!).count();
      expect(remainingCards).toBe(4);
    });
  });

  describe('exported constants', () => {
    it('should have correct EASY_INTERVALS', () => {
      expect(EASY_INTERVALS).toEqual([1, 3, 7, 14, 30]);
    });

    it('should have correct NORMAL_INTERVALS', () => {
      expect(NORMAL_INTERVALS).toEqual([1, 2, 4, 7]);
    });

    it('should have MAX_NEW_CARDS_PER_DAY = 50', () => {
      expect(MAX_NEW_CARDS_PER_DAY).toBe(50);
    });
  });
});
