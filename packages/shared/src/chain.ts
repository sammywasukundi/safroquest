/**
 * Safrochain network constants used by SafroQuest.
 * Source: Safrochain draft docs (testnet endpoints) and the EightSaf wallet store listing.
 * TO CONFIRM against the official docs: HD coin type, validator/consensus bech32 prefixes.
 */
export const CHAIN = {
  prefix: 'addr_safro',
  denom: 'usaf',
  display: 'SAF',
  decimals: 6,
  /** BIP-44 path. Coin type 118 is the usual Cosmos value, not yet confirmed for Safrochain. */
  hdPath: "m/44'/118'/0'/0/0",
  testnet: {
    /** Chain ID reported by the RPC node. Keplr, Leap and Zunia must use this one. */
    rpcChainId: 'safro-testnet-1',
    /** Chain ID that the EightSaf extension lists for testnet. */
    walletChainId: 'safrochain-testnet-1',
    rpc: 'https://rpc.testnet.safrochain.com',
    rest: 'https://rest.testnet.safrochain.com',
    faucet: 'https://faucet.safrochain.com/',
    explorer: 'https://explorer.safrochain.com/',
  },
} as const;

export const usafToSaf = (usaf: string | number | bigint): string => {
  const n = BigInt(usaf);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
};
