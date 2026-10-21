// Browser storage can be missing or throw (private mode, blocked site data), so every access is guarded.
// The app still works without it; the value just doesn't survive a reload.

export function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Ignored on purpose: see the note above.
  }
}
