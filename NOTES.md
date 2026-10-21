# Notes

## Decisions

**Amounts are `bigint` in the asset's smallest unit.** A JS `number` would silently change an 18-decimal ETH value like `"12.345678901234591676"`. API strings are parsed once, strictly, when the response arrives; a malformed amount is an error, never 0. User input is lenient only on surrounding whitespace and a comma as the decimal separator. Plain `bigint` instead of a decimal library: it's built in and the math needed is small. USD is computed exactly and rounded to cents only for display.

**USD total = available only.** Pending can still be reversed by the exchange, and claiming money is already leaving the account. The headline is money the user can act on now; pending and claiming are shown per asset.

**Balance right after a claim: C + D's note.** The next 1–2 snapshots (recomputed every 15s) can still show the old balance, so the app corrects them for this device's claims using server timestamps only:
- **Snapshot older than the claim** (`asOf < createdAt`): the amount is moved from available to claiming on screen.
- **Failed claim, snapshot older than its `updatedAt`:** the amount goes back to available.
- **Snapshot at or after settlement:** the snapshot is the truth and the correction stops.

Each card also notes "Claim … in progress / completed / failed". Alternatives:
- **A, server data only:** the balance looks unchanged for up to ~30s, so the user claims again.
- **B, naive optimistic deduction:** a stale snapshot undoes it, so the balance drops then jumps back.
- **D alone:** honest, but the number lags.

C reacts at once and only moves backwards for a failure that comes with a reason; the device clock doesn't matter. Confirmed live: a snapshot taken at 12:07:44, before a claim created at 12:07:49, showed the old balance; the 12:07:59 snapshot showed available −20 and claiming +20.

*Product owner's override:* the Claim button stays enabled while a claim is in flight. Validation uses the corrected balance and the server checks live, so the same money can't be claimed twice; disabling would block a legitimate claim of the remainder.

**Unknown claim outcome.** A timeout, network error, 5xx or 429 on `POST /v1/claims` means "unknown", never "failed".
- **Before sending:** the Idempotency-Key and exact body are saved to localStorage.
- **Re-checking:** the app re-sends the same key and body with backoff. The server either replays the original claim or creates it once.
- **If still unknown:** "We couldn't confirm your claim yet. Don't submit it again." with a "Check again" button. Attempts resume after a reload (banner on Home).
- **Clearing:** only a claim object or a definite 4xx clears the attempt.

Confirmed live: a POST returned 504 but the claim existed. The same key returned 200, `Idempotent-Replayed: true`, and the same id; a new key would have created a duplicate.

**Retry policy.** GETs get at most 3 attempts, each with a 10s timeout:
- **429:** wait `retryAfterMs` or `Retry-After`; if it asks for more than 10s, show the error instead.
- **500, 503, 504 and network errors:** exponential backoff with jitter.

The HTTP layer never retries a POST; only the claim logic does, with the same key.

**Token storage.** The user pastes the token at runtime and it is stored in localStorage, behind guarded access. It is never in code, the repo, logs or the build. A 401 doesn't clear the token; the user chooses "Change token". Claims are stored under a hash of the token, so accounts never mix.

## Working with AI

### TODO: heading 1
TODO (see `ai-logs/`)

### TODO: heading 2
TODO (see `ai-logs/`)

### TODO: heading 3
TODO (see `ai-logs/`)

## Not done / known issues

- **No browser end-to-end tests.** Unit tests cover the money logic, the API client, the balance correction and the claim store; the screens were not tested automatically.
- **"Updated Xs ago" uses the device clock.** The browser can't read the server's `Date` header (CORS), so a wrong phone clock skews the label.
- **Unknown-outcome attempts don't adjust the displayed balance.** We don't know the claim exists, so they show a warning banner instead.
- **Claims made on another device** aren't corrected locally; they appear through snapshots within ~15–30s.
- **Decision C assumes `asOf` is exactly when the snapshot was taken.** The live test supports this but the docs don't guarantee it; displayed balances are clamped at 0.
- **Activity:** an item for an asset that isn't in balances shows the raw amount. There's no pull-to-refresh, and the history doesn't refresh on its own.
- **Pull-to-refresh on web** is a small custom touch handler, untested across mobile browsers; the Refresh button always works.
- **Blocked localStorage:** the token and pending attempts don't survive a reload.
- **Unused template npm dependencies** are still installed. They aren't imported, so they aren't in the bundle.
