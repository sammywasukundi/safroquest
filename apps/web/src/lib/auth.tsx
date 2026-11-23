import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken, type PublicUser } from './api';
import { applyTheme } from './theme';
import { setLang } from '../i18n';
import { unlockVault, hasVault, wipeVault } from './vault';
import { embeddedSigner, type Signer } from './wallets';

interface Auth {
  user: PublicUser | null;
  loading: boolean;
  signer: Signer | null;
  vaultPresent: boolean;
  /** Runs the challenge/signature handshake and opens a session. Throws ApiError('NO_ACCOUNT') if a username is needed. */
  authenticate(signer: Signer, extra?: { username?: string; backupConfirmed?: boolean }): Promise<void>;
  unlock(pin: string): Promise<Signer>;
  lock(): void;
  logout(): Promise<void>;
  setUser(u: PublicUser): void;
  refreshVault(): void;
}
const Ctx = createContext<Auth | null>(null);
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('AuthProvider missing'); return c; };

const AUTO_LOCK_MS = 5 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const [signer, setSigner] = useState<Signer | null>(null);
  const [vaultPresent, setVaultPresent] = useState(hasVault());
  const timer = useRef<number>();

  const adopt = useCallback((u: PublicUser) => {
    setUserState(u);
    setLang(u.locale);
    applyTheme(u.theme, u.accent);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api<PublicUser>('/me').then(adopt).catch(() => setToken(null)).finally(() => setLoading(false));
  }, [adopt]);

  useEffect(() => {
    const onUnauthorized = () => { setToken(null); setUserState(null); setSigner(null); };
    window.addEventListener('sq:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sq:unauthorized', onUnauthorized);
  }, []);

  // Drop the in-memory key after a period of inactivity.
  useEffect(() => {
    if (!signer || signer.kind !== 'embedded') return;
    const reset = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setSigner(null), AUTO_LOCK_MS); };
    reset();
    const evs = ['pointerdown', 'keydown'] as const;
    evs.forEach((e) => window.addEventListener(e, reset));
    return () => { window.clearTimeout(timer.current); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [signer]);

  const authenticate: Auth['authenticate'] = useCallback(async (s, extra = {}) => {
    const { message } = await api<{ message: string }>('/auth/challenge', { body: { address: s.address } });
    const sig = await s.sign(message);
    const res = await api<{ token: string; user: PublicUser }>('/auth/verify', {
      body: {
        address: s.address, message, pubKey: sig.pub_key.value, signature: sig.signature, walletKind: s.kind,
        locale: localStorage.getItem('sq.lang') ?? 'en', ...extra,
      },
    });
    setToken(res.token);
    setSigner(s);
    adopt(res.user);
  }, [adopt]);

  const unlock: Auth['unlock'] = useCallback(async (pin) => {
    const phrase = await unlockVault(pin);
    const s = embeddedSigner(phrase);
    setSigner(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (e) { if (!(e instanceof ApiError)) throw e; }
    setToken(null); setUserState(null); setSigner(null);
  }, []);

  const value = useMemo<Auth>(() => ({
    user, loading, signer, vaultPresent, authenticate, unlock, lock: () => setSigner(null), logout,
    setUser: adopt, refreshVault: () => setVaultPresent(hasVault()),
  }), [user, loading, signer, vaultPresent, authenticate, unlock, logout, adopt]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { wipeVault };
