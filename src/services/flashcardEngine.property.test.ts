import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { db } from '../db/database';
import type { VocabularyWord, FlashCard, CardType } from '../db/database';
import { flashCardArb, difficultyArb } from '../test/generators';
import {
  createCardsForWord,
  calculateNextInterval,
  getDueCardCount,
  EASY_INTERVALS,
  NORMAL_INTERVALS,
  MAX_NEW_CARDS_PER_DAY,
} from './flashcardEngine';

/**
 * Property 10: Flashcard Auto-Generation
 *
 * For any word saved to vocabulary, the system SHALL automatically create exactly
 * 4 card types (or 3 if TTS unavailable), each with nextReviewDate set to
 * creation date + 1 day and intervalDays = 1.
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

// Generator: VocabularyWord with a random createdAt date
const vocabularyWordWithDateArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  hanzi: fc.string({ minLength: 1, maxLength: 4, unit: fc.constantFrom('你', '好', '我', '是', '人', '大', '中', '国') }),
  pinyin: fc.constantFrom('ni', 'hao', 'wo', 'shi', 'ren', 'da', 'zhong', 'guo'),
  tone: fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  lastStudiedAt: fc.constant(null as Date | null),
  studyCount: fc.constant(0),
}) as fc.Arbitrary<VocabularyWord>;

describe('Feature: chinese-learning-keyboard, Property 10: Flashcard Auto-Generation', () => {
  it('creates exactly 4 cards when ttsAvailable=true, or 3 when ttsAvailable=false', () => {
    fc.assert(
      fc.property(vocabularyWordWithDateArb, fc.boolean(), (word, ttsAvailable) => {
        const cards = createCardsForWord(word, ttsAvailable);

        // Assert: exactly 4 cards if ttsAvailable=true, exactly 3 if false
        const expectedCount = ttsAvailable ? 4 : 3;
        expect(cards.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('every card has intervalDays === 1', () => {
    fc.assert(
      fc.property(vocabularyWordWithDateArb, fc.boolean(), (word, ttsAvailable) => {
        const cards = createCardsForWord(word, ttsAvailable);

        for (const card of cards) {
          expect(card.intervalDays).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every card has nextReviewDate === createdAt + 1 day (24*60*60*1000 ms)', () => {
    fc.assert(
      fc.property(vocabularyWordWithDateArb, fc.boolean(), (word, ttsAvailable) => {
        const cards = createCardsForWord(word, ttsAvailable);
        const expectedNextReview = new Date(word.createdAt.getTime() + 24 * 60 * 60 * 1000);

        for (const card of cards) {
          expect(card.nextReviewDate.getTime()).toBe(expectedNextReview.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every card has studyCount=0, easyCount=0, normalCount=0, hardCount=0, lastStudiedAt=null', () => {
    fc.assert(
      fc.property(vocabularyWordWithDateArb, fc.boolean(), (word, ttsAvailable) => {
        const cards = createCardsForWord(word, ttsAvailable);

        for (const card of cards) {
          expect(card.studyCount).toBe(0);
          expect(card.easyCount).toBe(0);
          expect(card.normalCount).toBe(0);
          expect(card.hardCount).toBe(0);
          expect(card.lastStudiedAt).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all card types are unique', () => {
    fc.assert(
      fc.property(vocabularyWordWithDateArb, fc.boolean(), (word, ttsAvailable) => {
        const cards = createCardsForWord(word, ttsAvailable);
        const cardTypes = cards.map((c) => c.cardType);
        const uniqueTypes = new Set(cardTypes);

        expect(uniqueTypes.size).toBe(cards.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 11: Spaced Repetition Interval Progression
 *
 * For any flashcard at any interval stage:
 * - Selecting "easy" SHALL advance the interval to the next value in [1, 3, 7, 14, 30] (capped at 30)
 * - Selecting "normal" SHALL advance the interval to the next value in [1, 2, 4, 7] (capped at 7)
 * - Selecting "hard" SHALL always reset the interval to 1
 *
 * **Validates: Requirements 10.4, 10.5, 10.6, 10.7**
 */

// Generator: FlashCard with intervalDays from the combined valid set of EASY + NORMAL intervals
const allValidIntervals = [...new Set([...EASY_INTERVALS, ...NORMAL_INTERVALS])];
const intervalDaysArb = fc.constantFrom(...allValidIntervals);
const flashCardWithIntervalArb = fc.tuple(flashCardArb, intervalDaysArb).map(
  ([card, intervalDays]): FlashCard => ({ ...card, intervalDays })
);

