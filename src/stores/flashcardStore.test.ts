import { describe, it, expect, beforeEach } from 'vitest';
import { useFlashcardStore } from './flashcardStore';
import { db } from '../db/database';
import type { FlashCard, VocabularyWord } from '../db/database';

describe('flashcardStore', () => {
  beforeEach(async () => {
    // Reset the store state
    useFlashcardStore.setState({
      currentCard: null,
      dueCount: 0,
      isShowingAnswer: false,
    });

    // Clear all database tables
    await db.flashcards.clear();
    await db.vocabulary.clear();
    await db.studyEvents.clear();
    await db.dailyStats.clear();
  });

  async function seedWordAndCards(): Promise<{ word: VocabularyWord; cards: FlashCard[] }> {
    const wordId = await db.vocabulary.add({
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      tone: [3, 3],
      meaning: '안녕하세요',
      koreanPronunciation: '니하오',
      isFavorite: false,
      tags: [],
      hskLevel: 1,
      createdAt: new Date(),
      lastStudiedAt: null,
      studyCount: 0,
    });

    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday

    const cardData: Omit<FlashCard, 'id'>[] = [
      {
        wordId: wordId as number,
        cardType: 'meaning-to-hanzi',
        intervalDays: 1,
        nextReviewDate: pastDate,
        studyCount: 0,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: pastDate,
      },
      {
        wordId: wordId as number,
        cardType: 'hanzi-to-meaning',
        intervalDays: 1,
        nextReviewDate: pastDate,
        studyCount: 0,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: pastDate,
      },
    ];

    const ids = await db.flashcards.bulkAdd(cardData, { allKeys: true });
    const cards = (await db.flashcards.bulkGet(ids as number[])).filter(
      (c): c is FlashCard => c !== undefined
    );
    const word = await db.vocabulary.get(wordId as number);

    return { word: word!, cards };
  }

  describe('loadDueCards', () => {
    it('should set dueCount and currentCard when due cards exist', async () => {
      await seedWordAndCards();

      await useFlashcardStore.getState().loadDueCards();

      const state = useFlashcardStore.getState();
      expect(state.dueCount).toBe(2);
      expect(state.currentCard).not.toBeNull();
      expect(state.currentCard!.cardType).toBe('meaning-to-hanzi');
      expect(state.isShowingAnswer).toBe(false);
    });

    it('should set currentCard to null when no due cards exist', async () => {
      await useFlashcardStore.getState().loadDueCards();

      const state = useFlashcardStore.getState();
      expect(state.dueCount).toBe(0);
      expect(state.currentCard).toBeNull();
      expect(state.isShowingAnswer).toBe(false);
    });

    it('should reset isShowingAnswer to false', async () => {
      await seedWordAndCards();

      // Simulate showing answer first
      useFlashcardStore.setState({ isShowingAnswer: true });

      await useFlashcardStore.getState().loadDueCards();

      expect(useFlashcardStore.getState().isShowingAnswer).toBe(false);
    });
  });

  describe('flipCard', () => {
    it('should set isShowingAnswer to true', () => {
      useFlashcardStore.getState().flipCard();

      expect(useFlashcardStore.getState().isShowingAnswer).toBe(true);
    });
  });

  describe('reviewCard', () => {
    it('should review the current card and load next due cards', async () => {
      await seedWordAndCards();
      await useFlashcardStore.getState().loadDueCards();

      const firstCard = useFlashcardStore.getState().currentCard;
      expect(firstCard).not.toBeNull();

      await useFlashcardStore.getState().reviewCard('easy');

      const state = useFlashcardStore.getState();
      // After reviewing, next card should be loaded
      // The reviewed card should have moved to a future date
      expect(state.isShowingAnswer).toBe(false);
      // Due count should decrease by 1 (the reviewed card moved to future)
      expect(state.dueCount).toBe(1);
    });

    it('should record a study activity event', async () => {
      await seedWordAndCards();
      await useFlashcardStore.getState().loadDueCards();

      await useFlashcardStore.getState().reviewCard('normal');

      const events = await db.studyEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('flashcard');
    });

    it('should do nothing if currentCard is null', async () => {
      // No cards loaded
      await useFlashcardStore.getState().reviewCard('hard');

      const events = await db.studyEvents.toArray();
      expect(events.length).toBe(0);
    });
  });
});
