/**
 * Toast Container Component
 *
 * 앱 상단에 토스트 알림을 표시하는 컴포넌트.
 * useToastStore에서 토스트 목록을 구독하여 렌더링.
 *
 * Requirements: 14.1
 */

import { useToastStore } from '../stores/toastStore';
import type { ErrorSeverity } from '../utils/errorHandler';

// ============================================================
// Severity Styles
// ============================================================

const SEVERITY_STYLES: Record<ErrorSeverity, string> = {
  info: 'bg-blue-50 border-blue-300 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  error: 'bg-red-50 border-red-300 text-red-800',
};

const SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
};

// ============================================================
// Toast Container Component
// ============================================================

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 space-y-2"
      aria-live="polite"
      aria-label="알림"
    >
      {toasts.map((toast) => (
        <div
          key={`${toast.code}-${Date.now()}`}
          className={`flex items-start gap-2 p-3 border rounded-lg shadow-md animate-fade-in ${SEVERITY_STYLES[toast.severity]}`}
          role="alert"
        >
          <span className="text-base flex-shrink-0" aria-hidden="true">
            {SEVERITY_ICONS[toast.severity]}
          </span>
          <p className="text-sm flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.code)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-lg leading-none"
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
