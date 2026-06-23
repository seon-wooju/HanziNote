// src/services/pronunciationTrainer.ts
// Web Speech Recognition + MediaRecorder API를 사용한 발음 평가 서비스
// Requirements: 7.1, 7.2, 7.3, 7.4

export interface PronunciationResult {
  overallScore: number; // 0-100
  syllableScores: SyllableScore[];
}

export interface SyllableScore {
  expected: string; // 기대 병음
  recognized: string; // 인식된 텍스트
  score: number; // 0-100
}

// Custom error types for UI to catch
export class MicrophonePermissionDeniedError extends Error {
  constructor() {
    super('마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
    this.name = 'MicrophonePermissionDeniedError';
  }
}

export class NoSpeechDetectedError extends Error {
  constructor() {
    super('음성이 감지되지 않았습니다. 다시 녹음해주세요.');
    this.name = 'NoSpeechDetectedError';
  }
}

// Module state
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioChunks: Blob[] = [];
let recordingTimeout: ReturnType<typeof setTimeout> | null = null;
let isRecording = false;

const MAX_RECORDING_DURATION_MS = 60_000; // 60 seconds

/**
 * 마이크 권한 상태를 확인합니다.
 * navigator.permissions.query를 사용하며, 지원하지 않는 브라우저에서는
 * getUserMedia를 시도하여 권한 상태를 판별합니다.
 */
export async function checkMicrophonePermission(): Promise<PermissionState> {
  try {
    // Primary: Use Permissions API
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      return result.state;
    }
  } catch {
    // Permissions API not supported or 'microphone' not recognized
    // Fall through to fallback
  }

  // Fallback: Try getUserMedia to determine permission state
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission was granted - clean up the stream
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'denied';
      }
    }
    // Other errors (e.g., no device) - treat as prompt state
    return 'prompt';
  }
}

/**
 * 마이크 녹음을 시작합니다.
 * - navigator.mediaDevices.getUserMedia로 마이크를 요청합니다.
 * - MediaRecorder를 생성하고 녹음을 시작합니다.
 * - 최대 60초 후 자동으로 녹음을 중지합니다.
 *
 * @throws MicrophonePermissionDeniedError 마이크 권한이 거부된 경우
 */
export async function startRecording(): Promise<void> {
  if (isRecording) {
    return;
  }

  // Reset state
  audioChunks = [];

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new MicrophonePermissionDeniedError();
      }
    }
    throw error;
  }

  mediaRecorder = new MediaRecorder(mediaStream);

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start();
  isRecording = true;

  // Auto-stop after 60 seconds
  recordingTimeout = setTimeout(() => {
    if (isRecording) {
      stopRecording();
    }
  }, MAX_RECORDING_DURATION_MS);
}

/**
 * 녹음을 중지하고 녹음된 오디오 Blob을 반환합니다.
 *
 * @returns 녹음된 오디오 Blob (audio/webm 또는 브라우저 기본 MIME)
 */
export async function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || !isRecording) {
      reject(new Error('녹음이 진행 중이 아닙니다.'));
      return;
    }

    // Clear the auto-stop timeout
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }

    mediaRecorder.onstop = () => {
      isRecording = false;

      // Stop all media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || 'audio/webm',
      });
      audioChunks = [];
      mediaRecorder = null;

      resolve(blob);
    };

    mediaRecorder.onerror = (event) => {
      isRecording = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      reject(new Error(`녹음 중 오류가 발생했습니다: ${(event as ErrorEvent).message || 'unknown error'}`));
    };

    mediaRecorder.stop();
  });
}

/**
 * 녹음된 오디오와 기대 병음을 비교하여 발음 정확도를 평가합니다.
 * Web Speech Recognition API (lang: 'zh-CN')를 사용하여 음성을 텍스트로 변환하고,
 * 인식된 텍스트와 기대 병음을 음절별로 비교하여 점수를 산출합니다.
 *
 * @param _audioBlob 녹음된 오디오 Blob (현재 Web Speech Recognition은 실시간 인식만 지원하므로 직접 사용하지 않음)
 * @param expectedPinyin 기대되는 병음 문자열 (예: "nǐ hǎo")
 * @returns PronunciationResult 음절별 점수 및 전체 점수
 */
