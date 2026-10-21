# Notes

## Decisions

**Amounts are `bigint` in the asset's smallest unit.** A JS `number` would silently change an 18-decimal ETH value like `"12.345678901234591676"`. I used plain `bigint` rather than a decimal library: it's built in and the math needed is small. API strings are parsed strictly, once; a malformed amount is an error, never 0. User input also accepts surrounding whitespace and a decimal comma. USD is computed exactly and rounded to cents only for display.

**USD total = available only.** Pending can still be reversed by the exchange, and claiming money is already leaving the account. The headline is what the user can act on now; the others are shown per asset.

**Balance right after a claim: C + D's note.** The 1–2 snapshots after a claim can still show the old balance. The app corrects them for this device's claims, comparing server timestamps only:
- **Snapshot older than the claim:** the amount is moved to claiming.
- **Failed claim:** the amount goes back to available.
- **Snapshot at or after settlement:** the snapshot is the truth.

Each card also notes "Claim … in progress / completed / failed".

Alternatives:
- **A, server data only:** the balance looks unchanged for ~30s, so the user claims again.
- **B, naive optimistic deduction:** a stale snapshot undoes it, so the balance drops then jumps back.
- **D alone:** honest, but the number lags.

C reacts at once, only moves backwards for a failure that comes with a reason, and ignores the device clock. Verified live (see Working with AI #2).

*My override:* the Claim button stays enabled while a claim is in flight. Validation uses the corrected balance and the server checks live, so the same money can't be claimed twice. Disabling the button would block a legitimate claim of the remainder.

**Unknown claim outcome.** A timeout, network error, 5xx or 429 on the claim POST means "unknown", never "failed".
- **Before sending:** the Idempotency-Key and exact body are saved.
- **Re-checking:** the same key and body are re-sent with backoff, so the claim is replayed or created exactly once.
- **If still unknown:** "We couldn't confirm your claim yet. Don't submit it again." with "Check again", and the attempt resumes after a reload.
- **Clearing:** only a claim object or a definite 4xx clears the attempt. Verified live: a 504'd POST had created the claim and the same key replayed it.

**Retry policy.** GETs get at most 3 attempts with a 10s timeout each: 429 honors `retryAfterMs` (but errors rather than wait over 10s), and 5xx and network errors back off with jitter. POSTs are retried only by the claim logic, with the same key.

**Token storage.** The user pastes the token at runtime and it's kept in localStorage; it is never in code, the repo, logs or the build. A 401 doesn't clear it; the user chooses "Change token". Claims are stored per token hash, so accounts never mix.

## Working with AI

### 1. A prompt that didn't get me what I wanted
For the claim flow I asked the AI to "stop after each part to run tests" and report after each part so I could commit. It did all three parts in one turn with summaries in between, so I never got a clean pause to commit. Next time I'd ask for one part per message. Search: `stop after each part to run tests`.

### 2. AI output that was risky, and how I checked it
Decision C relied on `asOf` being the exact snapshot time, which the AI flagged as unverified. I checked with curl against the live API: a snapshot from before the claim showed the old balance and the next showed −20/+20. A 504'd POST turned out to have created the claim and was replayed under the same Idempotency-Key, which proves a "new key on retry" would double-claim. Separately, in step 1 the AI ran `git stash -u` on uncommitted work and the restore collided with a generated file; nothing was lost, but it was risky. Search: `This confirms the asOf vs createdAt assumption behind decision C`, `could not restore untracked files from stash`.

### 3. A suggestion I rejected
I overrode the AI's recommendation to keep D's disabled Claim button ("Keeping D's note and the disabled Claim button limits the damage"). With the corrected balance and the server's live check, the same money can't be claimed twice, and a disabled button would block a legitimate claim of the remainder without explanation. Search: `do NOT disable the Claim button while a claim is in flight`.

## Not done / known issues

- **No browser end-to-end tests**, only unit tests (money, API client, balance correction, claim store).
- **"Updated Xs ago" uses the device clock.** The server's `Date` header isn't readable through CORS.
- **Unknown-outcome attempts don't adjust the balance** (banner instead); other devices' claims appear only via snapshots.
- **Smaller gaps:** Activity doesn't auto-refresh; web pull-to-refresh is a custom handler; blocked localStorage loses state on reload.
