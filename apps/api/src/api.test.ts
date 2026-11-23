import { describe, expect, it } from 'vitest';
import { generatePhrase, signArbitrary, walletFromPhrase, HISTORY_WINDOW } from '@safroquest/shared';
import { buildApp } from './app.ts';
import { pickQuestion, shuffledOrder } from './engine.ts';

const origin = { origin: 'http://localhost:5173' };

async function signIn(app: ReturnType<typeof buildApp>, username: string, phrase = generatePhrase(12)) {
  const w = walletFromPhrase(phrase);
  const ch = await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: origin, payload: { address: w.address } });
  const { message } = ch.json() as { message: string };
  const s = signArbitrary(w.privateKey, w.address, message);
  const res = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: origin, payload: { address: w.address, message, pubKey: s.pub_key.value, signature: s.signature, username } });
  return { res, w, message, s };
}

describe('question engine', () => {
  const pool = Array.from({ length: 17 }, (_, i) => ({ id: `q${i}` }));
  it('never repeats a question within the last 10 draws', () => {
    const history: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const { question } = pickQuestion(pool, history);
      expect(history.slice(-HISTORY_WINDOW)).not.toContain(question.id);
      history.push(question.id);
    }
  });
  it('shrinks the window when the pool is small', () => {
    const small = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const h: string[] = [];
    for (let i = 0; i < 50; i++) { const r = pickQuestion(small, h); expect(h[h.length - 1]).not.toBe(r.question.id); h.push(r.question.id); }
    expect(pickQuestion([{ id: 'only' }], ['only']).question.id).toBe('only');
  });
  it('shuffles answer positions as a permutation', () => {
    const o = shuffledOrder(4);
    expect([...o].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('API', () => {
  it('signs up, plays, and levels up', async () => {
    const app = buildApp({ dbFile: null, config: { devAdmin: true } });
    const { res } = await signIn(app, 'sammy');
    expect(res.statusCode).toBe(200);
    const { token, user } = res.json() as { token: string; user: { role: string; level: number } };
    expect(user.role).toBe('admin'); // first account in dev
    expect(user.level).toBe(1);
    const auth = { authorization: `Bearer ${token}`, ...origin };

    let totalXp = 0;
    for (let i = 0; i < 8; i++) {
      const q = (await app.inject({ method: 'POST', url: '/api/quests/next', headers: auth })).json() as { qid: string; options: string[]; text: string };
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      // cheat through the stored question to answer correctly
      const stored = (await app.inject({ method: 'GET', url: '/api/admin/questions', headers: auth })).json() as { id: string; options: { en: string[] }; correct: number }[];
      const sq = stored.find((x) => x.id === q.qid)!;
      const choice = q.options.indexOf(sq.options.en[sq.correct]!);
      const a = (await app.inject({ method: 'POST', url: '/api/quests/answer', headers: auth, payload: { qid: q.qid, choice } })).json() as { correct: boolean; xpGained: number };
      expect(a.correct).toBe(true);
      totalXp += a.xpGained;
    }
    const dash = (await app.inject({ method: 'GET', url: '/api/dashboard', headers: auth })).json() as { xp: number; level: number; streak: number; daily: { claimed: boolean } };
    expect(dash.xp).toBe(totalXp);
    expect(totalXp).toBe(8 * 20 + 30); // 8 correct + one daily bonus
    expect(dash.level).toBeGreaterThanOrEqual(4);
    expect(dash.streak).toBe(1);
    expect(dash.daily.claimed).toBe(true);
  });

  it('rejects replayed, tampered and unsigned sign-ins', async () => {
    const app = buildApp({ dbFile: null });
    const { w, message, s } = await signIn(app, 'alice');
    const replay = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: origin, payload: { address: w.address, message, pubKey: s.pub_key.value, signature: s.signature } });
    expect(replay.statusCode).toBe(401); // challenge already used

    const other = walletFromPhrase(generatePhrase(24));
    const ch = (await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: origin, payload: { address: other.address } })).json() as { message: string };
    const forged = signArbitrary(w.privateKey, other.address, ch.message);
    const r = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: origin, payload: { address: other.address, message: ch.message, pubKey: forged.pub_key.value, signature: forged.signature, username: 'mallory' } });
    expect(r.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: origin, payload: { address: 'cosmos1abc' } })).statusCode).toBe(400);
  });

  it('asks for a username on first sign-in and blocks duplicates', async () => {
    const app = buildApp({ dbFile: null });
    const p = generatePhrase(12);
    const w = walletFromPhrase(p);
    const ch = (await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: origin, payload: { address: w.address } })).json() as { message: string };
    const s = signArbitrary(w.privateKey, w.address, ch.message);
    const noName = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: origin, payload: { address: w.address, message: ch.message, pubKey: s.pub_key.value, signature: s.signature } });
    expect(noName.json()).toEqual({ error: 'NO_ACCOUNT' });
    expect((await signIn(app, 'bob')).res.statusCode).toBe(200);
    expect((await signIn(app, 'BOB')).res.statusCode).toBe(409);
  });

  it('keeps the back-office for admins and validates new quests', async () => {
    const app = buildApp({ dbFile: null, config: { devAdmin: true } });
    const a = (await signIn(app, 'admin1')).res.json() as { token: string };
    const p = (await signIn(app, 'player1')).res.json() as { token: string; user: { role: string } };
    expect(p.user.role).toBe('player');
    const as = (t: string) => ({ authorization: `Bearer ${t}`, ...origin });
    expect((await app.inject({ method: 'GET', url: '/api/admin/stats', headers: as(p.token) })).statusCode).toBe(403);
    const good = { domain: 'cosmos', rank: 'cosmonaut', difficulty: 2, status: 'published', text: { en: 'What is IBC used for?' }, options: { en: ['Connecting chains', 'Mining', 'Printing'] }, correct: 0 };
    const created = await app.inject({ method: 'POST', url: '/api/admin/questions', headers: as(a.token), payload: good });
    expect(created.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/admin/questions', headers: as(a.token), payload: { ...good, correct: 9 } })).statusCode).toBe(400);
    const stats = (await app.inject({ method: 'GET', url: '/api/admin/stats', headers: as(a.token) })).json() as { questions: { published: number } };
    expect(stats.questions.published).toBe(18);
  });

  it('approves a translation contribution and grants XP', async () => {
    const app = buildApp({ dbFile: null, config: { devAdmin: true } });
    const a = (await signIn(app, 'admin1')).res.json() as { token: string };
    const p = (await signIn(app, 'player1')).res.json() as { token: string };
    const as = (t: string) => ({ authorization: `Bearer ${t}`, ...origin });
    const task = (await app.inject({ method: 'GET', url: '/api/contrib/task', headers: as(p.token) })).json() as { id: string };
    expect((await app.inject({ method: 'POST', url: '/api/contrib/submit', headers: as(p.token), payload: { taskId: task.id, text: 'Ne partagez jamais votre phrase secrète.' } })).statusCode).toBe(200);
    const pending = (await app.inject({ method: 'GET', url: '/api/admin/contributions', headers: as(a.token) })).json() as { id: string }[];
    expect(pending).toHaveLength(1);
    await app.inject({ method: 'POST', url: `/api/admin/contributions/${pending[0]!.id}/review`, headers: as(a.token), payload: { approve: true } });
    const d = (await app.inject({ method: 'GET', url: '/api/dashboard', headers: as(p.token) })).json() as { xp: number };
    expect(d.xp).toBe(30);
    const n = (await app.inject({ method: 'GET', url: '/api/notifications', headers: as(p.token) })).json() as { type: string }[];
    expect(n[0]!.type).toBe('contribution');
  });
});
