import { useSyncExternalStore } from "react";
import { readStorage, storageKeys, writeStorage } from "./storage";

export type ThemePreference = "light" | "dark" | "system";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
let preference: ThemePreference = initialPreference();

function initialPreference(): ThemePreference {
  const stored = readStorage(storageKeys.theme);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function notify(): void {
  for (const listener of listeners) listener();
}

media.addEventListener("change", notify);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  writeStorage(storageKeys.theme, next === "system" ? null : next);
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  notify();
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference);
}

/** Whether the effective theme is dark (explicit choice, or the OS setting when on "system"). */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => preference === "dark" || (preference === "system" && media.matches));
}
