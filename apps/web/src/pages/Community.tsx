import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Row { position: number; username: string; level: number; xp: number; rank: string; me: boolean }
interface Task { id: string; source: string; targetLocale: string }
const GROUP = (import.meta.env.VITE_COMMUNITY_URL as string | undefined) ?? '';

export function Community() {
  const { t } = useTranslation();
  const [lb, setLb] = useState<{ top: Row[]; me: Row } | null>(null);
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ top: Row[]; me: Row }>('/leaderboard').then(setLb).catch(() => setError(t('common.error')));
    api<Task | null>('/contrib/task').then(setTask).catch(() => setTask(null));
  }, [t]);

  const submit = async () => {
    if (!task) return;
    try { await api('/contrib/submit', { body: { taskId: task.id, text } }); setThanks(true); setText(''); setTask(null); } catch { setError(t('common.error')); }
  };

  return (
    <main className="page">
      <h1>{t('nav.community')}</h1>
      {error && <p className="err">{error}</p>}

      <h2>{t('community.translateTitle')}</h2>
      <div className="card">
        {thanks ? <p className="ok">{t('community.translateThanks')}</p> : task === undefined ? <p className="sub">{t('common.loading')}</p> : task ? (
          <>
            <p className="sub">{t('community.translateDesc')}</p>
            <p style={{ fontWeight: 700 }}>“{task.source}”</p>
            <div className="field"><textarea rows={3} value={text} maxLength={400} aria-label={t('community.translateTitle')} onChange={(e) => setText(e.target.value)} /></div>
            <button className="btn" disabled={text.trim().length < 3} onClick={() => void submit()}>{t('community.translateAction')}</button>
          </>
        ) : <p className="sub">{t('community.noTask')}</p>}
      </div>

      <h2>{t('community.leaderboard')}</h2>
      <div className="card">
        {lb && (
          <ol className="lb">
            {lb.top.map((r) => (
              <li key={r.position} className={r.me ? 'me' : ''}>
                <span className="pos">{r.position}</span>
                <span className="grow">{r.username}{r.me ? ` (${t('community.you')})` : ''}</span>
                <span className="chip">{t(`ranks.${r.rank}`)}</span>
                <span>{r.xp} XP</span>
              </li>
            ))}
          </ol>
        )}
        {lb && !lb.top.some((r) => r.me) && <p className="sub">#{lb.me.position} · {lb.me.xp} XP</p>}
      </div>

      <h2>{t('community.groupTitle')}</h2>
      <div className="card">
        <p className="sub">{t('community.groupDesc')}</p>
        {GROUP ? <a className="btn" href={GROUP} target="_blank" rel="noreferrer">{t('community.join')}</a> : <p className="sub">{t('community.groupMissing')}</p>}
      </div>
    </main>
  );
}
