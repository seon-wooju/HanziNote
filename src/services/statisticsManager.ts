import { db, type StudyEventType } from '../db/database';

// ============================================================
// Interfaces
// ============================================================

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalStudyCount: number;
  totalWritingCount: number;
  totalPronunciationCount: number;
  wordStats: { wordId: number; hanzi: string; count: number }[];
}

export interface OverallStats {
  totalStudyCount: number;
  totalWritingCount: number;
  totalPronunciationCount: number;
  lastStudiedAt: Date | null;
}

// ============================================================
// Helper Functions
// ============================================================

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// Public API
// ============================================================

/**
 * Record a study activity event and update daily stats.
 * @param type - The type of study activity (flashcard, writing, pronunciation)
 * @param wordId - The ID of the word studied
 */
export async function recordStudyActivity(
  type: StudyEventType,
  wordId: number
): Promise<void> {
  const date = getTodayDateString();
  const timestamp = new Date();

  // 1. Add a StudyEvent record
  await db.studyEvents.add({
    wordId,
    type,
    date,
    timestamp,
  });

  // 2. Update or create the DailyStatRecord for today
  const existing = await db.dailyStats.get(date);

  if (existing) {
    const update: Partial<typeof existing> = {};
    if (type === 'flashcard') {
      update.totalStudyCount = existing.totalStudyCount + 1;
    } else if (type === 'writing') {
      update.totalWritingCount = existing.totalWritingCount + 1;
    } else if (type === 'pronunciation') {
      update.totalPronunciationCount = existing.totalPronunciationCount + 1;
    }
    await db.dailyStats.update(date, update);
  } else {
    await db.dailyStats.put({
      date,
      totalStudyCount: type === 'flashcard' ? 1 : 0,
      totalWritingCount: type === 'writing' ? 1 : 0,
      totalPronunciationCount: type === 'pronunciation' ? 1 : 0,
    });
  }
}

/**
 * Get today's study statistics aggregated by word.
 */
export async function getTodayStats(): Promise<DailyStats> {
  const date = getTodayDateString();

  // Get the DailyStatRecord for today (or defaults)
  const dailyRecord = await db.dailyStats.get(date);
  const totalStudyCount = dailyRecord?.totalStudyCount ?? 0;
  const totalWritingCount = dailyRecord?.totalWritingCount ?? 0;
  const totalPronunciationCount = dailyRecord?.totalPronunciationCount ?? 0;

  // Query all study events for today
  const todayEvents = await db.studyEvents.where('date').equals(date).toArray();

  // Aggregate by wordId
  const wordCountMap = new Map<number, number>();
  for (const event of todayEvents) {
    const current = wordCountMap.get(event.wordId) ?? 0;
    wordCountMap.set(event.wordId, current + 1);
  }

  // Look up hanzi for each wordId from vocabulary table
  const wordStats: { wordId: number; hanzi: string; count: number }[] = [];
  for (const [wordId, count] of wordCountMap) {
    const word = await db.vocabulary.get(wordId);
    const hanzi = word?.hanzi ?? '';
    wordStats.push({ wordId, hanzi, count });
  }

  return {
    date,
    totalStudyCount,
    totalWritingCount,
    totalPronunciationCount,
    wordStats,
  };
}

/**
 * Get overall (all-time) study statistics.
 */
export async function getOverallStats(): Promise<OverallStats> {
  // Sum all DailyStatRecords
  const allDailyStats = await db.dailyStats.toArray();

  let totalStudyCount = 0;
  let totalWritingCount = 0;
  let totalPronunciationCount = 0;

  for (const record of allDailyStats) {
    totalStudyCount += record.totalStudyCount;
    totalWritingCount += record.totalWritingCount;
    totalPronunciationCount += record.totalPronunciationCount;
  }

  // Find the most recent timestamp from studyEvents
  const lastEvent = await db.studyEvents
    .orderBy('id')
    .last();

  const lastStudiedAt = lastEvent?.timestamp ?? null;

  return {
    totalStudyCount,
    totalWritingCount,
    totalPronunciationCount,
    lastStudiedAt,
  };
}
