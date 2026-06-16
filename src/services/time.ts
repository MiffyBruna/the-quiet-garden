/**
 * TIME service — the kit's single canonical "now" source.
 *
 * Contract: docs/sdk-wiring.md § TIME. Wraps `RundotGameAPI.time.requestTimeAsync`
 * and returns the server clock as Unix-ms. Client clocks lie — a player can roll
 * the device clock forward to cheat a timer — so any time-based feature (daily
 * resets, timed growth, "come back tomorrow") should anchor on the server time
 * this module returns, never `Date.now()`.
 *
 * Caching: the first call hits the network and seeds a cache. Within the TTL
 * (default 5 min) subsequent calls return `cachedServerTime + (Date.now() -
 * cachedAtClientMs)` — i.e. the last server anchor advanced by elapsed client
 * time, which costs nothing and avoids spamming the endpoint. `refreshServerTime`
 * forces a re-anchor (the lifecycle layer calls it on `onAwake`).
 *
 * Fail-loud split (contract): the *first* fetch failing is load-bearing — a
 * time-based feature can't anchor without a server time — so it throws
 * {@link KitTimeError}. A *subsequent* fetch failing (network blip mid-play) is
 * best-effort: we keep serving the last-good anchor + delta and swallow the error.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** Default cache time-to-live (ms). */
export const DEFAULT_TIME_CACHE_TTL_MS = 5 * 60 * 1000;

/** Typed time failure. Thrown only on the load-bearing first fetch. */
export class KitTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KitTimeError';
  }
}

interface TimeCache {
  /** Server time (Unix-ms) at the moment of the last successful anchor. */
  serverTime: number;
  /** `Date.now()` at the moment of the last successful anchor. */
  clientAtMs: number;
}

let cache: TimeCache | null = null;
let cacheTtlMs = DEFAULT_TIME_CACHE_TTL_MS;

/** Override the cache TTL (creator-configurable). Resets nothing else. */
export function setTimeCacheTtl(ttlMs: number): void {
  cacheTtlMs = ttlMs;
}

/** Drop the cache so the next `getServerNow` re-anchors from the network. */
export function resetTimeCache(): void {
  cache = null;
}

/** Fetch a fresh server anchor and update the cache. */
async function anchorFromNetwork(): Promise<number> {
  // The default-export `RundotGameAPI` surfaces time methods flat on the root
  // (`requestTimeAsync`), not under a `time` namespace — that namespace exists
  // only on the internal Host interface. The TIME.md doc shows `time.*`, but the
  // installed types are canonical, so we call the root method.
  const { serverTime } = await RundotGameAPI.requestTimeAsync();
  cache = { serverTime, clientAtMs: Date.now() };
  return serverTime;
}

/** Compute "now" by advancing the cached anchor by elapsed client time. */
function projectedNow(c: TimeCache): number {
  return c.serverTime + (Date.now() - c.clientAtMs);
}

/**
 * The canonical "now", in Unix-ms, anchored to server time.
 *
 * - No cache yet → network fetch. On failure, throws {@link KitTimeError}
 *   (load-bearing: we have no anchor at all).
 * - Cache fresh (within TTL) → return the projected now, no network.
 * - Cache stale → attempt a re-anchor; on failure, fall back to the last-good
 *   projected now (best-effort) rather than throwing.
 */
export async function getServerNow(): Promise<number> {
  if (cache == null) {
    try {
      return await anchorFromNetwork();
    } catch (err) {
      throw new KitTimeError(`initial server-time fetch failed: ${String(err)}`);
    }
  }

  const ageMs = Date.now() - cache.clientAtMs;
  if (ageMs < cacheTtlMs) {
    return projectedNow(cache);
  }

  // Stale: try to re-anchor, but never throw — we already have a usable anchor.
  try {
    return await anchorFromNetwork();
  } catch (err) {
    console.warn('[kit/sdk] time re-anchor failed, using cached anchor:', err);
    return projectedNow(cache);
  }
}

/**
 * Force a re-anchor from the network (lifecycle `onAwake`). Best-effort: a
 * failure keeps the previous anchor and is swallowed, returning the projected
 * now from whatever anchor we have. Throws {@link KitTimeError} only if there
 * was no prior anchor AND the refresh fails.
 */
export async function refreshServerTime(): Promise<number> {
  try {
    return await anchorFromNetwork();
  } catch (err) {
    if (cache == null) {
      throw new KitTimeError(`server-time refresh failed with no prior anchor: ${String(err)}`);
    }
    console.warn('[kit/sdk] time refresh failed, using cached anchor:', err);
    return projectedNow(cache);
  }
}
