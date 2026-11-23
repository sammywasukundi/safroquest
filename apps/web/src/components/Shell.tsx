import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { useAuth } from '../lib/auth';

const TABS = [
  { to: '/', key: 'home', icon: 'home', end: true },
  { to: '/play', key: 'play', icon: 'play' },
  { to: '/community', key: 'community', icon: 'users' },
  { to: '/wallet', key: 'wallet', icon: 'wallet' },
  { to: '/settings', key: 'settings', icon: 'settings' },
] as const;

export function Shell() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div className="shell"><div className="page plain"><p className="sub">{t('common.loading')}</p></div></div>;
  if (!user) return <Navigate to="/welcome" replace />;
  return (
    <div className="shell">
      <Outlet />
      <nav className="tabbar" aria-label="Main">
        <ul>
          {TABS.map((x) => (
            <li key={x.key}>
              <NavLink to={x.to} end={'end' in x}>
                <Icon name={x.icon} />
                {t(`nav.${x.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
