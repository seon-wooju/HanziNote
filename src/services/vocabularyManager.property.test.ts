import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { db } from '../db/database';
import { saveWord, deleteWord, searchByKorean, getWords, toggleFavorite, addTag, removeTag } from './vocabularyManager';
import { createCardsForWord } from './flashcardEngine';

/**
 * Property 5: Vocabulary Save Round-Trip
 *
 * For any valid word data, saving to the vocabulary and then retrieving by hanzi
 * SHALL return an equivalent record with all original fields preserved plus
 * initialized metadata (studyCount=0, lastStudiedAt=null).
 *
 * Validates: Requirements 3.1
 */

const wordDataArb = fc.record({
  hanzi: fc.integer({ min: 1, max: 99999 }).map(n => '\u5B57' + n),
  pinyin: fc.constant('zi'),
  tone: fc.constant([4] as number[]),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

describe('Feature: chinese-learning-keyboard, Property 5: Vocabulary Save Round-Trip', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
  });

  it('saving a word and retrieving by hanzi preserves all original fields with initialized metadata', async () => {
    await fc.assert(
      fc.asyncProperty(wordDataArb, async (wordData) => {
        await db.vocabulary.clear();
        const result = await saveWord(wordData);
        expect(result.success).toBe(true);
        expect(result.isDuplicate).toBe(false);
        const retrieved = await db.vocabulary.where('hanzi').equals(wordData.hanzi).first();
        expect(retrieved).toBeDefined();
        expect(retrieved!.hanzi).toBe(wordData.hanzi);
        expect(retrieved!.pinyin).toBe(wordData.pinyin);
        expect(retrieved!.tone).toEqual(wordData.tone);
        expect(retrieved!.meaning).toBe(wordData.meaning);
        expect(retrieved!.koreanPronunciation).toBe(wordData.koreanPronunciation);
        expect(retrieved!.isFavorite).toBe(wordData.isFavorite);
        expect(retrieved!.tags).toEqual(wordData.tags);
        expect(retrieved!.hskLevel).toBe(wordData.hskLevel);
        expect(retrieved!.studyCount).toBe(0);
        expect(retrieved!.lastStudiedAt).toBeNull();
        expect(retrieved!.createdAt).toBeInstanceOf(Date);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 6: Vocabulary Duplicate Prevention (Idempotence)
 *
 * Validates: Requirements 3.2
 */

const duplicateWordDataArb = fc.record({
  hanzi: fc.integer({ min: 1, max: 99999 }).map(n => '\u91CD' + n),
  pinyin: fc.constant('chong'),
  tone: fc.constant([2] as number[]),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

describe('Feature: chinese-learning-keyboard, Property 6: Vocabulary Duplicate Prevention', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
  });

  it('attempting to save the same hanzi again returns isDuplicate: true and vocabulary size remains 1', async () => {
    await fc.assert(
      fc.asyncProperty(duplicateWordDataArb, async (wordData) => {
        await db.vocabulary.clear();
        const firstResult = await saveWord(wordData);
        expect(firstResult.success).toBe(true);
        expect(firstResult.isDuplicate).toBe(false);
        const countAfterFirst = await db.vocabulary.count();
        expect(countAfterFirst).toBe(1);
        const secondData = { ...wordData, meaning: wordData.meaning + '_x', isFavorite: !wordData.isFavorite };
        const secondResult = await saveWord(secondData);
        expect(secondResult.success).toBe(false);
        expect(secondResult.isDuplicate).toBe(true);
        const countAfterSecond = await db.vocabulary.count();
        expect(countAfterSecond).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Vocabulary Filter Correctness
 *
 * For any set of vocabulary words and any filter criterion, applying the filter
 * SHALL return only words that match the filter predicate, and no word matching
 * the predicate SHALL be excluded.
 *
 * Validates: Requirements 3.3
 */

const filterWordArb = (index: number) =>
  fc.record({
    hanzi: fc.constant(String.fromCodePoint(0x5000 + index)),
    pinyin: fc.constant('ma'),
    tone: fc.constant([1] as number[]),
    meaning: fc.constant('meaning' + index),
    koreanPronunciation: fc.constant('\uB9C8'),
    isFavorite: fc.boolean(),
    tags: fc.subarray(['food', 'animal', 'color', 'verb', 'noun'], { minLength: 0, maxLength: 3 }),
    hskLevel: fc.constantFrom(1, 2, 3, 4, 5, 6, null as number | null),
  });

const filterWordsArb = fc.tuple(
  filterWordArb(0), filterWordArb(1), filterWordArb(2), filterWordArb(3), filterWordArb(4),
  filterWordArb(5), filterWordArb(6), filterWordArb(7), filterWordArb(8), filterWordArb(9)
);

describe('Feature: chinese-learning-keyboard, Property 7: Vocabulary Filter Correctness', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
    await db.flashcards.clear();
  });

  it('favorite filter returns only words with isFavorite=true and no favorite word is excluded', async () => {
    await fc.assert(
      fc.asyncProperty(filterWordsArb, async (wordsTuple) => {
        const words = [...wordsTuple];
        await db.vocabulary.clear();
        for (const wordData of words) { await saveWord(wordData); }
        const results = await getWords({ type: 'favorite' });
        for (const word of results) { expect(word.isFavorite).toBe(true); }
        const expectedFavorites = words.filter((w) => w.isFavorite);
        expect(results.length).toBe(expectedFavorites.length);
      }),
      { numRuns: 50 }
    );
  });

  it('hsk filter returns only words with matching hskLevel and no matching word is excluded', async () => {
    await fc.assert(
      fc.asyncProperty(filterWordsArb, fc.integer({ min: 1, max: 6 }), async (wordsTuple, hskLevel) => {
        const words = [...wordsTuple];
        await db.vocabulary.clear();
        for (const wordData of words) { await saveWord(wordData); }
        const results = await getWords({ type: 'hsk', level: hskLevel });
        for (const word of results) { expect(word.hskLevel).toBe(hskLevel); }
        const expectedWords = words.filter((w) => w.hskLevel === hskLevel);
        expect(results.length).toBe(expectedWords.length);
      }),
      { numRuns: 50 }
    );
  });

  it('tag filter returns only words with the matching tag and no matching word is excluded', async () => {
    await fc.assert(
      fc.asyncProperty(filterWordsArb, fc.constantFrom('food', 'animal', 'color', 'verb', 'noun'), async (wordsTuple, tag) => {
        const words = [...wordsTuple];
        await db.vocabulary.clear();
        for (const wordData of words) { await saveWord(wordData); }
        const results = await getWords({ type: 'tag', tag });
        for (const word of results) { expect(word.tags).toContain(tag); }
        const expectedWords = words.filter((w) => w.tags.includes(tag));
        expect(results.length).toBe(expectedWords.length);
      }),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 8: Cascading Delete Completeness
 *
 * Validates: Requirements 3.6, 10.11
 */

const cascadeDeleteWordArb = fc.record({
  hanzi: fc.integer({ min: 1, max: 99999 }).map(n => '\u5220' + n),
  pinyin: fc.constant('shan'),
  tone: fc.constant([1] as number[]),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

describe('Feature: chinese-learning-keyboard, Property 8: Cascading Delete Completeness', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
    await db.flashcards.clear();
  });

  it('deleting a word removes all vocabulary and flashcard records referencing that word ID', async () => {
    await fc.assert(
      fc.asyncProperty(cascadeDeleteWordArb, fc.boolean(), async (wordData, ttsAvailable) => {
        await db.vocabulary.clear();
        await db.flashcards.clear();
        const result = await saveWord(wordData);
        expect(result.success).toBe(true);
        expect(result.word).toBeDefined();
        const wordId = result.word!.id!;
        const cards = createCardsForWord(result.word!, ttsAvailable);
        await db.flashcards.bulkAdd(cards);
        const cardsBeforeDelete = await db.flashcards.where('wordId').equals(wordId).toArray();
        expect(cardsBeforeDelete.length).toBeGreaterThan(0);
        await deleteWord(wordId);
        const vocabAfterDelete = await db.vocabulary.where('id').equals(wordId).toArray();
        expect(vocabAfterDelete.length).toBe(0);
        const cardsAfterDelete = await db.flashcards.where('wordId').equals(wordId).toArray();
        expect(cardsAfterDelete.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 9: Korean Search Substring Match
 *
 * Validates: Requirements 4.1, 4.2
 */

const koreanSearchCharArb = fc.constantFrom(
  '\uAC00', '\uB098', '\uB2E4', '\uB77C', '\uB9C8', '\uBC14', '\uC0AC', '\uC544', '\uC790', '\uCC28',
  '\uCE74', '\uD0C0', '\uD30C', '\uD558', '\uACE0', '\uB178', '\uB3C4', '\uB85C', '\uBAA8', '\uBCF4',
  '\uC18C', '\uC624', '\uC870', '\uCD08', '\uCF54', '\uD1A0', '\uD3EC', '\uD638', '\uAD6C', '\uB204',
  '\uB450', '\uB8E8', '\uBB34', '\uBD80', '\uC218', '\uC6B0', '\uC8FC', '\uCD94', '\uCFE0', '\uD22C',
  '\uD559', '\uC2B5', '\uB2E8', '\uC5B4', '\uBB38', '\uC7A5', '\uB73B', '\uC758', '\uBBF8', '\uD55C'
);

const koreanSearchMeaningArb = fc.array(koreanSearchCharArb, { minLength: 2, maxLength: 15 })
  .map((chars) => chars.join(''));

const koreanSearchUniqueHanziArb = (size: number) =>
  fc.shuffledSubarray(
    Array.from({ length: 200 }, (_, i) => String.fromCodePoint(0x4E00 + i)),
    { minLength: size, maxLength: size }
  );

describe('Feature: chinese-learning-keyboard, Property 9: Korean Search Substring Match', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
    await db.flashcards.clear();
  });

  it('all returned results contain the query as a substring, are sorted by createdAt desc, and limited to 50', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 20 }).chain((count) =>
          fc.tuple(
            fc.array(koreanSearchMeaningArb, { minLength: count, maxLength: count }),
            koreanSearchUniqueHanziArb(count)
          )
        ),
        fc.boolean(),
        async ([meanings, hanzis], useSubstring) => {
          await db.vocabulary.clear();
          await db.flashcards.clear();
          for (let i = 0; i < meanings.length; i++) {
            await saveWord({
              hanzi: hanzis[i]!,
              pinyin: 'ni',
              tone: [3],
              meaning: meanings[i]!,
              koreanPronunciation: '\uB2C8',
              isFavorite: false,
              tags: [],
              hskLevel: 1,
            });
          }
          let query: string;
          if (useSubstring && meanings.length > 0) {
            const randomMeaning = meanings[Math.floor(Math.random() * meanings.length)]!;
            const startIdx = Math.floor(Math.random() * (randomMeaning.length - 1));
            const endIdx = startIdx + 1 + Math.floor(Math.random() * Math.max(1, randomMeaning.length - startIdx - 1));
            query = randomMeaning.substring(startIdx, Math.min(endIdx, randomMeaning.length));
          } else {
            query = meanings[0]!.substring(0, 1 + Math.floor(Math.random() * Math.min(2, meanings[0]!.length - 1)));
          }
          if (!query || query.trim().length === 0) { return; }
          const results = await searchByKorean(query);
          expect(results.length).toBeLessThanOrEqual(50);
          for (const word of results) { expect(word.meaning.includes(query)).toBe(true); }
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(results[i]!.createdAt.getTime());
          }
          const allWords = await db.vocabulary.toArray();
          const matchingWords = allWords.filter((w) => w.meaning.includes(query));
          if (matchingWords.length <= 50) { expect(results.length).toBe(matchingWords.length); }
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 15: Vocabulary Field Update Persistence
 *
 * For any vocabulary word, toggling the favorite state or adding/removing a tag,
 * then reading the word back from storage, SHALL reflect the updated state.
 *
 * Validates: Requirements 3.4, 3.5
 */

const fieldUpdateWordArb = fc.record({
  hanzi: fc.integer({ min: 1, max: 99999 }).map(n => '\u66F4' + n),
  pinyin: fc.constant('geng'),
  tone: fc.constant([1] as number[]),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

const tagArb = fc.string({ minLength: 1, maxLength: 15 });

describe('Feature: chinese-learning-keyboard, Property 15: Vocabulary Field Update Persistence', () => {
  beforeEach(async () => {
    await db.vocabulary.clear();
  });

  it('toggling favorite state persists correctly when read back from storage', async () => {
    await fc.assert(
      fc.asyncProperty(fieldUpdateWordArb, async (wordData) => {
        await db.vocabulary.clear();

        const result = await saveWord(wordData);
        expect(result.success).toBe(true);
        expect(result.word).toBeDefined();
        const wordId = result.word!.id!;

        const originalFavorite = wordData.isFavorite;

        // Toggle favorite
        await toggleFavorite(wordId);

        // Read back and verify toggled state
        const afterToggle = await db.vocabulary.get(wordId);
        expect(afterToggle).toBeDefined();
        expect(afterToggle!.isFavorite).toBe(!originalFavorite);

        // Toggle again to verify it goes back
        await toggleFavorite(wordId);
        const afterSecondToggle = await db.vocabulary.get(wordId);
        expect(afterSecondToggle).toBeDefined();
        expect(afterSecondToggle!.isFavorite).toBe(originalFavorite);
      }),
      { numRuns: 100 }
    );
  });

  it('adding a tag persists correctly when read back from storage', async () => {
    await fc.assert(
      fc.asyncProperty(fieldUpdateWordArb, tagArb, async (wordData, newTag) => {
        await db.vocabulary.clear();

        const result = await saveWord(wordData);
        expect(result.success).toBe(true);
        expect(result.word).toBeDefined();
        const wordId = result.word!.id!;

        // Add a tag
        await addTag(wordId, newTag);

        // Read back and verify tag is present
        const afterAdd = await db.vocabulary.get(wordId);
        expect(afterAdd).toBeDefined();
        expect(afterAdd!.tags).toContain(newTag);
      }),
      { numRuns: 100 }
    );
  });

  it('removing a tag persists correctly when read back from storage', async () => {
    await fc.assert(
      fc.asyncProperty(fieldUpdateWordArb, tagArb, async (wordData, tagToRemove) => {
        await db.vocabulary.clear();

        // Ensure the word has the tag we want to remove
        const wordWithTag = { ...wordData, tags: [...wordData.tags, tagToRemove] };
        const result = await saveWord(wordWithTag);
        expect(result.success).toBe(true);
        expect(result.word).toBeDefined();
        const wordId = result.word!.id!;

        // Verify tag is present before removal
        const beforeRemove = await db.vocabulary.get(wordId);
        expect(beforeRemove).toBeDefined();
        expect(beforeRemove!.tags).toContain(tagToRemove);

        // Remove the tag
        await removeTag(wordId, tagToRemove);

        // Read back and verify tag is absent
        const afterRemove = await db.vocabulary.get(wordId);
        expect(afterRemove).toBeDefined();
        expect(afterRemove!.tags).not.toContain(tagToRemove);
      }),
      { numRuns: 100 }
    );
  });
});
