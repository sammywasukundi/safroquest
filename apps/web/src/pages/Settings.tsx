import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { walletFromPhrase } from '@safroquest/shared';
import { PinField, useVaultMessage } from '../components/Pin';
import { api, type PublicUser } from '../lib/api';
import { useAuth } from '../lib/auth';
import { shortAddr } from '../lib/format';
import { setLang } from '../i18n';
import { applyTheme, type Accent, type ThemeMode } from '../lib/theme';
import { createVault, unlockVault, vaultInfo } from '../lib/vault';

const ACCENTS: { id: Accent; color: string }[] = [
  { id: 'sky', color: '#0EA5E9' }, { id: 'mint', color: '#10B981' }, { id: 'lavender', color: '#8B5CF6' }, { id: 'sun', color: '#F59E0B' },
];

export function Settings() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const vaultMsg = useVaultMessage();
  const { user, setUser, logout, lock, signer } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;

  const patch = async (body: Partial<PublicUser>) => { setUser(await api<PublicUser>('/me', { method: 'PATCH', body })); };
  const hasLocalVault = vaultInfo()?.address === user.address;

  const changePin = async () => {
    setMsg('');
    if (newPin.length < 6) return setMsg(t('auth.pinShort'));
    try {
      const phrase = await unlockVault(oldPin);
      const words = phrase.split(' ').length === 24 ? 24 : 12;
      await createVault(phrase, newPin, walletFromPhrase(phrase).address, words);
      setOldPin(''); setNewPin(''); setMsg(t('settings.pinChanged'));
    } catch (e) { setMsg(vaultMsg(e)); }
  };

  const exportData = async () => {
    const data = await api<unknown>('/me/export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'safroquest-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const del = async () => { await api('/me', { method: 'DELETE' }); await logout(); nav('/welcome', { replace: true }); };

  return (
    <main className="page">
      <h1>{t('nav.settings')}</h1>

      <h2>{t('settings.account')}</h2>
      <div className="card">
        <div className="row between"><b>{user.username}</b><span className="chip">{user.walletKind}</span></div>
        <p className="sub" style={{ wordBreak: 'break-all' }}>{shortAddr(user.address)}</p>
      </div>

      <h2>{t('settings.language')}</h2>
      <div className="seg">
        {(['en', 'fr'] as const).map((l) => (
          <button key={l} aria-pressed={i18n.language === l} onClick={() => { setLang(l); void patch({ locale: l }); }}>{l === 'en' ? 'English' : 'Français'}</button>
        ))}
      </div>

      <h2>{t('settings.theme')}</h2>
      <div className="seg">
        {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
          <button key={m} aria-pressed={user.theme === m} onClick={() => { applyTheme(m, user.accent); void patch({ theme: m }); }}>
            {t(`settings.theme${m[0]!.toUpperCase()}${m.slice(1)}`)}
          </button>
        ))}
      </div>
      <h2>{t('settings.accent')}</h2>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button key={a.id} className="swatch" style={{ background: a.color }} aria-pressed={user.accent === a.id}
            aria-label={t(`settings.accent${a.id[0]!.toUpperCase()}${a.id.slice(1)}`)}
            onClick={() => { applyTheme(user.theme, a.id); void patch({ accent: a.id }); }} />
        ))}
      </div>

      <h2>{t('settings.security')}</h2>
      <div className="card">
        {hasLocalVault ? (
          <>
            <h3>{t('settings.changePin')}</h3>
            <PinField value={oldPin} onChange={setOldPin} label={t('settings.oldPin')} />
            <PinField value={newPin} onChange={setNewPin} label={t('settings.newPin')} />
            {msg && <p className={msg === t('settings.pinChanged') ? 'ok' : 'err'} role="status">{msg}</p>}
            <button className="btn ghost" disabled={!oldPin || !newPin} onClick={() => void changePin()}>{t('settings.changePin')}</button>
          </>
        ) : <p className="sub">{t('wallet.external', { wallet: user.walletKind })}</p>}
        {signer?.kind === 'embedded' && <button className="btn ghost" onClick={lock}>{t('settings.lockNow')}</button>}
      </div>

      <h2>{t('settings.notifications')}</h2>
      <div className="card">
        {([['inApp', 'inApp'], ['reminders', 'reminders'], ['community', 'communityNotifs']] as const).map(([k, label]) => (
          <label className="toggle" key={k} style={{ marginBottom: 0 }}>
            <span>{t(`settings.${label}`)}</span>
            <input type="checkbox" checked={user.notifPrefs[k]} onChange={(e) => void patch({ notifPrefs: { ...user.notifPrefs, [k]: e.target.checked } })} />
          </label>
        ))}
        <p className="sub" style={{ marginTop: 8 }}>{t('settings.notifNote')}</p>
      </div>

      <h2>{t('settings.privacy')}</h2>
      <div className="card">
        <button className="btn ghost" onClick={() => void exportData()}>{t('settings.export')}</button>
        {deleting ? (
          <div style={{ marginTop: 12 }}>
            <p className="sub">{t('settings.deleteWarn')}</p>
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label={t('auth.username')} />
            <button className="btn danger" style={{ marginTop: 10 }} disabled={confirmName !== user.username} onClick={() => void del()}>{t('settings.delete')}</button>
          </div>
        ) : <button className="btn danger" onClick={() => setDeleting(true)}>{t('settings.delete')}</button>}
      </div>

      {user.role === 'admin' && <Link className="btn ghost" style={{ marginTop: 12 }} to="/admin">{t('settings.admin')}</Link>}
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => void logout().then(() => nav('/welcome', { replace: true }))}>{t('settings.signOut')}</button>
      <p className="sub" style={{ textAlign: 'center', marginTop: 18 }}>SafroQuest v0.1 · MIT · {t('settings.about')}</p>
    </main>
  );
}
