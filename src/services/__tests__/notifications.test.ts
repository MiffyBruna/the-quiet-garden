import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  scheduleNotification,
  cancelKitNotification,
  cancelAllKitNotifications,
  areNotificationsEnabled,
  setNotificationsEnabled,
} from '../notifications';

const gentle = { title: 'Your garden missed you', body: 'A new bloom is ready.', delaySeconds: 24 * 60 * 60 };

beforeEach(() => {
  resetRundotMock();
});

describe('scheduleNotification', () => {
  it('schedules with the creator copy and a namespaced id', async () => {
    const id = await scheduleNotification('daily_bloom', gentle);
    expect(id).toBe('kit_daily_bloom');
    expect(RundotGameAPI.notifications.scheduleAsync).toHaveBeenCalledWith(
      'Your garden missed you',
      'A new bloom is ready.',
      24 * 60 * 60,
      'kit_daily_bloom',
    );
  });

  it('skips silently when permission is off (no schedule call)', async () => {
    RundotGameAPI.notifications.isLocalNotificationsEnabled.mockResolvedValue(false);
    const id = await scheduleNotification('daily_bloom', gentle);
    expect(id).toBeNull();
    expect(RundotGameAPI.notifications.scheduleAsync).not.toHaveBeenCalled();
  });

  it('returns null and does not throw when scheduling fails (best-effort)', async () => {
    RundotGameAPI.notifications.scheduleAsync.mockRejectedValueOnce(new Error('denied'));
    await expect(scheduleNotification('daily_bloom', gentle)).resolves.toBeNull();
  });
});

describe('cancelAllKitNotifications', () => {
  it('cancels only kit-namespaced notifications', async () => {
    RundotGameAPI.notifications.getAllScheduledLocalNotifications.mockResolvedValueOnce([
      { id: 'kit_daily_bloom' },
      { id: 'creator_custom_thing' },
      { id: 'kit_visit_reminder' },
    ]);
    await cancelAllKitNotifications();
    expect(RundotGameAPI.notifications.cancelNotification).toHaveBeenCalledWith('kit_daily_bloom');
    expect(RundotGameAPI.notifications.cancelNotification).toHaveBeenCalledWith('kit_visit_reminder');
    expect(RundotGameAPI.notifications.cancelNotification).not.toHaveBeenCalledWith('creator_custom_thing');
  });

  it('swallows an enumeration failure', async () => {
    RundotGameAPI.notifications.getAllScheduledLocalNotifications.mockRejectedValueOnce(new Error('x'));
    await expect(cancelAllKitNotifications()).resolves.toBeUndefined();
  });
});

describe('cancelKitNotification', () => {
  it('cancels by namespaced id (fire-and-forget)', () => {
    cancelKitNotification('daily_bloom');
    expect(RundotGameAPI.notifications.cancelNotification).toHaveBeenCalledWith('kit_daily_bloom');
  });
});

describe('enable/disable', () => {
  it('reads the permission flag', async () => {
    RundotGameAPI.notifications.isLocalNotificationsEnabled.mockResolvedValueOnce(true);
    expect(await areNotificationsEnabled()).toBe(true);
  });

  it('returns false on a permission read error', async () => {
    RundotGameAPI.notifications.isLocalNotificationsEnabled.mockRejectedValueOnce(new Error('x'));
    expect(await areNotificationsEnabled()).toBe(false);
  });

  it('sets the permission flag and returns the requested state', async () => {
    expect(await setNotificationsEnabled(true)).toBe(true);
    expect(RundotGameAPI.notifications.setLocalNotificationsEnabled).toHaveBeenCalledWith(true);
  });
});
