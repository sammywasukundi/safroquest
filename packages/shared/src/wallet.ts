import { secp256k1 } from '@noble/curves/secp256k1';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { addressFromPublicKey } from './adr36.ts';
import { CHAIN } from './chain.ts';

export type WordCount = 12 | 24;

/** 12 words = 128 bits of entropy, 24 words = 256 bits. */
export const generatePhrase = (words: WordCount): string => generateMnemonic(wordlist, words === 24 ? 256 : 128);

export const normalizePhrase = (s: string): string => s.trim().toLowerCase().split(/\s+/).join(' ');

export const isValidPhrase = (s: string): boolean => {
  const p = normalizePhrase(s);
  const n = p.split(' ').length;
  return (n === 12 || n === 24) && validateMnemonic(p, wordlist);
};

export interface DerivedWallet {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

export function walletFromPhrase(phrase: string, hdPath: string = CHAIN.hdPath): DerivedWallet {
  const seed = mnemonicToSeedSync(normalizePhrase(phrase));
  const key = HDKey.fromMasterSeed(seed).derive(hdPath);
  if (!key.privateKey) throw new Error('derivation failed');
  const publicKey = secp256k1.getPublicKey(key.privateKey, true);
  return { privateKey: key.privateKey, publicKey, address: addressFromPublicKey(publicKey) };
}
