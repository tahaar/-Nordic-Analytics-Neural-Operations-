import { useEffect, useState } from "react";

const PINNED_STORAGE_KEY = "pinnedMatches";

function readPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function usePinned() {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(readPinned());
  }, []);

  const persist = (next: string[]) => {
    setPinned(next);
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
  };

  const toggle = (matchKey: string) => {
    const next = pinned.includes(matchKey)
      ? pinned.filter((m) => m !== matchKey)
      : [...pinned, matchKey];
    persist(next);
  };

  return { pinned, toggle };
}
