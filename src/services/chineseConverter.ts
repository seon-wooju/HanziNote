/**
 * Chinese Converter Service
 *
 * 병음을 한자로 변환하는 모듈.
 * - 기본: 번들된 정적 사전 (약 400 단어, 즉시 사용 가능)
 * - 확장: public/dictionary.json (10,000 단어, lazy-load)
 */

import { DICTIONARY, type DictionaryEntry } from '../data/dictionary';
import { TONE_MAP } from '../data/toneMap';

// 확장 사전 (lazy-loaded)
let extendedDictionary: DictionaryEntry[] = [];
let isExtendedLoaded = false;

/**
 * 확장 사전 로딩 (앱 시작 시 1회 호출)
 */
export async function loadExtendedDictionary(): Promise<void> {
  if (isExtendedLoaded) return;
  try {
    const response = await fetch('/dictionary.json');
    if (response.ok) {
      const data = await response.json();
      extendedDictionary = data as DictionaryEntry[];
      isExtendedLoaded = true;
      console.log(`Extended dictionary loaded: ${extendedDictionary.length} entries`);
    }
  } catch {
    console.warn('Failed to load extended dictionary, using built-in only');
  }
}

/** 현재 사용 가능한 전체 사전 반환 */
function getAllDictionary(): DictionaryEntry[] {
  if (isExtendedLoaded && extendedDictionary.length > 0) {
    return extendedDictionary;
  }
  return DICTIONARY;
}

// ============================================================
// Interfaces
// ============================================================

export interface HanziCandidate {
  hanzi: string;
  pinyin: string;
  tone: number;
  meaning: string;
  koreanPronunciation: string;
  frequency: number;
}

