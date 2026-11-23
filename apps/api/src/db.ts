import fs from 'node:fs';
import path from 'node:path';
import type { Domain, Locale, RankId } from '@safroquest/shared';

export type Localized<T> = Record<Locale, T>;

export interface Question {
  id: string;
  domain: Domain;
  rank: RankId;
  type: 'mcq';
  difficulty: 1 | 2 | 3 | 4 | 5;
  text: Localized<string>;
  options: Localized<string[]>;
  correct: number;
  explanation: Localized<string>;
  source: { label: string; url?: string };
  status: 'draft' | 'published' | 'archived';
  origin: 'seed' | 'human' | 'ai';
  version: number;
}

export interface Activity { id: string; t: number; type: 'welcome' | 'xp' | 'level' | 'rank' | 'daily' | 'contrib'; data: Record<string, unknown> }
export interface Notice { id: string; t: number; type: 'level_up' | 'rank_up' | 'daily' | 'contribution' | 'announcement'; data: Record<string, unknown>; read: boolean }

export interface User {
  id: string;
  username: string;
  address: string;
  walletKind: string;
  role: 'player' | 'admin';
  createdAt: string;
  locale: Locale;
  theme: 'system' | 'light' | 'dark';
  accent: 'sky' | 'mint' | 'lavender' | 'sun';
  xp: number;
  answered: number;
  correct: number;
  history: string[];
  pending?: { qid: string; order: number[] };
  streak: number;
  lastDay?: string;
  daily: { day: string; correct: number; claimed: boolean };
  activity: Activity[];
  notifications: Notice[];
  notifPrefs: { inApp: boolean; reminders: boolean; community: boolean };
  backupConfirmed: boolean;
}

export interface Contribution { id: string; userId: string; username: string; taskId: string; text: string; status: 'pending' | 'approved' | 'rejected'; t: number }
export interface Announcement { id: string; t: number; text: Localized<string> }
export interface Challenge { message: string; domain: string; expires: number }

export interface DbState {
  users: Record<string, User>;
  sessions: Record<string, { userId: string; expires: number }>;
  challenges: Record<string, Challenge>;
  questions: Question[];
  contributions: Contribution[];
  announcements: Announcement[];
  counter: number;
}

/**
 * A tiny JSON-file store, good enough for a local V1 and for tests (file = null keeps it in memory).
 * The same shape maps one-to-one to PostgreSQL tables for the production version.
 */
export class Db {
  state: DbState;
  constructor(private file: string | null, seed: Question[]) {
    if (file && fs.existsSync(file)) {
      this.state = JSON.parse(fs.readFileSync(file, 'utf8')) as DbState;
    } else {
      this.state = { users: {}, sessions: {}, challenges: {}, questions: seed, contributions: [], announcements: [], counter: 0 };
      this.save();
    }
  }
  nextId(prefix: string): string {
    this.state.counter += 1;
    return `${prefix}-${String(this.state.counter).padStart(4, '0')}`;
  }
  save(): void {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state));
    fs.renameSync(tmp, this.file);
  }
}
