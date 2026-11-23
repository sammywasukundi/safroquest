# Wallets

SafroQuest signs players in by asking their wallet to sign a short text (ADR-036 `signArbitrary`). Nothing is broadcast, no fee is paid.

| Wallet | How it connects | Chain ID used | Status |
|---|---|---|---|
| SafroQuest wallet (embedded) | Local key from a 12 or 24-word phrase, encrypted by your PIN | n/a | Tested (unit + browser) |
| Keplr | `window.keplr`, chain suggested automatically | `safro-testnet-1` | Not tested with the real extension |
| Leap | `window.leap`, same as Keplr | `safro-testnet-1` | Not tested with the real extension |
| Cosmostation | `window.cosmostation.providers.keplr` | `safro-testnet-1` | Not tested with the real extension |
| **EightSaf** | `window.eightsaf` (extension) | `safrochain-testnet-1` | Not tested. Assumes a Keplr-compatible API (`enable`, `getKey`, `signArbitrary`) |
| **Zunia** | `@zunialab/sdk-web`: extension, or phone pairing with a QR code | `safro-testnet-1` | Not tested. Safrochain must be known to Zunia |

## Things to verify with the real wallets

1. **Chain IDs.** EightSaf lists testnet as `safrochain-testnet-1` with RPC chain ID `safro-testnet-1`. Keplr-style wallets need the ID the RPC node reports. Both are set in `packages/shared/src/chain.ts` and `apps/web/src/lib/wallets.ts`.
2. **EightSaf API.** If the app says the wallet "does not offer message signing", EightSaf's provider differs from Keplr's. The EightSaf adapter in Interchain Kit (`@interchain-kit/eightsaf-extension`) is the fallback to integrate.
3. **Zunia.** Phone pairing needs the chain registered in Zunia. The extension can add chains; the phone cannot.
4. **Validator and consensus prefixes** used when suggesting the chain to Keplr/Leap follow the usual `addr_safrovaloper` pattern and are unconfirmed. Only the account prefix `addr_safro` comes from the Safrochain docs.
5. **HD coin type** is assumed to be 118.

## Embedded wallet and 12 vs 24 words

The player chooses 12 words (128-bit entropy, easier to copy) or 24 words (256-bit). EightSaf documents a 24-word phrase; whether it imports 12 words is **not verified**. Recommend 24 words to players who plan to import their phrase into EightSaf.

## Security notes

- The phrase is generated in the browser, shown once, and stored only as an AES-256-GCM ciphertext under a key derived from the PIN (PBKDF2-SHA256, 600,000 rounds).
- A 6-digit PIN is weak against someone who copies your browser storage: choose a longer passphrase when possible. Keep only testnet or game value in the embedded wallet.
- Wrong PINs: pause after 5, local vault erased after 10 (restore with the phrase).
