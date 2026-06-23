import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { convertPinyinToHanzi } from './chineseConverter';
import { validPinyinArb } from '../test/generators';

/**
 * Feature: chinese-learning-keyboard, Property 4: Chinese Conversion Result Constraints
 *
 * For any valid pinyin input, the conversion result SHALL return at most 10 candidates,
 * each containing all required fields (hanzi, pinyin, tone, meaning, koreanPronunciation),
 * sorted in non-increasing frequency order.
 *
 * **Validates: Requirements 2.1, 2.2, 2.4**
 */
describe('Feature: chinese-learning-keyboard, Property 4: Chinese Conversion Result Constraints', () => {
  it('should return at most 10 candidates for any valid pinyin', () => {
    fc.assert(
      fc.property(validPinyinArb, (pinyin) => {
        const result = convertPinyinToHanzi(pinyin);
        expect(result.candidates.length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 100 }
    );
  });

  it('should have all required fields as non-empty strings or valid numbers for each candidate', () => {
    fc.assert(
      fc.property(validPinyinArb, (pinyin) => {
        const result = convertPinyinToHanzi(pinyin);

        for (const candidate of result.candidates) {
          // String fields must be non-empty strings
          expect(typeof candidate.hanzi).toBe('string');
          expect(candidate.hanzi.length).toBeGreaterThan(0);

          expect(typeof candidate.pinyin).toBe('string');
          expect(candidate.pinyin.length).toBeGreaterThan(0);

          expect(typeof candidate.meaning).toBe('string');
          expect(candidate.meaning.length).toBeGreaterThan(0);

          expect(typeof candidate.koreanPronunciation).toBe('string');
          expect(candidate.koreanPronunciation.length).toBeGreaterThan(0);

          // Numeric fields must be valid numbers
          expect(typeof candidate.tone).toBe('number');
          expect(candidate.tone).toBeGreaterThanOrEqual(0);
          expect(candidate.tone).toBeLessThanOrEqual(4);

          expect(typeof candidate.frequency).toBe('number');
          expect(candidate.frequency).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should sort candidates in non-increasing frequency order', () => {
    fc.assert(
      fc.property(validPinyinArb, (pinyin) => {
        const result = convertPinyinToHanzi(pinyin);

        for (let i = 1; i < result.candidates.length; i++) {
          expect(result.candidates[i - 1].frequency).toBeGreaterThanOrEqual(
            result.candidates[i].frequency
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should have hasResults=true iff candidates.length > 0', () => {
    fc.assert(
      fc.property(validPinyinArb, (pinyin) => {
        const result = convertPinyinToHanzi(pinyin);

        if (result.hasResults) {
          expect(result.candidates.length).toBeGreaterThan(0);
        } else {
          expect(result.candidates.length).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
