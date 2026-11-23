import { useTranslation } from 'react-i18next';
import { fmtTime } from '../lib/format';

export interface ActivityItem { id: string; t: number; type: string; data: Record<string, unknown> }

export function Feed({ items }: { items: ActivityItem[] }) {
  const { t, i18n } = useTranslation();
  const text = (a: ActivityItem) => {
    const d = { ...a.data } as Record<string, unknown>;
    if (typeof d.domain === 'string') d.domain = t(`domains.${d.domain}`);
    if (typeof d.rank === 'string') d.rank = t(`ranks.${d.rank}`);
    return t(`activity.${a.type}`, d);
  };
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id}><span>{text(a)}</span><time>{fmtTime(a.t, i18n.language)}</time></li>
      ))}
    </ul>
  );
}
