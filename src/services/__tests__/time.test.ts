import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  getServerNow,
  refreshServerTime,
  resetTimeCache,
  setTimeCacheTtl,
  DEFAULT_TIME_CACHE_TTL_MS,
  KitTimeError,
} from '../time';

beforeEach(() => {
  resetRundotMock();
  resetTimeCache();
  setTimeCacheTtl(DEFAULT_TIME_CACHE_TTL_MS);
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getServerNow', () => {
  it('fetches server time on the first call', async () => {
    const now = await getServerNow();
    expect(now).toBe(1_700_000_000_000);
    expect(RundotGameAPI.requestTimeAsync).toHaveBeenCalledTimes(1);
  });

  it('serves from cache within the TTL (no second network call)', async () => {
    await getServerNow();
    await getServerNow();
    expect(RundotGameAPI.requestTimeAsync).toHaveBeenCalledTimes(1);
  });

  it('re-anchors after the TTL expires', async () => {
    setTimeCacheTtl(0); // everything is immediately stale
    await getServerNow();
    await getServerNow();
    expect(RundotGameAPI.requestTimeAsync).toHaveBeenCalledTimes(2);
  });

  it('throws KitTimeError when the first fetch fails (load-bearing)', async () => {
    RundotGameAPI.requestTimeAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(getServerNow()).rejects.toBeInstanceOf(KitTimeError);
  });

  it('falls back to the cached anchor when a stale re-anchor fails (best-effort)', async () => {
    await getServerNow(); // seed the cache
    setTimeCacheTtl(0); // force staleness
    RundotGameAPI.requestTimeAsync.mockRejectedValueOnce(new Error('blip'));
    const now = await getServerNow();
    // Returns the projected last-good anchor rather than throwing.
    expect(now).toBeGreaterThanOrEqual(1_700_000_000_000);
  });
});

describe('refreshServerTime', () => {
  it('forces a fresh network anchor', async () => {
    await getServerNow();
    await refreshServerTime();
    expect(RundotGameAPI.requestTimeAsync).toHaveBeenCalledTimes(2);
  });

  it('throws when refresh fails and there is no prior anchor', async () => {
    RundotGameAPI.requestTimeAsync.mockRejectedValueOnce(new Error('cold'));
    await expect(refreshServerTime()).rejects.toBeInstanceOf(KitTimeError);
  });
});
