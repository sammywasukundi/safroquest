import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brand, Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Feed, type ActivityItem } from '../components/Feed';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Dash {
  xp: number; level: number; xpInLevel: number; xpPerLevel: number; rank: string; nextRank: string | null; streak: number;
  answered: number; accuracy: number | null; daily: { correct: number; goal: number; claimed: boolean };
  activity: ActivityItem[]; unread: number; announcements: { id: string; text: Record<string, string> }[];
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api<Dash>('/dashboard').then(setD).catch(() => setErr(true)); }, []);

  if (!user) return null;
  const C = 2 * Math.PI * 40;
  const pct = d ? d.xpInLevel / d.xpPerLevel : 0;

  return (
    <main className="page">
      <div className="top">
        <Logo size={32} /><Brand /><div className="spacer" />
        <Link className="iconbtn" to="/notifications" aria-label={t('notifications.title')}>
          <Icon name="bell" />
          {!!d?.unread && <span className="badge">{d.unread}</span>}
        </Link>
      </div>
      <h1>{t('home.hello', { name: user.username })}</h1>
      {err && <p className="err">{t('common.error')}</p>}
      {!d && !err && <p className="sub">{t('common.loading')}</p>}
      {d && (
        <>
          <div className="card row" style={{ marginTop: 14, gap: 16 }}>
            <div className="ring" role="img" aria-label={t('home.levelLine', { level: d.level, xp: d.xp })}>
              <svg width="96" height="96" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--tint)" strokeWidth="10" />
                <circle className="v" cx="50" cy="50" r="40" fill="none" stroke="var(--ac)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
              </svg>
              <div className="lvl">{d.level}</div>
            </div>
            <div className="grow">
              <h3>{t(`ranks.${d.rank}`)}</h3>
              <p className="sub">{t('home.levelLine', { level: d.level, xp: d.xp })}</p>
              <div className="bar" aria-hidden="true"><i style={{ width: `${pct * 100}%` }} /></div>
              <p className="sub" style={{ marginTop: 4 }}>{t('home.toNext', { xp: d.xpInLevel, per: d.xpPerLevel, next: d.level + 1 })}</p>
            </div>
          </div>

          <div className="stats">
            <div className="stat"><b>{d.streak}</b><span>{d.streak ? t('home.streak', { count: d.streak }) : t('home.noStreak')}</span></div>
            <div className="stat"><b>{d.accuracy === null ? '–' : `${d.accuracy}%`}</b><span>{t('home.accuracy')}</span></div>
            <div className="stat"><b>{d.answered}</b><span>{t('home.answered')}</span></div>
          </div>

          <div className="card">
            <h3>{t('home.daily')}</h3>
            {d.daily.claimed ? <p className="ok">{t('home.dailyDone')}</p> : (
              <>
                <p className="sub">{t('home.dailyGoal', { goal: d.daily.goal, done: d.daily.correct })}</p>
                <div className="bar" aria-hidden="true"><i style={{ width: `${(d.daily.correct / d.daily.goal) * 100}%` }} /></div>
              </>
            )}
            <Link className="btn" style={{ marginTop: 12 }} to="/play">{t('home.continue')}</Link>
          </div>

          <div className="card tint">
            <h3>{t('home.nextBoss')}</h3>
            <p style={{ margin: '4px 0' }}>{t(`boss.${d.rank}`)}</p>
            <p className="sub">{t('home.bossNote')}</p>
          </div>

          {d.announcements.length > 0 && (
            <>
              <h2>{t('home.announcements')}</h2>
              {d.announcements.map((a) => <div className="card" key={a.id}>{a.text[i18n.language] || a.text.en}</div>)}
            </>
          )}

          <h2>{t('home.activity')}</h2>
          <div className="card">
            {d.activity.length ? <Feed items={d.activity} /> : <p className="sub">{t('home.noActivity')}</p>}
          </div>
        </>
      )}
    </main>
  );
}
