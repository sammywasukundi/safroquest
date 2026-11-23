import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isValidPhrase, normalizePhrase, walletFromPhrase } from '@safroquest/shared';
import { Brand, Logo } from '../components/Logo';
import { PinField, useVaultMessage } from '../components/Pin';
import { WalletPicker } from '../components/WalletPicker';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { createVault, vaultInfo } from '../lib/vault';
import { embeddedSigner, type Signer } from '../lib/wallets';

export function Login() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const vaultMsg = useVaultMessage();
  const { authenticate, unlock, vaultPresent, refreshVault } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [pin2, setPin2] = useState('');
  const [pending, setPending] = useState<Signer | null>(null);
  const [username, setUsername] = useState('');

  /** Signs in; if the wallet has no account yet, asks for a username and retries. */
  const enter = async (s: Signer, name?: string) => {
    try {
      await authenticate(s, name ? { username: name } : {});
      nav('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_ACCOUNT') { setPending(s); setError(''); return; }
      if (e instanceof ApiError && e.code === 'rate_limited') setError(t('auth.rate'));
      else if (e instanceof ApiError && e.code === 'username_taken') setError(t('auth.usernameTaken'));
      else if (e instanceof ApiError && e.code === 'username_invalid') setError(t('auth.usernameInvalid'));
      else if (e instanceof ApiError && e.code.startsWith('challenge')) setError(t('auth.challenge'));
      else setError(t('common.error'));
      throw e;
    }
  };

  const unlockAndEnter = async () => {
    setBusy(true); setError('');
    try { const s = await unlock(pin); await enter(s); } catch (e) { if (!(e instanceof ApiError)) { setError(vaultMsg(e)); refreshVault(); } } finally { setBusy(false); }
  };

  const restoreAndEnter = async () => {
    if (!isValidPhrase(phrase)) return setError(t('auth.invalidPhrase'));
    if (pin.length < 6) return setError(t('auth.pinShort'));
    if (pin !== pin2) return setError(t('auth.pinMismatch'));
    setBusy(true); setError('');
    try {
      const p = normalizePhrase(phrase);
      await createVault(p, pin, walletFromPhrase(p).address, p.split(' ').length === 24 ? 24 : 12);
      refreshVault();
      await enter(embeddedSigner(p));
    } catch (e) { if (!(e instanceof ApiError)) setError(t('common.error')); } finally { setBusy(false); }
  };

  return (
    <div className="shell">
      <main className="page plain">
        <div className="top"><Logo size={32} /><Brand /></div>
        <h1>{t('auth.loginTitle')}</h1>

        {pending ? (
          <div className="stack" style={{ marginTop: 16 }}>
            <p>{t('auth.noAccount')}</p>
            <div className="field">
              <label htmlFor="u">{t('auth.username')}</label>
              <input id="u" value={username} maxLength={20} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} />
            </div>
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn" disabled={busy} onClick={() => { setBusy(true); void enter(pending, username).catch(() => undefined).finally(() => setBusy(false)); }}>{t('auth.createAccount')}</button>
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 16 }}>
            {vaultPresent && !restore && (
              <div className="card">
                <p className="sub" style={{ wordBreak: 'break-all' }}>{vaultInfo()?.address}</p>
                <PinField value={pin} onChange={setPin} label={t('auth.pin')} autoFocus />
                <button className="btn" disabled={busy || !pin} onClick={() => void unlockAndEnter()}>{busy ? t('common.loading') : t('auth.unlock')}</button>
              </div>
            )}

            {restore ? (
              <div className="card">
                <h3>{t('auth.restore')}</h3>
                <p className="sub">{t('auth.restoreHelp')}</p>
                <div className="field"><textarea rows={3} autoCapitalize="none" autoComplete="off" value={phrase} onChange={(e) => setPhrase(e.target.value)} aria-label={t('auth.restore')} /></div>
                <PinField value={pin} onChange={setPin} label={t('auth.pin')} />
                <PinField value={pin2} onChange={setPin2} label={t('auth.pinConfirm')} />
                <button className="btn" disabled={busy} onClick={() => void restoreAndEnter()}>{busy ? t('common.loading') : t('auth.restoreAction')}</button>
                <button className="link" onClick={() => setRestore(false)}>{t('common.back')}</button>
              </div>
            ) : (
              <button className="btn ghost" onClick={() => { setRestore(true); setPin(''); setError(''); }}>{t('auth.restore')}</button>
            )}

            {!restore && (<><h2>{t('auth.external')}</h2><WalletPicker onSigner={(s) => enter(s)} /></>)}
            {error && <p className="err" role="alert">{error}</p>}
            <p className="sub">{t('auth.newHere')} <Link to="/signup">{t('welcome.create')}</Link></p>
          </div>
        )}
      </main>
    </div>
  );
}
