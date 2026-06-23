import Dexie, { type Table } from 'dexie';

// ============================================================
// Entity Interfaces
// ============================================================

export interface VocabularyWord {
  id?: number;
  hanzi: string;
  pinyin: string;
  tone: number[];
  meaning: string;
  koreanPronunciation: string;
  isFavorite: boolean;
  tags: string[];
  hskLevel: number | null;
  createdAt: Date;
  lastStudiedAt: Date | null;
  studyCount: number;
}

export type CardType =
  | 'meaning-to-hanzi'
  | 'hanzi-to-meaning'
  | 'pinyin-to-hanzi'
  | 'audio-to-hanzi';

export interface FlashCard {
  id?: number;
  wordId: number;
  cardType: CardType;
  intervalDays: number;
  nextReviewDate: Date;
  studyCount: number;
  easyCount: number;
  normalCount: number;
  hardCount: number;
  lastStudiedAt: Date | null;
  createdAt: Date;
}

export interface DailyStatRecord {
  date: string; // YYYY-MM-DD
  totalStudyCount: number;
  totalWritingCount: number;
  totalPronunciationCount: number;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

export type StudyEventType = 'flashcard' | 'writing' | 'pronunciation';

export interface StudyEvent {
  id?: number;
  wordId: number;
  type: StudyEventType;
  date: string; // YYYY-MM-DD
  timestamp: Date;
}

// ============================================================
// Database Class
// ============================================================

export class AppDatabase extends Dexie {
  vocabulary!: Table<VocabularyWord>;
  flashcards!: Table<FlashCard>;
  dailyStats!: Table<DailyStatRecord>;
  settings!: Table<SettingsRecord>;
  studyEvents!: Table<StudyEvent>;

  constructor() {
    super('ChineseLearningKeyboard');
    this.version(1).stores({
      vocabulary:
        '++id, &hanzi, *tags, hskLevel, isFavorite, createdAt, lastStudiedAt',
      flashcards: '++id, wordId, cardType, nextReviewDate, createdAt',
      dailyStats: '&date',
      settings: 'key',
      studyEvents: '++id, wordId, type, date',
    });
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const db = new AppDatabase();