export interface ConversionResult {
  candidates: HanziCandidate[];
  hasResults: boolean;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Build a reverse map from toned vowel character → { base vowel, tone number }
 */
const TONED_CHAR_MAP: Map<string, { vowel: string; tone: number }> = new Map();

for (const [vowel, tones] of Object.entries(TONE_MAP)) {
  tones.forEach((tonedChar, index) => {
    TONED_CHAR_MAP.set(tonedChar, { vowel, tone: index + 1 });
  });
}

/**
 * Extract the tone number from a toned pinyin string.
 * Returns 0 (neutral tone) if no tone mark is found.
 *
 * e.g., "nǐ" → 3, "ma" → 0, "wǒ" → 3
 */
export function extractTone(tonedPinyin: string): number {
  for (const char of tonedPinyin) {
    const entry = TONED_CHAR_MAP.get(char);
    if (entry) {
      return entry.tone;
    }
  }
  return 0;
}

/**
 * Remove tone marks from a pinyin string, returning the base pinyin.
 *
 * e.g., "nǐ" → "ni", "wǒmen" → "women", "zhōngguó" → "zhongguo"
 */
export function removeToneMarks(tonedPinyin: string): string {
  let result = '';
  for (const char of tonedPinyin) {
    const entry = TONED_CHAR_MAP.get(char);
    if (entry) {
      result += entry.vowel;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Normalize pinyin input for comparison:
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove tone marks (to get base pinyin for matching)
 */
function normalizePinyin(pinyin: string): string {
  return removeToneMarks(pinyin.trim().toLowerCase());
}

/**
 * Convert a DictionaryEntry to a HanziCandidate
 */
function entryToCandidate(entry: DictionaryEntry): HanziCandidate {
  return {
    hanzi: entry.hanzi,
    pinyin: entry.pinyin,
    tone: extractTone(entry.pinyin),
    meaning: entry.meaning,
    koreanPronunciation: entry.koreanPronunciation,
    frequency: entry.frequency,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Convert pinyin input to hanzi candidates.
 *
 * Accepts toned pinyin (e.g., "nǐ") or plain pinyin (e.g., "ni").
 * Searches the dictionary for matching entries, sorted by frequency descending.
 * Returns at most 10 candidates.
 *
 * Supports:
 * - Single syllable: "nǐ" → 你, 尼, etc.
 * - Multi-syllable compound: "nǐ hǎo" → 你好 (searches joined form too)
 * - Individual syllable fallback: if compound not found, search each syllable
 *
 * @param pinyin - The pinyin string to look up (can be toned or untoned)
 * @returns ConversionResult with candidates array and hasResults flag
 */
export function convertPinyinToHanzi(pinyin: string): ConversionResult {
  // Handle empty or invalid input
  if (!pinyin || pinyin.trim().length === 0) {
    return { candidates: [], hasResults: false };
  }

  const normalizedInput = normalizePinyin(pinyin);

  // If normalization results in empty string, return no results
  if (normalizedInput.length === 0) {
    return { candidates: [], hasResults: false };
  }

  // Strategy 1: Search as full compound (spaces removed) — e.g., "paiqiu" for "pái qiú"
  const normalizedJoined = normalizedInput.replace(/\s+/g, '');
  const dict = getAllDictionary();
  let matches = dict.filter((entry) => {
    const entryBasePinyin = removeToneMarks(entry.pinyin.toLowerCase()).replace(/\s+/g, '');
    return entryBasePinyin === normalizedJoined;
  });

  // Strategy 2: Search with spaces intact (for entries that store pinyin with spaces)
  if (matches.length === 0) {
    matches = dict.filter((entry) => {
      const entryBasePinyin = removeToneMarks(entry.pinyin.toLowerCase());
      return entryBasePinyin === normalizedInput;
    });
  }

  // Strategy 3: If multi-syllable and no compound match, search each syllable individually
  if (matches.length === 0 && normalizedInput.includes(' ')) {
    const syllables = normalizedInput.split(/\s+/);
    for (const syllable of syllables) {
      const syllableMatches = dict.filter((entry) => {
        const entryBasePinyin = removeToneMarks(entry.pinyin.toLowerCase()).replace(/\s+/g, '');
        return entryBasePinyin === syllable;
      });
      matches.push(...syllableMatches);
    }
  }

  // Strategy 4: Prefix/partial match — find entries whose pinyin starts with the input
  if (matches.length === 0) {
    matches = dict.filter((entry) => {
      const entryBasePinyin = removeToneMarks(entry.pinyin.toLowerCase()).replace(/\s+/g, '');
      return entryBasePinyin.startsWith(normalizedJoined) || normalizedJoined.startsWith(entryBasePinyin);
    });
  }

  // Deduplicate by hanzi
  const seen = new Set<string>();
  const uniqueMatches: DictionaryEntry[] = [];
  for (const match of matches) {
    if (!seen.has(match.hanzi)) {
      seen.add(match.hanzi);
      uniqueMatches.push(match);
    }
  }

  // Sort: Korean meaning first, then by frequency descending
  uniqueMatches.sort((a, b) => {
    // 한국어 뜻이 있는 것 우선 (영어 알파벳으로 시작하지 않는 것)
    const aIsKorean = !/^[a-zA-Z(]/.test(a.meaning);
    const bIsKorean = !/^[a-zA-Z(]/.test(b.meaning);
    if (aIsKorean && !bIsKorean) return -1;
    if (!aIsKorean && bIsKorean) return 1;
    return b.frequency - a.frequency;
  });

  // Limit to max 10 candidates
  const limitedMatches = uniqueMatches.slice(0, 10);

  // Convert to HanziCandidate format
  const candidates = limitedMatches.map(entryToCandidate);

  return {
    candidates,
    hasResults: candidates.length > 0,
  };
}

/**
 * Retrieve a single dictionary entry by exact hanzi match.
 *
 * @param hanzi - The hanzi character(s) to look up
 * @returns The matching HanziCandidate or null if not found
 */
export function getDictionaryEntry(hanzi: string): HanziCandidate | null {
  if (!hanzi || hanzi.trim().length === 0) {
    return null;
  }

  const entry = getAllDictionary().find((e) => e.hanzi === hanzi.trim());

  if (!entry) {
    return null;
  }

  return entryToCandidate(entry);
}

/**
 * Search dictionary by Korean meaning (partial match).
 * Returns up to 10 candidates sorted by frequency descending.
 *
 * @param query - Korean text to search in meaning field
 * @returns Array of HanziCandidate matching the query
 */
export function searchByMeaning(query: string): HanziCandidate[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmedQuery = query.trim().toLowerCase();

  const matches = getAllDictionary().filter((entry) =>
    entry.meaning.toLowerCase().includes(trimmedQuery)
  );

  // Sort by frequency descending
  matches.sort((a, b) => b.frequency - a.frequency);

  // Limit to 10 results
  return matches.slice(0, 10).map(entryToCandidate);
}
