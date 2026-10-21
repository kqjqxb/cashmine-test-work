import { createContext, useContext, useState, type ReactNode } from 'react';

import { readStorage, writeStorage } from '@/lib/storage';

const STORAGE_KEY = 'cashmine.token';

type TokenContextValue = { token: string | null; setToken: (token: string) => void };

const TokenContext = createContext<TokenContextValue | null>(null);

/** Holds the user's API token. It only ever lives in memory and browser storage; it is never logged. */
export function TokenProvider({ children }: { children: ReactNode }) {
  // localStorage is synchronous and web output is a single-page app (no SSR), so we can read it on first render.
  const [token, setTokenState] = useState(() => readStorage(STORAGE_KEY));

  const setToken = (next: string) => {
    writeStorage(STORAGE_KEY, next);
    setTokenState(next);
  };

  return <TokenContext.Provider value={{ token, setToken }}>{children}</TokenContext.Provider>;
}

export function useToken(): TokenContextValue {
  const value = useContext(TokenContext);
  if (!value) throw new Error('useToken must be used inside TokenProvider');
  return value;
}
