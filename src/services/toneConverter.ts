/**
 * Tone Converter Service
 * 병음 텍스트와 성조 번호를 성조 부호가 포함된 병음 문자로 변환하는 순수 함수 모듈.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
 */

import { TONE_MAP } from '../data/toneMap';
import { VALID_PINYIN_SYLLABLES } from '../data/pinyinTable';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToneConversionResult {
  toned: string;
  syllables: PinyinSyllable[];
  isValid: boolean;
}

export interface PinyinSyllable {
  original: string;
  pinyin: string;
  tone: number;
  toned: string;
  isValid: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 200;

// Build a reverse map from toned characters back to base vowel + tone number
const REVERSE_TONE_MAP: Map<string, { vowel: string; tone: number }> = new Map();
for (const [vowel, tonedChars] of Object.entries(TONE_MAP)) {
  for (let i = 0; i < tonedChars.length; i++) {
    const char = tonedChars[i];
    if (char) {
      REVERSE_TONE_MAP.set(char, { vowel, tone: i + 1 });
    }
  }
}

// Set for O(1) lookup of valid pinyin syllables
const VALID_PINYIN_SET: Set<string> = new Set(VALID_PINYIN_SYLLABLES);

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a syllable (without tone number) is a valid pinyin syllable.
 * Checks against the VALID_PINYIN_SYLLABLES table.
 */
export function isValidPinyin(syllable: string): boolean {
  return VALID_PINYIN_SET.has(syllable.toLowerCase());
}

/**
 * Parse a single syllable string (e.g., "ni3", "lv4", "ma") into its components.
 * Handles "v" and "u:" → "ü" conversion.
 */
export function parseSyllable(syllable: string): PinyinSyllable {
  const trimmed = syllable.trim().toLowerCase();

  if (!trimmed) {
    return {
      original: syllable,
      pinyin: '',
      tone: 0,
      toned: '',
      isValid: false,
    };
  }

  // Extract tone number from end (if present)
  let tone = 0;
  let pinyinPart = trimmed;

  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (lastChar >= '1' && lastChar <= '4') {
    tone = parseInt(lastChar, 10);
    pinyinPart = trimmed.slice(0, -1);
  }

  // Handle "v" → "ü" and "u:" → "ü" conversion
  pinyinPart = normalizeUmlaut(pinyinPart);

  // Validate against pinyin table
  const valid = isValidPinyin(pinyinPart);

  // Apply tone to get the toned result
  const toned = tone > 0 ? applyTone(pinyinPart, tone) : pinyinPart;

  return {
    original: syllable,
    pinyin: pinyinPart,
    tone,
    toned,
    isValid: valid,
  };
}

/**
 * Apply a tone mark to the correct vowel in a pinyin string.
 *
 * Tone placement rules:
 * 1. If there is an "a" or "e", it takes the tone mark.
 * 2. If there is "ou", the "o" takes the tone mark.
 * 3. Otherwise, the second vowel takes the tone mark.
 */
export function applyTone(pinyin: string, tone: number): string {
  if (tone < 1 || tone > 4) {
    return pinyin;
  }

  const vowelIndex = findToneVowelIndex(pinyin);
  if (vowelIndex === -1) {
    return pinyin;
  }

  const vowel = pinyin.charAt(vowelIndex);
  const tonedVowel = getTonedChar(vowel, tone);

  if (!tonedVowel) {
    return pinyin;
  }

  return pinyin.slice(0, vowelIndex) + tonedVowel + pinyin.slice(vowelIndex + 1);
}

/**
 * Remove tone marks from a toned pinyin string and extract the tone number.
 * Supports round-trip: removeTone(applyTone("ni", 3)) → { pinyin: "ni", tone: 3 }
 */
export function removeTone(tonedPinyin: string): { pinyin: string; tone: number } {
  let tone = 0;
  let result = '';

  for (const char of tonedPinyin) {
    const mapped = REVERSE_TONE_MAP.get(char);
    if (mapped) {
      result += mapped.vowel;
      tone = mapped.tone;
    } else {
      result += char;
    }
  }

  return { pinyin: result, tone };
}

/**
 * Orchestrate full conversion with multi-syllable support.
 * Splits input by whitespace, converts each syllable, and joins results.
 * Enforces 200-character input limit.
 */
export function convertTone(input: string): ToneConversionResult {
  // Enforce max input length
  if (input.length > MAX_INPUT_LENGTH) {
    return {
      toned: '',
      syllables: [],
      isValid: false,
    };
  }

  if (!input.trim()) {
    return {
      toned: '',
      syllables: [],
      isValid: true,
    };
  }

  // Split by whitespace to handle multi-syllable input
  const parts = input.trim().split(/\s+/);
  const syllables: PinyinSyllable[] = parts.map(parseSyllable);
  const toned = syllables.map((s) => s.toned).join(' ');
  const isValid = syllables.every((s) => s.isValid);

  return {
    toned,
    syllables,
    isValid,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Normalize "v" and "u:" to "ü" in a pinyin string.
 */
function normalizeUmlaut(pinyin: string): string {
  // Replace "u:" with "ü"
  let result = pinyin.replace(/u:/g, 'ü');
  // Replace "v" with "ü" (only when it represents ü in pinyin context)
  result = result.replace(/v/g, 'ü');
  return result;
}

/**
 * Find the index of the vowel that should receive the tone mark.
 *
 * Rules:
 * 1. If there is an "a" or "e", it takes the tone mark.
 * 2. If there is "ou", the "o" takes the tone mark.
 * 3. Otherwise, the second vowel takes the tone mark.
 */
function findToneVowelIndex(pinyin: string): number {
  const vowels = 'aeiouü';

  // Rule 1: "a" or "e" always takes the tone mark
  for (let i = 0; i < pinyin.length; i++) {
    const ch = pinyin.charAt(i);
    if (ch === 'a' || ch === 'e') {
      return i;
    }
  }

  // Rule 2: If there is "ou", the "o" takes the tone mark
  const ouIndex = pinyin.indexOf('ou');
  if (ouIndex !== -1) {
    return ouIndex;
  }

  // Rule 3: Otherwise, the second vowel takes the tone mark
  let vowelCount = 0;
  for (let i = 0; i < pinyin.length; i++) {
    if (vowels.includes(pinyin.charAt(i))) {
      vowelCount++;
      if (vowelCount === 2) {
        return i;
      }
    }
  }

  // If only one vowel exists, it takes the tone mark
  for (let i = 0; i < pinyin.length; i++) {
    if (vowels.includes(pinyin.charAt(i))) {
      return i;
    }
  }

  return -1;
}

/**
 * Get the toned character for a given base vowel and tone number.
 */
function getTonedChar(vowel: string, tone: number): string | null {
  const toneChars = TONE_MAP[vowel];
  if (!toneChars || tone < 1 || tone > 4) {
    return null;
  }
  return toneChars[tone - 1] ?? null;
}
