import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAIN } from '@safroquest/shared';
import { Feed, type ActivityItem } from '../components/Feed';
import { PinField, useVaultMessage } from '../components/Pin';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { vaultInfo, unlockVault } from '../lib/vault';

export function Wallet() {
  const { t } = useTranslation();
  const { user, signer, lock, vaultPresent } = useAuth();
  const vaultMsg = useVaultMessage();
  const [bal, setBal] = useState<string | null | 'err'>(null);
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pin, setPin] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [rank, setRank] = useState('explorer');

  const refresh = () => {
    if (!user) return;
    setBal(null);
    api<{ saf: string }>(`/chain/balance/${user.address}`).then((b) => setBal(b.saf)).catch(() => setBal('err'));
  };
  useEffect(() => {
    refresh();
    api<{ activity: ActivityItem[]; rank: string }>('/dashboard').then((d) => { setActivity(d.activity); setRank(d.rank); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.address]);

  if (!user) return null;
  const embedded = user.walletKind === 'embedded';
  const mine = vaultInfo()?.address === user.address;

  const copy = async () => { await navigator.clipboard.writeText(user.address).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const reveal = async () => {
    setError('');
    try { setPhrase(await unlockVault(pin)); setPin(''); } catch (e) { setError(vaultMsg(e)); }
  };

  return (
    <main className="page">
      <h1>{t('nav.wallet')}</h1>

      <div className="card" style={{ marginTop: 14 }}>
        <p className="sub">{t('wallet.balance')}</p>
        <div className="big">{bal === null ? '…' : bal === 'err' ? '–' : `${bal} ${CHAIN.display}`}</div>
        {bal === 'err' && <p className="sub">{t('wallet.unreachable')}</p>}
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn small ghost" onClick={refresh}>{t('wallet.refresh')}</button>
          <a className="btn small" href={CHAIN.testnet.faucet} target="_blank" rel="noreferrer">{t('wallet.faucet')}</a>
        </div>
      </div>

      <div className="card">
        <p className="sub">{t('wallet.address')} · {t('wallet.network')}: {CHAIN.testnet.rpcChainId}</p>
        <div className="addr">{user.address}</div>
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn small ghost" onClick={() => void copy()}>{copied ? t('common.copied') : t('common.copy')}</button>
          <a className="btn small ghost" href={`${CHAIN.testnet.explorer}`} target="_blank" rel="noreferrer">{t('wallet.explorer')}</a>
        </div>
      </div>

      <h2>{t('wallet.backup')}</h2>
      <div className="card">
        {!embedded ? <p>{t('wallet.external', { wallet: user.walletKind })}</p> : (
          <>
            <p className={user.backupConfirmed ? 'ok' : 'err'}>{user.backupConfirmed ? t('wallet.backedUp') : t('wallet.notBacked')}</p>
            {!(vaultPresent && mine) ? <p className="sub">{t('wallet.none')}</p> : phrase ? (
              <>
                <div className="phrase">{phrase.split(' ').map((w, i) => <div key={i}><i>{i + 1}</i>{w}</div>)}</div>
                <button className="btn ghost" onClick={() => setPhrase('')}>{t('auth.phraseHide')}</button>
              </>
            ) : (
              <>
                <p className="sub">{t('wallet.enterPin')}</p>
                <PinField value={pin} onChange={setPin} label={t('auth.pin')} />
                {error && <p className="err" role="alert">{error}</p>}
                <button className="btn ghost" disabled={!pin} onClick={() => void reveal()}>{t('wallet.showPhrase')}</button>
              </>
            )}
            {signer && <button className="link" onClick={lock}>{t('wallet.lock')}</button>}
          </>
        )}
      </div>

      <h2>{t('wallet.badges')}</h2>
      <div className="card tint"><p>{t('wallet.badgesSoon', { rank: t(`ranks.${rank}`) })}</p></div>

      <h2>{t('wallet.history')}</h2>
      <div className="card">{activity.length ? <Feed items={activity} /> : <p className="sub">{t('home.noActivity')}</p>}</div>
    </main>
  );
}