describe('Feature: chinese-learning-keyboard, Property 11: Spaced Repetition Interval Progression', () => {
  it('selecting "easy" advances the interval to the next value in EASY_INTERVALS, capped at 30', () => {
    fc.assert(
      fc.property(flashCardWithIntervalArb, (card) => {
        const result = calculateNextInterval(card, 'easy');

        const currentIndex = EASY_INTERVALS.indexOf(card.intervalDays);
        if (currentIndex === -1 || currentIndex >= EASY_INTERVALS.length - 1) {
          // Not in easy intervals or at max → returns cap (30)
          expect(result).toBe(30);
        } else {
          // Advances to next value in the sequence
          expect(result).toBe(EASY_INTERVALS[currentIndex + 1]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('selecting "normal" advances the interval to the next value in NORMAL_INTERVALS, capped at 7', () => {
    fc.assert(
      fc.property(flashCardWithIntervalArb, (card) => {
        const result = calculateNextInterval(card, 'normal');

        const currentIndex = NORMAL_INTERVALS.indexOf(card.intervalDays);
        if (currentIndex === -1 || currentIndex >= NORMAL_INTERVALS.length - 1) {
          // Not in normal intervals or at max → returns cap (7)
          expect(result).toBe(7);
        } else {
          // Advances to next value in the sequence
          expect(result).toBe(NORMAL_INTERVALS[currentIndex + 1]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('selecting "hard" always resets the interval to 1', () => {
    fc.assert(
      fc.property(flashCardWithIntervalArb, (card) => {
        const result = calculateNextInterval(card, 'hard');
        expect(result).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('for any difficulty, the result is always a positive integer within known bounds', () => {
    fc.assert(
      fc.property(flashCardWithIntervalArb, difficultyArb, (card, difficulty) => {
        const result = calculateNextInterval(card, difficulty);

        // Result must be a positive integer
        expect(result).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(result)).toBe(true);

        // Result is bounded by the max interval across all progressions
        expect(result).toBeLessThanOrEqual(30);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 12: Due Card Count Accuracy
 *
 * For any set of flashcards with various nextReviewDate values, the due card count
 * for a given date SHALL equal the number of cards where nextReviewDate <= date,
 * limited to MAX_NEW_CARDS_PER_DAY for new cards.
 *
 * Validates: Requirements 10.8, 10.12
 */

// Generator for a flashcard with random nextReviewDate and studyCount
const cardTypeArb = fc.constantFrom<CardType>(
  'meaning-to-hanzi',
  'hanzi-to-meaning',
  'pinyin-to-hanzi',
  'audio-to-hanzi'
);

// Generate a date within a reasonable range (Jan 2024 - Dec 2024)
const dateArb = fc.integer({ min: 0, max: 364 }).map(
  (dayOffset) => new Date(2024, 0, 1 + dayOffset)
);

// Generate a flashcard record (without id, to be inserted into DB)
const flashCardDataArb = fc.record({
  wordId: fc.integer({ min: 1, max: 1000 }),
  cardType: cardTypeArb,
  intervalDays: fc.constantFrom(1, 2, 3, 4, 7, 14, 30),
  nextReviewDate: dateArb,
  studyCount: fc.nat({ max: 20 }),
  easyCount: fc.nat({ max: 10 }),
  normalCount: fc.nat({ max: 10 }),
  hardCount: fc.nat({ max: 10 }),
  lastStudiedAt: fc.option(dateArb, { nil: null }),
  createdAt: dateArb,
});

// Generate a set of flashcards (between 1 and 80 to test the cap)
const flashCardSetArb = fc.array(flashCardDataArb, { minLength: 1, maxLength: 80 });

describe('Feature: chinese-learning-keyboard, Property 12: Due Card Count Accuracy', () => {
  beforeEach(async () => {
    await db.flashcards.clear();
  });

  it('getDueCardCount returns review cards count + min(new cards count, MAX_NEW_CARDS_PER_DAY) for any query date', async () => {
    await fc.assert(
      fc.asyncProperty(flashCardSetArb, dateArb, async (cards, queryDate) => {
        // Clear DB for each iteration
        await db.flashcards.clear();

        // Insert all cards into the database
        await db.flashcards.bulkAdd(cards);

        // Call getDueCardCount
        const actualCount = await getDueCardCount(queryDate);

        // Manually compute expected count
        const dueCards = cards.filter(
          (card) => card.nextReviewDate.getTime() <= queryDate.getTime()
        );
        const reviewCards = dueCards.filter((card) => card.studyCount > 0);
        const newCards = dueCards.filter((card) => card.studyCount === 0);

        const expectedCount =
          reviewCards.length + Math.min(newCards.length, MAX_NEW_CARDS_PER_DAY);

        expect(actualCount).toBe(expectedCount);
      }),
      { numRuns: 50 }
    );
  });
});
