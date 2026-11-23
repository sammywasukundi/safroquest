import { HISTORY_WINDOW } from '@safroquest/shared';

export type Rng = () => number;

export interface PickResult<T> {
  question: T;
  /** How many recently seen questions were excluded from this draw. */
  excluded: number;
  /** How many questions were eligible. */
  candidates: number;
}

/**
 * Draws a question that the player has not seen in their last `window` attempts.
 * If the pool is too small for the full window, the window shrinks so a draw is always possible.
 */
export function pickQuestion<T extends { id: string }>(
  pool: T[],
  history: string[],
  opts: { window?: number; rng?: Rng } = {},
): PickResult<T> {
  if (pool.length === 0) throw new Error('empty question pool');
  const rng = opts.rng ?? Math.random;
  const window = Math.min(opts.window ?? HISTORY_WINDOW, Math.max(0, pool.length - 1));
  // slice(-0) would return the whole history, so handle an empty window explicitly
  const recent = new Set(window === 0 ? [] : history.slice(-window));
  const eligible = pool.filter((q) => !recent.has(q.id));
  const question = eligible[Math.floor(rng() * eligible.length)]!;
  return { question, excluded: pool.length - eligible.length, candidates: eligible.length };
}

/** Fisher-Yates permutation of [0..n-1], so answer positions change every time. */
export function shuffledOrder(n: number, rng: Rng = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
