// ============================================================
// Stroke Viewer Service
// hanzi-writer library wrapper for stroke order animations
// ============================================================

import HanziWriter from 'hanzi-writer';

// ============================================================
// Types & Interfaces
// ============================================================

export interface StrokeViewerOptions {
  character: string;
  container: HTMLElement;
  speed: 'normal' | 'slow';
  mode: 'auto' | 'step' | 'repeat';
}

export interface StrokeState {
  currentStroke: number;
  totalStrokes: number;
  isPlaying: boolean;
}

export interface HanziWriterInstance {
  writer: HanziWriter;
  state: StrokeState;
  options: StrokeViewerOptions;
  _repeatTimer: ReturnType<typeof setTimeout> | null;
  _stopped: boolean;
}

// ============================================================
// Speed Configuration
// ============================================================

/** Default speed: strokeAnimationSpeed=1, delayBetweenStrokes=300 */
const NORMAL_SPEED_OPTIONS = {
  strokeAnimationSpeed: 1,
  delayBetweenStrokes: 300,
};

/** Slow speed: 50% of default (strokeAnimationSpeed=2 means slower animation, doubled delay) */
const SLOW_SPEED_OPTIONS = {
  strokeAnimationSpeed: 0.5,
  delayBetweenStrokes: 600,
};

// ============================================================
// Core Functions
// ============================================================

/**
 * Create a HanziWriter instance with the specified options.
 *
 * - Initializes hanzi-writer on the given container with the character.
 * - Configures speed (normal or slow) based on StrokeViewerOptions.
 * - Mode determines playback behavior (auto, step, or repeat).
 *
 * @param options - Configuration for the stroke viewer.
 * @returns A HanziWriterInstance wrapping the writer and state.
 */
export function createStrokeViewer(options: StrokeViewerOptions): HanziWriterInstance {
  const speedConfig = options.speed === 'slow' ? SLOW_SPEED_OPTIONS : NORMAL_SPEED_OPTIONS;

  const writer = HanziWriter.create(options.container, options.character, {
    width: options.container.clientWidth || 300,
    height: options.container.clientHeight || 300,
    padding: 5,
    showOutline: true,
    showCharacter: false,
    strokeAnimationSpeed: speedConfig.strokeAnimationSpeed,
    delayBetweenStrokes: speedConfig.delayBetweenStrokes,
    strokeColor: '#333333',
    outlineColor: '#DDDDDD',
    drawingColor: '#333333',
  });

  const instance: HanziWriterInstance = {
    writer,
    state: {
      currentStroke: 0,
      totalStrokes: 0,
      isPlaying: false,
    },
    options,
    _repeatTimer: null,
    _stopped: false,
  };

  // Load character data to get total strokes
  writer.getCharacterData().then((character) => {
    if (character) {
      instance.state.totalStrokes = character.strokes.length;
    }
  });

  return instance;
}

/**
 * Animate the full character stroke by stroke (auto playback).
 * In repeat mode, the animation restarts after a 1-second delay until stopped.
 *
 * @param instance - The HanziWriterInstance to animate.
 */
export async function animateCharacter(instance: HanziWriterInstance): Promise<void> {
  instance.state.isPlaying = true;
  instance.state.currentStroke = 0;
  instance._stopped = false;

  if (instance.options.mode === 'repeat') {
    await animateWithRepeat(instance);
  } else {
    await instance.writer.animateCharacter();
    instance.state.isPlaying = false;
    if (instance.state.totalStrokes > 0) {
      instance.state.currentStroke = instance.state.totalStrokes;
    }
  }
}

/**
 * Animate the next stroke in step mode.
 * Advances the current stroke counter by one and animates that single stroke.
 *
 * @param instance - The HanziWriterInstance to advance.
 */
export async function animateNextStroke(instance: HanziWriterInstance): Promise<void> {
  if (instance.state.currentStroke >= instance.state.totalStrokes) {
    return;
  }

  instance.state.isPlaying = true;

  await instance.writer.animateStroke(instance.state.currentStroke);
  instance.state.currentStroke += 1;

  instance.state.isPlaying = false;
}

/**
 * Pause the current animation.
 * Stops the animation at the current state, preserving drawn strokes.
 *
 * @param instance - The HanziWriterInstance to pause.
 */
export function pauseAnimation(instance: HanziWriterInstance): void {
  instance._stopped = true;
  instance.state.isPlaying = false;

  // Clear any pending repeat timer
  if (instance._repeatTimer !== null) {
    clearTimeout(instance._repeatTimer);
    instance._repeatTimer = null;
  }

  instance.writer.pauseAnimation();
}

/**
 * Reset the animation back to initial state.
 * Hides the character and shows only the outline.
 *
 * @param instance - The HanziWriterInstance to reset.
 */
export function resetAnimation(instance: HanziWriterInstance): void {
  instance._stopped = true;
  instance.state.isPlaying = false;
  instance.state.currentStroke = 0;

  // Clear any pending repeat timer
  if (instance._repeatTimer !== null) {
    clearTimeout(instance._repeatTimer);
    instance._repeatTimer = null;
  }

  instance.writer.hideCharacter();
  instance.writer.showOutline();
}

/**
 * Check if a given character has stroke data available in hanzi-writer.
 *
 * @param character - The Chinese character to check.
 * @returns true if stroke data is available, false otherwise.
 */
export function isCharacterSupported(character: string): boolean {
  // hanzi-writer.loadCharacterData is async, but for a synchronous check
  // we use a try-catch around a flag-based approach.
  // Since the actual check is async, we provide both sync (optimistic) and async versions.
  // For the synchronous version, we check basic validity (single CJK character).
  if (!character || character.length !== 1) {
    return false;
  }

  const code = character.charCodeAt(0);

  // CJK Unified Ideographs: U+4E00 to U+9FFF
  // CJK Unified Ideographs Extension A: U+3400 to U+4DBF
  // CJK Compatibility Ideographs: U+F900 to U+FAFF
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff)
  );
}

/**
 * Async version of character support check using hanzi-writer's data loader.
 * Attempts to load character data and resolves to true if successful.
 *
 * @param character - The Chinese character to check.
 * @returns Promise resolving to true if stroke data exists, false otherwise.
 */
export async function isCharacterSupportedAsync(character: string): Promise<boolean> {
  if (!character || character.length !== 1) {
    return false;
  }

  try {
    const data = await HanziWriter.loadCharacterData(character);
    return data !== null && data !== undefined;
  } catch {
    return false;
  }
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Handles repeat mode: animates, waits 1 second, then restarts until stopped.
 */
async function animateWithRepeat(instance: HanziWriterInstance): Promise<void> {
  while (!instance._stopped) {
    instance.state.currentStroke = 0;

    await instance.writer.animateCharacter();

    if (instance._stopped) break;

    if (instance.state.totalStrokes > 0) {
      instance.state.currentStroke = instance.state.totalStrokes;
    }

    // Wait 1 second before restarting
    await new Promise<void>((resolve) => {
      instance._repeatTimer = setTimeout(() => {
        instance._repeatTimer = null;
        resolve();
      }, 1000);
    });

    if (instance._stopped) break;

    // Reset character for next loop
    await instance.writer.hideCharacter();
    instance.state.currentStroke = 0;
  }

  instance.state.isPlaying = false;
}
