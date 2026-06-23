/**
 * Writing Canvas Service
 *
 * Konva.js 기반 필기 캔버스 서비스.
 * trace(따라 쓰기), blank(빈칸 쓰기), dictation(받아쓰기) 모드를 지원한다.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.6
 */
import Konva from 'konva';

export type WritingMode = 'trace' | 'blank' | 'dictation';

export interface CanvasConfig {
  mode: WritingMode;
  character?: string;         // trace 모드용 가이드 한자
  hint?: string;              // blank 모드용 힌트 (뜻/병음)
  width: number;
  height: number;
}

export interface StrokeData {
  points: { x: number; y: number }[];
  timestamp: number;
}

// Module-level state tracking per stage
const stageState = new WeakMap<Konva.Stage, {
  isDrawing: boolean;
  currentLine: Konva.Line | null;
  strokes: StrokeData[];
  currentPoints: { x: number; y: number }[];
  drawingEnabled: boolean;
  drawingLayer: Konva.Layer;
}>();

/**
 * 캔버스를 초기화한다.
 * - trace 모드: 회색 가이드 한자를 opacity 0.3으로 표시
 * - blank 모드: 상단에 힌트 텍스트(뜻/병음) 표시
 * - dictation 모드: 빈 캔버스 제공
 */
export function initCanvas(container: HTMLDivElement, config: CanvasConfig): Konva.Stage {
  const { mode, character, hint, width, height } = config;

  // Create Konva Stage
  const stage = new Konva.Stage({
    container,
    width,
    height,
  });

  // Background/guide layer
  const guideLayer = new Konva.Layer();
  stage.add(guideLayer);

  // Drawing layer for user strokes
  const drawingLayer = new Konva.Layer();
  stage.add(drawingLayer);

  // Mode-specific setup
  if (mode === 'trace' && character) {
    // Render guide character at opacity 0.3
    const guideText = new Konva.Text({
      x: 0,
      y: 0,
      width,
      height,
      text: character,
      fontSize: Math.min(width, height) * 0.7,
      fontFamily: 'serif',
      fill: '#888888',
      opacity: 0.3,
      align: 'center',
      verticalAlign: 'middle',
    });
    guideLayer.add(guideText);
  } else if (mode === 'blank' && hint) {
    // Render hint text at top in small font
    const hintText = new Konva.Text({
      x: 10,
      y: 10,
      text: hint,
      fontSize: 16,
      fontFamily: 'sans-serif',
      fill: '#666666',
    });
    guideLayer.add(hintText);
  }
  // dictation mode: empty canvas (no guide elements)

  guideLayer.draw();

  // Initialize state for this stage
  const state = {
    isDrawing: false,
    currentLine: null as Konva.Line | null,
    currentPoints: [] as { x: number; y: number }[],
    strokes: [] as StrokeData[],
    drawingEnabled: true,
    drawingLayer,
  };
  stageState.set(stage, state);

  // Setup drawing event handlers
  setupDrawingEvents(stage);

  return stage;
}

/**
 * Setup mouse and touch drawing events on the stage.
 */
function setupDrawingEvents(stage: Konva.Stage): void {
  const state = stageState.get(stage);
  if (!state) return;

  // Start drawing
  const handlePointerDown = () => {
    if (!state.drawingEnabled) return;
    state.isDrawing = true;
    state.currentPoints = [];

    const pos = stage.getPointerPosition();
    if (!pos) return;

    state.currentPoints.push({ x: pos.x, y: pos.y });

    const line = new Konva.Line({
      stroke: 'black',
      strokeWidth: 3,
      lineCap: 'round',
      lineJoin: 'round',
      points: [pos.x, pos.y],
    });

    state.currentLine = line;
    state.drawingLayer.add(line);
  };

  // Continue drawing
  const handlePointerMove = () => {
    if (!state.isDrawing || !state.drawingEnabled) return;

    const pos = stage.getPointerPosition();
    if (!pos || !state.currentLine) return;

    state.currentPoints.push({ x: pos.x, y: pos.y });

    const flatPoints = state.currentPoints.flatMap(p => [p.x, p.y]);
    state.currentLine.points(flatPoints);
    state.drawingLayer.batchDraw();
  };

  // End drawing
  const handlePointerUp = () => {
    if (!state.isDrawing || !state.drawingEnabled) return;
    state.isDrawing = false;

    if (state.currentPoints.length > 0) {
      state.strokes.push({
        points: [...state.currentPoints],
        timestamp: Date.now(),
      });
    }

    state.currentLine = null;
    state.currentPoints = [];
  };

  // Mouse events
  stage.on('mousedown', handlePointerDown);
  stage.on('mousemove', handlePointerMove);
  stage.on('mouseup', handlePointerUp);

  // Touch events
  stage.on('touchstart', handlePointerDown);
  stage.on('touchmove', handlePointerMove);
  stage.on('touchend', handlePointerUp);
}

/**
 * 캔버스를 초기화한다. 모든 사용자 필기를 삭제하고 빈 캔버스로 복원한다.
 * Validates: Requirement 9.6
 */
export function clearCanvas(stage: Konva.Stage): void {
  const state = stageState.get(stage);
  if (!state) return;

  // Destroy all lines on the drawing layer
  state.drawingLayer.destroyChildren();
  state.drawingLayer.draw();

  // Reset stroke data
  state.strokes = [];
  state.currentPoints = [];
  state.currentLine = null;
  state.isDrawing = false;
}

/**
 * 현재까지 그려진 모든 획 데이터를 반환한다.
 */
export function getStrokes(stage: Konva.Stage): StrokeData[] {
  const state = stageState.get(stage);
  if (!state) return [];

  return [...state.strokes];
}

/**
 * 드로잉을 활성화한다.
 */
export function enableDrawing(stage: Konva.Stage): void {
  const state = stageState.get(stage);
  if (!state) return;

  state.drawingEnabled = true;
}

/**
 * 드로잉을 비활성화한다.
 */
export function disableDrawing(stage: Konva.Stage): void {
  const state = stageState.get(stage);
  if (!state) return;

  state.drawingEnabled = false;
  // If currently drawing, stop
  if (state.isDrawing) {
    state.isDrawing = false;
    state.currentLine = null;
    state.currentPoints = [];
  }
}
