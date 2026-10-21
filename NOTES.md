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

### 1. A prompt that didn't come out the way I meant it
I asked for PLAN.md "with exactly this content", but I never closed the ```` ```markdown ```` block, and my instruction came after it. The AI had to guess where the file ended; it said so and named the line it stopped at, so I could check rather than find out later. Lesson: keep file content and instructions in separate, closed blocks. Search: `the markdown block in your message wasn't closed`.

### 2. AI output that was risky, and how I checked it
Decision C relied on `asOf` being the exact time the snapshot was taken; the AI listed this as the main risk, unverified. I tested it with curl against the live API. A snapshot from before the claim showed the old balance and the next one showed −20/+20. The same test returned a 504 for a claim that had been created, and it replayed under the same Idempotency-Key, which proves a "new key on retry" would double-claim. Search: `This confirms the asOf vs createdAt assumption behind decision C`.

### 3. A suggestion I rejected
The AI recommended keeping D's disabled Claim button ("Keeping D's note and the disabled Claim button limits the damage"). I overrode it. Validation already uses the corrected available and the server checks live, so double-claiming the same money is impossible, while a disabled button would block a legitimate claim of the remainder with no visible reason. Search: `do NOT disable the Claim button while a claim is in flight`.

## Not done / known issues

- **No browser end-to-end tests.** Unit tests cover the money logic, the API client, the balance correction and the claim store.
- **"Updated Xs ago" uses the device clock.** The server's `Date` header isn't readable through CORS.
- **Unknown-outcome attempts don't adjust the balance**, because the claim may not exist; they show a banner instead. Claims made on another device appear only through snapshots.
- **Decision C assumes `asOf` is exactly when the snapshot was taken.** Verified live once, not guaranteed by the docs; displayed balances are clamped at 0.
- **Smaller gaps:**
  - Activity has no auto-refresh, and an item for an asset not in balances shows the raw amount.
  - Pull-to-refresh on web is a custom touch handler.
  - If localStorage is blocked, the token and pending attempts are lost on reload.
  - Unused template dependencies are still installed (not bundled).
