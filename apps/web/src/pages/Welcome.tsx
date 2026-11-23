import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brand, Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { setLang } from '../i18n';

export function Welcome() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="shell">
      <main className="page plain">
        <div className="top"><div className="spacer" />
          <div className="seg" role="group" aria-label="Language" style={{ width: 130 }}>
            {(['en', 'fr'] as const).map((l) => (
              <button key={l} aria-pressed={i18n.language === l} onClick={() => setLang(l)} style={{ padding: 6 }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="hero">
          <Logo size={96} />
          <h1><Brand /></h1>
          <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 18, marginTop: 8 }}>{t('welcome.tagline')}</p>
          <p>{t('welcome.sub')}</p>
        </div>
        <div className="steps"><div>① {t('welcome.learn')}</div><div>② {t('welcome.prove')}</div><div>③ {t('welcome.build')}</div></div>
        <Link className="btn" to="/signup">{t('welcome.create')}</Link>
        <Link className="btn ghost" to="/login">{t('welcome.login')}</Link>
        <p className="sub" style={{ textAlign: 'center', marginTop: 18 }}>{t('welcome.prototype')}</p>
      </main>
    </div>
  );
}
