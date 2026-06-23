import fc from 'fast-check';
import { VALID_PINYIN_SYLLABLES } from '../data/pinyinTable';
import type { CardType } from '../db/database';

// Difficulty type (defined here as it's a service-level type used in flashcard engine)
type Difficulty = 'easy' | 'normal' | 'hard';

// 유효 병음 음절 생성기
export const validPinyinArb = fc.constantFrom(...VALID_PINYIN_SYLLABLES);

// 성조 번호 포함 병음 생성기
export const tonedPinyinArb = fc.tuple(validPinyinArb, fc.integer({ min: 1, max: 4 }))
  .map(([syllable, tone]) => `${syllable}${tone}`);

// 여러 음절 병음 문자열 생성기
export const multiSyllablePinyinArb = fc.array(tonedPinyinArb, { minLength: 1, maxLength: 20 })
  .map(syllables => syllables.join(' '));

// VocabularyWord 생성기
export const vocabularyWordArb = fc.record({
  hanzi: fc.string({ minLength: 1, maxLength: 4, unit: fc.constantFrom('你', '好', '我', '是', '人', '大', '中', '国') }),
  pinyin: validPinyinArb,
  tone: fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
  meaning: fc.string({ minLength: 1, maxLength: 20 }),
  koreanPronunciation: fc.string({ minLength: 1, maxLength: 10 }),
  isFavorite: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
  hskLevel: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

// Difficulty 생성기
export const difficultyArb = fc.constantFrom<Difficulty>('easy', 'normal', 'hard');

// CardType 생성기
export const cardTypeArb = fc.constantFrom<CardType>('meaning-to-hanzi', 'hanzi-to-meaning', 'pinyin-to-hanzi', 'audio-to-hanzi');

// FlashCard 생성기
export const flashCardArb = fc.record({
  id: fc.uuid(),
  wordId: fc.uuid(),
  cardType: cardTypeArb,
  intervalDays: fc.constantFrom(1, 2, 3, 4, 7, 14, 30),
  nextReviewDate: fc.date(),
  studyCount: fc.nat({ max: 100 }),
  easyCount: fc.nat({ max: 50 }),
  normalCount: fc.nat({ max: 50 }),
  hardCount: fc.nat({ max: 50 }),
  lastStudiedAt: fc.option(fc.date(), { nil: null }),
  createdAt: fc.date(),
});
