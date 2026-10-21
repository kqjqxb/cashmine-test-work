# Notes

## Decisions

**Amounts are `bigint` in the asset's smallest unit.** ETH has 18 decimals; a JS `number` keeps only ~15–17 significant digits, so `"12.345678901234591676"` would silently change. API strings are parsed once, strictly, when the response arrives (`src/lib/money.ts`); a malformed amount is an error, never 0. User input is lenient only on surrounding whitespace and a comma as the decimal separator. I chose plain `bigint` over a decimal library because it is built into the language and the needed math (add, subtract, compare, scale) is small. USD values are exact (`units / 10^scale`) and are rounded to cents only when formatted.

**USD total = available only.** Pending can still be reversed by the exchange, and claiming money is already leaving the account. The headline is money the user can act on now; pending and claiming are shown per asset. If any `usdPrice` is malformed, the total shows "—" rather than a partial number.

**Balance right after a claim: C (correct the snapshot using server timestamps) + D's note.** Balances are a snapshot recomputed every 15s, so the 1–2 snapshots after a claim can still show the old balance. Claims are stored locally per token, and the snapshot is corrected:
- **Snapshot older than the claim** (`asOf < createdAt`): the snapshot doesn't know the claim yet, so the amount is moved from available to claiming on screen.
- **Failed claim, snapshot older than its `updatedAt`:** the amount goes back to available on screen.
- **Snapshot at or after the settled claim's `updatedAt`:** the snapshot is the truth and the correction stops.
- **Never below 0:** displayed balances are clamped at 0.

Each card also notes "Claim of X in progress / completed / failed".

Alternatives considered:
- **A, server data only:** the balance stays unchanged for ~30s, which led to the complaint "I claimed again".
- **B, naive optimistic deduction:** a stale snapshot undoes the deduction, which led to "dropped then jumped back".
- **D alone:** honest, but the number lags.

C reacts immediately and never moves backwards except for a failure that comes with a reason. It compares only server times, so the device clock doesn't matter. This was checked live: a snapshot with `asOf` 12:07:44, before the claim's `createdAt` of 12:07:49, showed the old balance; the snapshot at 12:07:59 showed available −20 and claiming +20.

**Override (product owner): the Claim button stays enabled while a claim is in flight.** Max and validation use the corrected available, so the same money can't be claimed twice, and the server checks available live. Disabling the button would block a legitimate claim of the remaining balance, with no visible reason.

**Unknown claim outcome.** A 504, client timeout, network error, 5xx or 429 on `POST /v1/claims` means "we don't know", never "failed". The attempt (Idempotency-Key and exact body) is written to localStorage *before* sending.
- **Automatic re-send:** the same key and body are sent again after 1s, 3s and 7s. The server then either replays the original claim or creates it exactly once.
- **If still unknown:** the app shows "We couldn't confirm your claim yet. Don't submit it again." with a "Check again" button that uses the same key.
- **After a reload:** unresolved attempts resume automatically, and Home shows a banner for them.
- **When the attempt is cleared:** only on receiving a claim object, or a definite 4xx (any 4xx except 429).

Live evidence: a POST returned 504 but the claim *was* created. Repeating it with the same key returned 200, `Idempotent-Replayed: true`, and the same claim id. A new key would have created a second claim.

**Retry policy.**
- **GETs:** at most 3 attempts with a 10s timeout each.
  - A 429 waits `retryAfterMs` or `Retry-After`. If that is over 10s, the error is shown instead of making the UI hang.
  - 500, 503, 504 and network errors back off at 400ms·2ⁿ with random jitter.
- **POST `/v1/claims`:** never retried by the HTTP layer. Only the claims logic re-sends it, with the same key and body.
- **Polling:** balances poll every 15s while Home is open (one request at a time), and pending claims every 2s.

**Token storage.** The user pastes the token at runtime (masked input) and it is stored in localStorage; every storage access is wrapped in try/catch. It is never in code, the repo, logs or the build. I checked that the web export doesn't contain the `.env` token. A 401 never clears the token automatically; the user chooses "Change token". Claims are stored under a hash of the token, so switching tokens never mixes accounts.

## Working with AI

### TODO: heading 1
TODO (see `ai-logs/`)

### TODO: heading 2
TODO (see `ai-logs/`)

### TODO: heading 3
TODO (see `ai-logs/`)

## Not done / known issues

- **Activity history** isn't built. `getActivity` and signed-amount parsing exist in the client, but there is no screen.
- **No browser end-to-end tests.** Unit tests cover the money logic, the API client, the balance correction and the claim store. The screens were not tested automatically.
- **"Updated Xs ago" uses the device clock** (`now − asOf`). The browser can't read the server's `Date` header (CORS), so a wrong phone clock skews the label.
- **Unknown-outcome attempts don't adjust the displayed balance**, because we don't know the claim exists. They get a warning banner instead; if the claim does exist, the next snapshot shows it.
- **Claims made on another device** aren't corrected locally; they appear through snapshots within ~15–30s.
- **Assumption about `asOf`:** decision C assumes `asOf` is exactly when the snapshot was taken. The live test supports this, but it isn't guaranteed by the docs. The clamp at 0 limits the damage if it's wrong.
- **Pull-to-refresh on web** is a small custom touch handler, because react-native-web's `RefreshControl` does nothing. It's untested on every mobile browser, and the Refresh button is always there.
- **Error envelope:** a 409 `IDEMPOTENCY_MISMATCH` is treated as a definite rejection. It shouldn't happen, because the body is persisted and re-sent byte for byte.
- **Storage:** if the browser blocks localStorage, the token and pending attempts don't survive a reload. The app still works within the session.
- **Unused template npm dependencies** are still installed. They aren't imported, so they aren't in the bundle.
