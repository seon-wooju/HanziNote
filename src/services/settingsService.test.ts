import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import {
  loadSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from './settingsService';

describe('settingsService', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  describe('loadSettings', () => {
    it('returns DEFAULT_SETTINGS when no settings are stored', async () => {
      const settings = await loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('returns stored settings when all keys exist', async () => {
      const custom: AppSettings = {
        largeFontMode: true,
        extraLargeFontMode: false,
        hidePinyin: true,
        hideMeaning: false,
        showStrokeOrder: true,
        hideKoreanPronunciation: true,
      };

      for (const [key, value] of Object.entries(custom)) {
        await db.settings.put({ key, value });
      }

      const settings = await loadSettings();
      expect(settings).toEqual(custom);
    });

    it('uses defaults for missing keys', async () => {
      await db.settings.put({ key: 'largeFontMode', value: true });

      const settings = await loadSettings();
      expect(settings.largeFontMode).toBe(true);
      expect(settings.extraLargeFontMode).toBe(false);
      expect(settings.hidePinyin).toBe(false);
      expect(settings.hideMeaning).toBe(false);
      expect(settings.showStrokeOrder).toBe(false);
      expect(settings.hideKoreanPronunciation).toBe(false);
    });

    it('uses defaults for keys with non-boolean values', async () => {
      await db.settings.put({ key: 'largeFontMode', value: 'invalid' });
      await db.settings.put({ key: 'hidePinyin', value: 42 });

      const settings = await loadSettings();
      expect(settings.largeFontMode).toBe(false);
      expect(settings.hidePinyin).toBe(false);
    });
  });

  describe('saveSettings', () => {
    it('persists all settings to IndexedDB', async () => {
      const custom: AppSettings = {
        largeFontMode: true,
        extraLargeFontMode: true,
        hidePinyin: false,
        hideMeaning: true,
        showStrokeOrder: false,
        hideKoreanPronunciation: true,
      };

      await saveSettings(custom);

      const record = await db.settings.get('largeFontMode');
      expect(record?.value).toBe(true);

      const record2 = await db.settings.get('hideMeaning');
      expect(record2?.value).toBe(true);

      const record3 = await db.settings.get('showStrokeOrder');
      expect(record3?.value).toBe(false);
    });

    it('overwrites previously stored settings', async () => {
      await saveSettings({ ...DEFAULT_SETTINGS, largeFontMode: true });
      await saveSettings({ ...DEFAULT_SETTINGS, largeFontMode: false });

      const record = await db.settings.get('largeFontMode');
      expect(record?.value).toBe(false);
    });
  });

  describe('resetSettings', () => {
    it('clears existing settings and writes defaults', async () => {
      await saveSettings({
        largeFontMode: true,
        extraLargeFontMode: true,
        hidePinyin: true,
        hideMeaning: true,
        showStrokeOrder: true,
        hideKoreanPronunciation: true,
      });

      const result = await resetSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);

      const loaded = await loadSettings();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('returns DEFAULT_SETTINGS even on empty table', async () => {
      const result = await resetSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('round-trip', () => {
    it('save then load returns the same settings', async () => {
      const custom: AppSettings = {
        largeFontMode: true,
        extraLargeFontMode: false,
        hidePinyin: true,
        hideMeaning: true,
        showStrokeOrder: false,
        hideKoreanPronunciation: true,
      };

      await saveSettings(custom);
      const loaded = await loadSettings();
      expect(loaded).toEqual(custom);
    });
  });
});
