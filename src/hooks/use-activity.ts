import { useCallback, useEffect, useRef, useState } from 'react';

import { getActivity, type ActivityItem } from '@/api/client';
import { ApiError, toApiError } from '@/api/errors';

type State = {
  items: ActivityItem[];
  nextCursor: string | null;
  /** True until the first page arrives (or fails). */
  loading: boolean;
  loadingMore: boolean;
  /** First page failed: nothing to show. */
  error: ApiError | null;
  /** A later page failed: loaded items are kept. */
  moreError: ApiError | null;
};

const INITIAL: State = { items: [], nextCursor: null, loading: true, loadingMore: false, error: null, moreError: null };

/** Cursor-paginated history. Starts once `decimalsByAsset` (from balances) is known; one request at a time. */
export function useActivity(token: string, decimalsByAsset: Record<string, number> | null) {
  const [state, setState] = useState<State>(INITIAL);
  const inFlight = useRef(false);
  // Read through a ref: a balances refresh must not restart pagination.
  // Declared before the effect that starts loading, so it runs first.
  const decimals = useRef(decimalsByAsset);
  useEffect(() => {
    decimals.current = decimalsByAsset;
  }, [decimalsByAsset]);

  /** cursor undefined = first page. Only sets state after the await (callers set the loading flags). */
  const fetchPage = useCallback(
    async (cursor?: string) => {
      if (inFlight.current || !decimals.current) return;
      inFlight.current = true;
      try {
        const page = await getActivity(token, decimals.current, cursor);
        setState((s) => {
          const seen = new Set(cursor ? s.items.map((i) => i.id) : []);
          const items = [...(cursor ? s.items : []), ...page.items.filter((i) => !seen.has(i.id))];
          return { ...INITIAL, items, nextCursor: page.nextCursor, loading: false };
        });
      } catch (e) {
        const error = toApiError(e);
        setState((s) => (cursor ? { ...s, loadingMore: false, moreError: error } : { ...INITIAL, loading: false, error }));
      } finally {
        inFlight.current = false;
      }
    },
    [token],
  );

  const ready = decimalsByAsset !== null;
  useEffect(() => {
    if (ready) void fetchPage();
  }, [ready, fetchPage]);

  const retry = () => {
    setState(INITIAL);
    void fetchPage();
  };

  const loadMore = () => {
    if (!state.nextCursor || inFlight.current) return;
    setState((s) => ({ ...s, loadingMore: true, moreError: null }));
    void fetchPage(state.nextCursor);
  };

  return { ...state, retry, loadMore };
}
