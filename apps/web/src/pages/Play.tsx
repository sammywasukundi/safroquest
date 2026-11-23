import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RANK_IDS, RANK_LEVELS, levelFromXp, rankIndexFromLevel } from '@safroquest/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Q { qid: string; domain: string; rank: string; text: string; options: string[]; source: { label: string; url?: string }; meter: { excluded: number; candidates: number; pool: number } }
interface A { correct: boolean; correctIndex: number; explanation: string; source: { label: string; url?: string }; xpGained: number; level: number; levelUp: boolean; rankUp: boolean; dailyBonus: boolean }

export function Play() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [res, setRes] = useState<A | null>(null);
  const [error, setError] = useState('');
  const [xp, setXp] = useState(user?.xp ?? 0);

  useEffect(() => { if (user) setXp(user.xp); }, [user]);

  const load = async () => {
    setError(''); setRes(null); setPicked(null);
    try { setQ(await api<Q>('/quests/next', { body: {} })); } catch { setError(t('play.empty')); }
  };
  const answer = async (i: number) => {
    if (!q || picked !== null) return;
    setPicked(i);
    try {
      const r = await api<A>('/quests/answer', { body: { qid: q.qid, choice: i } });
      setRes(r);
      setXp((x) => x + r.xpGained);
      if (user) setUser({ ...user, xp: user.xp + r.xpGained, level: r.level });
    } catch { setError(t('common.error')); }
  };

  const level = levelFromXp(xp);
  const ri = rankIndexFromLevel(level);

  if (!playing) {
    return (
      <main className="page">
        <h1>{t('nav.play')}</h1>
        <button className="btn" style={{ margin: '16px 0' }} onClick={() => { setPlaying(true); void load(); }}>{t('play.start')}</button>
        <h2>{t('play.pathTitle')}</h2>
        <div className="card">
          <ol className="path">
            {RANK_IDS.map((id, i) => {
              const [from, to] = RANK_LEVELS[id];
              return (
                <li key={id}>
                  <b>{t(`ranks.${id}`)}</b>
                  <span className="sub grow">{to >= 999 ? t('play.levelsOpen', { from }) : t('play.levels', { from, to })}{i === ri ? ` · ${t(`boss.${id}`)}` : ''}</span>
                  <span className={i === ri ? 'chip on' : 'chip'}>{i < ri ? t('play.done') : i === ri ? t('play.current') : t('play.locked')}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="sub">{t('play.bank')}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="row between">
        <button className="link" onClick={() => setPlaying(false)}>← {t('play.exit')}</button>
        {q && <span className="chip on">{t(`domains.${q.domain}`)}</span>}
      </div>
      {error && <p className="err">{error}</p>}
      {q && (
        <div className="card" style={{ marginTop: 10 }}>
          <p className="sub" aria-live="polite">{t('play.meter', q.meter)}</p>
          <div className="q">{q.text}</div>
          {q.options.map((o, i) => {
            const cls = res ? (i === res.correctIndex ? 'opt ok' : i === picked ? 'opt bad' : 'opt') : 'opt';
            return (
              <button key={i} className={cls} disabled={picked !== null} onClick={() => void answer(i)}>
                {o}{res && i === res.correctIndex ? ' ✓' : res && i === picked ? ' ✗' : ''}
              </button>
            );
          })}
          {res && (
            <div aria-live="polite">
              <p className={`fb ${res.correct ? 'ok' : ''}`}>{res.correct ? t('play.correct', { xp: res.xpGained - (res.dailyBonus ? 30 : 0) }) : t('play.wrong')}</p>
              {res.levelUp && <p className="ok">{t('play.levelUp', { level: res.level })}</p>}
              {res.rankUp && <p className="ok">{t('play.rankUp', { rank: t(`ranks.${RANK_IDS[rankIndexFromLevel(res.level)]}`) })}</p>}
              {res.dailyBonus && <p className="ok">{t('play.dailyBonus')}</p>}
              <p>{res.explanation}</p>
              <p className="sub">{t('play.source', { label: res.source.label })}</p>
              <button className="btn" onClick={() => void load()}>{t('play.next')}</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
