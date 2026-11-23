export const XP_PER_LEVEL = 50;
export const XP_CORRECT = 20;
export const XP_DAILY_BONUS = 30;
export const XP_CONTRIBUTION = 30;
export const DAILY_GOAL = 3;
export const HISTORY_WINDOW = 10;

export const RANK_IDS = ['explorer', 'cosmonaut', 'smith', 'builder', 'guardian'] as const;
export type RankId = (typeof RANK_IDS)[number];

/** Inclusive level ranges. The last rank is open-ended. */
export const RANK_LEVELS: Record<RankId, [number, number]> = {
  explorer: [1, 3],
  cosmonaut: [4, 6],
  smith: [7, 9],
  builder: [10, 12],
  guardian: [13, 999],
};

export const levelFromXp = (xp: number): number => Math.floor(xp / XP_PER_LEVEL) + 1;

export const rankIndexFromLevel = (level: number): number => {
  const i = RANK_IDS.findIndex((id) => level >= RANK_LEVELS[id][0] && level <= RANK_LEVELS[id][1]);
  return i < 0 ? RANK_IDS.length - 1 : i;
};

export const rankFromXp = (xp: number): RankId => RANK_IDS[rankIndexFromLevel(levelFromXp(xp))]!;

export const DOMAINS = ['fundamentals', 'wallets', 'cosmos', 'cosmwasm', 'safrochain', 'governance'] as const;
export type Domain = (typeof DOMAINS)[number];
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
