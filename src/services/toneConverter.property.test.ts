/**
 * Property-Based Tests: Tone Converter
 * Feature: chinese-learning-keyboard
 *
 * Property 1: Tone Conversion Round-Trip
 * For any valid pinyin syllable with a tone number (1-4), converting it to toned pinyin
 * and then extracting the original pinyin text and tone number SHALL produce the original input.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.6
 *
 * Property 2: Invalid Pinyin Detection
 * For any string that is NOT a valid pinyin syllable according to the 한어병음방안,
 * the pinyin validator SHALL mark it as invalid while preserving the original input text.
 * Validates: Requirements 1.4
 *
 * Property 3: Multi-Syllable Compositional Conversion
 * For any list of valid pinyin syllables, converting the space-joined string SHALL produce
 * the same result as converting each syllable individually and joining with spaces.
 * Validates: Requirements 1.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyTone, removeTone, isValidPinyin, parseSyllable, convertTone } from './toneConverter';
import { validPinyinArb, tonedPinyinArb } from '../test/generators';
import { VALID_PINYIN_SYLLABLES } from '../data/pinyinTable';

describe('Feature: chinese-learning-keyboard, Property 1: Tone Conversion Round-Trip', () => {
  it('removeTone(applyTone(pinyin, tone)) === { pinyin, tone } for any valid pinyin and tone 1-4', () => {
    fc.assert(
      fc.property(
        validPinyinArb,
        fc.integer({ min: 1, max: 4 }),
        (pinyin, tone) => {
          // Pre-condition: pinyin must be valid
          expect(isValidPinyin(pinyin)).toBe(true);

          // Apply tone to get toned pinyin
          const toned = applyTone(pinyin, tone);

          // Remove tone to get back original
          const result = removeTone(toned);

          // Round-trip should produce original pinyin and tone
          expect(result.pinyin).toBe(pinyin);
          expect(result.tone).toBe(tone);
        }
      ),
      { numRuns: 200 }
    );
  });
});


describe('Feature: chinese-learning-keyboard, Property 2: Invalid Pinyin Detection', () => {
  // Set of valid pinyin syllables for filtering (lowercase)
  const validPinyinSet = new Set(VALID_PINYIN_SYLLABLES.map(s => s.toLowerCase()));

  // Generator for strings that are definitely NOT valid pinyin syllables
  const invalidPinyinArb = fc.oneof(
    // Random alphanumeric strings filtered to exclude valid pinyin
    fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz') })
      .filter(s => !validPinyinSet.has(s.toLowerCase())),
    // Strings with special characters (never valid pinyin)
    fc.string({ minLength: 1, maxLength: 5, unit: fc.constantFrom(...'!@#$%^&*()_+-=[]{}|;:,.<>?') }),
    // Strings with numbers in the middle (never valid pinyin base)
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 3, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz') }),
      fc.string({ minLength: 1, maxLength: 2, unit: fc.constantFrom(...'0123456789') }),
      fc.string({ minLength: 1, maxLength: 3, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz') })
    ).map(([a, b, c]) => `${a}${b}${c}`),
    // Uppercase-only strings (isValidPinyin is case-insensitive, so filter needed)
    fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ') })
      .filter(s => !validPinyinSet.has(s.toLowerCase()))
  );

  it('isValidPinyin(invalidString) returns false for any non-pinyin string', () => {
    /**
     * Validates: Requirements 1.4
     */
    fc.assert(
      fc.property(
        invalidPinyinArb,
        (invalidStr) => {
          expect(isValidPinyin(invalidStr)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('parseSyllable(invalidString + toneNumber) has isValid === false but preserves original', () => {
    /**
     * Validates: Requirements 1.4
     */
    fc.assert(
      fc.property(
        invalidPinyinArb,
        fc.integer({ min: 1, max: 4 }),
        (invalidStr, tone) => {
          const input = `${invalidStr}${tone}`;
          const result = parseSyllable(input);

          // The syllable should be marked invalid
          expect(result.isValid).toBe(false);

          // The original input text must be preserved
          expect(result.original).toBe(input);
        }
      ),
      { numRuns: 200 }
    );
  });
});


describe('Feature: chinese-learning-keyboard, Property 3: Multi-Syllable Compositional Conversion', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * For any list of valid pinyin syllables, converting the space-joined string
   * SHALL produce the same result as converting each syllable individually
   * and joining with spaces.
   */
  it('convertTone(syllables.join(" ")).toned === syllables.map(s => convertTone(s).toned).join(" ")', () => {
    const multiSyllablePinyinArb = fc.array(tonedPinyinArb, { minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(
        multiSyllablePinyinArb,
        (syllables) => {
          // Join syllables with space
          const joined = syllables.join(' ');

          // Convert the joined string
          const joinedResult = convertTone(joined);

          // Convert each syllable individually
          const individualResults = syllables.map(s => convertTone(s));

          // The toned output of the joined conversion should equal
          // the individually converted results joined with spaces
          const expectedToned = individualResults.map(r => r.toned).join(' ');

          expect(joinedResult.toned).toBe(expectedToned);
        }
      ),
      { numRuns: 100 }
    );
  });
});
