export class ApiError extends Error {
  /** HTTP status; 0 when there was no HTTP error response (network, timeout, cancelled, malformed body). */
  readonly status: number;
  /** Server code (VALIDATION, UNAUTHORIZED, RATE_LIMITED, SERVER, TIMEOUT, ...) or a client one (NETWORK, CLIENT_TIMEOUT, ABORTED, BAD_RESPONSE). */
  readonly code: string;
  readonly field?: string;
  readonly retryAfterMs?: number;

  constructor(status: number, code: string, message: string, extra: { field?: string; retryAfterMs?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = extra.field;
    this.retryAfterMs = extra.retryAfterMs;
  }
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', 'Something went wrong');
}

export const isUnauthorized = (error: ApiError) => error.status === 401;

/** Short user-facing text. Never includes the token or request details. */
export function describeError(error: ApiError): string {
  if (isUnauthorized(error)) return 'Token invalid or expired';
  switch (error.code) {
    case 'RATE_LIMITED':
      return 'Too many requests. Try again in a moment.';
    case 'NETWORK':
      return 'No connection to CashMine. Check your internet.';
    case 'CLIENT_TIMEOUT':
    case 'TIMEOUT':
    case 'SERVER':
      return 'CashMine is temporarily unavailable.';
    case 'BAD_RESPONSE':
      return 'The server sent data we could not read safely.';
    default:
      return error.message || 'Something went wrong';
  }
}
