import { createClaim, getBalances } from './client';
import { ApiError } from './errors';

const BALANCES = {
  asOf: '2026-10-20T08:01:15.000Z',
  items: [{ asset: 'ETH', decimals: 18, available: '12.345678901234591676', pending: '0', claiming: '0.5', usdPrice: '2500' }],
};

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
}

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

describe('getBalances', () => {
  it('parses amounts into bigint and sends the token', async () => {
    fetchMock.mockReturnValueOnce(reply(200, BALANCES));
    const balances = await getBalances('secret');
    expect(balances.items[0].available).toBe(12_345678901234591676n);
    expect(balances.items[0].claiming).toBe(500_000_000_000_000_000n);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
  });

  it('retries 429 (after retryAfterMs) and 503, then succeeds', async () => {
    fetchMock
      .mockReturnValueOnce(reply(429, { error: { code: 'RATE_LIMITED', message: 'slow down', retryAfterMs: 5 } }))
      .mockReturnValueOnce(reply(503, { error: { code: 'SERVER', message: 'down' } }))
      .mockReturnValueOnce(reply(200, BALANCES));
    await expect(getBalances('t')).resolves.toMatchObject({ asOf: BALANCES.asOf });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 attempts', async () => {
    fetchMock.mockImplementation(() => reply(429, { error: { code: 'RATE_LIMITED', message: 'x', retryAfterMs: 1 } }));
    await expect(getBalances('t')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry 401 and keeps status + code', async () => {
    fetchMock.mockReturnValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: 'bad token' } }));
    const error = await getBalances('t').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'bad token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a JSON number', 12.5],
    ['an invalid string', '1e-3'],
    ['too many decimals', '0.0000000000000000001'],
    ['missing', undefined],
  ])('rejects an amount that is %s instead of defaulting to 0', async (_, available) => {
    fetchMock.mockReturnValueOnce(reply(200, { ...BALANCES, items: [{ ...BALANCES.items[0], available }] }));
    await expect(getBalances('t')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('createClaim', () => {
  const claim = { asset: 'ETH', decimals: 18, amount: 500_000_000_000_000_000n, destinationId: 'dest_wallet' };

  it('is never retried, even on 503', async () => {
    fetchMock.mockReturnValue(reply(503, { error: { code: 'SERVER', message: 'down' } }));
    await expect(createClaim('t', claim, 'key-1')).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the amount as an exact string with the Idempotency-Key', async () => {
    fetchMock.mockReturnValueOnce(
      reply(
        200,
        {
          id: 'clm_1', asset: 'ETH', amount: '0.5', fee: '0.0012', receiveAmount: '0.4988', destinationId: 'dest_wallet',
          status: 'pending', failureReason: null, createdAt: 'x', updatedAt: 'x',
        },
        { 'Idempotent-Replayed': 'true' },
      ),
    );
    const result = await createClaim('t', claim, 'key-1');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet' });
    expect(init.headers['Idempotency-Key']).toBe('key-1');
    expect(result.replayed).toBe(true);
    expect(result.claim.receiveAmount).toBe(498_800_000_000_000_000n);
  });
});
