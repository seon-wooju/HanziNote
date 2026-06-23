import { db } from '../db/database';

// ============================================================
// AppSettings Interface & Defaults
// ============================================================

export interface AppSettings {
  largeFontMode: boolean; // 큰 글씨 (1.5x)
  extraLargeFontMode: boolean; // 초대형 글씨 (2x)
  hidePinyin: boolean; // 병음 숨기기
  hideMeaning: boolean; // 뜻 숨기기
  showStrokeOrder: boolean; // 획순 표시
  hideKoreanPronunciation: boolean; // 한국식 발음 숨기기
}

export const DEFAULT_SETTINGS: AppSettings = {
  largeFontMode: false,
  extraLargeFontMode: false,
  hidePinyin: false,
  hideMeaning: false,
  showStrokeOrder: false,
  hideKoreanPronunciation: false,
};

// ============================================================
// Settings Persistence Functions
// ============================================================

/**
 * Load settings from IndexedDB.
 * Reads each setting key individually and composes the AppSettings object.
 * Falls back to DEFAULT_SETTINGS on any failure or missing keys.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

    const records = await db.settings.bulkGet(keys);

    for (let i = 0; i < keys.length; i++) {
      const record = records[i];
      if (record !== undefined && typeof record.value === 'boolean') {
        settings[keys[i]] = record.value;
      }
    }

    return settings;
  } catch {
    console.error('Failed to load settings from IndexedDB, using defaults');
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to IndexedDB.
 * Writes each setting as a separate key-value record using upsert (put).
 * Logs error but does not throw on failure.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const keys = Object.keys(settings) as (keyof AppSettings)[];
    const records = keys.map((key) => ({ key, value: settings[key] }));
    await db.settings.bulkPut(records);
  } catch {
    console.error('Failed to save settings to IndexedDB');
  }
}

/**
 * Reset settings to defaults.
 * Clears the settings table, writes DEFAULT_SETTINGS, and returns them.
 */
export async function resetSettings(): Promise<AppSettings> {
  try {
    await db.settings.clear();
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
    const records = keys.map((key) => ({ key, value: DEFAULT_SETTINGS[key] }));
    await db.settings.bulkPut(records);
  } catch {
    console.error('Failed to reset settings in IndexedDB');
  }
  return { ...DEFAULT_SETTINGS };
}
