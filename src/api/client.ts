import { API_BASE_URL } from '@/config';
import { parseAmount, parseSignedAmount } from '@/lib/money';

import { ApiError } from './errors';

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;
/** A 429 asking us to wait longer than this is surfaced to the user instead of silently waiting. */
const MAX_RETRY_WAIT_MS = 10_000;

// ---------- Types (amounts already parsed to bigint smallest units) ----------

export type Balance = {
  asset: string;
  decimals: number;
  available: bigint;
  pending: bigint;
  claiming: bigint;
  /** Kept as the API string; money.computeUsd parses it exactly. */
  usdPrice: string;
};
export type Balances = { asOf: string; asOfMs: number; items: Balance[] };

export type Destination = { id: string; label: string };
export type ClaimOptions = { asset: string; minAmount: bigint; fee: bigint; destinations: Destination[] };

export type ClaimStatus = 'pending' | 'completed' | 'failed';
export type Claim = {
  id: string;
  asset: string;
  amount: bigint;
  fee: bigint;
  receiveAmount: bigint;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};
/** The exact POST body. Persisted as-is so a retry with the same Idempotency-Key sends the same body. */
export type ClaimBody = { asset: string; amount: string; destinationId: string };

export type ActivityItem = {
  id: string;
  type: 'accrual' | 'reversal' | 'claim';
  asset: string;
  /** Signed: negative for reversals and claims. null when the asset is not in balances (decimals unknown). */
  amount: bigint | null;
  decimals: number | null;
  /** The API string, shown as-is when `amount` is null. */
  rawAmount: string;
  status: string;
  exchange: string | null;
  createdAt: string;
  relatedId: string | null;
};
export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

// ---------- Endpoints ----------

export async function getBalances(token: string, signal?: AbortSignal): Promise<Balances> {
  const o = object(await request('/v1/balances', { token, signal }), 'balances');
  const asOf = string(o, 'asOf');
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) badResponse('asOf');
  return { asOf, asOfMs, items: array(o, 'items').map(parseBalance) };
}

export async function getClaimOptions(token: string, asset: string, decimals: number, signal?: AbortSignal): Promise<ClaimOptions> {
  const o = object(await request(`/v1/claim-options?asset=${encodeURIComponent(asset)}`, { token, signal }), 'claim options');
  return {
    asset: string(o, 'asset'),
    minAmount: amount(o, 'minAmount', decimals),
    fee: amount(o, 'fee', decimals),
    destinations: array(o, 'destinations').map((raw) => {
      const d = object(raw, 'destination');
      return { id: string(d, 'id'), label: string(d, 'label') };
    }),
  };
}

/** Never retried here: a retry must reuse the same Idempotency-Key and body, which the caller owns. */
export async function createClaim(
  token: string,
  body: ClaimBody,
  decimals: number,
  idempotencyKey: string,
): Promise<{ claim: Claim; replayed: boolean }> {
  let replayed = false;
  const data = await request('/v1/claims', {
    token,
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
    onResponse: (response) => (replayed = response.headers.get('Idempotent-Replayed') === 'true'),
  });
  return { claim: parseClaim(data, decimals), replayed };
}

export async function getClaim(token: string, id: string, decimals: number, signal?: AbortSignal): Promise<Claim> {
  return parseClaim(await request(`/v1/claims/${encodeURIComponent(id)}`, { token, signal }), decimals);
}

/** `decimalsByAsset` comes from balances: activity amounts can only be parsed with their asset's decimals. */
export async function getActivity(
  token: string,
  decimalsByAsset: Record<string, number>,
  cursor?: string,
  signal?: AbortSignal,
): Promise<ActivityPage> {
  const query = cursor ? `?limit=20&cursor=${encodeURIComponent(cursor)}` : '?limit=20';
  const o = object(await request(`/v1/activity${query}`, { token, signal }), 'activity');
  return {
    items: array(o, 'items').map((raw) => parseActivityItem(raw, decimalsByAsset)),
    nextCursor: nullableString(o, 'nextCursor'),
  };
}

// ---------- Transport ----------

type RequestOptions = {
  token: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  onResponse?: (response: Response) => void;
};

/** GETs are retried on 429 / 500 / 503 / 504 / network errors, up to MAX_ATTEMPTS. POSTs are sent once. */
async function request(path: string, options: RequestOptions): Promise<unknown> {
  const retryable = (options.method ?? 'GET') === 'GET';
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestOnce(path, options);
    } catch (error) {
      if (!retryable || attempt >= MAX_ATTEMPTS || !(error instanceof ApiError)) throw error;
      const delay = retryDelayMs(error, attempt);
      if (delay === null) throw error;
      await sleep(delay, options.signal);
    }
  }
}

