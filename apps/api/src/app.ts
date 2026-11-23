import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  CHAIN, DAILY_GOAL, DOMAINS, LOCALES, RANK_IDS, XP_CONTRIBUTION, XP_CORRECT, XP_DAILY_BONUS,
  isValidAddress, levelFromXp, rankIndexFromLevel, usafToSaf, verifyArbitrary, XP_PER_LEVEL,
  type Locale,
} from '@safroquest/shared';
import { config as defaultConfig, type Config } from './config.ts';
import { Db, type Question, type User } from './db.ts';
import { pickQuestion, shuffledOrder } from './engine.ts';

declare module 'fastify' {
  interface FastifyRequest { user?: User }
}

const CONTRIB_TASKS = [
  'Never share your seed phrase with anyone.',
  'A testnet lets you practise with tokens that have no real value.',
  'Your private key proves that you own your address.',
  'Fees pay validators and discourage spam.',
  'Always check the website address before signing a message.',
].map((source, i) => ({ id: `t-${i + 1}`, source, targetLocale: 'fr' as const }));

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const pickLocale = (l: unknown): Locale => (LOCALES as readonly string[]).includes(l as string) ? (l as Locale) : 'en';
const str = (v: unknown, min: number, max: number): string | null => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null);

export function publicUser(u: User) {
  return {
    id: u.id, username: u.username, address: u.address, walletKind: u.walletKind, role: u.role,
    locale: u.locale, theme: u.theme, accent: u.accent, xp: u.xp, level: levelFromXp(u.xp),
    createdAt: u.createdAt, notifPrefs: u.notifPrefs, backupConfirmed: u.backupConfirmed,
  };
}

export interface BuildOptions { config?: Partial<Config>; dbFile?: string | null }

