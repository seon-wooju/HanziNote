import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore } from './toastStore';
import type { AppError } from '../utils/errorHandler';

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createToast = (code: string, message = 'Test error'): AppError => ({
    code,
    message,
    severity: 'error',
    recoverable: true,
  });

  describe('addToast', () => {
    it('should add a toast to the array', () => {
      const toast = createToast('ERR_1');
      useToastStore.getState().addToast(toast);

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0]).toEqual(toast);
    });

    it('should limit toasts to max 5', () => {
      const store = useToastStore.getState();
      for (let i = 1; i <= 6; i++) {
        store.addToast(createToast(`ERR_${i}`));
      }

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(5);
      // Oldest (ERR_1) should be removed, ERR_2 is now first
      expect(toasts[0]!.code).toBe('ERR_2');
      expect(toasts[4]!.code).toBe('ERR_6');
    });

    it('should auto-remove toast after 5 seconds', () => {
      const toast = createToast('AUTO_REMOVE');
      useToastStore.getState().addToast(toast);

      expect(useToastStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(5000);

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should not remove other toasts when auto-removing', () => {
      useToastStore.getState().addToast(createToast('FIRST'));
      vi.advanceTimersByTime(2000);
      useToastStore.getState().addToast(createToast('SECOND'));

      // After 3 more seconds, FIRST should be removed (5s total)
      vi.advanceTimersByTime(3000);
      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.code).toBe('SECOND');
    });
  });

  describe('removeToast', () => {
    it('should remove a toast by code', () => {
      useToastStore.getState().addToast(createToast('TO_REMOVE'));
      useToastStore.getState().addToast(createToast('TO_KEEP'));

      useToastStore.getState().removeToast('TO_REMOVE');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.code).toBe('TO_KEEP');
    });

    it('should do nothing if code is not found', () => {
      useToastStore.getState().addToast(createToast('EXISTS'));
      useToastStore.getState().removeToast('NOT_EXISTS');

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('should remove only the first match when duplicates exist', () => {
      useToastStore.getState().addToast(createToast('DUP', 'First'));
      useToastStore.getState().addToast(createToast('DUP', 'Second'));

      useToastStore.getState().removeToast('DUP');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.message).toBe('Second');
    });
  });
});
