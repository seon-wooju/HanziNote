import { create } from 'zustand';
import type { AppError } from '../utils/errorHandler';

// ============================================================
// Toast Store Interface
// ============================================================

export interface ToastState {
  toasts: AppError[];
  addToast: (error: AppError) => void;
  removeToast: (code: string) => void;
}

// ============================================================
// Constants
// ============================================================

const MAX_TOASTS = 5;
const AUTO_REMOVE_DELAY_MS = 5000;

// ============================================================
// Toast Store
// ============================================================

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (error: AppError) => {
    const currentToasts = get().toasts;

    // Limit to MAX_TOASTS — remove oldest if at capacity
    const updatedToasts =
      currentToasts.length >= MAX_TOASTS
        ? [...currentToasts.slice(1), error]
        : [...currentToasts, error];

    set({ toasts: updatedToasts });

    // Auto-remove after delay
    setTimeout(() => {
      get().removeToast(error.code);
    }, AUTO_REMOVE_DELAY_MS);
  },

  removeToast: (code: string) => {
    const currentToasts = get().toasts;
    // Remove first matching toast by code
    const index = currentToasts.findIndex((t) => t.code === code);
    if (index !== -1) {
      const updated = [...currentToasts];
      updated.splice(index, 1);
      set({ toasts: updated });
    }
  },
}));
