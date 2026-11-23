import { describe, expect, it } from 'vitest';
import {
  CHAIN, generatePhrase, isValidAddress, isValidPhrase, levelFromXp, rankFromXp, signArbitrary,
  verifyArbitrary, walletFromPhrase, usafToSaf,
} from './index.ts';

describe('wallet', () => {
  it('generates 12 and 24 word phrases that validate', () => {
    expect(generatePhrase(12).split(' ')).toHaveLength(12);
    expect(generatePhrase(24).split(' ')).toHaveLength(24);
    expect(isValidPhrase(generatePhrase(12))).toBe(true);
    expect(isValidPhrase(generatePhrase(24))).toBe(true);
    expect(isValidPhrase('abandon abandon abandon')).toBe(false);
  });
  it('derives a deterministic addr_safro address', () => {
    const p = generatePhrase(12);
    const a = walletFromPhrase(p);
    expect(a.address.startsWith(CHAIN.prefix + '1')).toBe(true);
    expect(isValidAddress(a.address)).toBe(true);
    expect(walletFromPhrase(p).address).toBe(a.address);
    expect(walletFromPhrase(generatePhrase(12)).address).not.toBe(a.address);
  });
  it('normalizes whitespace and case', () => {
    const p = generatePhrase(12);
    expect(walletFromPhrase(`  ${p.toUpperCase().replace(/ /g, '   ')} `).address).toBe(walletFromPhrase(p).address);
  });
});

describe('ADR-036 signature', () => {
  const w = walletFromPhrase(generatePhrase(24));
  const msg = 'SafroQuest sign-in\nNonce: abc';
  it('verifies a valid signature', () => {
    const s = signArbitrary(w.privateKey, w.address, msg);
    expect(verifyArbitrary({ signer: w.address, message: msg, pubKey: s.pub_key.value, signature: s.signature })).toBe(true);
  });
  it('rejects a changed message, a wrong signer and a foreign key', () => {
    const s = signArbitrary(w.privateKey, w.address, msg);
    expect(verifyArbitrary({ signer: w.address, message: msg + 'x', pubKey: s.pub_key.value, signature: s.signature })).toBe(false);
    const other = walletFromPhrase(generatePhrase(12));
    expect(verifyArbitrary({ signer: other.address, message: msg, pubKey: s.pub_key.value, signature: s.signature })).toBe(false);
    const s2 = signArbitrary(other.privateKey, w.address, msg);
    expect(verifyArbitrary({ signer: w.address, message: msg, pubKey: s2.pub_key.value, signature: s2.signature })).toBe(false);
  });
  it('rejects garbage input without throwing', () => {
    expect(verifyArbitrary({ signer: w.address, message: msg, pubKey: 'zz', signature: '!!' })).toBe(false);
  });
});

describe('ranks and units', () => {
  it('maps XP to level and rank', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(150)).toBe(4);
    expect(rankFromXp(149)).toBe('explorer');
    expect(rankFromXp(150)).toBe('cosmonaut');
    expect(rankFromXp(300)).toBe('smith');
  });
  it('converts usaf to SAF', () => {
    expect(usafToSaf('1500000')).toBe('1.5');
    expect(usafToSaf('0')).toBe('0');
    expect(usafToSaf('123')).toBe('0.000123');
  });
});
