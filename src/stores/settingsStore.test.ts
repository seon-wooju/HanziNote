import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { DEFAULT_SETTINGS } from '../services/settingsService';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(async () => {
    await db.settings.clear();
    // Reset store state before each test
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: false,
    });
  });

  describe('initial state', () => {
    it('starts with DEFAULT_SETTINGS and isLoaded=false', () => {
      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
      expect(state.isLoaded).toBe(false);
    });
  });

  describe('loadSettings', () => {
    it('loads settings from IndexedDB and sets isLoaded to true', async () => {
      // Store custom settings in DB
      await db.settings.put({ key: 'largeFontMode', value: true });
      await db.settings.put({ key: 'hidePinyin', value: true });

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.largeFontMode).toBe(true);
      expect(state.settings.hidePinyin).toBe(true);
      expect(state.settings.extraLargeFontMode).toBe(false);
    });

    it('uses DEFAULT_SETTINGS when DB is empty', async () => {
      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSetting', () => {
    it('updates a setting immediately in state', () => {
      useSettingsStore.getState().updateSetting('largeFontMode', true);

      const state = useSettingsStore.getState();
      expect(state.settings.largeFontMode).toBe(true);
    });

    it('persists settings to IndexedDB after 500ms debounce', async () => {
      useSettingsStore.getState().updateSetting('hidePinyin', true);

      // Wait for the 500ms debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 600));

      const record = await db.settings.get('hidePinyin');
      expect(record?.value).toBe(true);
    });

    it('debounces multiple rapid updates', async () => {
      useSettingsStore.getState().updateSetting('largeFontMode', true);
      useSettingsStore.getState().updateSetting('hidePinyin', true);
      useSettingsStore.getState().updateSetting('largeFontMode', false);

      // Wait for the debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Only the final state should be persisted
      const state = useSettingsStore.getState();
      expect(state.settings.largeFontMode).toBe(false);
      expect(state.settings.hidePinyin).toBe(true);

      const record = await db.settings.get('largeFontMode');
      expect(record?.value).toBe(false);

      const record2 = await db.settings.get('hidePinyin');
      expect(record2?.value).toBe(true);
    });

    it('updates each setting key correctly', () => {
      useSettingsStore.getState().updateSetting('extraLargeFontMode', true);
      expect(useSettingsStore.getState().settings.extraLargeFontMode).toBe(true);

      useSettingsStore.getState().updateSetting('showStrokeOrder', true);
      expect(useSettingsStore.getState().settings.showStrokeOrder).toBe(true);

      useSettingsStore.getState().updateSetting('hideKoreanPronunciation', true);
      expect(useSettingsStore.getState().settings.hideKoreanPronunciation).toBe(true);

      useSettingsStore.getState().updateSetting('hideMeaning', true);
      expect(useSettingsStore.getState().settings.hideMeaning).toBe(true);
    });
  });
});
