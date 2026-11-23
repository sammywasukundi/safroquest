import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VaultError } from '../lib/vault';

/** Maps a vault failure to a readable message. */
export function useVaultMessage() {
  const { t } = useTranslation();
  return (e: unknown): string => {
    if (e instanceof VaultError) {
      if (e.code === 'wrong') return t('auth.wrongPin', { left: e.n });
      if (e.code === 'locked') return t('auth.pinLocked', { s: e.n });
      if (e.code === 'wiped') return t('auth.vaultWiped');
      return t('wallet.none');
    }
    return t('common.error');
  };
}

export function PinField({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={`pin-${label}`}>{label}</label>
      <div className="row">
        <input id={`pin-${label}`} className="grow" type={show ? 'text' : 'password'} inputMode="text" autoComplete="off" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="link" onClick={() => setShow((s) => !s)}>{show ? t('auth.phraseHide') : t('auth.phraseShow')}</button>
      </div>
    </div>
  );
}
