import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  loadSave,
  persistSave,
  clearSave,
  parseKitSaveState,
  defaultSaveState,
  KitStorageError,
  SAVE_KEY,
  SAVE_SCHEMA_VERSION,
} from '../storage';

beforeEach(() => {
  resetRundotMock();
});

describe('loadSave', () => {
  it('returns a default save on first launch (absent key)', async () => {
    const state = await loadSave();
    expect(state).toEqual(defaultSaveState());
    expect(state.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('round-trips a persisted save', async () => {
    await persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 123, data: { soft: '42' } });
    const loaded = await loadSave();
    expect(loaded.data).toEqual({ soft: '42' });
    expect(loaded.savedAt).toBe(123);
  });

  it('throws CORRUPT on a non-JSON blob (fail loud)', async () => {
    await RundotGameAPI.appStorage.setItem(SAVE_KEY, 'not json {{{');
    await expect(loadSave()).rejects.toMatchObject({ code: 'CORRUPT' });
  });

  it('throws CORRUPT on a save version newer than supported', async () => {
    await RundotGameAPI.appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_SCHEMA_VERSION + 5, savedAt: 0, data: {} }),
    );
    await expect(loadSave()).rejects.toBeInstanceOf(KitStorageError);
  });

  it('throws OFFLINE when the read is rate-limited', async () => {
    RundotGameAPI.appStorage.getItem.mockRejectedValueOnce({ code: 'RATE_LIMITED' });
    await expect(loadSave()).rejects.toMatchObject({ code: 'OFFLINE' });
  });

  it('throws UNKNOWN on an unexpected read failure', async () => {
    RundotGameAPI.appStorage.getItem.mockRejectedValueOnce(new Error('bridge down'));
    await expect(loadSave()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('parseKitSaveState', () => {
  it('rejects a blob with no integer version', () => {
    expect(() => parseKitSaveState(JSON.stringify({ data: {} }))).toThrow(KitStorageError);
  });
});

describe('persistSave', () => {
  it('throws QUOTA when the serialized blob exceeds the 8 KiB value cap', async () => {
    const big = 'x'.repeat(9 * 1024);
    await expect(
      persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 0, data: { blob: big } }),
    ).rejects.toMatchObject({ code: 'QUOTA' });
  });

  it('throws QUOTA when the host reports QUOTA_EXCEEDED', async () => {
    RundotGameAPI.appStorage.setItem.mockRejectedValueOnce({ code: 'QUOTA_EXCEEDED' });
    await expect(
      persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 0, data: {} }),
    ).rejects.toMatchObject({ code: 'QUOTA' });
  });

  it('retries a rate-limited write then throws OFFLINE after 3 attempts', async () => {
    RundotGameAPI.appStorage.setItem.mockRejectedValue({ code: 'RATE_LIMITED' });
    await expect(
      persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 0, data: {} }),
    ).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(RundotGameAPI.appStorage.setItem).toHaveBeenCalledTimes(3);
  });

  it('succeeds after a transient rate-limit then a good write', async () => {
    RundotGameAPI.appStorage.setItem
      .mockRejectedValueOnce({ code: 'RATE_LIMITED' })
      .mockResolvedValueOnce(undefined);
    await expect(
      persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 0, data: {} }),
    ).resolves.toBeUndefined();
    expect(RundotGameAPI.appStorage.setItem).toHaveBeenCalledTimes(2);
  });
});

describe('clearSave', () => {
  it('removes the save key', async () => {
    await persistSave({ version: SAVE_SCHEMA_VERSION, savedAt: 0, data: { a: 1 } });
    await clearSave();
    expect(await loadSave()).toEqual(defaultSaveState());
  });

  it('throws UNKNOWN on removal failure', async () => {
    RundotGameAPI.appStorage.removeItem.mockRejectedValueOnce(new Error('nope'));
    await expect(clearSave()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
