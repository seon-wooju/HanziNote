// ============================================================
// TTS Player Service
// Web Speech API wrapper for Chinese (zh-CN) text-to-speech
// ============================================================

// ============================================================
// Types & Interfaces
// ============================================================

export type PlaybackSpeed = 0.5 | 0.75 | 1.0;

export interface TTSState {
  isPlaying: boolean;
  isAvailable: boolean;
  currentSpeed: PlaybackSpeed;
}

// ============================================================
// Internal State
// ============================================================

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isCurrentlyPlaying = false;
let stopRequested = false;

// ============================================================
// Voice Detection
// ============================================================

/**
 * Get a Chinese voice from the available speech synthesis voices.
 * Prefers zh-CN, falls back to any voice whose lang starts with "zh".
 * Returns null if no Chinese voice is found.
 */
export function getChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  // Prefer exact zh-CN match
  const zhCN = voices.find((voice) => voice.lang === 'zh-CN');
  if (zhCN) return zhCN;

  // Fall back to any Chinese voice (zh-TW, zh-HK, etc.)
  const zhAny = voices.find((voice) => voice.lang.startsWith('zh'));
  if (zhAny) return zhAny;

  return null;
}

/**
 * Check if TTS is available for Chinese text.
 * Returns true if the Web Speech API exists AND a Chinese voice is available.
 */
export function checkAvailability(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }

  return getChineseVoice() !== null;
}

// ============================================================
// Playback Functions
// ============================================================

/**
 * Speak the given text using the Web Speech API with a Chinese voice.
 *
 * - Stops any currently playing utterance before starting.
 * - Creates a SpeechSynthesisUtterance with the specified speed.
 * - Returns a Promise that resolves on 'end' and rejects on 'error'.
 *
 * @param text - The Chinese text to speak (supports single characters, words, or sentences up to 200 chars).
 * @param speed - Playback speed: 0.5, 0.75, or 1.0 (default: 1.0).
 */
export function speak(text: string, speed: PlaybackSpeed = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Web Speech API is not available'));
      return;
    }

    // Stop any current playback (but don't set stopRequested flag)
    cancelCurrentPlayback();

    const voice = getChineseVoice();
    if (!voice) {
      reject(new Error('No Chinese (zh-CN) voice available'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = 'zh-CN';
    utterance.rate = speed;

    utterance.onend = () => {
      isCurrentlyPlaying = false;
      currentUtterance = null;
      resolve();
    };

    utterance.onerror = (event) => {
      isCurrentlyPlaying = false;
      currentUtterance = null;
      // 'interrupted' and 'canceled' are expected when stop() is called
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`TTS error: ${event.error}`));
      }
    };

    currentUtterance = utterance;
    isCurrentlyPlaying = true;
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Repeat playback of the given text multiple times with a 1-second interval between plays.
 *
 * @param text - The Chinese text to speak.
 * @param times - Number of repetitions (default: 3).
 * @param speed - Playback speed (default: 1.0).
 */
export async function speakRepeat(
  text: string,
  times: number = 3,
  speed: PlaybackSpeed = 1.0
): Promise<void> {
  stopRequested = false;

  for (let i = 0; i < times; i++) {
    if (stopRequested) break;

    await speak(text, speed);

    // Wait 1 second between repetitions (except after the last one)
    if (i < times - 1 && !stopRequested) {
      await delay(1000);
    }
  }
}

/**
 * Stop the current utterance and cancel any queued speech.
 */
export function stop(): void {
  stopRequested = true;

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  isCurrentlyPlaying = false;
  currentUtterance = null;
}

// ============================================================
// State Query
// ============================================================

/**
 * Get the current TTS state.
 */
export function getTTSState(currentSpeed: PlaybackSpeed = 1.0): TTSState {
  return {
    isPlaying: isCurrentlyPlaying,
    isAvailable: checkAvailability(),
    currentSpeed,
  };
}

// ============================================================
// Utility
// ============================================================

/**
 * Cancel current playback without affecting the stopRequested flag.
 * Used internally by speak() to stop previous utterance before starting a new one.
 */
function cancelCurrentPlayback(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  isCurrentlyPlaying = false;
  currentUtterance = null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
