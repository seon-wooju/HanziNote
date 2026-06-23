import { db, type VocabularyWord } from '../db/database';

// ============================================================
// Types
// ============================================================

export type VocabularyFilter =
  | { type: 'all' }
  | { type: 'favorite' }
  | { type: 'today' }
  | { type: 'difficult' }
  | { type: 'hsk'; level: number }
  | { type: 'tag'; tag: string };

export interface SaveResult {
  success: boolean;
  isDuplicate: boolean;
  word?: VocabularyWord;
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Save a new word to the vocabulary.
 * Detects duplicates via the unique hanzi index constraint.
 */
export async function saveWord(
  data: Omit<VocabularyWord, 'id' | 'createdAt' | 'lastStudiedAt' | 'studyCount'>
): Promise<SaveResult> {
  try {
    const word: VocabularyWord = {
      ...data,
      createdAt: new Date(),
      lastStudiedAt: null,
      studyCount: 0,
    };

    const id = await db.vocabulary.add(word);
    const saved = await db.vocabulary.get(id);

    return {
      success: true,
      isDuplicate: false,
      word: saved,
    };
  } catch (error: unknown) {
    // Dexie throws ConstraintError when unique index is violated
    if (
      error instanceof Error &&
      (error.name === 'ConstraintError' ||
        error.message.includes('uniqueness'))
    ) {
      return {
        success: false,
        isDuplicate: true,
      };
    }
    throw error;
  }
}

/**
 * Delete a word and cascade-delete all associated flashcards and study events.
 */
export async function deleteWord(id: number): Promise<void> {
  await db.transaction('rw', db.vocabulary, db.flashcards, db.studyEvents, async () => {
    await db.flashcards.where('wordId').equals(id).delete();
    await db.studyEvents.where('wordId').equals(id).delete();
    await db.vocabulary.delete(id);
  });
}

/**
 * Toggle the isFavorite flag for a word and persist.
 */
export async function toggleFavorite(id: number): Promise<void> {
  const word = await db.vocabulary.get(id);
  if (!word) return;

  await db.vocabulary.update(id, {
    isFavorite: !word.isFavorite,
  });
}

/**
 * Add a tag to a word's tags array.
 * Skips if the tag already exists.
 */
export async function addTag(id: number, tag: string): Promise<void> {
  const word = await db.vocabulary.get(id);
  if (!word) return;

  if (!word.tags.includes(tag)) {
    await db.vocabulary.update(id, {
      tags: [...word.tags, tag],
    });
  }
}

/**
 * Remove a tag from a word's tags array.
 */
export async function removeTag(id: number, tag: string): Promise<void> {
  const word = await db.vocabulary.get(id);
  if (!word) return;

  await db.vocabulary.update(id, {
    tags: word.tags.filter((t) => t !== tag),
  });
}

/**
 * Get words filtered by the given criterion.
 */
export async function getWords(filter: VocabularyFilter): Promise<VocabularyWord[]> {
  switch (filter.type) {
    case 'all':
      return db.vocabulary.orderBy('createdAt').reverse().toArray();

    case 'favorite':
      return db.vocabulary
        .filter((word) => word.isFavorite === true)
        .toArray();

    case 'today': {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );
      return db.vocabulary
        .where('createdAt')
        .between(startOfDay, endOfDay, true, false)
        .reverse()
        .toArray();
    }

    case 'difficult':
      return db.vocabulary
        .filter((word) => {
          if (word.studyCount === 0) return false;
          // A word is "difficult" if it has associated flashcards
          // where hardCount > easyCount + normalCount
          // Since we don't have direct access to flashcard counts here,
          // we use a heuristic: word has been studied but marked difficult overall
          // by checking associated flashcard data
          return true; // Will be refined after fetching flashcard data
        })
        .toArray()
        .then(async (words) => {
          // Filter words that have associated flashcards with hardCount > easyCount + normalCount
          const difficultWords: VocabularyWord[] = [];
          for (const word of words) {
            if (word.id === undefined) continue;
            const cards = await db.flashcards
              .where('wordId')
              .equals(word.id)
              .toArray();
            if (cards.length === 0) continue;
            const totalHard = cards.reduce((sum, c) => sum + c.hardCount, 0);
            const totalEasy = cards.reduce((sum, c) => sum + c.easyCount, 0);
            const totalNormal = cards.reduce((sum, c) => sum + c.normalCount, 0);
            if (totalHard > totalEasy + totalNormal) {
              difficultWords.push(word);
            }
          }
          return difficultWords;
        });

    case 'hsk':
      return db.vocabulary
        .where('hskLevel')
        .equals(filter.level)
        .toArray();

    case 'tag':
      return db.vocabulary
        .where('tags')
        .equals(filter.tag)
        .toArray();
  }
}

/**
 * Search words by Korean meaning (partial match).
 * Returns max 50 results sorted by createdAt descending.
 */
export async function searchByKorean(query: string): Promise<VocabularyWord[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmedQuery = query.trim();

  const results = await db.vocabulary
    .filter((word) => word.meaning.includes(trimmedQuery))
    .toArray();

  // Sort by createdAt descending
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Limit to 50 results
  return results.slice(0, 50);
}
