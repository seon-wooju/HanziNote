import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import {
  recordStudyActivity,
  getTodayStats,
  getOverallStats,
} from './statisticsManager';

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('statisticsManager', () => {
  beforeEach(async () => {
    await db.studyEvents.clear();
    await db.dailyStats.clear();
    await db.vocabulary.clear();
  });

  describe('recordStudyActivity', () => {
    it('should record a flashcard study event', async () => {
      await recordStudyActivity('flashcard', 1);

      const events = await db.studyEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('flashcard');
      expect(events[0].wordId).toBe(1);
      expect(events[0].date).toBe(getTodayDateString());
      expect(events[0].timestamp).toBeInstanceOf(Date);
    });

    it('should record a writing study event', async () => {
      await recordStudyActivity('writing', 2);

      const events = await db.studyEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('writing');
      expect(events[0].wordId).toBe(2);
    });

    it('should record a pronunciation study event', async () => {
      await recordStudyActivity('pronunciation', 3);

      const events = await db.studyEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('pronunciation');
      expect(events[0].wordId).toBe(3);
    });

    it('should create a DailyStatRecord for today on first event', async () => {
      await recordStudyActivity('flashcard', 1);

      const dailyStat = await db.dailyStats.get(getTodayDateString());
      expect(dailyStat).toBeDefined();
      expect(dailyStat!.totalStudyCount).toBe(1);
      expect(dailyStat!.totalWritingCount).toBe(0);
      expect(dailyStat!.totalPronunciationCount).toBe(0);
    });

    it('should increment existing DailyStatRecord counts', async () => {
      await recordStudyActivity('flashcard', 1);
      await recordStudyActivity('flashcard', 2);
      await recordStudyActivity('writing', 1);
      await recordStudyActivity('pronunciation', 3);

      const dailyStat = await db.dailyStats.get(getTodayDateString());
      expect(dailyStat!.totalStudyCount).toBe(2);
      expect(dailyStat!.totalWritingCount).toBe(1);
      expect(dailyStat!.totalPronunciationCount).toBe(1);
    });

    it('should handle multiple events for the same word', async () => {
      await recordStudyActivity('flashcard', 1);
      await recordStudyActivity('flashcard', 1);
      await recordStudyActivity('writing', 1);

      const events = await db.studyEvents.toArray();
      expect(events).toHaveLength(3);
    });
  });

  describe('getTodayStats', () => {
    it('should return all zeros when no data exists', async () => {
      const stats = await getTodayStats();

      expect(stats.date).toBe(getTodayDateString());
      expect(stats.totalStudyCount).toBe(0);
      expect(stats.totalWritingCount).toBe(0);
      expect(stats.totalPronunciationCount).toBe(0);
      expect(stats.wordStats).toHaveLength(0);
    });

    it('should aggregate events by word', async () => {
      // Add vocabulary words so hanzi can be looked up
      const id1 = await db.vocabulary.add({
        hanzi: '你',
        pinyin: 'nǐ',
        tone: [3],
        meaning: '너',
        koreanPronunciation: '니',
        isFavorite: false,
        tags: [],
        hskLevel: 1,
        createdAt: new Date(),
        lastStudiedAt: null,
        studyCount: 0,
      });
      const id2 = await db.vocabulary.add({
        hanzi: '好',
        pinyin: 'hǎo',
        tone: [3],
        meaning: '좋다',
        koreanPronunciation: '하오',
        isFavorite: false,
        tags: [],
        hskLevel: 1,
        createdAt: new Date(),
        lastStudiedAt: null,
        studyCount: 0,
      });

      await recordStudyActivity('flashcard', id1 as number);
      await recordStudyActivity('flashcard', id1 as number);
      await recordStudyActivity('writing', id2 as number);

      const stats = await getTodayStats();

      expect(stats.totalStudyCount).toBe(2);
      expect(stats.totalWritingCount).toBe(1);
      expect(stats.totalPronunciationCount).toBe(0);
      expect(stats.wordStats).toHaveLength(2);

      const word1Stats = stats.wordStats.find((w) => w.wordId === id1);
      expect(word1Stats).toBeDefined();
      expect(word1Stats!.hanzi).toBe('你');
      expect(word1Stats!.count).toBe(2);

      const word2Stats = stats.wordStats.find((w) => w.wordId === id2);
      expect(word2Stats).toBeDefined();
      expect(word2Stats!.hanzi).toBe('好');
      expect(word2Stats!.count).toBe(1);
    });

    it('should return empty hanzi for deleted vocabulary words', async () => {
      await recordStudyActivity('flashcard', 999);

      const stats = await getTodayStats();

      expect(stats.wordStats).toHaveLength(1);
      expect(stats.wordStats[0].wordId).toBe(999);
      expect(stats.wordStats[0].hanzi).toBe('');
      expect(stats.wordStats[0].count).toBe(1);
    });
  });

  describe('getOverallStats', () => {
    it('should return all zeros and null lastStudiedAt when no data exists', async () => {
      const stats = await getOverallStats();

      expect(stats.totalStudyCount).toBe(0);
      expect(stats.totalWritingCount).toBe(0);
      expect(stats.totalPronunciationCount).toBe(0);
      expect(stats.lastStudiedAt).toBeNull();
    });

    it('should sum all daily stats records', async () => {
      // Manually insert daily stats for different days
      await db.dailyStats.put({
        date: '2024-01-01',
        totalStudyCount: 5,
        totalWritingCount: 3,
        totalPronunciationCount: 2,
      });
      await db.dailyStats.put({
        date: '2024-01-02',
        totalStudyCount: 10,
        totalWritingCount: 4,
        totalPronunciationCount: 1,
      });

      const stats = await getOverallStats();

      expect(stats.totalStudyCount).toBe(15);
      expect(stats.totalWritingCount).toBe(7);
      expect(stats.totalPronunciationCount).toBe(3);
    });

    it('should return the most recent timestamp as lastStudiedAt', async () => {
      await recordStudyActivity('flashcard', 1);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordStudyActivity('writing', 2);

      const stats = await getOverallStats();

      expect(stats.lastStudiedAt).toBeInstanceOf(Date);
      // lastStudiedAt should be close to now
      const now = new Date();
      const diff = now.getTime() - stats.lastStudiedAt!.getTime();
      expect(diff).toBeLessThan(5000); // within 5 seconds
    });

    it('should work with recordStudyActivity integration', async () => {
      await recordStudyActivity('flashcard', 1);
      await recordStudyActivity('flashcard', 2);
      await recordStudyActivity('writing', 1);
      await recordStudyActivity('pronunciation', 3);

      const stats = await getOverallStats();

      expect(stats.totalStudyCount).toBe(2);
      expect(stats.totalWritingCount).toBe(1);
      expect(stats.totalPronunciationCount).toBe(1);
      expect(stats.lastStudiedAt).not.toBeNull();
    });
  });
});