export function buildApp(opts: BuildOptions = {}) {
  const config: Config = { ...defaultConfig, ...opts.config };
  const seed = JSON.parse(fs.readFileSync(config.seedFile, 'utf8')) as Question[];
  const db = new Db(opts.dbFile === undefined ? config.dbFile : opts.dbFile, seed);
  const S = db.state;
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  // --- helpers -------------------------------------------------------------
  const hits = new Map<string, number[]>();
  const limited = (key: string, max: number) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    hits.set(key, arr);
    return arr.length > max;
  };
  const notify = (u: User, type: User['notifications'][number]['type'], data: Record<string, unknown> = {}) => {
    if (!u.notifPrefs.inApp) return;
    u.notifications.unshift({ id: db.nextId('n'), t: Date.now(), type, data, read: false });
    u.notifications.length = Math.min(u.notifications.length, 50);
  };
  const log = (u: User, type: User['activity'][number]['type'], data: Record<string, unknown> = {}) => {
    u.activity.unshift({ id: db.nextId('a'), t: Date.now(), type, data });
    u.activity.length = Math.min(u.activity.length, 50);
  };
  const gain = (u: User, xp: number) => {
    const before = levelFromXp(u.xp);
    u.xp += xp;
    const after = levelFromXp(u.xp);
    const levelUp = after > before;
    const rankUp = rankIndexFromLevel(after) > rankIndexFromLevel(before);
    if (levelUp) { log(u, 'level', { level: after }); notify(u, 'level_up', { level: after }); }
    if (rankUp) { const rank = RANK_IDS[rankIndexFromLevel(after)]; log(u, 'rank', { rank }); notify(u, 'rank_up', { rank }); }
    return { levelUp, rankUp, level: after, rank: RANK_IDS[rankIndexFromLevel(after)]! };
  };
  const needAuth = (req: FastifyRequest, reply: FastifyReply): User | null => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const s = token ? S.sessions[token] : undefined;
    if (!s || s.expires < Date.now()) { void reply.code(401).send({ error: 'unauthorized' }); return null; }
    const u = S.users[s.userId];
    if (!u) { void reply.code(401).send({ error: 'unauthorized' }); return null; }
    req.user = u;
    return u;
  };
  const needAdmin = (req: FastifyRequest, reply: FastifyReply): User | null => {
    const u = needAuth(req, reply);
    if (!u) return null;
    if (u.role !== 'admin') { void reply.code(403).send({ error: 'forbidden' }); return null; }
    return u;
  };
  const bad = (reply: FastifyReply, error: string, code = 400) => reply.code(code).send({ error });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;

  // --- public --------------------------------------------------------------
  app.get('/api/health', async () => ({ ok: true, questions: S.questions.filter((q) => q.status === 'published').length }));
  app.get('/api/announcements', async () => S.announcements.slice(0, 5));

  // --- auth: wallet challenge / signature ---------------------------------
  app.post('/api/auth/challenge', async (req, reply) => {
    if (limited(`ch:${req.ip}`, 30)) return bad(reply, 'rate_limited', 429);
    const address = str(body(req).address, 10, 100);
    if (!address || !isValidAddress(address)) return bad(reply, 'invalid_address');
    const domain = new URL(req.headers.origin ?? 'http://localhost').host;
    const now = Date.now();
    const message = [
      'SafroQuest sign-in',
      `Domain: ${domain}`,
      `Address: ${address}`,
      `Nonce: ${randomBytes(16).toString('hex')}`,
      `Issued: ${new Date(now).toISOString()}`,
      `Expires: ${new Date(now + config.challengeMs).toISOString()}`,
    ].join('\n');
    S.challenges[address] = { message, domain, expires: now + config.challengeMs };
    db.save();
    return { message };
  });

  app.post('/api/auth/verify', async (req, reply) => {
    if (limited(`vf:${req.ip}`, 30)) return bad(reply, 'rate_limited', 429);
    const b = body(req);
    const address = str(b.address, 10, 100);
    const message = typeof b.message === 'string' ? b.message : '';
    const pubKey = typeof b.pubKey === 'string' ? b.pubKey : '';
    const signature = typeof b.signature === 'string' ? b.signature : '';
    if (!address) return bad(reply, 'invalid_address');
    const ch = S.challenges[address];
    if (!ch || ch.expires < Date.now() || ch.message !== message) return bad(reply, 'challenge_invalid', 401);
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== ch.domain) return bad(reply, 'domain_mismatch', 401);
    if (!verifyArbitrary({ signer: address, message, pubKey, signature })) return bad(reply, 'bad_signature', 401);
    delete S.challenges[address]; // one use only: replaying the same signature fails

    let user = Object.values(S.users).find((u) => u.address === address);
    if (!user) {
      const username = str(b.username, 3, 20);
      if (!username) return bad(reply, 'NO_ACCOUNT', 404);
      if (!/^[A-Za-z0-9_]+$/.test(username)) return bad(reply, 'username_invalid');
      if (Object.values(S.users).some((u) => u.username.toLowerCase() === username.toLowerCase())) return bad(reply, 'username_taken', 409);
      const first = Object.keys(S.users).length === 0;
      user = {
        id: db.nextId('u'), username, address, walletKind: typeof b.walletKind === 'string' ? b.walletKind.slice(0, 20) : 'unknown',
        role: config.adminAddresses.includes(address) || (config.devAdmin && first) ? 'admin' : 'player',
        createdAt: new Date().toISOString(), locale: pickLocale(b.locale), theme: 'system', accent: 'sky',
        xp: 0, answered: 0, correct: 0, history: [], streak: 0, daily: { day: today(), correct: 0, claimed: false },
        activity: [], notifications: [], notifPrefs: { inApp: true, reminders: true, community: true }, backupConfirmed: b.backupConfirmed === true,
      };
      S.users[user.id] = user;
      log(user, 'welcome');
    }
    const token = randomBytes(32).toString('base64url');
    S.sessions[token] = { userId: user.id, expires: Date.now() + config.sessionDays * 86_400_000 };
    db.save();
    return { token, user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (!needAuth(req, reply)) return;
    delete S.sessions[(req.headers.authorization ?? '').replace(/^Bearer /, '')];
    db.save();
    return { ok: true };
  });

  // --- me ------------------------------------------------------------------
  app.get('/api/me', async (req, reply) => { const u = needAuth(req, reply); if (u) return publicUser(u); });

  app.patch('/api/me', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const b = body(req);
    if (b.locale !== undefined) u.locale = pickLocale(b.locale);
    if (['system', 'light', 'dark'].includes(b.theme as string)) u.theme = b.theme as User['theme'];
    if (['sky', 'mint', 'lavender', 'sun'].includes(b.accent as string)) u.accent = b.accent as User['accent'];
    if (b.backupConfirmed === true) u.backupConfirmed = true;
    if (b.notifPrefs && typeof b.notifPrefs === 'object') {
      const p = b.notifPrefs as Record<string, unknown>;
      for (const k of ['inApp', 'reminders', 'community'] as const) if (typeof p[k] === 'boolean') u.notifPrefs[k] = p[k] as boolean;
    }
    db.save();
    return publicUser(u);
  });

  app.get('/api/me/export', async (req, reply) => { const u = needAuth(req, reply); if (u) return { exportedAt: new Date().toISOString(), user: u, contributions: S.contributions.filter((c) => c.userId === u.id) }; });

  app.delete('/api/me', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    delete S.users[u.id];
    for (const [t, s] of Object.entries(S.sessions)) if (s.userId === u.id) delete S.sessions[t];
    S.contributions = S.contributions.filter((c) => c.userId !== u.id);
    db.save();
    return { ok: true };
  });

  // --- dashboard -----------------------------------------------------------
  app.get('/api/dashboard', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const level = levelFromXp(u.xp);
    const ri = rankIndexFromLevel(level);
    const day = today();
    const daily = u.daily.day === day ? u.daily : { day, correct: 0, claimed: false };
    return {
      xp: u.xp, level, xpInLevel: u.xp % XP_PER_LEVEL, xpPerLevel: XP_PER_LEVEL,
      rank: RANK_IDS[ri], nextRank: RANK_IDS[ri + 1] ?? null,
      streak: u.lastDay === day || u.lastDay === yesterday() ? u.streak : 0,
      answered: u.answered, correct: u.correct,
      accuracy: u.answered ? Math.round((u.correct / u.answered) * 100) : null,
      daily: { correct: daily.correct, goal: DAILY_GOAL, claimed: daily.claimed },
      activity: u.activity.slice(0, 15),
      unread: u.notifications.filter((n) => !n.read).length,
      announcements: S.announcements.slice(0, 3),
    };
  });

  // --- quests --------------------------------------------------------------
  const localize = (q: Question, locale: Locale) => ({
    text: q.text[locale] || q.text.en,
    options: q.options[locale]?.length === q.options.en.length ? q.options[locale] : q.options.en,
    explanation: q.explanation[locale] || q.explanation.en,
  });

  app.post('/api/quests/next', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const pool = S.questions.filter((q) => q.status === 'published');
    if (!pool.length) return bad(reply, 'no_questions', 503);
    const { question, excluded, candidates } = pickQuestion(pool, u.history);
    const order = shuffledOrder(question.options.en.length);
    u.pending = { qid: question.id, order };
    db.save();
    const l = localize(question, u.locale);
    return {
      qid: question.id, domain: question.domain, rank: question.rank, source: question.source,
      text: l.text, options: order.map((i) => l.options[i]), meter: { excluded, candidates, pool: pool.length },
    };
  });

  app.post('/api/quests/answer', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const b = body(req);
    const p = u.pending;
    if (!p || p.qid !== b.qid) return bad(reply, 'no_pending_question', 409);
    const choice = Number(b.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= p.order.length) return bad(reply, 'invalid_choice');
    const q = S.questions.find((x) => x.id === p.qid);
    if (!q) return bad(reply, 'question_gone', 410);
    u.pending = undefined;
    const correct = p.order[choice] === q.correct;
    const correctIndex = p.order.indexOf(q.correct);
    u.answered += 1;
    u.history.push(q.id);
    if (u.history.length > 200) u.history.splice(0, u.history.length - 200);

    const day = today();
    if (u.lastDay !== day) { u.streak = u.lastDay === yesterday() ? u.streak + 1 : 1; u.lastDay = day; }
    if (u.daily.day !== day) u.daily = { day, correct: 0, claimed: false };

    let xpGained = 0;
    let level = levelFromXp(u.xp);
    let levelUp = false, rankUp = false, dailyBonus = false;
    if (correct) {
      u.correct += 1;
      u.daily.correct += 1;
      xpGained += XP_CORRECT;
      const r = gain(u, XP_CORRECT);
      levelUp = r.levelUp; rankUp = r.rankUp; level = r.level;
      log(u, 'xp', { xp: XP_CORRECT, domain: q.domain });
      if (u.daily.correct >= DAILY_GOAL && !u.daily.claimed) {
        u.daily.claimed = true;
        dailyBonus = true;
        xpGained += XP_DAILY_BONUS;
        const r2 = gain(u, XP_DAILY_BONUS);
        levelUp = levelUp || r2.levelUp; rankUp = rankUp || r2.rankUp; level = r2.level;
        log(u, 'daily', { xp: XP_DAILY_BONUS }); notify(u, 'daily', { xp: XP_DAILY_BONUS });
      }
    }
    db.save();
    const l = localize(q, u.locale);
    return {
      correct, correctIndex, explanation: l.explanation, source: q.source, xpGained, level, levelUp, rankUp, dailyBonus,
      xp: u.xp, daily: { correct: u.daily.correct, goal: DAILY_GOAL },
    };
  });

  // --- community -----------------------------------------------------------
  app.get('/api/leaderboard', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const all = Object.values(S.users).sort((a, b) => b.xp - a.xp || a.createdAt.localeCompare(b.createdAt));
    const row = (x: User, i: number) => ({ position: i + 1, username: x.username, level: levelFromXp(x.xp), xp: x.xp, rank: RANK_IDS[rankIndexFromLevel(levelFromXp(x.xp))], me: x.id === u.id });
    return { top: all.slice(0, 20).map(row), me: row(u, all.findIndex((x) => x.id === u.id)) };
  });

  app.get('/api/contrib/task', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const done = new Set(S.contributions.filter((c) => c.userId === u.id).map((c) => c.taskId));
    return CONTRIB_TASKS.find((t) => !done.has(t.id)) ?? null;
  });

  app.post('/api/contrib/submit', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    const b = body(req);
    const text = str(b.text, 3, 400);
    const task = CONTRIB_TASKS.find((t) => t.id === b.taskId);
    if (!text || !task) return bad(reply, 'invalid_contribution');
    if (S.contributions.some((c) => c.userId === u.id && c.taskId === task.id)) return bad(reply, 'already_submitted', 409);
    S.contributions.push({ id: db.nextId('c'), userId: u.id, username: u.username, taskId: task.id, text, status: 'pending', t: Date.now() });
    db.save();
    return { ok: true };
  });

  // --- notifications -------------------------------------------------------
  app.get('/api/notifications', async (req, reply) => { const u = needAuth(req, reply); if (u) return u.notifications; });
  app.post('/api/notifications/read', async (req, reply) => {
    const u = needAuth(req, reply); if (!u) return;
    u.notifications.forEach((n) => { n.read = true; });
    db.save();
    return { ok: true };
  });

  // --- chain (proxy avoids browser CORS problems) --------------------------
  app.get('/api/chain/balance/:address', async (req, reply) => {
    if (!needAuth(req, reply)) return;
    const { address } = req.params as { address: string };
    if (!isValidAddress(address)) return bad(reply, 'invalid_address');
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`${config.chainRest}/cosmos/bank/v1beta1/balances/${address}`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) return bad(reply, 'chain_error', 502);
      const j = (await r.json()) as { balances?: { denom: string; amount: string }[] };
      const usaf = j.balances?.find((x) => x.denom === CHAIN.denom)?.amount ?? '0';
      return { usaf, saf: usafToSaf(usaf) };
    } catch {
      return bad(reply, 'chain_unreachable', 502);
    }
  });

  // --- admin ---------------------------------------------------------------
  const validQuestion = (b: Record<string, unknown>): Omit<Question, 'id' | 'version' | 'origin'> | string => {
    const text = b.text as Record<string, unknown> | undefined;
    const options = b.options as Record<string, unknown> | undefined;
    const explanation = (b.explanation ?? {}) as Record<string, unknown>;
    if (!text || !options) return 'invalid_question';
    const en = str(text.en, 5, 300);
    const enOpts = Array.isArray(options.en) ? (options.en as unknown[]).map((o) => str(o, 1, 200)) : [];
    if (!en || enOpts.length < 2 || enOpts.length > 6 || enOpts.some((o) => !o)) return 'invalid_options';
    const correct = Number(b.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= enOpts.length) return 'invalid_correct';
    if (!(DOMAINS as readonly string[]).includes(b.domain as string)) return 'invalid_domain';
    if (!(RANK_IDS as readonly string[]).includes(b.rank as string)) return 'invalid_rank';
    const frOpts = Array.isArray(options.fr) && (options.fr as unknown[]).length === enOpts.length ? (options.fr as unknown[]).map((o) => str(o, 1, 200) ?? '') : [];
    const source = (b.source ?? {}) as Record<string, unknown>;
    return {
      domain: b.domain as Question['domain'], rank: b.rank as Question['rank'], type: 'mcq',
      difficulty: Math.min(5, Math.max(1, Number(b.difficulty) || 1)) as Question['difficulty'],
      text: { en, fr: str(text.fr, 5, 300) ?? '' }, options: { en: enOpts as string[], fr: frOpts.every(Boolean) ? frOpts : [] },
      correct, explanation: { en: str(explanation.en, 0, 400) ?? '', fr: str(explanation.fr, 0, 400) ?? '' },
      source: { label: str(source.label, 1, 80) ?? 'Manual', url: str(source.url, 8, 300) ?? undefined },
      status: ['draft', 'published', 'archived'].includes(b.status as string) ? (b.status as Question['status']) : 'draft',
    };
  };

  app.get('/api/admin/questions', async (req, reply) => { if (needAdmin(req, reply)) return S.questions; });
  app.post('/api/admin/questions', async (req, reply) => {
    const u = needAdmin(req, reply); if (!u) return;
    const v = validQuestion(body(req));
    if (typeof v === 'string') return bad(reply, v);
    const q: Question = { ...v, id: `q-${String(S.questions.length + 1).padStart(3, '0')}-${db.nextId('x').slice(-4)}`, origin: 'human', version: 1 };
    S.questions.push(q);
    db.save();
    return q;
  });
  app.put('/api/admin/questions/:id', async (req, reply) => {
    if (!needAdmin(req, reply)) return;
    const q = S.questions.find((x) => x.id === (req.params as { id: string }).id);
    if (!q) return bad(reply, 'not_found', 404);
    const v = validQuestion({ ...q, ...body(req) });
    if (typeof v === 'string') return bad(reply, v);
    Object.assign(q, v, { version: q.version + 1 });
    db.save();
    return q;
  });
  app.get('/api/admin/contributions', async (req, reply) => { if (needAdmin(req, reply)) return S.contributions.filter((c) => c.status === 'pending'); });
  app.post('/api/admin/contributions/:id/review', async (req, reply) => {
    if (!needAdmin(req, reply)) return;
    const c = S.contributions.find((x) => x.id === (req.params as { id: string }).id);
    if (!c || c.status !== 'pending') return bad(reply, 'not_found', 404);
    const approve = body(req).approve === true;
    c.status = approve ? 'approved' : 'rejected';
    const u = S.users[c.userId];
    if (u && approve) { gain(u, XP_CONTRIBUTION); log(u, 'contrib', { xp: XP_CONTRIBUTION }); notify(u, 'contribution', { xp: XP_CONTRIBUTION }); }
    db.save();
    return c;
  });
  app.post('/api/admin/announcements', async (req, reply) => {
    if (!needAdmin(req, reply)) return;
    const b = body(req);
    const en = str(b.en, 3, 280);
    if (!en) return bad(reply, 'invalid_text');
    const a = { id: db.nextId('an'), t: Date.now(), text: { en, fr: str(b.fr, 3, 280) ?? en } };
    S.announcements.unshift(a);
    S.announcements.length = Math.min(S.announcements.length, 20);
    for (const usr of Object.values(S.users)) if (usr.notifPrefs.community) notify(usr, 'announcement', { text: a.text });
    db.save();
    return a;
  });
  app.get('/api/admin/stats', async (req, reply) => {
    if (!needAdmin(req, reply)) return;
    const users = Object.values(S.users);
    const answered = users.reduce((n, u) => n + u.answered, 0);
    const correct = users.reduce((n, u) => n + u.correct, 0);
    return {
      users: users.length, answered, accuracy: answered ? Math.round((correct / answered) * 100) : null,
      questions: { published: S.questions.filter((q) => q.status === 'published').length, draft: S.questions.filter((q) => q.status === 'draft').length, total: S.questions.length },
      pendingContributions: S.contributions.filter((c) => c.status === 'pending').length,
      byRank: RANK_IDS.map((r) => ({ rank: r, players: users.filter((u) => RANK_IDS[rankIndexFromLevel(levelFromXp(u.xp))] === r).length })),
    };
  });

  return app;
}
