import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase, db } from './database';
import type {
  VocabularyWord,
  FlashCard,
  DailyStatRecord,
  SettingsRecord,
  StudyEvent,
} from './database';

describe('AppDatabase', () => {
  let testDb: AppDatabase;

  beforeEach(() => {
    testDb = new AppDatabase();
  });

  afterEach(async () => {
    await testDb.delete();
    testDb.close();
  });

  it('should be an instance of AppDatabase', () => {
    expect(testDb).toBeInstanceOf(AppDatabase);
  });

  it('should have the correct database name', () => {
    expect(testDb.name).toBe('ChineseLearningKeyboard');
  });

  it('should have all expected tables', () => {
    expect(testDb.vocabulary).toBeDefined();
    expect(testDb.flashcards).toBeDefined();
    expect(testDb.dailyStats).toBeDefined();
    expect(testDb.settings).toBeDefined();
    expect(testDb.studyEvents).toBeDefined();
  });

  it('should add and retrieve a vocabulary word', async () => {
    const word: VocabularyWord = {
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      tone: [3, 3],
      meaning: '안녕하세요',
      koreanPronunciation: '니하오',
      isFavorite: false,
      tags: ['인사', 'HSK1'],
      hskLevel: 1,
      createdAt: new Date(),
      lastStudiedAt: null,
      studyCount: 0,
    };

    const id = await testDb.vocabulary.add(word);
    const retrieved = await testDb.vocabulary.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.hanzi).toBe('你好');
    expect(retrieved!.pinyin).toBe('nǐ hǎo');
    expect(retrieved!.meaning).toBe('안녕하세요');
    expect(retrieved!.tags).toEqual(['인사', 'HSK1']);
  });

  it('should enforce unique hanzi constraint', async () => {
    const word: VocabularyWord = {
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
    };

    await testDb.vocabulary.add(word);
    await expect(testDb.vocabulary.add({ ...word })).rejects.toThrow();
  });

  it('should add and retrieve a flashcard', async () => {
    const card: FlashCard = {
      wordId: 1,
      cardType: 'meaning-to-hanzi',
      intervalDays: 1,
      nextReviewDate: new Date(),
      studyCount: 0,
      easyCount: 0,
      normalCount: 0,
      hardCount: 0,
      lastStudiedAt: null,
      createdAt: new Date(),
    };

    const id = await testDb.flashcards.add(card);
    const retrieved = await testDb.flashcards.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.wordId).toBe(1);
    expect(retrieved!.cardType).toBe('meaning-to-hanzi');
  });

  it('should add and retrieve daily stats with unique date', async () => {
    const stats: DailyStatRecord = {
      date: '2024-01-15',
      totalStudyCount: 10,
      totalWritingCount: 5,
      totalPronunciationCount: 3,
    };

    await testDb.dailyStats.add(stats);
    const retrieved = await testDb.dailyStats.get('2024-01-15');

    expect(retrieved).toBeDefined();
    expect(retrieved!.totalStudyCount).toBe(10);
  });

  it('should add and retrieve settings by key', async () => {
    const setting: SettingsRecord = {
      key: 'largeFontMode',
      value: true,
    };

    await testDb.settings.add(setting);
    const retrieved = await testDb.settings.get('largeFontMode');

    expect(retrieved).toBeDefined();
    expect(retrieved!.value).toBe(true);
  });

  it('should add and retrieve study events', async () => {
    const event: StudyEvent = {
      wordId: 1,
      type: 'flashcard',
      date: '2024-01-15',
      timestamp: new Date(),
    };

    const id = await testDb.studyEvents.add(event);
    const retrieved = await testDb.studyEvents.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe('flashcard');
    expect(retrieved!.wordId).toBe(1);
  });

  it('should query flashcards by wordId', async () => {
    const cards: FlashCard[] = [
      {
        wordId: 1,
        cardType: 'meaning-to-hanzi',
        intervalDays: 1,
        nextReviewDate: new Date(),
        studyCount: 0,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      },
      {
        wordId: 1,
        cardType: 'hanzi-to-meaning',
        intervalDays: 1,
        nextReviewDate: new Date(),
        studyCount: 0,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      },
      {
        wordId: 2,
        cardType: 'meaning-to-hanzi',
        intervalDays: 1,
        nextReviewDate: new Date(),
        studyCount: 0,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
      },
    ];

    await testDb.flashcards.bulkAdd(cards);
    const word1Cards = await testDb.flashcards
      .where('wordId')
      .equals(1)
      .toArray();

    expect(word1Cards).toHaveLength(2);
  });

  it('should query vocabulary by tags using multi-entry index', async () => {
    const words: VocabularyWord[] = [
      {
        hanzi: '你',
        pinyin: 'nǐ',
        tone: [3],
        meaning: '너',
        koreanPronunciation: '니',
        isFavorite: false,
        tags: ['인사', 'HSK1'],
        hskLevel: 1,
        createdAt: new Date(),
        lastStudiedAt: null,
        studyCount: 0,
      },
      {
        hanzi: '好',
        pinyin: 'hǎo',
        tone: [3],
        meaning: '좋다',
        koreanPronunciation: '하오',
        isFavorite: false,
        tags: ['형용사', 'HSK1'],
        hskLevel: 1,
        createdAt: new Date(),
        lastStudiedAt: null,
        studyCount: 0,
      },
    ];

    await testDb.vocabulary.bulkAdd(words);
    const hsk1Words = await testDb.vocabulary
      .where('tags')
      .equals('HSK1')
      .toArray();

    expect(hsk1Words).toHaveLength(2);

    const greetingWords = await testDb.vocabulary
      .where('tags')
      .equals('인사')
      .toArray();

    expect(greetingWords).toHaveLength(1);
    expect(greetingWords[0]!.hanzi).toBe('你');
  });
});

describe('db singleton', () => {
  it('should export a singleton database instance', () => {
    expect(db).toBeInstanceOf(AppDatabase);
    expect(db.name).toBe('ChineseLearningKeyboard');
  });
});
