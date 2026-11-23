const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const TOKEN_KEY = 'sq.token';

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/auth/verify') window.dispatchEvent(new Event('sq:unauthorized'));
    throw new ApiError(data.error ?? 'error', res.status);
  }
  return data as T;
}

export interface PublicUser {
  id: string; username: string; address: string; walletKind: string; role: 'player' | 'admin';
  locale: 'en' | 'fr'; theme: 'system' | 'light' | 'dark'; accent: 'sky' | 'mint' | 'lavender' | 'sun';
  xp: number; level: number; createdAt: string; backupConfirmed: boolean;
  notifPrefs: { inApp: boolean; reminders: boolean; community: boolean };
}
