# V1 scope and known limits

## Done and tested

- Monorepo, TypeScript, 16 automated tests (wallet derivation for 12/24 words, ADR-036 sign/verify, anti-repeat engine, auth, admin, contributions).
- A headless-browser run of: sign-up with 24 words, backup check, PIN, dashboard, quest, wrong/right PIN on the phrase, French and dark mode, reload, back-office, sign-out and PIN sign-in.

## Not done yet (honest list)

| Item | Why it matters | Planned |
|---|---|---|
| Real wallets (Keplr, Leap, Cosmostation, EightSaf, Zunia) not tried | Adapters follow public APIs but need a test with each extension | First task for the author |
| Contract not compiled | Written without a Rust toolchain | `cargo test`, then review |
| No on-chain XP or badges | V1 stores XP in the API | V1.2: oracle service sends `award_batch` |
| Starter bank of 17 questions, no rank gating | Needs 60+ per rank to gate by rank | AI pipeline with human review (V1.1) |
| JSON file store | Fine locally, not for production | PostgreSQL with the same shapes |
| Session token in `localStorage` | Simple for V1 | `httpOnly` cookies plus refresh rotation |
| No Telegram login, no push | Personal notifications are in-app only | See NOTIFICATIONS.md |
| Boss missions on testnet | Needs transaction building with CosmJS | V1.1 |
| Chain constants partly assumed | Coin type 118, validator prefixes | Confirm with the Safrochain team |
| Balance depends on the public testnet REST endpoint | Unreachable in some networks | Set `CHAIN_REST` |

## Design choices worth knowing

- **Embedded wallet signs with the same ADR-036 flow as external wallets**, so the server has a single verification path.
- **Anti-repeat window** shrinks automatically when a pool is smaller than the window (a bug found by the tests: `slice(-0)` returns the whole array).
- **Answers are never sent to the client before answering**; option order is shuffled server-side for every draw.
- **Dev admin:** the first account becomes admin only when `NODE_ENV` is not `production` (or `DEV_ADMIN=1`). In production, list admin addresses in `ADMIN_ADDRESSES`.
