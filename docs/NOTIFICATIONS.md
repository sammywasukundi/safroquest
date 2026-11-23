# Notifications: group or phone notifications?

**Recommendation: both, with different jobs.** A community group is for conversation and feedback. Notifications are for personal, timely events.
Do not use a group as the only channel: it is noisy, hard to moderate, and a magnet for scam messages.

## 1. Community group (conversation and feedback)

A Telegram group with topics (or a Discord server), linked from the Community tab (`VITE_COMMUNITY_URL`).

- **Announcements:** read-only channel for releases and events.
- **Feedback:** what players like or find confusing.
- **Bugs:** with steps to reproduce.
- **Quest ideas and corrections:** feeds the back-office review queue.
- **Translators:** coordination for the translation quests.
- **Help:** newcomer questions.

Rules to pin: admins never message first, nobody ever asks for a secret phrase or PIN, links from strangers are not clicked.
Use a captcha bot against spam and bots. Do not paste usernames from the leaderboard into the group without consent.

## 2. Notifications (personal events)

| Event | Channel | Frequency | Opt-out |
|---|---|---|---|
| Level up, rank up | In-app (V1), Web Push or Telegram bot later | Each event | Settings |
| Daily quest complete | In-app (V1) | Daily at most | Settings |
| Translation validated or rejected | In-app (V1), Telegram bot later | Each event | Settings |
| Daily reminder, streak at risk | Telegram bot or Web Push (V1.1/V1.2) | 1 per day maximum | Settings |
| Community announcement | In-app (V1), mirrored in the group | Rare | Settings |
| Weekly draw result (later) | In-app, Telegram bot | Weekly | Settings |

### Channels, in order of delivery

1. **In-app notification centre (done in V1).** Bell icon on Home, with unread badge. Preferences in Settings.
2. **Telegram bot (V1.1).** The player links their account with `/start <code>`; the bot sends opt-in messages. Fits the target audience and works without app installation.
3. **Web Push (V1.2).** PWA push notifications (VAPID). Works on Android Chrome; on iOS only for an installed PWA (iOS 16.4 or later).
4. **Email:** not planned.

### Principles

- Opt-in, per category, with one-tap opt-out.
- No more than one reminder per day. Never urgent or fear-based wording ("your streak dies in 5 minutes" is not allowed).
- Never include secrets or ask for them. No notification asks the user to sign something.
- Notifications carry no personal data beyond what the player sees in the app.
