import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DOMAINS, RANK_IDS } from '@safroquest/shared';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Stats { users: number; answered: number; accuracy: number | null; questions: { published: number; draft: number; total: number }; pendingContributions: number }
interface Q { id: string; domain: string; rank: string; status: string; text: { en: string }; origin: string; version: number }
interface C { id: string; username: string; taskId: string; text: string }

const blank = { textEn: '', textFr: '', optsEn: '', optsFr: '', correct: '1', domain: 'fundamentals', rank: 'explorer', difficulty: '1', status: 'published', explEn: '', srcLabel: '', srcUrl: '' };

export function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [cs, setCs] = useState<C[]>([]);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState('');
  const [an, setAn] = useState({ en: '', fr: '' });

  const load = () => {
    void api<Stats>('/admin/stats').then(setStats);
    void api<Q[]>('/admin/questions').then(setQs);
    void api<C[]>('/admin/contributions').then(setCs);
  };
  useEffect(() => { if (user?.role === 'admin') load(); }, [user?.role]);

  if (user?.role !== 'admin') return <main className="page"><p className="err">{t('admin.forbidden')}</p></main>;
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const add = async (e: FormEvent) => {
    e.preventDefault(); setMsg('');
    const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    try {
      await api('/admin/questions', { body: {
        domain: f.domain, rank: f.rank, difficulty: Number(f.difficulty), status: f.status,
        text: { en: f.textEn, fr: f.textFr }, options: { en: lines(f.optsEn), fr: lines(f.optsFr) },
        correct: Number(f.correct) - 1, explanation: { en: f.explEn }, source: { label: f.srcLabel || 'Manual', url: f.srcUrl || undefined },
      } });
      setF(blank); setMsg(t('admin.saved')); load();
    } catch (err) { setMsg(String((err as Error).message)); }
  };
  const setStatus = async (q: Q, status: string) => { await api(`/admin/questions/${q.id}`, { method: 'PUT', body: { status } }); load(); };

  return (
    <main className="page">
      <div className="row"><Link className="iconbtn" to="/settings" aria-label={t('common.back')}><Icon name="back" /></Link><h1>{t('admin.title')}</h1></div>

      <h2>{t('admin.stats')}</h2>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.users}</b><span>{t('admin.players')}</span></div>
          <div className="stat"><b>{stats.answered}</b><span>{t('admin.answers')}</span></div>
          <div className="stat"><b>{stats.accuracy ?? '–'}{stats.accuracy !== null && '%'}</b><span>{t('admin.accuracy')}</span></div>
          <div className="stat"><b>{stats.questions.published}</b><span>{t('admin.published')}</span></div>
          <div className="stat"><b>{stats.questions.draft}</b><span>{t('admin.drafts')}</span></div>
          <div className="stat"><b>{stats.pendingContributions}</b><span>{t('admin.pending')}</span></div>
        </div>
      )}

      <h2>{t('admin.contributions')}</h2>
      <div className="card">
        {cs.length === 0 ? <p className="sub">{t('admin.noPending')}</p> : cs.map((c) => (
          <div key={c.id} style={{ marginBottom: 12 }}>
            <p className="sub">{c.username} · {c.taskId}</p><p>{c.text}</p>
            <div className="row">
              <button className="btn small" onClick={() => void api(`/admin/contributions/${c.id}/review`, { body: { approve: true } }).then(load)}>{t('admin.approve')}</button>
              <button className="btn small ghost" onClick={() => void api(`/admin/contributions/${c.id}/review`, { body: { approve: false } }).then(load)}>{t('admin.reject')}</button>
            </div>
          </div>
        ))}
      </div>

      <h2>{t('admin.add')}</h2>
      <form className="card" onSubmit={(e) => void add(e)}>
        <div className="field"><label htmlFor="te">{t('admin.textEn')}</label><textarea id="te" rows={2} required value={f.textEn} onChange={set('textEn')} /></div>
        <div className="field"><label htmlFor="tf">{t('admin.textFr')}</label><textarea id="tf" rows={2} value={f.textFr} onChange={set('textFr')} /></div>
        <div className="field"><label htmlFor="oe">{t('admin.optionsEn')}</label><textarea id="oe" rows={4} required value={f.optsEn} onChange={set('optsEn')} /></div>
        <div className="field"><label htmlFor="of">{t('admin.optionsFr')}</label><textarea id="of" rows={4} value={f.optsFr} onChange={set('optsFr')} /></div>
        <div className="field"><label htmlFor="co">{t('admin.correct')}</label><input id="co" type="number" min={1} max={6} value={f.correct} onChange={set('correct')} /></div>
        <div className="field"><label htmlFor="do">{t('admin.domain')}</label><select id="do" value={f.domain} onChange={set('domain')}>{DOMAINS.map((d) => <option key={d} value={d}>{t(`domains.${d}`)}</option>)}</select></div>
        <div className="field"><label htmlFor="ra">{t('admin.rank')}</label><select id="ra" value={f.rank} onChange={set('rank')}>{RANK_IDS.map((r) => <option key={r} value={r}>{t(`ranks.${r}`)}</option>)}</select></div>
        <div className="field"><label htmlFor="di">{t('admin.difficulty')}</label><input id="di" type="number" min={1} max={5} value={f.difficulty} onChange={set('difficulty')} /></div>
        <div className="field"><label htmlFor="st">{t('admin.status')}</label><select id="st" value={f.status} onChange={set('status')}><option value="draft">{t('admin.draft')}</option><option value="published">{t('admin.publish')}</option></select></div>
        <div className="field"><label htmlFor="ex">{t('admin.explanation')}</label><textarea id="ex" rows={2} value={f.explEn} onChange={set('explEn')} /></div>
        <div className="field"><label htmlFor="sl">{t('admin.sourceLabel')}</label><input id="sl" value={f.srcLabel} onChange={set('srcLabel')} /></div>
        <div className="field"><label htmlFor="su">{t('admin.sourceUrl')}</label><input id="su" type="url" value={f.srcUrl} onChange={set('srcUrl')} /></div>
        {msg && <p className={msg === t('admin.saved') ? 'ok' : 'err'} role="status">{msg}</p>}
        <button className="btn" type="submit">{t('admin.save')}</button>
      </form>

      <h2>{t('admin.announce')}</h2>
      <div className="card">
        <div className="field"><label htmlFor="ae">{t('admin.announceEn')}</label><textarea id="ae" rows={2} value={an.en} onChange={(e) => setAn({ ...an, en: e.target.value })} /></div>
        <div className="field"><label htmlFor="af">{t('admin.announceFr')}</label><textarea id="af" rows={2} value={an.fr} onChange={(e) => setAn({ ...an, fr: e.target.value })} /></div>
        <button className="btn" disabled={an.en.trim().length < 3} onClick={() => void api('/admin/announcements', { body: an }).then(() => setAn({ en: '', fr: '' }))}>{t('admin.send')}</button>
      </div>

      <h2>{t('admin.list')}</h2>
      <div className="card">
        <table className="table"><tbody>
          {qs.map((q) => (
            <tr key={q.id}>
              <td><b>{q.text.en}</b><br /><span className="sub">{q.id} · {t(`domains.${q.domain}`)} · {t(`ranks.${q.rank}`)} · v{q.version} · {q.origin}</span></td>
              <td><span className={q.status === 'published' ? 'chip on' : 'chip'}>{q.status}</span><br />
                <button className="link" onClick={() => void setStatus(q, q.status === 'published' ? 'draft' : 'published')}>{q.status === 'published' ? t('admin.unpublish') : t('admin.toggle')}</button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </main>
  );
}
