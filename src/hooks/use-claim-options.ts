import { useEffect, useState } from 'react';

import { getClaimOptions, type ClaimOptions } from '@/api/client';
import { ApiError, toApiError } from '@/api/errors';

type State = { options: ClaimOptions | null; error: ApiError | null; loading: boolean };

/** Loads claim options once `decimals` is known (from balances). `reload` is for the Retry button. */
export function useClaimOptions(token: string, asset: string, decimals: number | undefined) {
  const [state, setState] = useState<State>({ options: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (decimals === undefined) return;
    const controller = new AbortController();
    getClaimOptions(token, asset, decimals, controller.signal).then(
      (options) => setState({ options, error: null, loading: false }),
      (error) => !controller.signal.aborted && setState({ options: null, error: toApiError(error), loading: false }),
    );
    return () => controller.abort();
  }, [token, asset, decimals, attempt]);

  const reload = () => {
    setState({ options: null, error: null, loading: true });
    setAttempt((n) => n + 1);
  };

  return { ...state, reload };
}
