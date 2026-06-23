import { useState, useEffect, useRef } from 'react';

// ============================================================
// useNetworkStatus Hook
// ============================================================

interface NetworkStatus {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** True if the app transitioned from offline back to online */
  wasOffline: boolean;
}

/**
 * React hook for detecting online/offline network status.
 * Listens to browser online/offline events and tracks transitions.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
