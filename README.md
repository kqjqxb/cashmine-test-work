# CashMine payback — mobile web slice

Expo (SDK 58, TypeScript, expo-router) app for a ~390px phone screen: see payback balances and claim them.

**Live:** https://cashmine-test-work.vercel.app

On first open, paste the API token from the task email. It is stored only in this browser (localStorage) and can be changed from Home.

## Run locally

```bash
npm install
npx expo start --web   # opens the app in the browser
npm test               # unit tests (jest-expo)
npx tsc --noEmit       # typecheck
npx expo lint          # lint
```

## What works

- **Token gate:** asks for the token at runtime; "Change token" on Home; a 401 shows "Token invalid or expired" without clearing the token.
- **Balances (Home):**
  - USD total of what can be claimed now, and one card per asset (available, pending, claiming, USD value).
  - "Updated Xs ago", plus a "Stale" label when the data is over 60s old or the last refresh failed.
  - Loading skeleton, a full-screen error with Retry, and an inline banner that keeps old data when a refresh fails.
  - Refresh button, pull-to-refresh, and auto-refresh every 15s while the screen is open.
- **Claim:**
  - Loads claim options; amount input with Max and live validation (min, available, decimals, fee), plus a "you receive" preview.
  - Destination picker, review, then confirm with an Idempotency-Key that is persisted before sending.
  - Status screen polls the claim until it is completed or failed.
- **Unknown outcome** (504, timeout, network error, 5xx):
  - Never shown as failed; the POST is re-sent with the same key and body.
  - "Check again" button; unresolved attempts resume after a reload and show a banner on Home.
- **Balance right after a claim:** the snapshot is corrected for this device's claims, using server timestamps only, and each card shows a "Claim … in progress / completed / failed" note.
- **Money:** every amount is a `bigint` in the asset's smallest unit; no floats anywhere.
- **Tests (91):** amount parsing and formatting, claim validation, fee and USD math, the API client (retries, no retry on POST, strict parsing), balance correction after a claim, and the claim store.

Not done: Activity history. See [NOTES.md](NOTES.md).

## Project structure

```
src/
  app/                 routes (expo-router)
    _layout.tsx        token gate + claims provider + stack
    index.tsx          Home: balances
    claim.tsx          claim form → review → confirm
    claim-status.tsx   claim status / unknown-outcome checking
    token.tsx          change token
  api/
    client.ts          typed fetch: timeout, GET retries, strict response parsing
    errors.ts          ApiError + user-facing messages
  claims/
    store.ts           persisted claim attempts (Idempotency-Key + exact body)
    claims-provider.tsx  submit, re-check with same key, poll pending claims
  lib/
    money.ts           bigint amounts: parse, format, validate, USD
    display-balance.ts balance correction after a claim (pure)
  hooks/               balances polling, corrected balances, claim options, clock
  components/          UI building blocks (button, card, states, …)
  constants/theme.ts   colors, radius, spacing
  config.ts            API base URL (only place it appears)
```
