import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  isRewardedAdReady,
  presentRewardedAd,
  setDailyAdCap,
  DEFAULT_DAILY_CAP,
} from '../ads';
import { resetTimeCache } from '../time';

beforeEach(() => {
  resetRundotMock();
  resetTimeCache();
  setDailyAdCap(DEFAULT_DAILY_CAP);
  // Default mock device is desktop — make it mobile so ads are supported.
  RundotGameAPI.system.getDevice.mockReturnValue({
    screenSize: { width: 390, height: 844 },
    viewportSize: { width: 390, height: 844 },
    orientation: 'portrait',
    pixelRatio: 3,
    fontScale: 1,
    deviceType: 'phone',
    hapticsEnabled: true,
    haptics: { supported: true, enabled: true },
  });
  RundotGameAPI.system.isWeb.mockReturnValue(false);
});

describe('isRewardedAdReady', () => {
  it('returns true when the SDK has an ad and fires rewarded_ad_offered', async () => {
    const ready = await isRewardedAdReady('offline_boost_2x');
    expect(ready).toBe(true);
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'rewarded_ad_offered',
      { placement: 'offline_boost_2x' },
    );
  });

  it('returns false on desktop (ads unsupported there)', async () => {
    RundotGameAPI.system.isWeb.mockReturnValue(true);
    RundotGameAPI.system.getDevice.mockReturnValue({
      screenSize: { width: 1920, height: 1080 },
      viewportSize: { width: 1280, height: 720 },
      orientation: 'landscape',
      pixelRatio: 1,
      fontScale: 1,
      deviceType: 'desktop',
      hapticsEnabled: false,
      haptics: { supported: false, enabled: false },
    });
    expect(await isRewardedAdReady('flyby_10x')).toBe(false);
    expect(RundotGameAPI.ads.isRewardedAdReadyAsync).not.toHaveBeenCalled();
  });

  it('returns false (hide CTA) when no ad is available — not an error', async () => {
    RundotGameAPI.ads.isRewardedAdReadyAsync.mockResolvedValueOnce(false);
    expect(await isRewardedAdReady('flyby_10x')).toBe(false);
  });
});

describe('presentRewardedAd — daily cap', () => {
  it('grants the reward and increments the counter on a watched ad', async () => {
    const result = await presentRewardedAd('offline_boost_2x');
    expect(result).toEqual({ rewarded: true });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'rewarded_ad_watched',
      { placement: 'offline_boost_2x' },
    );
  });

  it('enforces the 5/day cap across placements', async () => {
    for (let i = 0; i < DEFAULT_DAILY_CAP; i++) {
      const r = await presentRewardedAd('speedup_skip');
      expect(r.rewarded).toBe(true);
    }
    // The 6th attempt is over cap.
    const capped = await presentRewardedAd('daily_gift_2x');
    expect(capped).toEqual({ rewarded: false });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'rewarded_ad_cap_hit',
      { placement: 'daily_gift_2x' },
    );
  });

  it('hides the CTA once the cap is reached', async () => {
    for (let i = 0; i < DEFAULT_DAILY_CAP; i++) {
      await presentRewardedAd('speedup_skip');
    }
    expect(await isRewardedAdReady('free_crate_skip')).toBe(false);
  });

  it('respects a creator-tuned cap', async () => {
    setDailyAdCap(1);
    expect((await presentRewardedAd('flyby_10x')).rewarded).toBe(true);
    expect((await presentRewardedAd('flyby_10x')).rewarded).toBe(false);
  });
});

describe('presentRewardedAd — failure handling', () => {
  it('grants the base reward when the ad rejects mid-show (no punish)', async () => {
    RundotGameAPI.ads.showRewardedAdAsync.mockRejectedValueOnce(new Error('network'));
    const result = await presentRewardedAd('offline_boost_2x');
    expect(result).toEqual({ rewarded: true });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'rewarded_ad_failed',
      { placement: 'offline_boost_2x' },
    );
  });

  it('does not grant on an early dismissal', async () => {
    RundotGameAPI.ads.showRewardedAdAsync.mockResolvedValueOnce(false);
    const result = await presentRewardedAd('offline_boost_2x');
    expect(result).toEqual({ rewarded: false });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'rewarded_ad_dismissed',
      { placement: 'offline_boost_2x' },
    );
  });
});

describe('no interstitial export', () => {
  it('the ads module does not export an interstitial wrapper', async () => {
    const mod = await import('../ads');
    const names = Object.keys(mod);
    expect(names.some((n) => /interstitial/i.test(n))).toBe(false);
  });
});
