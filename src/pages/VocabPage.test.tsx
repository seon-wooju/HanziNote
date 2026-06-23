/**
 * VocabPage Component Tests
 *
 * Requirements: 3.3, 3.4, 3.6, 4.1, 4.3, 4.4, 6.1, 6.2, 6.4, 15.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VocabPage } from './VocabPage';
import type { VocabularyWord } from '../db/database';

// ============================================================
// Mocks
// ============================================================

const mockNavigateTo = vi.fn();
const mockSettings = {
  hidePinyin: false,
  hideMeaning: false,
  hideKoreanPronunciation: false,
  largeFontMode: false,
  extraLargeFontMode: false,
  showStrokeOrder: false,
};

vi.mock('../stores/appStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ navigateTo: mockNavigateTo }),
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ settings: mockSettings }),
}));

const mockWords: VocabularyWord[] = [
  {
    id: 1,
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    tone: [3, 3],
    meaning: '안녕하세요',
    koreanPronunciation: '니하오',
    isFavorite: false,
    tags: ['인사'],
    hskLevel: 1,
    createdAt: new Date('2024-01-02'),
    lastStudiedAt: null,
    studyCount: 0,
  },
  {
    id: 2,
    hanzi: '谢谢',
    pinyin: 'xiè xiè',
    tone: [4, 4],
    meaning: '감사합니다',
    koreanPronunciation: '셰셰',
    isFavorite: true,
    tags: [],
    hskLevel: 1,
    createdAt: new Date('2024-01-01'),
    lastStudiedAt: null,
    studyCount: 0,
  },
];

const mockGetWords = vi.fn().mockResolvedValue(mockWords);
const mockSearchByKorean = vi.fn().mockResolvedValue([]);
const mockToggleFavorite = vi.fn().mockResolvedValue(undefined);
const mockAddTag = vi.fn().mockResolvedValue(undefined);
const mockRemoveTag = vi.fn().mockResolvedValue(undefined);
const mockDeleteWord = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/vocabularyManager', () => ({
  getWords: (...args: unknown[]) => mockGetWords(...args),
  searchByKorean: (...args: unknown[]) => mockSearchByKorean(...args),
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
  addTag: (...args: unknown[]) => mockAddTag(...args),
  removeTag: (...args: unknown[]) => mockRemoveTag(...args),
  deleteWord: (...args: unknown[]) => mockDeleteWord(...args),
}));

const mockSpeak = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/ttsPlayer', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
}));

// ============================================================
// Tests
// ============================================================

describe('VocabPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWords.mockResolvedValue(mockWords);
    mockSearchByKorean.mockResolvedValue([]);
    mockSettings.hidePinyin = false;
    mockSettings.hideMeaning = false;
    mockSettings.hideKoreanPronunciation = false;
    mockSettings.largeFontMode = false;
    mockSettings.extraLargeFontMode = false;
  });

  it('renders page title and back button', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('단어장')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('홈으로')).toBeInTheDocument();
  });

  it('navigates back to home when back button is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('홈으로')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('홈으로'));
    expect(mockNavigateTo).toHaveBeenCalledWith('home');
  });

  it('renders filter tabs', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('전체')).toBeInTheDocument();
    });
    expect(screen.getByText('즐겨찾기')).toBeInTheDocument();
    expect(screen.getByText('오늘')).toBeInTheDocument();
    expect(screen.getByText('어려운 단어')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('한국어 검색')).toBeInTheDocument();
    });
  });

  it('loads and displays words', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    expect(screen.getByText('谢谢')).toBeInTheDocument();
  });

  it('displays pinyin when setting is not hidden', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('nǐ hǎo')).toBeInTheDocument();
    });
    expect(screen.getByText('xiè xiè')).toBeInTheDocument();
  });

  it('hides pinyin when setting is enabled', async () => {
    mockSettings.hidePinyin = true;
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    expect(screen.queryByText('nǐ hǎo')).not.toBeInTheDocument();
  });

  it('displays meaning when setting is not hidden', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('안녕하세요')).toBeInTheDocument();
    });
    expect(screen.getByText('감사합니다')).toBeInTheDocument();
  });

  it('hides meaning when setting is enabled', async () => {
    mockSettings.hideMeaning = true;
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    expect(screen.queryByText('안녕하세요')).not.toBeInTheDocument();
  });

  it('displays korean pronunciation with 참고용 label', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('니하오')).toBeInTheDocument();
    });
    // 참고용 labels (one per word with korean pronunciation)
    const labels = screen.getAllByText('참고용');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('hides korean pronunciation when setting is enabled', async () => {
    mockSettings.hideKoreanPronunciation = true;
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    expect(screen.queryByText('니하오')).not.toBeInTheDocument();
    expect(screen.queryByText('참고용')).not.toBeInTheDocument();
  });

  it('calls toggleFavorite when favorite button is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    const favButtons = screen.getAllByLabelText(/즐겨찾기/);
    fireEvent.click(favButtons[0]);
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith(1);
    });
  });

  it('shows delete confirmation and deletes word', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('你好 삭제'));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockDeleteWord).toHaveBeenCalledWith(1);
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when confirmation is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('你好 삭제'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeleteWord).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('calls speak when TTS button is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('你好 발음 재생'));
    await waitFor(() => {
      expect(mockSpeak).toHaveBeenCalledWith('你好');
    });
  });

  it('searches by Korean when query is entered', async () => {
    mockSearchByKorean.mockResolvedValue([mockWords[0]]);
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('한국어 검색')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('한국어 검색'), {
      target: { value: '안녕' },
    });

    await waitFor(() => {
      expect(mockSearchByKorean).toHaveBeenCalledWith('안녕');
    });
  });

  it('shows empty message when search has no results', async () => {
    mockSearchByKorean.mockResolvedValue([]);
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('한국어 검색')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('한국어 검색'), {
      target: { value: '없는단어' },
    });

    await waitFor(() => {
      expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
    });
  });

  it('hides filter tabs when search query is active', async () => {
    mockSearchByKorean.mockResolvedValue([mockWords[0]]);
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('전체')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('한국어 검색'), {
      target: { value: '안녕' },
    });

    await waitFor(() => {
      expect(screen.queryByText('전체')).not.toBeInTheDocument();
    });
  });

  it('changes filter when tab is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('즐겨찾기')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('즐겨찾기'));

    await waitFor(() => {
      expect(mockGetWords).toHaveBeenCalledWith({ type: 'favorite' });
    });
  });

  it('displays tags on word cards', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('인사')).toBeInTheDocument();
    });
  });

  it('opens tag dialog when add tag button is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument();
    });

    const tagButtons = screen.getAllByLabelText('태그 추가');
    fireEvent.click(tagButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('태그 추가', { selector: 'h3' })).toBeInTheDocument();
    });
  });

  it('removes tag when tag remove button is clicked', async () => {
    render(<VocabPage />);
    await waitFor(() => {
      expect(screen.getByText('인사')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('인사 태그 삭제'));

    await waitFor(() => {
      expect(mockRemoveTag).toHaveBeenCalledWith(1, '인사');
    });
  });
});
