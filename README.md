# SafroQuest

**Learn Safrochain. Prove it. Help build it.**

SafroQuest is a free, open-source mobile-first game that turns the Safrochain documentation into quests, ranks and badges.
Players create a wallet (or connect one), answer questions that never repeat within 10 attempts, climb from *Explorer* to
*Guardian*, and contribute translations and reviews to the ecosystem.

> Status: **V1** (local, testnet-oriented). Independent community project, not an official Safrochain product.
> Français : voir [README.fr.md](README.fr.md). Landing page: [`landing/`](landing/index.html).

## What V1 includes

| Area | V1 |
|---|---|
| Accounts | Create an account with a **12 or 24-word** wallet generated on your device, protected by a PIN (AES-256-GCM, PBKDF2 600k). Restore from a phrase. |
| External wallets | Keplr, Leap, Cosmostation, **EightSaf**, **Zunia** (extension or phone QR). See [docs/WALLETS.md](docs/WALLETS.md). |
| Sign-in | Passwordless: the server sends a challenge, the wallet signs it (ADR-036), the server verifies. One-use nonce, 5-minute expiry, domain bound. |
| Game | 17 bilingual starter questions, XP, levels, ranks, daily quest and streak, **no repeat within 10 questions** (tested). |
| App | Dashboard with activity feed, bottom navigation (Home, Play, Community, Wallet, Settings), notification centre. |
| Community | Leaderboard, translation contribution quest, link to the community group. |
| Back-office | Add/publish questions, review contributions, announcements, stats (admin only). |
| i18n and themes | English and French; light, dark, system; four accent colours. |
| Contract | `contracts/quest-registry` (CosmWasm), **not yet compiled**. |

Details and limits: [docs/V1-SCOPE.md](docs/V1-SCOPE.md). Notifications strategy: [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md).

## Run it on your PC

Requirements: Node.js 20 or newer, npm, Git.

```bash
git clone https://github.com/sammywasukundi/safroquest.git
cd safroquest
npm install
npm run dev
```

Open <http://localhost:5173>. The API runs on port 8787. In development the **first account you create becomes admin**
(Settings, then "Open back-office"). Full testing guide, including phone, wallets and Windows/WSL: [docs/TESTING.md](docs/TESTING.md).

```bash
npm test            # unit and API tests (16)
npm run typecheck   # TypeScript, all packages
npm run build       # production build of the web app
```

## Structure

```
apps/web         React + TypeScript + Vite PWA (auth, game, wallet, settings, admin)
apps/api         Fastify API (challenge/signature auth, quests, dashboard, community, admin), JSON file store
packages/shared  Chain constants, BIP-39 wallet (12/24), ADR-036 sign/verify, ranks (used by web and api)
contracts/       CosmWasm QuestRegistry (Rust)
landing/         Static showcase page (EN/FR) with Open Graph image
docs/            Testing, wallets, notifications, V1 scope
```

## How sign-in works

1. The app asks `POST /api/auth/challenge` with the wallet address and receives a text containing domain, address, nonce and expiry.
2. The wallet (or the embedded key) signs it off-chain (`signArbitrary`, ADR-036). The private key never leaves the wallet.
3. `POST /api/auth/verify` checks the public key matches the address, the signature matches the message, and the nonce is unused. A new address must choose a username.
4. The server returns a session token. Replaying the same signature fails.

## Network

Safrochain testnet, from the draft docs: RPC chain ID `safro-testnet-1`, wallet-facing ID `safrochain-testnet-1` (EightSaf), base denom `usaf` (1 SAF = 1,000,000 usaf),
address prefix `addr_safro`. The HD coin type (118) and validator prefixes are **to confirm** with the Safrochain team. Constants live in `packages/shared/src/chain.ts`.

## Roadmap

V1.1 Telegram login and bot notifications, AI question pipeline with human review, boss missions on testnet.
V1.2 On-chain registry and badges (CW721), weekly draw, Web Push. See the full specification (cahier des charges) shared with this repository.

## License

MIT. See [LICENSE](LICENSE).
