import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { fmtTime } from '../lib/format';

interface N { id: string; t: number; type: string; data: Record<string, unknown>; read: boolean }

export function Notifications() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<N[] | null>(null);
  const load = () => api<N[]>('/notifications').then(setItems).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);

  const label = (n: N) => {
    if (n.type === 'announcement') { const txt = n.data.text as Record<string, string> | undefined; return txt?.[i18n.language] || txt?.en || t('notifications.announcement'); }
    const d = { ...n.data } as Record<string, unknown>;
    if (typeof d.rank === 'string') d.rank = t(`ranks.${d.rank}`);
    return t(`notifications.${n.type}`, d);
  };

  return (
    <main className="page">
      <div className="row"><Link className="iconbtn" to="/" aria-label={t('common.back')}><Icon name="back" /></Link><h1>{t('notifications.title')}</h1></div>
      <div className="card" style={{ marginTop: 14 }}>
        {!items ? <p className="sub">{t('common.loading')}</p> : items.length === 0 ? <p className="sub">{t('notifications.empty')}</p> : (
          <ul className="feed">
            {items.map((n) => <li key={n.id} style={{ fontWeight: n.read ? 500 : 700 }}><span>{label(n)}</span><time>{fmtTime(n.t, i18n.language)}</time></li>)}
          </ul>
        )}
      </div>
      {!!items?.some((n) => !n.read) && <button className="btn ghost" onClick={() => void api('/notifications/read', { body: {} }).then(load)}>{t('notifications.markRead')}</button>}
    </main>
  );
}
