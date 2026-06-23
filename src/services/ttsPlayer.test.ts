import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  speak,
  speakRepeat,
  stop,
  checkAvailability,
  getChineseVoice,
  getTTSState,
} from './ttsPlayer';

// ============================================================
// Mock Web Speech API
// ============================================================

function createMockVoice(lang: string, name: string): SpeechSynthesisVoice {
  return {
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  };
}

// Mock SpeechSynthesisUtterance class for jsdom environment
class MockSpeechSynthesisUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: ((ev: Event) => void) | null = null;
  onerror: ((ev: SpeechSynthesisErrorEvent) => void) | null = null;
  onstart: ((ev: Event) => void) | null = null;
  onpause: ((ev: Event) => void) | null = null;
  onresume: ((ev: Event) => void) | null = null;
  onmark: ((ev: Event) => void) | null = null;
  onboundary: ((ev: Event) => void) | null = null;

  constructor(text: string = '') {
    this.text = text;
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

// Install the mock globally before tests
(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

function createMockSpeechSynthesis() {
  const mockVoices = [
    createMockVoice('en-US', 'English'),
    createMockVoice('zh-CN', 'Chinese Mandarin'),
    createMockVoice('ja-JP', 'Japanese'),
  ];

  return {
    getVoices: vi.fn(() => mockVoices),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      // Simulate immediate end by default
      setTimeout(() => {
        if (utterance.onend) {
          utterance.onend(new Event('end') as SpeechSynthesisEvent);
        }
      }, 0);
    }),
    cancel: vi.fn(),
    paused: false,
    pending: false,
    speaking: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onvoiceschanged: null,
  } as unknown as SpeechSynthesis;
}

describe('TTS Player', () => {
  let mockSpeechSynthesis: SpeechSynthesis;

  beforeEach(() => {
    mockSpeechSynthesis = createMockSpeechSynthesis();
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stop();
  });

  describe('getChineseVoice()', () => {
    it('returns zh-CN voice when available', () => {
      const voice = getChineseVoice();
      expect(voice).not.toBeNull();
      expect(voice!.lang).toBe('zh-CN');
    });

    it('falls back to other zh voices when zh-CN is unavailable', () => {
      (mockSpeechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockVoice('en-US', 'English'),
        createMockVoice('zh-TW', 'Chinese Taiwan'),
      ]);

      const voice = getChineseVoice();
      expect(voice).not.toBeNull();
      expect(voice!.lang).toBe('zh-TW');
    });

    it('returns null when no Chinese voice is available', () => {
      (mockSpeechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockVoice('en-US', 'English'),
        createMockVoice('ja-JP', 'Japanese'),
      ]);

      const voice = getChineseVoice();
      expect(voice).toBeNull();
    });
  });

  describe('checkAvailability()', () => {
    it('returns true when speechSynthesis exists and zh-CN voice available', () => {
      expect(checkAvailability()).toBe(true);
    });

    it('returns false when no Chinese voice available', () => {
      (mockSpeechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockVoice('en-US', 'English'),
      ]);

      expect(checkAvailability()).toBe(false);
    });
  });

  describe('speak()', () => {
    it('creates utterance with correct parameters', async () => {
      await speak('你好', 0.75);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      const utterance = (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as SpeechSynthesisUtterance;
      expect(utterance.text).toBe('你好');
      expect(utterance.rate).toBe(0.75);
      expect(utterance.lang).toBe('zh-CN');
    });

    it('uses default speed of 1.0 when not specified', async () => {
      await speak('你好');

      const utterance = (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as SpeechSynthesisUtterance;
      expect(utterance.rate).toBe(1.0);
    });

    it('stops current playback before starting new one', async () => {
      await speak('第一');
      await speak('第二');

      // cancel() is called before each speak to stop previous
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('rejects when no Chinese voice is available', async () => {
      (mockSpeechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockVoice('en-US', 'English'),
      ]);

      await expect(speak('你好')).rejects.toThrow('No Chinese (zh-CN) voice available');
    });

    it('rejects on TTS error', async () => {
      (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (utterance: SpeechSynthesisUtterance) => {
          setTimeout(() => {
            if (utterance.onerror) {
              const event = { error: 'network' } as SpeechSynthesisErrorEvent;
              utterance.onerror(event);
            }
          }, 0);
        }
      );

      await expect(speak('你好')).rejects.toThrow('TTS error: network');
    });

    it('resolves gracefully on interrupted/canceled errors', async () => {
      (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (utterance: SpeechSynthesisUtterance) => {
          setTimeout(() => {
            if (utterance.onerror) {
              const event = { error: 'interrupted' } as SpeechSynthesisErrorEvent;
              utterance.onerror(event);
            }
          }, 0);
        }
      );

      // Should resolve without throwing
      await expect(speak('你好')).resolves.toBeUndefined();
    });
  });

  describe('speakRepeat()', () => {
    it('calls speak multiple times', async () => {
      // Make speak call onend immediately (synchronous mock)
      (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (utterance: SpeechSynthesisUtterance) => {
          // Trigger onend synchronously so the loop advances
          if (utterance.onend) {
            utterance.onend(new Event('end') as SpeechSynthesisEvent);
          }
        }
      );

      // Use real timers but with small repeat count to keep test fast
      await speakRepeat('你好', 2, 1.0);

      // speak should be called 2 times (once per repeat)
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
    });

    it('stops repeating when stop() is called', async () => {
      let callCount = 0;
      (mockSpeechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
        (utterance: SpeechSynthesisUtterance) => {
          callCount++;
          // After first speak, call stop
          if (callCount === 1) {
            stop();
          }
          if (utterance.onend) {
            utterance.onend(new Event('end') as SpeechSynthesisEvent);
          }
        }
      );

      await speakRepeat('你好', 5, 1.0);

      // Should have stopped after first call due to stop()
      expect(callCount).toBe(1);
    });
  });

  describe('stop()', () => {
    it('calls speechSynthesis.cancel()', () => {
      stop();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('getTTSState()', () => {
    it('returns state reflecting availability', () => {
      const state = getTTSState(0.75);
      expect(state.isAvailable).toBe(true);
      expect(state.currentSpeed).toBe(0.75);
      expect(state.isPlaying).toBe(false);
    });
  });
});
