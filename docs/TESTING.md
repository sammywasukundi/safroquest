# Testing SafroQuest on your PC

## 1. Quick start (browser on the same computer)

```bash
npm install
npm run dev        # API :8787 and web :5173
```

Open <http://localhost:5173>. `localhost` counts as a secure context, so the wallet vault (WebCrypto) works.

**Windows 11:** use PowerShell, or WSL2. With WSL2, clone inside the Linux filesystem (for example `~/safroquest`), not under `/mnt/c`, for faster installs.
Windows forwards `localhost` into WSL2, so <http://localhost:5173> works from your Windows browser.

## 2. Checklist of manual tests

| # | Test | Expected |
|---|---|---|
| 1 | Create an account with **12 words**, then another with **24 words** | Phrase shown once, backup check asks 3 random words, account created |
| 2 | Wrong PIN on Wallet, "Show my secret phrase" | "Wrong PIN. N tries left". After 5 wrong tries a pause, after 10 the local vault is erased |
| 3 | Reload the page | Still signed in. Wallet needs the PIN again to show the phrase |
| 4 | Sign out, then Sign in with the PIN | Back on the dashboard |
| 5 | Sign in with "Restore with my secret phrase" on a clean browser profile | Same address, same account |
| 6 | Play 10+ questions in a row | No question repeats within any window of 10 |
| 7 | Answer 3 correctly in a day | Daily bonus (+30 XP), notification appears |
| 8 | Settings: switch to French, Dark, change accent | Persists after reload and on next sign-in |
| 9 | Community: send a translation | Appears in Settings, Back-office, "Contributions to review". Approve it: +30 XP and a notification for the player |
| 10 | Back-office: add a question, set it to "Published" | It enters the draw |

## 3. Automated tests

```bash
npm test           # shared (wallet, ADR-036) and API (auth, engine, admin): 16 tests
npm run typecheck
npm run build
```

## 4. Testing on a phone

`http://<your-PC-IP>:5173` over Wi-Fi works for layout checks, **but the wallet vault will not work**: browsers only allow WebCrypto on HTTPS or `localhost`.
Use one of these instead:

- **HTTPS tunnel** (ngrok or cloudflared): `VITE_ALLOW_TUNNEL=1 npm run dev`, then tunnel port 5173 and open the HTTPS URL on the phone.
- **Android USB debugging:** `adb reverse tcp:5173 tcp:5173`, then open <http://localhost:5173> on the phone.

Telegram Mini Apps also require an HTTPS URL, so the tunnel is the way to test them later.

## 5. Testing external wallets

See [WALLETS.md](WALLETS.md). In short: install the extension, make sure it is on the Safrochain **testnet**, then Sign up, "Connect an existing wallet".

## 6. Balance shows "–"

The balance is fetched through the API from the Safrochain testnet REST endpoint. If your network blocks it, set `CHAIN_REST` in `apps/api/.env`.
The rest of the app works without it. Test SAF: use the faucet button in the Wallet tab.

## 7. Reset everything

Stop the API, delete `apps/api/data/db.json`, and clear site data in the browser (this also erases the local wallet, so keep your phrase).
