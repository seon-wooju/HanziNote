/**
 * SettingsPage Component Tests
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

// Mock settings store
const mockUpdateSetting = vi.fn();
let mockSettings = {
  largeFontMode: false,
  extraLargeFontMode: false,
  hidePinyin: false,
  hideMeaning: false,
  showStrokeOrder: false,
  hideKoreanPronunciation: false,
};

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ settings: mockSettings, updateSetting: mockUpdateSetting }),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {
      largeFontMode: false,
      extraLargeFontMode: false,
      hidePinyin: false,
      hideMeaning: false,
      showStrokeOrder: false,
      hideKoreanPronunciation: false,
    };
  });

  it('renders page title "설정"', () => {
    render(<SettingsPage />);
    expect(screen.getByText('설정')).toBeInTheDocument();
  });

  it('renders all 6 toggle switches', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('switch', { name: '큰 글씨 모드 (1.5x)' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '초대형 글씨 모드 (2x)' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '병음 숨기기' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '뜻 숨기기' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '획순 표시' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '한국식 발음 숨기기' })).toBeInTheDocument();
  });

  it('all toggles default to OFF (aria-checked=false)', () => {
    render(<SettingsPage />);
    const switches = screen.getAllByRole('switch');
    switches.forEach((sw) => {
      expect(sw).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('calls updateSetting with correct key and value when toggled ON', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('switch', { name: '큰 글씨 모드 (1.5x)' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('largeFontMode', true);

    fireEvent.click(screen.getByRole('switch', { name: '병음 숨기기' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('hidePinyin', true);
  });

  it('calls updateSetting with false when toggled OFF from ON state', () => {
    mockSettings = {
      ...mockSettings,
      largeFontMode: true,
    };
    render(<SettingsPage />);

    const toggle = screen.getByRole('switch', { name: '큰 글씨 모드 (1.5x)' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(mockUpdateSetting).toHaveBeenCalledWith('largeFontMode', false);
  });

  it('reflects current settings state in toggle switches', () => {
    mockSettings = {
      largeFontMode: true,
      extraLargeFontMode: false,
      hidePinyin: true,
      hideMeaning: false,
      showStrokeOrder: true,
      hideKoreanPronunciation: false,
    };
    render(<SettingsPage />);

    expect(screen.getByRole('switch', { name: '큰 글씨 모드 (1.5x)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: '초대형 글씨 모드 (2x)' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: '병음 숨기기' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: '뜻 숨기기' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: '획순 표시' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: '한국식 발음 숨기기' })).toHaveAttribute('aria-checked', 'false');
  });
});
