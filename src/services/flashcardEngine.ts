import { db } from '../db/database';
import type { FlashCard, CardType, VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

export type Difficulty = 'easy' | 'normal' | 'hard';

// ============================================================
// Constants
// ============================================================

export const EASY_INTERVALS = [1, 3, 7, 14, 30];
export const NORMAL_INTERVALS = [1, 2, 4, 7];
export const MAX_NEW_CARDS_PER_DAY = 50;

// ============================================================
// Interval Calculation (Pure Function)
// ============================================================

/**
 * Calculate the next review interval based on difficulty selection.
 * - easy: advance through [1, 3, 7, 14, 30], cap at 30
 * - normal: advance through [1, 2, 4, 7], cap at 7
 * - hard: always reset to 1
 */
export function calculateNextInterval(card: FlashCard, difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy': {
      const currentIndex = EASY_INTERVALS.indexOf(card.intervalDays);
      if (currentIndex === -1 || currentIndex >= EASY_INTERVALS.length - 1) {
        return 30; // 최대 간격 반복
      }
      return EASY_INTERVALS[currentIndex + 1];
    }
    case 'normal': {
      const currentIndex = NORMAL_INTERVALS.indexOf(card.intervalDays);
      if (currentIndex === -1 || currentIndex >= NORMAL_INTERVALS.length - 1) {
        return 7; // 최대 간격 반복
      }
      return NORMAL_INTERVALS[currentIndex + 1];
    }
    case 'hard':
      return 1; // 항상 1일로 초기화
  }
}

// ============================================================
// Card Creation
// ============================================================

/**
 * Create flashcards for a vocabulary word.
 * Generates 4 card types by default, or 3 if TTS is unavailable (skips 'audio-to-hanzi').
 * Each card starts with intervalDays=1 and nextReviewDate = createdAt + 1 day.
 */
export function createCardsForWord(
  word: VocabularyWord,
  ttsAvailable: boolean = true
): FlashCard[] {
  const cardTypes: CardType[] = ttsAvailable
    ? ['meaning-to-hanzi', 'hanzi-to-meaning', 'pinyin-to-hanzi', 'audio-to-hanzi']
    : ['meaning-to-hanzi', 'hanzi-to-meaning', 'pinyin-to-hanzi'];

  const createdAt = word.createdAt;
  const nextReviewDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // +1 day

  return cardTypes.map((cardType) => ({
    wordId: word.id!,
    cardType,
    intervalDays: 1,
    nextReviewDate,
    studyCount: 0,
    easyCount: 0,
    normalCount: 0,
    hardCount: 0,
    lastStudiedAt: null,
    createdAt,
  }));
}

// ============================================================
// Due Cards Query
// ============================================================

/**
 * Get all cards due for review on or before the given date.
 * New cards (studyCount === 0) are limited to MAX_NEW_CARDS_PER_DAY.
 */
export async function getDueCards(date: Date): Promise<FlashCard[]> {
  const allDue = await db.flashcards
    .where('nextReviewDate')
    .belowOrEqual(date)
    .toArray();

  const reviewCards = allDue.filter((card) => card.studyCount > 0);
  const newCards = allDue.filter((card) => card.studyCount === 0);

  const limitedNewCards = newCards.slice(0, MAX_NEW_CARDS_PER_DAY);

  return [...reviewCards, ...limitedNewCards];
}

/**
 * Get the count of cards due for review on or before the given date.
 * New cards (studyCount === 0) are limited to MAX_NEW_CARDS_PER_DAY.
 */
export async function getDueCardCount(date: Date): Promise<number> {
  const allDue = await db.flashcards
    .where('nextReviewDate')
    .belowOrEqual(date)
    .toArray();

  const reviewCount = allDue.filter((card) => card.studyCount > 0).length;
  const newCount = Math.min(
    allDue.filter((card) => card.studyCount === 0).length,
    MAX_NEW_CARDS_PER_DAY
  );

  return reviewCount + newCount;
}

// ============================================================
// Card Review
// ============================================================

/**
 * Review a card with the given difficulty.
 * Updates: studyCount, difficulty count, lastStudiedAt, intervalDays, nextReviewDate.
 */
export async function reviewCard(cardId: number, difficulty: Difficulty): Promise<FlashCard> {
  const card = await db.flashcards.get(cardId);
  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  const newInterval = calculateNextInterval(card, difficulty);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextReviewDate = new Date(today.getTime() + newInterval * 24 * 60 * 60 * 1000);

  const updates: Partial<FlashCard> = {
    studyCount: card.studyCount + 1,
    lastStudiedAt: now,
    intervalDays: newInterval,
    nextReviewDate,
  };

  // Increment the relevant difficulty counter
  switch (difficulty) {
    case 'easy':
      updates.easyCount = card.easyCount + 1;
      break;
    case 'normal':
      updates.normalCount = card.normalCount + 1;
      break;
    case 'hard':
      updates.hardCount = card.hardCount + 1;
      break;
  }

  await db.flashcards.update(cardId, updates);

  return { ...card, ...updates };
}

// ============================================================
// Card Deletion
// ============================================================

/**
 * Delete all flashcards associated with a given word ID.
 */
export async function deleteCardsForWord(wordId: number): Promise<void> {
  await db.flashcards.where('wordId').equals(wordId).delete();
}
