/**
 * Settings Page
 *
 * 사용자 설정을 토글 스위치로 관리하는 페이지.
 * 모든 토글의 기본값은 OFF이며, 변경 즉시 반영되고 500ms 이내에 IndexedDB에 저장.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { useSettingsStore } from '../stores/settingsStore';
import type { AppSettings } from '../services/settingsService';

// ============================================================
// Toggle Switch Component
// ============================================================

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <div
      className="flex items-center justify-between py-4 px-4 border-b border-gray-100 last:border-b-0"
      role="group"
    >
      <div className="flex flex-col">
        <span className="text-base font-medium text-gray-800">{label}</span>
        {description && (
          <span className="text-sm text-gray-500 mt-0.5">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}

// ============================================================
// Settings Configuration
// ============================================================

interface SettingItem {
  key: keyof AppSettings;
  label: string;
  description?: string;
}

const SETTINGS_LIST: SettingItem[] = [
  {
    key: 'largeFontMode',
    label: '큰 글씨 모드 (1.5x)',
    description: '기본 글씨 크기의 1.5배',
  },
  {
    key: 'extraLargeFontMode',
    label: '초대형 글씨 모드 (2x)',
    description: '기본 글씨 크기의 2배',
  },
  {
    key: 'hidePinyin',
    label: '병음 숨기기',
    description: '학습 화면에서 병음을 숨깁니다',
  },
  {
    key: 'hideMeaning',
    label: '뜻 숨기기',
    description: '학습 화면에서 한국어 뜻을 숨깁니다',
  },
  {
    key: 'showStrokeOrder',
    label: '획순 표시',
    description: '한자 학습 시 획순을 표시합니다',
  },
  {
    key: 'hideKoreanPronunciation',
    label: '한국식 발음 숨기기',
    description: '한국식 발음 표기를 숨깁니다',
  },
];

// ============================================================
// Settings Page Component
// ============================================================

export function SettingsPage() {
  const settings = useSettingsStore((state) => state.settings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      {/* Toggle List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {SETTINGS_LIST.map((item) => (
          <ToggleSwitch
            key={item.key}
            label={item.label}
            description={item.description}
            checked={settings[item.key]}
            onChange={(value) => updateSetting(item.key, value)}
          />
        ))}
      </div>

      {/* Info note */}
      <p className="text-sm text-gray-400 mt-4 text-center">
        설정 변경은 즉시 적용되며 자동으로 저장됩니다.
      </p>
    </div>
  );
}
