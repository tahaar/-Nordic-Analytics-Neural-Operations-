import fs from "fs";
import path from "path";

export type CacheEntry<T> = { value: T; expiresAt: number };
export type CacheStore = Record<string, CacheEntry<unknown>>;

const CACHE_FILE = process.env.CACHE_FILE || "/data/cache.json";
const CACHE_TTL_MS = 1000 * 60 * 5;
const MEMORY_CACHE: CacheStore = {};

export function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      Object.assign(MEMORY_CACHE, JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")));
    }
  } catch {}
}

export function saveCacheToDisk() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(MEMORY_CACHE), "utf-8");
  } catch {}
}

export function getFromCache<T>(key: string): T | null {
  const e = MEMORY_CACHE[key];
  if (!e || Date.now() > e.expiresAt) return null;
  return e.value as T;
}

export function setToCache<T>(key: string, value: T, ttlMs = CACHE_TTL_MS) {
  MEMORY_CACHE[key] = { value, expiresAt: Date.now() + ttlMs };
}
