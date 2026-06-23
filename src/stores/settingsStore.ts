import { create } from 'zustand';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  loadSettings as loadSettingsFromDB,
  saveSettings,
} from '../services/settingsService';

// ============================================================
// Settings Store Interface
// ============================================================

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  loadSettings: () => Promise<void>;
}

// ============================================================
// Debounce helper for persisting settings
// ============================================================

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(settings: AppSettings): void {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveSettings(settings);
    saveTimeout = null;
  }, 500);
}

// ============================================================
// Settings Store
// ============================================================

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    const settings = await loadSettingsFromDB();
    set({ settings, isLoaded: true });
  },

  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updatedSettings = { ...get().settings, [key]: value };
    set({ settings: updatedSettings });
    debouncedSave(updatedSettings);
  },
}));
