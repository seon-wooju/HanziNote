import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { db } from '../db/database';
import {
  saveSettings,
  loadSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from './settingsService';

/**
 * Property 14: Settings Persistence Round-Trip
 *
 * For any valid settings configuration, saving settings and then loading them
 * SHALL return an identical configuration object. If loading fails, the system
 * SHALL return DEFAULT_SETTINGS.
 *
 * Validates: Requirements 15.2, 15.3, 15.4
 */

// Generator for AppSettings (6 boolean fields)
const appSettingsArb = fc.record({
  largeFontMode: fc.boolean(),
  extraLargeFontMode: fc.boolean(),
  hidePinyin: fc.boolean(),
  hideMeaning: fc.boolean(),
  showStrokeOrder: fc.boolean(),
  hideKoreanPronunciation: fc.boolean(),
});

describe('Feature: chinese-learning-keyboard, Property 14: Settings Persistence Round-Trip', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it('saving settings and loading them returns an identical configuration object', async () => {
    await fc.assert(
      fc.asyncProperty(appSettingsArb, async (settings: AppSettings) => {
        // Clear before each iteration to ensure independence
        await db.settings.clear();

        // Save the generated settings
        await saveSettings(settings);

        // Load settings back
        const loaded = await loadSettings();

        // Assert round-trip: loaded settings must be identical to saved settings
        expect(loaded).toEqual(settings);
      }),
      { numRuns: 100 }
    );
  });

  it('loading from an empty/cleared DB returns DEFAULT_SETTINGS', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Ensure DB is cleared
        await db.settings.clear();

        // Load settings from empty DB
        const loaded = await loadSettings();

        // Should return DEFAULT_SETTINGS
        expect(loaded).toEqual(DEFAULT_SETTINGS);
      }),
      { numRuns: 100 }
    );
  });
});
