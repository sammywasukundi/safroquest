import { CHAIN, signArbitrary, walletFromPhrase, type StdSignature } from '@safroquest/shared';

export type WalletId = 'keplr' | 'leap' | 'cosmostation' | 'eightsaf' | 'zunia';

export interface Signer {
  kind: string;
  address: string;
  sign(message: string): Promise<StdSignature>;
}

export class WalletError extends Error {
  constructor(public code: 'not_installed' | 'unsupported' | 'rejected' | 'failed', msg = '') { super(msg || code); }
}

export const WALLETS: { id: WalletId; name: string; installUrl: string }[] = [
  { id: 'keplr', name: 'Keplr', installUrl: 'https://www.keplr.app/download' },
  { id: 'leap', name: 'Leap', installUrl: 'https://www.leapwallet.io/download' },
  { id: 'cosmostation', name: 'Cosmostation', installUrl: 'https://www.cosmostation.io/products/cosmostation_extension' },
  { id: 'eightsaf', name: 'EightSaf', installUrl: 'https://chromewebstore.google.com/detail/eightsaf-wallet/hpemogcffkhcoegjbphljmbjepibnpjj' },
  { id: 'zunia', name: 'Zunia', installUrl: 'https://zunialab.com' },
];

/** Embedded wallet: signs locally with the key derived from the secret phrase. */
export function embeddedSigner(phrase: string): Signer {
  const w = walletFromPhrase(phrase);
  return { kind: 'embedded', address: w.address, sign: async (m) => signArbitrary(w.privateKey, w.address, m) };
}

// --- injected (Keplr-compatible) wallets -------------------------------------
interface KeplrLike {
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{ bech32Address: string }>;
  signArbitrary(chainId: string, signer: string, data: string): Promise<StdSignature>;
  experimentalSuggestChain?(info: unknown): Promise<void>;
}
type Win = Window & { keplr?: KeplrLike; leap?: KeplrLike; eightsaf?: KeplrLike; cosmostation?: { providers?: { keplr?: KeplrLike } } };

const injected = (id: WalletId): KeplrLike | undefined => {
  const w = window as Win;
  if (id === 'keplr') return w.keplr;
  if (id === 'leap') return w.leap;
  if (id === 'eightsaf') return w.eightsaf;
  if (id === 'cosmostation') return w.cosmostation?.providers?.keplr;
  return undefined;
};

export const isInstalled = (id: WalletId): boolean => (id === 'zunia' ? true : !!injected(id));

/**
 * Chain ID to use per wallet. EightSaf lists testnet as safrochain-testnet-1, while the RPC node reports
 * safro-testnet-1, which Keplr-style wallets must match. To confirm with each wallet team.
 */
const chainIdFor = (id: WalletId) => (id === 'eightsaf' ? CHAIN.testnet.walletChainId : CHAIN.testnet.rpcChainId);

const chainInfo = () => {
  const cur = { coinDenom: CHAIN.display, coinMinimalDenom: CHAIN.denom, coinDecimals: CHAIN.decimals };
  const p = CHAIN.prefix;
  return {
    chainId: CHAIN.testnet.rpcChainId, chainName: 'Safrochain Testnet', rpc: CHAIN.testnet.rpc, rest: CHAIN.testnet.rest,
    bip44: { coinType: 118 }, // to confirm
    bech32Config: { // validator and consensus prefixes follow the usual pattern and are to confirm
      bech32PrefixAccAddr: p, bech32PrefixAccPub: `${p}pub`, bech32PrefixValAddr: `${p}valoper`,
      bech32PrefixValPub: `${p}valoperpub`, bech32PrefixConsAddr: `${p}valcons`, bech32PrefixConsPub: `${p}valconspub`,
    },
    currencies: [cur], stakeCurrency: cur,
    feeCurrencies: [{ ...cur, gasPriceStep: { low: 0.05, average: 0.05, high: 0.1 } }],
  };
};

const mapError = (e: unknown): WalletError => {
  if (e instanceof WalletError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|declin|cancel/i.test(msg)) return new WalletError('rejected', msg);
  return new WalletError('failed', msg);
};

export async function connectInjected(id: Exclude<WalletId, 'zunia'>): Promise<Signer> {
  const w = injected(id);
  if (!w) throw new WalletError('not_installed');
  if (typeof w.signArbitrary !== 'function' || typeof w.getKey !== 'function') throw new WalletError('unsupported');
  const chainId = chainIdFor(id);
  try {
    // EightSaf uses the network chosen inside the extension, so we do not suggest a chain to it.
    if (id !== 'eightsaf' && w.experimentalSuggestChain) await w.experimentalSuggestChain(chainInfo()).catch(() => undefined);
    await w.enable(chainId);
    const { bech32Address } = await w.getKey(chainId);
    return { kind: id, address: bech32Address, sign: (m) => w.signArbitrary(chainId, bech32Address, m).catch((e: unknown) => { throw mapError(e); }) };
  } catch (e) {
    throw mapError(e);
  }
}

// --- Zunia (extension or phone pairing through @zunialab/sdk-web) ---------------
export async function connectZunia(
  mode: 'extension' | 'qr',
  hooks: { onPairing?: (uri: string) => void; onCode?: (code: string) => void } = {},
): Promise<Signer> {
  const { createZuniaSession } = await import('@zunialab/sdk-web');
  const chainId = CHAIN.testnet.rpcChainId;
  const session = createZuniaSession();
  const options = { chains: [chainId], metadata: { name: 'SafroQuest', url: location.origin } };
  try {
    if (mode === 'qr') {
      session.on('pairing', (p) => hooks.onPairing?.(p.uri));
      session.on('verification', (c) => hooks.onCode?.(c));
      await session.connect({ ...options, prefer: 'native-ws', apiBase: 'https://api.zunialab.com' });
    } else if (!(await session.restore(options))) {
      await session.connect({ ...options, prefer: 'extension' });
    }
    const account = session.accounts[0];
    if (!account) throw new WalletError('failed', 'no account shared');
    return { kind: 'zunia', address: account.address, sign: (m) => session.signArbitrary(chainId, account.address, m) as Promise<StdSignature> };
  } catch (e) {
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'NOT_INSTALLED') throw new WalletError('not_installed');
    throw mapError(e);
  }
}

/** QR code (SVG markup generated by the Zunia SDK) for the phone pairing link. */
export async function qrSvg(text: string): Promise<string> {
  const m = await import('@zunialab/sdk-web');
  return m.renderQrSvg(text, { size: 220, label: 'Zunia' });
}
