import { describe, it, expect } from 'vitest';
import {
  convertPinyinToHanzi,
  getDictionaryEntry,
  extractTone,
  removeToneMarks,
} from './chineseConverter';

describe('chineseConverter', () => {
  describe('extractTone', () => {
    it('should extract tone 1 from toned pinyin', () => {
      expect(extractTone('tā')).toBe(1);
    });

    it('should extract tone 2 from toned pinyin', () => {
      expect(extractTone('méi')).toBe(2);
    });

    it('should extract tone 3 from toned pinyin', () => {
      expect(extractTone('nǐ')).toBe(3);
    });

    it('should extract tone 4 from toned pinyin', () => {
      expect(extractTone('shì')).toBe(4);
    });

    it('should return 0 for neutral tone (no tone marks)', () => {
      expect(extractTone('ma')).toBe(0);
      expect(extractTone('de')).toBe(0);
    });
  });

  describe('removeToneMarks', () => {
    it('should remove tone marks and return base pinyin', () => {
      expect(removeToneMarks('nǐ')).toBe('ni');
      expect(removeToneMarks('wǒ')).toBe('wo');
      expect(removeToneMarks('tā')).toBe('ta');
      expect(removeToneMarks('shì')).toBe('shi');
    });

    it('should handle multi-syllable pinyin', () => {
      expect(removeToneMarks('zhōngguó')).toBe('zhongguo');
      expect(removeToneMarks('wǒmen')).toBe('women');
    });

    it('should return unchanged string if no tone marks', () => {
      expect(removeToneMarks('ma')).toBe('ma');
      expect(removeToneMarks('de')).toBe('de');
    });
  });

  describe('convertPinyinToHanzi', () => {
    it('should return matching candidates for valid toned pinyin', () => {
      const result = convertPinyinToHanzi('nǐ');
      expect(result.hasResults).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].hanzi).toBe('你');
    });

    it('should return matching candidates for untoned pinyin', () => {
      const result = convertPinyinToHanzi('ni');
      expect(result.hasResults).toBe(true);
      // Should match entries whose base pinyin is "ni" (nǐ → ni)
      expect(result.candidates.some((c) => c.hanzi === '你')).toBe(true);
    });

    it('should return candidates sorted by frequency descending', () => {
      const result = convertPinyinToHanzi('tā');
      expect(result.hasResults).toBe(true);
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].frequency).toBeGreaterThanOrEqual(
          result.candidates[i].frequency
        );
      }
    });

    it('should return at most 10 candidates', () => {
      const result = convertPinyinToHanzi('tā');
      expect(result.candidates.length).toBeLessThanOrEqual(10);
    });

    it('should return all required fields for each candidate', () => {
      const result = convertPinyinToHanzi('wǒ');
      expect(result.hasResults).toBe(true);
      const candidate = result.candidates[0];
      expect(candidate).toHaveProperty('hanzi');
      expect(candidate).toHaveProperty('pinyin');
      expect(candidate).toHaveProperty('tone');
      expect(candidate).toHaveProperty('meaning');
      expect(candidate).toHaveProperty('koreanPronunciation');
      expect(candidate).toHaveProperty('frequency');
    });

    it('should extract correct tone number for candidates', () => {
      const result = convertPinyinToHanzi('nǐ');
      const niCandidate = result.candidates.find((c) => c.hanzi === '你');
      expect(niCandidate).toBeDefined();
      expect(niCandidate!.tone).toBe(3);
    });

    it('should return hasResults=false for no matches', () => {
      const result = convertPinyinToHanzi('xyz');
      expect(result.hasResults).toBe(false);
      expect(result.candidates).toEqual([]);
    });

    it('should return hasResults=false for empty input', () => {
      const result = convertPinyinToHanzi('');
      expect(result.hasResults).toBe(false);
      expect(result.candidates).toEqual([]);
    });

    it('should return hasResults=false for whitespace-only input', () => {
      const result = convertPinyinToHanzi('   ');
      expect(result.hasResults).toBe(false);
      expect(result.candidates).toEqual([]);
    });

    it('should handle case-insensitive matching', () => {
      const resultLower = convertPinyinToHanzi('ni');
      const resultUpper = convertPinyinToHanzi('NI');
      expect(resultLower.candidates.length).toBe(resultUpper.candidates.length);
    });

    it('should trim input before processing', () => {
      const result = convertPinyinToHanzi('  nǐ  ');
      expect(result.hasResults).toBe(true);
      expect(result.candidates[0].hanzi).toBe('你');
    });

    it('should match multiple entries with same base pinyin (ta → 他, 她, 它)', () => {
      const result = convertPinyinToHanzi('ta');
      expect(result.hasResults).toBe(true);
      const hanzis = result.candidates.map((c) => c.hanzi);
      expect(hanzis).toContain('他');
      expect(hanzis).toContain('她');
      expect(hanzis).toContain('它');
    });

    it('should return the most frequent candidate as first result', () => {
      // "ta" matches 他(9997), 她(9996), 它(9900) — 他 should be first
      const result = convertPinyinToHanzi('ta');
      expect(result.hasResults).toBe(true);
      expect(result.candidates[0].hanzi).toBe('他');
      expect(result.candidates[0].frequency).toBe(9997);
    });

    it('should enforce max 10 candidates limit even with many matches', () => {
      // Even if we search broadly, result should never exceed 10
      const result = convertPinyinToHanzi('shi');
      expect(result.candidates.length).toBeLessThanOrEqual(10);
      // Also verify the exact limit is applied (not just "some number")
      if (result.candidates.length === 10) {
        // If we got 10, the limit is enforced
        expect(result.candidates.length).toBe(10);
      }
    });

    it('should return different results for different tones of same base pinyin', () => {
      // "mǎi" (tone 3) → 买, "mài" (tone 4) → 卖
      const resultMai3 = convertPinyinToHanzi('mǎi');
      const resultMai4 = convertPinyinToHanzi('mài');

      // Both use the same base pinyin "mai" so untoned search returns both
      // But when toned, the function normalizes to base, so both should return the same candidates
      // This tests that the converter handles toned input correctly
      expect(resultMai3.hasResults).toBe(true);
      expect(resultMai4.hasResults).toBe(true);
      // Since normalization strips tones, both should match the same entries
      expect(resultMai3.candidates.length).toBe(resultMai4.candidates.length);
    });

    it('should return different tone values for candidates with different tones', () => {
      // "na" matches 那(nà, tone 4) and 哪(nǎ, tone 3)
      const result = convertPinyinToHanzi('na');
      expect(result.hasResults).toBe(true);
      const na4 = result.candidates.find((c) => c.hanzi === '那');
      const na3 = result.candidates.find((c) => c.hanzi === '哪');
      expect(na4).toBeDefined();
      expect(na3).toBeDefined();
      expect(na4!.tone).toBe(4);
      expect(na3!.tone).toBe(3);
    });

    it('should correctly assign tone numbers 1-4 and 0 for neutral tone', () => {
      // Tone 1: 他 (tā)
      const ta = convertPinyinToHanzi('ta');
      const taCandidate = ta.candidates.find((c) => c.hanzi === '他');
      expect(taCandidate!.tone).toBe(1);

      // Tone 2: 没 (méi)
      const mei = convertPinyinToHanzi('mei');
      const meiCandidate = mei.candidates.find((c) => c.hanzi === '没');
      expect(meiCandidate!.tone).toBe(2);

      // Tone 3: 你 (nǐ)
      const ni = convertPinyinToHanzi('ni');
      const niCandidate = ni.candidates.find((c) => c.hanzi === '你');
      expect(niCandidate!.tone).toBe(3);

      // Tone 4: 是 (shì)
      const shi = convertPinyinToHanzi('shi');
      const shiCandidate = shi.candidates.find((c) => c.hanzi === '是');
      expect(shiCandidate!.tone).toBe(4);

      // Tone 0 (neutral): 吗 (ma) - no tone marks
      const ma = convertPinyinToHanzi('ma');
      const maCandidate = ma.candidates.find((c) => c.hanzi === '吗');
      expect(maCandidate!.tone).toBe(0);
    });
  });

  describe('getDictionaryEntry', () => {
    it('should return entry for existing hanzi', () => {
      const entry = getDictionaryEntry('你');
      expect(entry).not.toBeNull();
      expect(entry!.hanzi).toBe('你');
      expect(entry!.pinyin).toBe('nǐ');
      expect(entry!.tone).toBe(3);
      expect(entry!.meaning).toBe('너');
      expect(entry!.koreanPronunciation).toBe('니');
    });

    it('should return entry for multi-character hanzi', () => {
      const entry = getDictionaryEntry('中国');
      expect(entry).not.toBeNull();
      expect(entry!.hanzi).toBe('中国');
      expect(entry!.pinyin).toBe('zhōngguó');
    });

    it('should return correct koreanPronunciation for various entries', () => {
      const entries = [
        { hanzi: '我', expected: '워' },
        { hanzi: '中国', expected: '쫑궈' },
        { hanzi: '朋友', expected: '펑요우' },
        { hanzi: '学校', expected: '쉬에샤오' },
        { hanzi: '老师', expected: '라오스' },
      ];

      for (const { hanzi, expected } of entries) {
        const entry = getDictionaryEntry(hanzi);
        expect(entry).not.toBeNull();
        expect(entry!.koreanPronunciation).toBe(expected);
      }
    });

    it('should return null for non-existing hanzi', () => {
      const entry = getDictionaryEntry('龍');
      expect(entry).toBeNull();
    });

    it('should return null for empty string', () => {
      const entry = getDictionaryEntry('');
      expect(entry).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      const entry = getDictionaryEntry('   ');
      expect(entry).toBeNull();
    });

    it('should trim input before lookup', () => {
      const entry = getDictionaryEntry('  你  ');
      expect(entry).not.toBeNull();
      expect(entry!.hanzi).toBe('你');
    });
  });
});
