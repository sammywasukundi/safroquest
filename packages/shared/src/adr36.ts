import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { base64, bech32 } from '@scure/base';
import { CHAIN } from './chain.ts';

const enc = new TextEncoder();

export interface StdSignature {
  pub_key: { type?: string; value: string };
  signature: string;
}

/** Cosmos address: bech32(prefix, ripemd160(sha256(compressed secp256k1 public key))). */
export function addressFromPublicKey(publicKey: Uint8Array, prefix: string = CHAIN.prefix): string {
  return bech32.encode(prefix, bech32.toWords(ripemd160(sha256(publicKey))));
}

export function isValidAddress(address: string, prefix: string = CHAIN.prefix): boolean {
  try {
    const d = bech32.decode(address as `${string}1${string}`);
    return d.prefix === prefix && bech32.fromWords(d.words).length === 20;
  } catch {
    return false;
  }
}

/** The ADR-036 off-chain sign doc, exactly as wallets such as Keplr build it. */
export function makeAdr36SignDoc(signer: string, message: string) {
  return {
    chain_id: '',
    account_number: '0',
    sequence: '0',
    fee: { gas: '0', amount: [] as unknown[] },
    msgs: [{ type: 'sign/MsgSignData', value: { signer, data: base64.encode(enc.encode(message)) } }],
    memo: '',
  };
}

const sortObject = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortObject);
  if (v && typeof v === 'object') {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((o, k) => {
        o[k] = sortObject((v as Record<string, unknown>)[k]);
        return o;
      }, {});
  }
  return v;
};

export const serializeSignDoc = (doc: unknown): Uint8Array => enc.encode(JSON.stringify(sortObject(doc)));

const digest = (signer: string, message: string) => sha256(serializeSignDoc(makeAdr36SignDoc(signer, message)));

/** Sign a message the way a wallet's signArbitrary does (used by the embedded wallet). */
export function signArbitrary(privateKey: Uint8Array, signer: string, message: string): StdSignature {
  const sig = secp256k1.sign(digest(signer, message), privateKey);
  return {
    pub_key: { type: 'tendermint/PubKeySecp256k1', value: base64.encode(secp256k1.getPublicKey(privateKey, true)) },
    signature: base64.encode(sig.toCompactRawBytes()),
  };
}

export interface VerifyInput {
  signer: string;
  message: string;
  pubKey: string;
  signature: string;
  prefix?: string;
}

/** Server-side check: the key matches the address, and the signature matches the message. */
export function verifyArbitrary({ signer, message, pubKey, signature, prefix = CHAIN.prefix }: VerifyInput): boolean {
  try {
    const pub = base64.decode(pubKey);
    if (pub.length !== 33) return false;
    if (addressFromPublicKey(pub, prefix) !== signer) return false;
    const sig = base64.decode(signature);
    if (sig.length !== 64) return false;
    return secp256k1.verify(sig, digest(signer, message), pub, { lowS: false });
  } catch {
    return false;
  }
}
