import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import {
  saveWord,
  deleteWord,
  toggleFavorite,
  addTag,
  removeTag,
  getWords,
  searchByKorean,
} from './vocabularyManager';

function makeWordData(overrides: Partial<Parameters<typeof saveWord>[0]> = {}) {
  return {
    hanzi: '你',
    pinyin: 'nǐ',
    tone: [3],
    meaning: '너',
    koreanPronunciation: '니',
    isFavorite: false,
    tags: [] as string[],
    hskLevel: 1 as number | null,
    ...overrides,
  };
}

describe('vocabularyManager', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
    await db.flashcards.clear();
    await db.studyEvents.clear();
  });

  describe('saveWord', () => {
    it('should save a word with initialized metadata', async () => {
      const result = await saveWord(makeWordData());

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.word).toBeDefined();
      expect(result.word!.hanzi).toBe('你');
      expect(result.word!.studyCount).toBe(0);
      expect(result.word!.lastStudiedAt).toBeNull();
      expect(result.word!.createdAt).toBeInstanceOf(Date);
    });

    it('should detect duplicate hanzi', async () => {
      await saveWord(makeWordData());
      const result = await saveWord(makeWordData({ pinyin: 'nǐ', meaning: '다른 뜻' }));

      expect(result.success).toBe(false);
      expect(result.isDuplicate).toBe(true);
      expect(result.word).toBeUndefined();
    });

    it('should allow different hanzi', async () => {
      await saveWord(makeWordData({ hanzi: '你' }));
      const result = await saveWord(makeWordData({ hanzi: '好' }));

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('deleteWord', () => {
    it('should delete the word from vocabulary', async () => {
      const { word } = await saveWord(makeWordData());
      expect(await db.vocabulary.count()).toBe(1);

      await deleteWord(word!.id!);
      expect(await db.vocabulary.count()).toBe(0);
    });

    it('should cascade delete associated flashcards', async () => {
      const { word } = await saveWord(makeWordData());
      const wordId = word!.id!;

      // Add some flashcards for this word
      await db.flashcards.bulkAdd([
        {
          wordId,
          cardType: 'meaning-to-hanzi',
          intervalDays: 1,
          nextReviewDate: new Date(),
          studyCount: 0,
          easyCount: 0,
          normalCount: 0,
          hardCount: 0,
          lastStudiedAt: null,
          createdAt: new Date(),
        },
        {
          wordId,
          cardType: 'hanzi-to-meaning',
          intervalDays: 1,
          nextReviewDate: new Date(),
          studyCount: 0,
          easyCount: 0,
          normalCount: 0,
          hardCount: 0,
          lastStudiedAt: null,
          createdAt: new Date(),
        },
      ]);

      expect(await db.flashcards.where('wordId').equals(wordId).count()).toBe(2);

      await deleteWord(wordId);

      expect(await db.flashcards.where('wordId').equals(wordId).count()).toBe(0);
      expect(await db.vocabulary.count()).toBe(0);
    });

    it('should cascade delete associated study events', async () => {
      const { word } = await saveWord(makeWordData());
      const wordId = word!.id!;

      // Add some study events for this word
      await db.studyEvents.bulkAdd([
        {
          wordId,
          type: 'flashcard',
          date: '2024-01-15',
          timestamp: new Date(),
        },
        {
          wordId,
          type: 'writing',
          date: '2024-01-15',
          timestamp: new Date(),
        },
      ]);

      expect(await db.studyEvents.where('wordId').equals(wordId).count()).toBe(2);

      await deleteWord(wordId);

      expect(await db.studyEvents.where('wordId').equals(wordId).count()).toBe(0);
      expect(await db.vocabulary.count()).toBe(0);
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle isFavorite from false to true', async () => {
      const { word } = await saveWord(makeWordData({ isFavorite: false }));
      await toggleFavorite(word!.id!);

      const updated = await db.vocabulary.get(word!.id!);
      expect(updated!.isFavorite).toBe(true);
    });

    it('should toggle isFavorite from true to false', async () => {
      const { word } = await saveWord(makeWordData({ isFavorite: true }));
      await toggleFavorite(word!.id!);

      const updated = await db.vocabulary.get(word!.id!);
      expect(updated!.isFavorite).toBe(false);
    });
  });

  describe('addTag / removeTag', () => {
    it('should add a tag to a word', async () => {
      const { word } = await saveWord(makeWordData({ tags: [] }));
      await addTag(word!.id!, 'HSK1');

      const updated = await db.vocabulary.get(word!.id!);
      expect(updated!.tags).toContain('HSK1');
    });

    it('should not add duplicate tag', async () => {
      const { word } = await saveWord(makeWordData({ tags: ['HSK1'] }));
      await addTag(word!.id!, 'HSK1');

      const updated = await db.vocabulary.get(word!.id!);
      expect(updated!.tags).toEqual(['HSK1']);
    });

    it('should remove a tag from a word', async () => {
      const { word } = await saveWord(makeWordData({ tags: ['HSK1', '음식'] }));
      await removeTag(word!.id!, 'HSK1');

      const updated = await db.vocabulary.get(word!.id!);
      expect(updated!.tags).toEqual(['음식']);
    });
  });

  describe('getWords', () => {
    it('should return all words sorted by createdAt desc', async () => {
      await saveWord(makeWordData({ hanzi: '一' }));
      await new Promise((r) => setTimeout(r, 10));
      await saveWord(makeWordData({ hanzi: '二' }));

      const words = await getWords({ type: 'all' });
      expect(words.length).toBe(2);
      expect(words[0].hanzi).toBe('二');
      expect(words[1].hanzi).toBe('一');
    });

    it('should filter favorite words', async () => {
      await saveWord(makeWordData({ hanzi: '一', isFavorite: true }));
      await saveWord(makeWordData({ hanzi: '二', isFavorite: false }));

      const words = await getWords({ type: 'favorite' });
      expect(words.length).toBe(1);
      expect(words[0].hanzi).toBe('一');
    });

    it('should filter today\'s words', async () => {
      await saveWord(makeWordData({ hanzi: '一' }));

      const words = await getWords({ type: 'today' });
      expect(words.length).toBe(1);
      expect(words[0].hanzi).toBe('一');
    });

    it('should filter by HSK level', async () => {
      await saveWord(makeWordData({ hanzi: '一', hskLevel: 1 }));
      await saveWord(makeWordData({ hanzi: '二', hskLevel: 2 }));

      const words = await getWords({ type: 'hsk', level: 1 });
      expect(words.length).toBe(1);
      expect(words[0].hanzi).toBe('一');
    });

    it('should filter by tag', async () => {
      await saveWord(makeWordData({ hanzi: '一', tags: ['음식'] }));
      await saveWord(makeWordData({ hanzi: '二', tags: ['동물'] }));

      const words = await getWords({ type: 'tag', tag: '음식' });
      expect(words.length).toBe(1);
      expect(words[0].hanzi).toBe('一');
    });

    it('should filter difficult words', async () => {
      const { word } = await saveWord(makeWordData({ hanzi: '一' }));
      // Mark as studied
      await db.vocabulary.update(word!.id!, { studyCount: 5 });
      // Add flashcard with high hardCount
      await db.flashcards.add({
        wordId: word!.id!,
        cardType: 'meaning-to-hanzi',
        intervalDays: 1,
        nextReviewDate: new Date(),
        studyCount: 5,
        easyCount: 0,
        normalCount: 1,
        hardCount: 3,
        lastStudiedAt: new Date(),
        createdAt: new Date(),
      });

      const words = await getWords({ type: 'difficult' });
      expect(words.length).toBe(1);
      expect(words[0].hanzi).toBe('一');
    });
  });

  describe('searchByKorean', () => {
    it('should find words by partial Korean meaning match', async () => {
      await saveWord(makeWordData({ hanzi: '朋友', meaning: '친구, 벗' }));
      await saveWord(makeWordData({ hanzi: '好', meaning: '좋다' }));

      const results = await searchByKorean('친구');
      expect(results.length).toBe(1);
      expect(results[0].hanzi).toBe('朋友');
    });

    it('should return empty array for empty query', async () => {
      await saveWord(makeWordData({ hanzi: '好', meaning: '좋다' }));

      const results = await searchByKorean('');
      expect(results.length).toBe(0);
    });

    it('should limit results to 50', async () => {
      // Create more than 50 words with matching meaning
      for (let i = 0; i < 55; i++) {
        await saveWord(
          makeWordData({ hanzi: `字${i}`, meaning: `테스트 단어 ${i}` })
        );
      }

      const results = await searchByKorean('테스트');
      expect(results.length).toBe(50);
    });

    it('should sort results by createdAt descending', async () => {
      await saveWord(makeWordData({ hanzi: '一', meaning: '하나' }));
      await new Promise((r) => setTimeout(r, 10));
      await saveWord(makeWordData({ hanzi: '二', meaning: '하나 둘' }));

      const results = await searchByKorean('하나');
      expect(results.length).toBe(2);
      expect(results[0].hanzi).toBe('二');
      expect(results[1].hanzi).toBe('一');
    });
  });
});
