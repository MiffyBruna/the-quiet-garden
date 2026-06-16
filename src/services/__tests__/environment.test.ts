import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  isDev,
  isMobile,
  isWeb,
  getDevice,
  resetDeviceCache,
  getSafeArea,
  getMyRole,
  canSeeDebugConsole,
} from '../environment';

beforeEach(() => {
  resetRundotMock();
  resetDeviceCache();
});

describe('isDev', () => {
  it('reflects the SDK environment flag', () => {
    RundotGameAPI.system.getEnvironment.mockReturnValueOnce({
      isDevelopment: true,
      platform: 'web',
      platformVersion: '1',
    });
    expect(isDev()).toBe(true);
  });

  it('returns false (safe default) when the SDK call throws', () => {
    RundotGameAPI.system.getEnvironment.mockImplementationOnce(() => {
      throw new Error('not initialized');
    });
    expect(isDev()).toBe(false);
  });
});

describe('platform checks', () => {
  it('isMobile passes through', () => {
    RundotGameAPI.system.isMobile.mockReturnValueOnce(true);
    expect(isMobile()).toBe(true);
  });

  it('isWeb defaults to true on error', () => {
    RundotGameAPI.system.isWeb.mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(isWeb()).toBe(true);
  });
});

describe('getDevice', () => {
  it('caches the device after the first read', () => {
    getDevice();
    getDevice();
    expect(RundotGameAPI.system.getDevice).toHaveBeenCalledTimes(1);
  });

  it('returns null when the first read fails', () => {
    RundotGameAPI.system.getDevice.mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(getDevice()).toBeNull();
  });
});

describe('getSafeArea', () => {
  it('passes through the SDK insets', () => {
    RundotGameAPI.system.getSafeArea.mockReturnValueOnce({ top: 44, right: 0, bottom: 34, left: 0 });
    expect(getSafeArea()).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });
  });

  it('returns zero insets (safe default) when the SDK call throws', () => {
    RundotGameAPI.system.getSafeArea.mockImplementationOnce(() => {
      throw new Error('not initialized');
    });
    expect(getSafeArea()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('getMyRole', () => {
  it('returns the SDK role', async () => {
    RundotGameAPI.app.getMyRole.mockResolvedValueOnce('owner');
    expect(await getMyRole()).toBe('owner');
  });

  it('returns "none" (least privilege) on error', async () => {
    RundotGameAPI.app.getMyRole.mockRejectedValueOnce(new Error('x'));
    expect(await getMyRole()).toBe('none');
  });
});

describe('canSeeDebugConsole (two-stage gate)', () => {
  it('is visible in dev', async () => {
    RundotGameAPI.system.getEnvironment.mockReturnValue({
      isDevelopment: true,
      platform: 'web',
      platformVersion: '1',
    });
    expect(await canSeeDebugConsole()).toBe(true);
  });

  it('is visible in production for an owner', async () => {
    RundotGameAPI.system.getEnvironment.mockReturnValue({
      isDevelopment: false,
      platform: 'ios',
      platformVersion: '17',
    });
    RundotGameAPI.app.getMyRole.mockResolvedValue('editor');
    expect(await canSeeDebugConsole()).toBe(true);
  });

  it('is hidden in production for a regular player', async () => {
    RundotGameAPI.system.getEnvironment.mockReturnValue({
      isDevelopment: false,
      platform: 'ios',
      platformVersion: '17',
    });
    RundotGameAPI.app.getMyRole.mockResolvedValue('none');
    expect(await canSeeDebugConsole()).toBe(false);
  });
});
