import { describe, it, expect, beforeEach } from 'vitest';
import { withDbErrorHandling } from './errorHandler';
import { useToastStore } from '../stores/toastStore';

describe('errorHandler', () => {
  beforeEach(() => {
    // Reset toast store before each test
    useToastStore.setState({ toasts: [] });
  });

  describe('withDbErrorHandling', () => {
    it('should return the result of a successful operation', async () => {
      const result = await withDbErrorHandling(
        async () => 'success',
        'fallback',
        'TEST_ERROR'
      );
      expect(result).toBe('success');
    });

    it('should return fallback when operation throws', async () => {
      const result = await withDbErrorHandling(
        async () => {
          throw new Error('DB error');
        },
        'fallback-value',
        'DB_WRITE_FAIL'
      );
      expect(result).toBe('fallback-value');
    });

    it('should add a toast when operation throws a generic error', async () => {
      await withDbErrorHandling(
        async () => {
          throw new Error('Some DB error');
        },
        null,
        'SAVE_FAIL'
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.code).toBe('SAVE_FAIL');
      expect(toasts[0]!.message).toBe('저장에 실패했습니다');
      expect(toasts[0]!.severity).toBe('error');
      expect(toasts[0]!.recoverable).toBe(true);
    });

    it('should detect QuotaExceededError and show storage full message', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');

      await withDbErrorHandling(
        async () => {
          throw quotaError;
        },
        [],
        'VOCAB_SAVE'
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.code).toBe('STORAGE_FULL');
      expect(toasts[0]!.message).toBe('저장 공간이 부족합니다');
      expect(toasts[0]!.recoverable).toBe(false);
    });

    it('should detect quota errors by message content', async () => {
      const error = new Error('The quota has been exceeded');

      await withDbErrorHandling(
        async () => {
          throw error;
        },
        null,
        'SETTINGS_SAVE'
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.code).toBe('STORAGE_FULL');
    });

    it('should provide a retryAction for non-quota errors', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount === 1) throw new Error('first attempt fails');
        return 'retry-success';
      };

      await withDbErrorHandling(operation, null, 'RETRY_TEST');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0]!.retryAction).toBeDefined();
    });

    it('should return fallback of correct type for arrays', async () => {
      const result = await withDbErrorHandling<string[]>(
        async () => {
          throw new Error('fail');
        },
        [],
        'ARRAY_TEST'
      );
      expect(result).toEqual([]);
    });
  });
});
