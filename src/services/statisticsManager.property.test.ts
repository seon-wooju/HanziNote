import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { db, type StudyEventType } from '../db/database';
import {
  recordStudyActivity,
  getTodayStats,
  getOverallStats,
} from './statisticsManager';

/**
 * Property 13: Statistics Accuracy
 *
 * For any sequence of study events recorded for a given date, the daily statistics
 * SHALL correctly reflect the count of each event type (flashcard, writing, pronunciation)
 * per word, and the overall statistics SHALL equal the sum across all dates.
 *
 * Validates: Requirements 11.1, 11.2
 */

// Generator for study event type
const studyEventTypeArb = fc.constantFrom<StudyEventType>(
  'flashcard',
  'writing',
  'pronunciation'
);

// Generator for a single study event: { type, wordId }
const studyEventArb = fc.record({
  type: studyEventTypeArb,
  wordId: fc.integer({ min: 1, max: 10 }),
});

// Generator for a sequence of study events (1-20 events per run)
const studyEventSequenceArb = fc.array(studyEventArb, {
  minLength: 1,
  maxLength: 20,
});

describe('Feature: chinese-learning-keyboard, Property 13: Statistics Accuracy', () => {
  beforeEach(async () => {
    await db.studyEvents.clear();
    await db.dailyStats.clear();
    await db.vocabulary.clear();
  });

  it('daily statistics correctly reflect counts of each event type and per-word counts', async () => {
    await fc.assert(
      fc.asyncProperty(studyEventSequenceArb, async (events) => {
        // Clear DB before each iteration
        await db.studyEvents.clear();
        await db.dailyStats.clear();

        // Record all events
        for (const event of events) {
          await recordStudyActivity(event.type, event.wordId);
        }

        // Compute expected counts
        const expectedFlashcardCount = events.filter(
          (e) => e.type === 'flashcard'
        ).length;
        const expectedWritingCount = events.filter(
          (e) => e.type === 'writing'
        ).length;
        const expectedPronunciationCount = events.filter(
          (e) => e.type === 'pronunciation'
        ).length;

        // Compute expected per-word counts (all event types combined)
        const expectedWordCounts = new Map<number, number>();
        for (const event of events) {
          const current = expectedWordCounts.get(event.wordId) ?? 0;
          expectedWordCounts.set(event.wordId, current + 1);
        }

        // Verify getTodayStats
        const todayStats = await getTodayStats();

        expect(todayStats.totalStudyCount).toBe(expectedFlashcardCount);
        expect(todayStats.totalWritingCount).toBe(expectedWritingCount);
        expect(todayStats.totalPronunciationCount).toBe(
          expectedPronunciationCount
        );

        // Verify per-word stats
        expect(todayStats.wordStats.length).toBe(expectedWordCounts.size);
        for (const [wordId, expectedCount] of expectedWordCounts) {
          const wordStat = todayStats.wordStats.find(
            (w) => w.wordId === wordId
          );
          expect(wordStat).toBeDefined();
          expect(wordStat!.count).toBe(expectedCount);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('overall statistics equal the sum of daily statistics', async () => {
    await fc.assert(
      fc.asyncProperty(studyEventSequenceArb, async (events) => {
        // Clear DB before each iteration
        await db.studyEvents.clear();
        await db.dailyStats.clear();

        // Record all events (all for today since recordStudyActivity uses current date)
        for (const event of events) {
          await recordStudyActivity(event.type, event.wordId);
        }

        // Get today's stats and overall stats
        const todayStats = await getTodayStats();
        const overallStats = await getOverallStats();

        // Since all events are recorded for today, overall should match today's totals
        expect(overallStats.totalStudyCount).toBe(todayStats.totalStudyCount);
        expect(overallStats.totalWritingCount).toBe(
          todayStats.totalWritingCount
        );
        expect(overallStats.totalPronunciationCount).toBe(
          todayStats.totalPronunciationCount
        );
      }),
      { numRuns: 50 }
    );
  });
});
