/**
 * NetworkStatusBanner Component Tests
 *
 * Tests for the network status banner that displays offline/online transitions.
 * Requirements: 12.4, 12.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NetworkStatusBanner } from './NetworkStatusBanner';

// Mock the useNetworkStatus hook
vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(),
}));

import { useNetworkStatus } from '../hooks/useNetworkStatus';
const mockUseNetworkStatus = vi.mocked(useNetworkStatus);

describe('NetworkStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should render nothing when online and never was offline', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, wasOffline: false });

    const { container } = render(<NetworkStatusBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('should show offline banner when network is disconnected', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, wasOffline: false });

    render(<NetworkStatusBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/오프라인 상태입니다/)).toBeInTheDocument();
    expect(screen.getByText(/일부 기능이 제한됩니다/)).toBeInTheDocument();
  });

  it('should show online return banner when transitioning back to online', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, wasOffline: true });

    render(<NetworkStatusBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('온라인 복귀')).toBeInTheDocument();
  });

  it('should hide online return banner after 3 seconds', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, wasOffline: true });

    render(<NetworkStatusBanner />);

    expect(screen.getByText('온라인 복귀')).toBeInTheDocument();

    // Advance past the 3 second timeout
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('온라인 복귀')).not.toBeInTheDocument();
  });

  it('offline banner should have correct styling (amber/yellow background)', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, wasOffline: false });

    render(<NetworkStatusBanner />);

    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('bg-amber-500');
    expect(banner.className).toContain('fixed');
    expect(banner.className).toContain('top-0');
  });

  it('online return banner should have correct styling (green background)', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, wasOffline: true });

    render(<NetworkStatusBanner />);

    const banner = screen.getByRole('status');
    expect(banner.className).toContain('bg-green-500');
    expect(banner.className).toContain('fixed');
    expect(banner.className).toContain('top-0');
  });
});
