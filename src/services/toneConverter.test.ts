/**
 * Unit tests for toneConverter service.
 * Tests specific examples, edge cases, and core tone placement logic.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSyllable,
  applyTone,
  removeTone,
  isValidPinyin,
  convertTone,
} from './toneConverter';

describe('toneConverter', () => {
  describe('isValidPinyin', () => {
    it('should return true for valid pinyin syllables', () => {
      expect(isValidPinyin('ni')).toBe(true);
      expect(isValidPinyin('hao')).toBe(true);
      expect(isValidPinyin('ma')).toBe(true);
      expect(isValidPinyin('zhong')).toBe(true);
      expect(isValidPinyin('nü')).toBe(true);
      expect(isValidPinyin('lü')).toBe(true);
    });

    it('should return false for invalid pinyin syllables', () => {
      expect(isValidPinyin('xyz')).toBe(false);
      expect(isValidPinyin('bx')).toBe(false);
      expect(isValidPinyin('zzz')).toBe(false);
      expect(isValidPinyin('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidPinyin('NI')).toBe(true);
      expect(isValidPinyin('Hao')).toBe(true);
    });
  });

  describe('parseSyllable', () => {
    it('should parse syllable with tone number', () => {
      const result = parseSyllable('ni3');
      expect(result.pinyin).toBe('ni');
      expect(result.tone).toBe(3);
      expect(result.toned).toBe('nǐ');
      expect(result.isValid).toBe(true);
      expect(result.original).toBe('ni3');
    });

    it('should parse syllable without tone number', () => {
      const result = parseSyllable('ma');
      expect(result.pinyin).toBe('ma');
      expect(result.tone).toBe(0);
      expect(result.toned).toBe('ma');
      expect(result.isValid).toBe(true);
    });

    it('should handle "v" → "ü" conversion', () => {
      const result = parseSyllable('lv4');
      expect(result.pinyin).toBe('lü');
      expect(result.tone).toBe(4);
      expect(result.toned).toBe('lǜ');
      expect(result.isValid).toBe(true);
    });

    it('should handle "nv3" → "nǚ"', () => {
      const result = parseSyllable('nv3');
      expect(result.pinyin).toBe('nü');
      expect(result.tone).toBe(3);
      expect(result.toned).toBe('nǚ');
      expect(result.isValid).toBe(true);
    });

    it('should handle "u:" → "ü" conversion', () => {
      const result = parseSyllable('lu:4');
      expect(result.pinyin).toBe('lü');
      expect(result.tone).toBe(4);
      expect(result.toned).toBe('lǜ');
      expect(result.isValid).toBe(true);
    });

    it('should mark invalid pinyin', () => {
      const result = parseSyllable('xyz1');
      expect(result.isValid).toBe(false);
    });

    it('should handle empty input', () => {
      const result = parseSyllable('');
      expect(result.pinyin).toBe('');
      expect(result.tone).toBe(0);
      expect(result.isValid).toBe(false);
    });
  });

  describe('applyTone', () => {
    it('should apply tone to "a" (rule 1: a/e takes tone)', () => {
      expect(applyTone('ma', 1)).toBe('mā');
      expect(applyTone('ma', 2)).toBe('má');
      expect(applyTone('ma', 3)).toBe('mǎ');
      expect(applyTone('ma', 4)).toBe('mà');
    });

    it('should apply tone to "e" (rule 1)', () => {
      expect(applyTone('me', 1)).toBe('mē');
      expect(applyTone('le', 2)).toBe('lé');
    });

    it('should apply tone to "a" in "ai", "ao" (rule 1)', () => {
      expect(applyTone('ai', 1)).toBe('āi');
      expect(applyTone('hao', 3)).toBe('hǎo');
    });

    it('should apply tone to "o" in "ou" (rule 2)', () => {
      expect(applyTone('gou', 3)).toBe('gǒu');
      expect(applyTone('dou', 1)).toBe('dōu');
    });

    it('should apply tone to second vowel otherwise (rule 3)', () => {
      expect(applyTone('gui', 4)).toBe('guì');
      expect(applyTone('liu', 2)).toBe('liú');
      expect(applyTone('dui', 4)).toBe('duì');
    });

    it('should apply tone to single vowel', () => {
      expect(applyTone('ni', 3)).toBe('nǐ');
      expect(applyTone('bu', 4)).toBe('bù');
    });

    it('should apply tone to "ü"', () => {
      expect(applyTone('lü', 4)).toBe('lǜ');
      expect(applyTone('nü', 3)).toBe('nǚ');
    });

    it('should return original if tone is 0 or out of range', () => {
      expect(applyTone('ma', 0)).toBe('ma');
      expect(applyTone('ma', 5)).toBe('ma');
    });
  });

  describe('removeTone', () => {
    it('should remove tone marks and return base vowel + tone number', () => {
      expect(removeTone('nǐ')).toEqual({ pinyin: 'ni', tone: 3 });
      expect(removeTone('mā')).toEqual({ pinyin: 'ma', tone: 1 });
      expect(removeTone('lǜ')).toEqual({ pinyin: 'lü', tone: 4 });
    });

    it('should handle strings without tone marks', () => {
      expect(removeTone('ma')).toEqual({ pinyin: 'ma', tone: 0 });
      expect(removeTone('ni')).toEqual({ pinyin: 'ni', tone: 0 });
    });

    it('should support round-trip with applyTone', () => {
      const toned = applyTone('ni', 3);
      expect(removeTone(toned)).toEqual({ pinyin: 'ni', tone: 3 });

      const toned2 = applyTone('hao', 3);
      expect(removeTone(toned2)).toEqual({ pinyin: 'hao', tone: 3 });

      const toned3 = applyTone('lü', 4);
      expect(removeTone(toned3)).toEqual({ pinyin: 'lü', tone: 4 });
    });
  });

  describe('convertTone', () => {
    it('should convert single syllable', () => {
      const result = convertTone('ni3');
      expect(result.toned).toBe('nǐ');
      expect(result.isValid).toBe(true);
      expect(result.syllables).toHaveLength(1);
    });

    it('should convert multi-syllable input', () => {
      const result = convertTone('ni3 hao3');
      expect(result.toned).toBe('nǐ hǎo');
      expect(result.isValid).toBe(true);
      expect(result.syllables).toHaveLength(2);
    });

    it('should handle "lv4" → "lǜ"', () => {
      const result = convertTone('lv4');
      expect(result.toned).toBe('lǜ');
      expect(result.isValid).toBe(true);
    });

    it('should handle input without tone numbers', () => {
      const result = convertTone('ma');
      expect(result.toned).toBe('ma');
      expect(result.isValid).toBe(true);
    });

    it('should mark invalid pinyin in result', () => {
      const result = convertTone('xyz1');
      expect(result.isValid).toBe(false);
      expect(result.syllables[0]!.isValid).toBe(false);
    });

    it('should handle mixed valid and invalid syllables', () => {
      const result = convertTone('ni3 xyz1');
      expect(result.isValid).toBe(false);
      expect(result.syllables[0]!.isValid).toBe(true);
      expect(result.syllables[1]!.isValid).toBe(false);
    });

    it('should enforce 200-character limit', () => {
      const longInput = 'a'.repeat(201);
      const result = convertTone(longInput);
      expect(result.toned).toBe('');
      expect(result.syllables).toHaveLength(0);
      expect(result.isValid).toBe(false);
    });

    it('should allow exactly 200 characters', () => {
      const input = 'ni3 '.repeat(50).trim(); // "ni3 ni3 ni3..." = 199 chars
      const result = convertTone(input);
      expect(result.syllables.length).toBeGreaterThan(0);
    });

    it('should handle empty input', () => {
      const result = convertTone('');
      expect(result.toned).toBe('');
      expect(result.syllables).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should handle whitespace-only input', () => {
      const result = convertTone('   ');
      expect(result.toned).toBe('');
      expect(result.syllables).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should handle multiple spaces between syllables', () => {
      const result = convertTone('ni3   hao3');
      expect(result.toned).toBe('nǐ hǎo');
      expect(result.syllables).toHaveLength(2);
    });

    it('should handle exactly 200 characters input', () => {
      // Create an input that is exactly 200 characters
      const base = 'ni3 '; // 4 chars
      const repeatCount = 50; // 4 * 50 = 200
      const input = base.repeat(repeatCount); // exactly 200 chars
      expect(input.length).toBe(200);
      const result = convertTone(input);
      expect(result.syllables.length).toBeGreaterThan(0);
      expect(result.toned).not.toBe('');
    });

    it('should reject exactly 201 characters input', () => {
      const input = 'a'.repeat(201);
      expect(input.length).toBe(201);
      const result = convertTone(input);
      expect(result.toned).toBe('');
      expect(result.syllables).toHaveLength(0);
      expect(result.isValid).toBe(false);
    });

    it('should handle numbers-only input as invalid pinyin', () => {
      const result = convertTone('123');
      expect(result.isValid).toBe(false);
      expect(result.syllables[0]!.isValid).toBe(false);
    });

    it('should convert single character input "a1" → "ā"', () => {
      const result = convertTone('a1');
      expect(result.toned).toBe('ā');
      expect(result.isValid).toBe(true);
      expect(result.syllables[0]!.tone).toBe(1);
    });
  });

  describe('edge cases - ü tones with "v" notation', () => {
    it('should convert all four tones: lv1→lǖ, lv2→lǘ, lv3→lǚ, lv4→lǜ', () => {
      expect(convertTone('lv1').toned).toBe('lǖ');
      expect(convertTone('lv2').toned).toBe('lǘ');
      expect(convertTone('lv3').toned).toBe('lǚ');
      expect(convertTone('lv4').toned).toBe('lǜ');
    });

    it('should mark all lv tones as valid', () => {
      for (let tone = 1; tone <= 4; tone++) {
        const result = convertTone(`lv${tone}`);
        expect(result.isValid).toBe(true);
        expect(result.syllables[0]!.pinyin).toBe('lü');
        expect(result.syllables[0]!.tone).toBe(tone);
      }
    });
  });

  describe('edge cases - ü tones with "u:" notation', () => {
    it('should convert all four tones: lu:1→lǖ, lu:2→lǘ, lu:3→lǚ, lu:4→lǜ', () => {
      expect(convertTone('lu:1').toned).toBe('lǖ');
      expect(convertTone('lu:2').toned).toBe('lǘ');
      expect(convertTone('lu:3').toned).toBe('lǚ');
      expect(convertTone('lu:4').toned).toBe('lǜ');
    });

    it('should mark all lu: tones as valid', () => {
      for (let tone = 1; tone <= 4; tone++) {
        const result = convertTone(`lu:${tone}`);
        expect(result.isValid).toBe(true);
        expect(result.syllables[0]!.pinyin).toBe('lü');
        expect(result.syllables[0]!.tone).toBe(tone);
      }
    });
  });

  describe('edge cases - special pinyin syllables', () => {
    it('should convert "niu2" → "niú"', () => {
      const result = convertTone('niu2');
      expect(result.toned).toBe('niú');
      expect(result.isValid).toBe(true);
    });

    it('should convert "jiu3" → "jiǔ"', () => {
      const result = convertTone('jiu3');
      expect(result.toned).toBe('jiǔ');
      expect(result.isValid).toBe(true);
    });

    it('should convert "er2" → "ér"', () => {
      const result = convertTone('er2');
      expect(result.toned).toBe('ér');
      expect(result.isValid).toBe(true);
    });

    it('should treat tone 5 as no tone (neutral tone)', () => {
      // Tone 5 is sometimes used for neutral tone.
      // Since parseSyllable only extracts 1-4, "ma5" should keep "5" as part of pinyin.
      const result = parseSyllable('ma5');
      // "5" is not extracted as tone (only 1-4 are), so the full string "ma5" is treated as pinyin
      // with tone=0, and it won't be valid pinyin
      expect(result.tone).toBe(0);
      expect(result.isValid).toBe(false);
    });
  });
});
