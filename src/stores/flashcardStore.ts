import { create } from 'zustand';
import type { FlashCard } from '../db/database';
import {
  type Difficulty,
  getDueCards,
  getDueCardCount,
  reviewCard as reviewCardService,
} from '../services/flashcardEngine';
import { recordStudyActivity } from '../services/statisticsManager';

// ============================================================
// Interface
// ============================================================

export interface FlashcardState {
  currentCard: FlashCard | null;
  dueCount: number;
  isShowingAnswer: boolean;
  flipCard: () => void;
  reviewCard: (difficulty: Difficulty) => Promise<void>;
  loadDueCards: () => Promise<void>;
}

// ============================================================
// Store
// ============================================================

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  currentCard: null,
  dueCount: 0,
  isShowingAnswer: false,

  flipCard: () => {
    set({ isShowingAnswer: true });
  },

  reviewCard: async (difficulty: Difficulty) => {
    const { currentCard, loadDueCards } = get();
    if (!currentCard || currentCard.id === undefined) return;

    await reviewCardService(currentCard.id, difficulty);
    await recordStudyActivity('flashcard', currentCard.wordId);
    await loadDueCards();
  },

  loadDueCards: async () => {
    const now = new Date();
    const dueCount = await getDueCardCount(now);
    const dueCards = await getDueCards(now);
    const currentCard = dueCards.length > 0 ? dueCards[0] : null;

    set({
      dueCount,
      currentCard,
      isShowingAnswer: false,
    });
  },
}));
