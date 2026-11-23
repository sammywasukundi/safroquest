import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../lib/api';
import { WALLETS, WalletError, connectInjected, connectZunia, isInstalled, qrSvg, type Signer, type WalletId } from '../lib/wallets';

/** Lets the player pick an external wallet, then hands a ready-to-sign Signer to the caller. */
export function WalletPicker({ onSigner }: { onSigner: (s: Signer) => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<WalletId | null>(null);
  const [zunia, setZunia] = useState(false);
  const [qr, setQr] = useState<{ svg?: string; code?: string } | null>(null);

  const explain = (e: unknown, id: WalletId) => {
    const name = WALLETS.find((w) => w.id === id)?.name ?? id;
    if (e instanceof WalletError) {
      if (e.code === 'not_installed') { setMissing(id); return t('auth.notInstalled', { name }); }
      if (e.code === 'unsupported') return t('auth.unsupported', { name });
      if (e.code === 'rejected') return t('auth.rejected');
      return t('auth.walletFailed', { msg: e.message });
    }
    return t('common.error');
  };

  const run = async (id: WalletId, connect: () => Promise<Signer>) => {
    setBusy(id); setError(''); setMissing(null);
    try { await onSigner(await connect()); } catch (e) { setError(e instanceof ApiError ? '' : explain(e, id)); } finally { setBusy(null); setQr(null); }
  };

  return (
    <div>
      <div className="wallets">
        {WALLETS.map((w) => (
          <button key={w.id} type="button" className="choice" disabled={busy !== null}
            onClick={() => (w.id === 'zunia' ? setZunia((z) => !z) : void run(w.id, () => connectInjected(w.id as Exclude<WalletId, 'zunia'>)))}>
            <b>{w.name}</b>
            <span className="sub">{w.id === 'zunia' ? '' : isInstalled(w.id) ? '✓' : ''}</span>
          </button>
        ))}
      </div>
      {zunia && (
        <div className="card" style={{ marginTop: 10 }}>
          <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => void run('zunia', () => connectZunia('extension'))}>{t('auth.zuniaExtension')}</button>
          <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => void run('zunia', () => connectZunia('qr', { onPairing: (uri) => void qrSvg(uri).then((svg) => setQr((q) => ({ ...q, svg }))), onCode: (code) => setQr((q) => ({ ...q, code })) }))}>{t('auth.zuniaPhone')}</button>
          {qr?.svg && (
            <div>
              <p className="sub" style={{ marginTop: 10 }}>{t('auth.scan')}</p>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr.svg }} />
              {qr.code && <p className="ok">{t('auth.compare', { code: `${qr.code.slice(0, 3)} ${qr.code.slice(3)}` })}</p>}
            </div>
          )}
        </div>
      )}
      {busy && <p className="sub" aria-live="polite">{t('auth.signing')}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      {missing && <a className="link" href={WALLETS.find((w) => w.id === missing)?.installUrl} target="_blank" rel="noreferrer">{t('auth.install')} {WALLETS.find((w) => w.id === missing)?.name}</a>}
    </div>
  );
}
