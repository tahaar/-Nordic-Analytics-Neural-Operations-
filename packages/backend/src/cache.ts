import fs from "fs";
import path from "path";

export type CacheEntry<T> = { value: T; expiresAt: number };
export type CacheStore = Record<string, CacheEntry<unknown>>;
export type CacheMetrics = {
  entries: number;
  expiredEntries: number;
  approximateBytes: number;
  filePath: string;
  loadedFromDiskAt: string | null;
  lastSaveAt: string | null;
};

const CACHE_FILE = process.env.CACHE_FILE || "/data/cache.json";
const CACHE_TTL_MS = 1000 * 60 * 5;
const MEMORY_CACHE: CacheStore = {};
let loadedFromDiskAt: string | null = null;
let lastSaveAt: string | null = null;

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { expiresAt?: unknown };
  return typeof candidate.expiresAt === "number" && Number.isFinite(candidate.expiresAt);
}

function pruneExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of Object.entries(MEMORY_CACHE)) {
    if (!isCacheEntry(entry) || entry.expiresAt <= now) {
      delete MEMORY_CACHE[key];
    }
  }
}

function sanitizeCacheStore(raw: unknown): CacheStore {
  if (!raw || typeof raw !== "object") return {};

  const next: CacheStore = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isCacheEntry(value)) continue;
    next[key] = {
      value: value.value,
      expiresAt: value.expiresAt,
    };
  }
  return next;
}

export function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as unknown;
      Object.assign(MEMORY_CACHE, sanitizeCacheStore(parsed));
      pruneExpiredEntries();
      loadedFromDiskAt = new Date().toISOString();
    }
  } catch {}
}

export function saveCacheToDisk() {
  try {
    pruneExpiredEntries();
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(MEMORY_CACHE), "utf-8");
    lastSaveAt = new Date().toISOString();
  } catch {}
}

export function getFromCache<T>(key: string): T | null {
  const e = MEMORY_CACHE[key];
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    delete MEMORY_CACHE[key];
    return null;
  }
  return e.value as T;
}

export function setToCache<T>(key: string, value: T, ttlMs = CACHE_TTL_MS) {
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.max(1000, Math.floor(ttlMs)) : CACHE_TTL_MS;
  MEMORY_CACHE[key] = {
    value,
    expiresAt: Date.now() + safeTtlMs,
  };
}

export function getCacheMetrics(): CacheMetrics {
  const now = Date.now();
  let expiredEntries = 0;

  for (const entry of Object.values(MEMORY_CACHE)) {
    if (entry.expiresAt <= now) expiredEntries += 1;
  }

  return {
    entries: Object.keys(MEMORY_CACHE).length,
    expiredEntries,
    approximateBytes: Buffer.byteLength(JSON.stringify(MEMORY_CACHE), "utf-8"),
    filePath: CACHE_FILE,
    loadedFromDiskAt,
    lastSaveAt,
  };
}
