/**
 * Local encrypted vault for the embedded wallet.
 * The secret phrase is encrypted with AES-256-GCM under a key derived from the PIN (PBKDF2-SHA256, 600k rounds)
 * and stored only in this browser. It is never sent to any server.
 */
const KEY = 'sq.vault.v1';
const FAILS = 'sq.vault.fails';
const LOCK = 'sq.vault.lockUntil';
const ITER = 600_000;
const PAUSE_AFTER = 5;
const WIPE_AFTER = 10;

interface VaultFile { v: 1; iter: number; salt: string; iv: string; ct: string; address: string; words: 12 | 24 }
export class VaultError extends Error {
  constructor(public code: 'none' | 'wrong' | 'locked' | 'wiped', public n = 0) { super(code); }
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const enc = new TextEncoder();

async function deriveKey(pin: string, salt: Uint8Array, iter: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

const read = (): VaultFile | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as VaultFile | null; } catch { return null; }
};

export const hasVault = () => read() !== null;
export const vaultInfo = () => { const v = read(); return v ? { address: v.address, words: v.words } : null; };
export const wipeVault = () => { localStorage.removeItem(KEY); localStorage.removeItem(FAILS); localStorage.removeItem(LOCK); };

export async function createVault(phrase: string, pin: string, address: string, words: 12 | 24) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(phrase)));
  const file: VaultFile = { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct), address, words };
  localStorage.setItem(KEY, JSON.stringify(file));
  localStorage.removeItem(FAILS);
  localStorage.removeItem(LOCK);
}

/** Wrong PINs cost time: a pause after 5 tries that doubles each time, and a wipe after 10. */
export async function unlockVault(pin: string): Promise<string> {
  const v = read();
  if (!v) throw new VaultError('none');
  const until = Number(localStorage.getItem(LOCK) ?? 0);
  if (until > Date.now()) throw new VaultError('locked', Math.ceil((until - Date.now()) / 1000));
  try {
    const key = await deriveKey(pin, unb64(v.salt), v.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) as BufferSource }, key, unb64(v.ct) as BufferSource);
    localStorage.removeItem(FAILS);
    localStorage.removeItem(LOCK);
    return new TextDecoder().decode(pt);
  } catch {
    const fails = Number(localStorage.getItem(FAILS) ?? 0) + 1;
    if (fails >= WIPE_AFTER) { wipeVault(); throw new VaultError('wiped'); }
    localStorage.setItem(FAILS, String(fails));
    if (fails >= PAUSE_AFTER) {
      localStorage.setItem(LOCK, String(Date.now() + 30_000 * 2 ** (fails - PAUSE_AFTER)));
      throw new VaultError('locked', 30 * 2 ** (fails - PAUSE_AFTER));
    }
    throw new VaultError('wrong', PAUSE_AFTER - fails);
  }
}
