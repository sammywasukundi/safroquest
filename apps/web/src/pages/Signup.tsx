import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generatePhrase, walletFromPhrase, type WordCount } from '@safroquest/shared';
import { Brand, Logo } from '../components/Logo';
import { PinField } from '../components/Pin';
import { WalletPicker } from '../components/WalletPicker';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { createVault } from '../lib/vault';
import { embeddedSigner, type Signer } from '../lib/wallets';

type Step = 'start' | 'length' | 'phrase' | 'verify' | 'pin' | 'wallets';
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export function Signup() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { authenticate, refreshVault } = useAuth();
  const [step, setStep] = useState<Step>('start');
  const [username, setUsername] = useState('');
  const [words, setWords] = useState<WordCount>(12);
  const [phrase, setPhrase] = useState('');
  const [shown, setShown] = useState(true);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => {
    const n = phrase ? phrase.split(' ').length : 12;
    const set = new Set<number>();
    while (set.size < 3) set.add(Math.floor(Math.random() * n));
    return [...set].sort((a, b) => a - b);
  }, [phrase]);

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      setError(e.code === 'username_taken' ? t('auth.usernameTaken') : e.code === 'username_invalid' ? t('auth.usernameInvalid') : e.code === 'rate_limited' ? t('auth.rate') : t('common.error'));
    } else setError(t('common.error'));
  };

  const validName = () => { if (!USERNAME.test(username)) { setError(t('auth.usernameInvalid')); return false; } setError(''); return true; };

  const finishEmbedded = async () => {
    if (pin.length < 6) return setError(t('auth.pinShort'));
    if (pin !== pin2) return setError(t('auth.pinMismatch'));
    setBusy(true); setError('');
    try {
      const w = walletFromPhrase(phrase);
      await createVault(phrase, pin, w.address, words);
      refreshVault();
      await authenticate(embeddedSigner(phrase), { username, backupConfirmed: true });
      nav('/', { replace: true });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const finishExternal = async (s: Signer) => {
    try { await authenticate(s, { username }); nav('/', { replace: true }); } catch (e) { fail(e); throw e instanceof Error ? e : new Error('failed'); }
  };

  return (
    <div className="shell">
      <main className="page plain">
        <div className="top"><Logo size={32} /><Brand /></div>
        <h1>{t('auth.createTitle')}</h1>

        {step === 'start' && (
          <div className="stack" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="u">{t('auth.username')}</label>
              <input id="u" value={username} maxLength={20} autoComplete="username" autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} />
              <span className="sub">{t('auth.usernameHelp')}</span>
            </div>
            <h2>{t('auth.chooseMethod')}</h2>
            <button className="choice" onClick={() => validName() && setStep('length')}><b>{t('auth.embedded')}</b>{t('auth.embeddedDesc')}</button>
            <button className="choice" onClick={() => validName() && setStep('wallets')}><b>{t('auth.external')}</b>{t('auth.externalDesc')}</button>
            {error && <p className="err" role="alert">{error}</p>}
            <p className="sub">{t('auth.haveAccount')} <Link to="/login">{t('welcome.login')}</Link></p>
          </div>
        )}

        {step === 'length' && (
          <div className="stack" style={{ marginTop: 16 }}>
            <h2>{t('auth.phraseLength')}</h2>
            <div className="seg">
              {([12, 24] as const).map((n) => (
                <button key={n} aria-pressed={words === n} onClick={() => setWords(n)}>
                  {t(`auth.words${n}`)}<small>{t(`auth.words${n}Help`)}</small>
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => { setPhrase(generatePhrase(words)); setShown(true); setStep('phrase'); }}>{t('common.next')}</button>
            <button className="link" onClick={() => setStep('start')}>{t('common.back')}</button>
          </div>
        )}

        {step === 'phrase' && (
          <div style={{ marginTop: 16 }}>
            <h2>{t('auth.phraseTitle')}</h2>
            <div className="warn" role="note">{t('auth.phraseWarn')}</div>
            <div className={`phrase ${shown ? '' : 'blur'}`} aria-label={t('auth.phraseTitle')}>
              {phrase.split(' ').map((w, i) => <div key={i}><i>{i + 1}</i>{w}</div>)}
            </div>
            <button className="link" onClick={() => setShown((s) => !s)}>{shown ? t('auth.phraseHide') : t('auth.phraseShow')}</button>
            <button className="btn" onClick={() => { setAnswers(['', '', '']); setError(''); setStep('verify'); }}>{t('auth.written')}</button>
          </div>
        )}

        {step === 'verify' && (
          <div style={{ marginTop: 16 }}>
            <h2>{t('auth.verifyTitle')}</h2>
            <p className="sub">{t('auth.verifyHelp')}</p>
            {checks.map((idx, k) => (
              <div className="field" key={idx}>
                <label htmlFor={`w${idx}`}>{t('auth.wordN', { n: idx + 1 })}</label>
                <input id={`w${idx}`} autoComplete="off" autoCapitalize="none" value={answers[k]} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === k ? e.target.value : x)))} />
              </div>
            ))}
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn" onClick={() => {
              const list = phrase.split(' ');
              if (checks.every((idx, k) => answers[k]!.trim().toLowerCase() === list[idx])) { setError(''); setStep('pin'); } else setError(t('auth.verifyWrong'));
            }}>{t('common.confirm')}</button>
            <button className="link" onClick={() => setStep('phrase')}>{t('common.back')}</button>
          </div>
        )}

        {step === 'pin' && (
          <div style={{ marginTop: 16 }}>
            <h2>{t('auth.pinTitle')}</h2>
            <p className="sub">{t('auth.pinHelp')}</p>
            <PinField value={pin} onChange={setPin} label={t('auth.pin')} autoFocus />
            <PinField value={pin2} onChange={setPin2} label={t('auth.pinConfirm')} />
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn" disabled={busy} onClick={() => void finishEmbedded()}>{busy ? t('common.loading') : t('auth.createAccount')}</button>
          </div>
        )}

        {step === 'wallets' && (
          <div style={{ marginTop: 16 }}>
            <h2>{t('auth.external')}</h2>
            <WalletPicker onSigner={finishExternal} />
            {error && <p className="err" role="alert">{error}</p>}
            <button className="link" onClick={() => setStep('start')}>{t('common.back')}</button>
          </div>
        )}
      </main>
    </div>
  );
}
