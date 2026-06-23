/**
 * HomePage Component Tests
 *
 * Requirements: 14.1, 10.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomePage } from './HomePage';

// Mock the stores
const mockNavigateTo = vi.fn();
const mockLoadDueCards = vi.fn();
let mockDueCount = 0;

vi.mock('../stores/appStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ navigateTo: mockNavigateTo }),
}));

vi.mock('../stores/flashcardStore', () => ({
  useFlashcardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ dueCount: mockDueCount, loadDueCards: mockLoadDueCards }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDueCount = 0;
  });

  it('renders app title', () => {
    render(<HomePage />);
    expect(screen.getByText('중국어 학습 키보드')).toBeInTheDocument();
    expect(screen.getByText('中文学习键盘')).toBeInTheDocument();
  });

  it('renders all 6 menu items', () => {
    render(<HomePage />);
    expect(screen.getByLabelText('입력기')).toBeInTheDocument();
    expect(screen.getByLabelText('단어장')).toBeInTheDocument();
    expect(screen.getByLabelText('발음 연습')).toBeInTheDocument();
    expect(screen.getByLabelText('쓰기 연습')).toBeInTheDocument();
    expect(screen.getByLabelText('통계')).toBeInTheDocument();
    expect(screen.getByLabelText('설정')).toBeInTheDocument();
  });

  it('calls loadDueCards on mount', () => {
    render(<HomePage />);
    expect(mockLoadDueCards).toHaveBeenCalledTimes(1);
  });

  it('navigates to correct page when menu item clicked', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByLabelText('입력기'));
    expect(mockNavigateTo).toHaveBeenCalledWith('input');

    fireEvent.click(screen.getByLabelText('단어장'));
    expect(mockNavigateTo).toHaveBeenCalledWith('vocab');

    fireEvent.click(screen.getByLabelText('설정'));
    expect(mockNavigateTo).toHaveBeenCalledWith('settings');
  });

  it('does not show due badge when dueCount is 0', () => {
    mockDueCount = 0;
    render(<HomePage />);
    expect(screen.queryByText(/오늘 복습/)).not.toBeInTheDocument();
  });

  it('shows due badge when dueCount > 0', () => {
    mockDueCount = 5;
    render(<HomePage />);
    expect(screen.getByText('오늘 복습: 5장')).toBeInTheDocument();
  });
});
