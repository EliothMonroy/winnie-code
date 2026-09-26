export const storageKeys = {
  theme: "winnie:theme",
  code: (slug: string) => `winnie:code:${slug}`,
  solved: (slug: string) => `winnie:solved:${slug}`,
  split: (name: string) => `winnie:split:${name}`,
};

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a value; null removes the key. Silently ignores unavailable storage. */
export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, blocked site data): the app still works without persistence
  }
}

export function isSolved(slug: string): boolean {
  return readStorage(storageKeys.solved(slug)) === "1";
}
