// ============================================================
// Error Handler Utility
// ============================================================

// ============================================================
// Types
// ============================================================

export type ErrorSeverity = 'info' | 'warning' | 'error';

export interface AppError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryAction?: () => Promise<void>;
}

// ============================================================
// Database Error Handling Wrapper
// ============================================================

/**
 * Wraps a database operation with error handling.
 * Catches Dexie/IndexedDB errors, shows a toast notification,
 * and returns a fallback value instead of throwing.
 */
export async function withDbErrorHandling<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorCode: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const toast = getToastForDbError(error, errorCode, operation);
    // Lazy import to avoid circular dependencies
    const { useToastStore } = await import('../stores/toastStore');
    useToastStore.getState().addToast(toast);
    return fallback;
  }
}

// ============================================================
// Error Classification Helpers
// ============================================================

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return true;
  }
  // Dexie wraps QuotaExceededError in its own error type
  if (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' ||
      error.message.toLowerCase().includes('quota'))
  ) {
    return true;
  }
  return false;
}

function getToastForDbError(
  error: unknown,
  errorCode: string,
  operation: () => Promise<unknown>
): AppError {
  if (isQuotaExceededError(error)) {
    return {
      code: 'STORAGE_FULL',
      message: '저장 공간이 부족합니다',
      severity: 'error',
      recoverable: false,
    };
  }

  return {
    code: errorCode,
    message: '저장에 실패했습니다',
    severity: 'error',
    recoverable: true,
    retryAction: async () => {
      await operation();
    },
  };
}