export async function evaluatePronunciation(
  _audioBlob: Blob,
  expectedPinyin: string
): Promise<PronunciationResult> {
  const expectedSyllables = expectedPinyin
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0);

  // Use Web Speech Recognition API
  const SpeechRecognitionAPI =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    // Speech Recognition not available - return zero scores
    return createEmptyResult(expectedSyllables);
  }

  return new Promise<PronunciationResult>((resolve) => {
    const recognition = new (SpeechRecognitionAPI as any)();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let hasResult = false;

    recognition.onresult = (event: any) => {
      hasResult = true;
      const transcript = event.results[0]?.[0]?.transcript || '';
      const confidence = event.results[0]?.[0]?.confidence || 0;

      const result = scorePronunciation(transcript, expectedSyllables, confidence);
      resolve(result);
    };

    recognition.onnomatch = () => {
      resolve(createEmptyResult(expectedSyllables));
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        resolve(createEmptyResult(expectedSyllables));
      } else {
        resolve(createEmptyResult(expectedSyllables));
      }
    };

    recognition.onend = () => {
      if (!hasResult) {
        // Recognition ended without result
        resolve(createEmptyResult(expectedSyllables));
      }
    };

    recognition.start();
  });
}

/**
 * 인식된 텍스트와 기대 음절을 비교하여 점수를 산출합니다.
 */
function scorePronunciation(
  transcript: string,
  expectedSyllables: string[],
  confidence: number
): PronunciationResult {
  if (!transcript || transcript.trim().length === 0) {
    return createEmptyResult(expectedSyllables);
  }

  // Split recognized text into characters (Chinese characters are single-char syllables)
  const recognizedChars = transcript.replace(/\s+/g, '').split('');

  const syllableScores: SyllableScore[] = expectedSyllables.map((expected, index) => {
    const recognized = recognizedChars[index] || '';

    if (!recognized) {
      return { expected, recognized: '', score: 0 };
    }

    // Calculate similarity score for this syllable
    const score = calculateSyllableScore(expected, recognized, confidence);
    return { expected, recognized, score };
  });

  // Overall score is the average of all syllable scores
  const overallScore =
    syllableScores.length > 0
      ? Math.round(
          syllableScores.reduce((sum, s) => sum + s.score, 0) / syllableScores.length
        )
      : 0;

  return { overallScore, syllableScores };
}

/**
 * 개별 음절의 발음 점수를 계산합니다.
 * 기대 병음과 인식된 텍스트 사이의 유사도를 기반으로 점수를 산출합니다.
 */
function calculateSyllableScore(
  expected: string,
  recognized: string,
  confidence: number
): number {
  // Normalize strings for comparison
  const normalizedExpected = expected.toLowerCase().trim();
  const normalizedRecognized = recognized.toLowerCase().trim();

  if (normalizedExpected === normalizedRecognized) {
    // Perfect match
    return Math.round(Math.max(85, confidence * 100));
  }

  // Calculate character-level similarity using Levenshtein-based approach
  const similarity = calculateStringSimilarity(normalizedExpected, normalizedRecognized);

  // Weight by recognition confidence
  const weightedScore = similarity * 0.7 + confidence * 100 * 0.3;

  return Math.round(Math.min(100, Math.max(0, weightedScore)));
}

/**
 * 두 문자열 간의 유사도를 0-100으로 계산합니다 (Levenshtein distance 기반).
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);

  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Levenshtein distance (edit distance) 계산
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * 빈 결과를 생성합니다 (발화 미감지 또는 오류 시 사용).
 */
function createEmptyResult(expectedSyllables: string[]): PronunciationResult {
  return {
    overallScore: 0,
    syllableScores: expectedSyllables.map((expected) => ({
      expected,
      recognized: '',
      score: 0,
    })),
  };
}
