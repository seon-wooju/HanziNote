/**
 * NetworkStatusBanner Component
 *
 * 네트워크 연결 상태를 사용자에게 시각적으로 알려주는 배너.
 * 오프라인 시 경고 배너를 표시하고, 온라인 복귀 시 잠시 복귀 메시지를 보여준다.
 *
 * Requirements: 12.4, 12.6
 */

import { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function NetworkStatusBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showOnlineNotice, setShowOnlineNotice] = useState(false);

  // Show "back online" notice briefly when transitioning from offline to online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowOnlineNotice(true);
      const timer = setTimeout(() => {
        setShowOnlineNotice(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show offline banner
  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
            />
          </svg>
          오프라인 상태입니다. 일부 기능이 제한됩니다.
        </span>
      </div>
    );
  }

  // Show brief "back online" notice
  if (showOnlineNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md transition-opacity duration-500"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          온라인 복귀
        </span>
      </div>
    );
  }

  return null;
}
