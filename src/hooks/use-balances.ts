import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getBalances, type Balances } from '@/api/client';
import { ApiError, toApiError } from '@/api/errors';

/** Snapshots are recomputed every 15s on the server, so polling faster is pointless. */
const REFRESH_INTERVAL_MS = 15_000;

type State = {
  data: Balances | null;
  /** Error of the last refresh. Old `data` is kept when a refresh fails. */
  error: ApiError | null;
  refreshing: boolean;
};

/** Loads balances while the screen is focused and refreshes them every 15s. Only one request runs at a time. */
export function useBalances(token: string) {
  const [state, setState] = useState<State>({ data: null, error: null, refreshing: false });
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setState((s) => ({ ...s, refreshing: true }));
    try {
      const data = await getBalances(token, controller.signal);
      setState({ data, error: null, refreshing: false });
    } catch (error) {
      // Cancelled because the screen lost focus: nothing to show, the next focus starts a fresh request.
      if (controller.signal.aborted) return;
      setState((s) => ({ ...s, error: toApiError(error), refreshing: false }));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, REFRESH_INTERVAL_MS);
      return () => {
        clearInterval(id);
        inFlight.current?.abort();
        inFlight.current = null;
      };
    }, [refresh]),
  );

  return { ...state, refresh };
}