async function requestOnce(path: string, { token, method = 'GET', body, headers, signal, onResponse }: RequestOptions) {
  // One controller for both our timeout and the caller's cancel signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);

  let response: Response;
  let text: string;
  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch {
    if (signal?.aborted) throw new ApiError(0, 'ABORTED', 'Request cancelled');
    if (controller.signal.aborted) throw new ApiError(0, 'CLIENT_TIMEOUT', 'The server took too long to respond');
    throw new ApiError(0, 'NETWORK', 'Network error');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }

  const data = parseJson(text);
  if (!response.ok) throw errorFromResponse(response, data);
  if (data === undefined) badResponse('not JSON');
  onResponse?.(response);
  return data;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Reads the { error: { code, message, field?, retryAfterMs? } } envelope; tolerates a missing or broken one. */
function errorFromResponse(response: Response, data: unknown): ApiError {
  const envelope = isObject(data) && isObject(data.error) ? data.error : {};
  const code = typeof envelope.code === 'string' ? envelope.code : `HTTP_${response.status}`;
  const message = typeof envelope.message === 'string' ? envelope.message : `Request failed (${response.status})`;
  const field = typeof envelope.field === 'string' ? envelope.field : undefined;
  const headerSeconds = Number(response.headers.get('Retry-After'));
  const retryAfterMs =
    typeof envelope.retryAfterMs === 'number' ? envelope.retryAfterMs : headerSeconds > 0 ? headerSeconds * 1000 : undefined;
  return new ApiError(response.status, code, message, { field, retryAfterMs });
}

/** null = do not retry. */
function retryDelayMs(error: ApiError, attempt: number): number | null {
  if (error.status === 429) {
    const wait = error.retryAfterMs ?? BASE_BACKOFF_MS * 2 ** attempt;
    return wait <= MAX_RETRY_WAIT_MS ? wait : null;
  }
  const transient = [500, 503, 504].includes(error.status) || error.code === 'NETWORK' || error.code === 'CLIENT_TIMEOUT';
  if (!transient) return null;
  // Exponential backoff with jitter so parallel requests don't retry in lockstep.
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * BASE_BACKOFF_MS;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError(0, 'ABORTED', 'Request cancelled'));
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }
    function cancel() {
      clearTimeout(timer);
      reject(new ApiError(0, 'ABORTED', 'Request cancelled'));
    }
    signal?.addEventListener('abort', cancel);
  });
}

// ---------- Response parsing: anything unexpected is an error, never a default value ----------

function parseBalance(raw: unknown): Balance {
  const o = object(raw, 'balance');
  const decimals = o.decimals;
  // Upper bound is a sanity check: no real asset has more than 36 decimals.
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) badResponse('decimals');
  return {
    asset: string(o, 'asset'),
    decimals,
    available: amount(o, 'available', decimals),
    pending: amount(o, 'pending', decimals),
    claiming: amount(o, 'claiming', decimals),
    usdPrice: string(o, 'usdPrice'),
  };
}

const CLAIM_STATUSES: readonly ClaimStatus[] = ['pending', 'completed', 'failed'];

function parseClaim(raw: unknown, decimals: number): Claim {
  const o = object(raw, 'claim');
  const status = string(o, 'status');
  if (!CLAIM_STATUSES.includes(status as ClaimStatus)) badResponse('claim status');
  return {
    id: string(o, 'id'),
    asset: string(o, 'asset'),
    amount: amount(o, 'amount', decimals),
    fee: amount(o, 'fee', decimals),
    receiveAmount: amount(o, 'receiveAmount', decimals),
    destinationId: string(o, 'destinationId'),
    status: status as ClaimStatus,
    failureReason: nullableString(o, 'failureReason'),
    createdAt: string(o, 'createdAt'),
    updatedAt: string(o, 'updatedAt'),
  };
}

const ACTIVITY_TYPES: readonly ActivityItem['type'][] = ['accrual', 'reversal', 'claim'];

function parseActivityItem(raw: unknown, decimalsByAsset: Record<string, number>): ActivityItem {
  const o = object(raw, 'activity item');
  const type = string(o, 'type');
  if (!ACTIVITY_TYPES.includes(type as ActivityItem['type'])) badResponse('activity type');
  const asset = string(o, 'asset');
  const rawAmount = string(o, 'amount');
  // Unknown asset: one row can't be parsed, but that must not hide the rest of the history.
  const decimals = decimalsByAsset[asset] ?? null;
  let amount: bigint | null = null;
  if (decimals !== null) {
    const parsed = parseSignedAmount(rawAmount, decimals);
    if (!parsed.ok) badResponse('amount');
    amount = parsed.value;
  }
  return {
    id: string(o, 'id'),
    type: type as ActivityItem['type'],
    asset,
    amount,
    decimals,
    rawAmount,
    status: string(o, 'status'),
    exchange: nullableString(o, 'exchange'),
    createdAt: string(o, 'createdAt'),
    relatedId: nullableString(o, 'relatedId'),
  };
}

function badResponse(what: string): never {
  throw new ApiError(0, 'BAD_RESPONSE', `Unexpected server response (${what})`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown, what: string): Record<string, unknown> {
  if (!isObject(value)) badResponse(what);
  return value;
}

function array(o: Record<string, unknown>, key: string): unknown[] {
  const value = o[key];
  if (!Array.isArray(value)) badResponse(key);
  return value;
}

function string(o: Record<string, unknown>, key: string): string {
  const value = o[key];
  if (typeof value !== 'string') badResponse(key);
  return value;
}

function nullableString(o: Record<string, unknown>, key: string): string | null {
  return o[key] === null ? null : string(o, key);
}

/** Strict: the API must send a valid decimal string, e.g. "0.5". */
function amount(o: Record<string, unknown>, key: string, decimals: number): bigint {
  const parsed = parseAmount(string(o, key), decimals);
  if (!parsed.ok) badResponse(key);
  return parsed.value;
}
