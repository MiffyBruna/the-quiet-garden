import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  getRunbucksBalance,
  purchaseProduct,
  openPlatformStore,
  getRunbucksIcon,
  hasMadePurchase,
  isSubscribed,
  getSubscriptionPackages,
  purchaseSubscription,
  KitIapError,
} from '../iap';

beforeEach(() => {
  resetRundotMock();
});

describe('getRunbucksBalance', () => {
  it('returns the balance', async () => {
    RundotGameAPI.iap.getHardCurrencyBalance.mockResolvedValueOnce(250);
    expect(await getRunbucksBalance()).toBe(250);
  });

  it('throws KitIapError on failure (load-bearing)', async () => {
    RundotGameAPI.iap.getHardCurrencyBalance.mockRejectedValueOnce(new Error('down'));
    await expect(getRunbucksBalance()).rejects.toBeInstanceOf(KitIapError);
  });
});

describe('purchaseProduct', () => {
  it('returns success with the refetched balance', async () => {
    RundotGameAPI.iap.spendCurrency.mockResolvedValueOnce({ success: true });
    RundotGameAPI.iap.getHardCurrencyBalance.mockResolvedValueOnce(800);
    const result = await purchaseProduct('premium_convert', 100);
    expect(result.outcome).toBe('success');
    expect(result.newBalance).toBe(800);
  });

  it('classifies a user-cancelled spend', async () => {
    RundotGameAPI.iap.spendCurrency.mockResolvedValueOnce({ success: false, error: 'USER_CANCELLED' });
    expect((await purchaseProduct('premium_convert', 100)).outcome).toBe('user_cancelled');
  });

  it('classifies insufficient funds', async () => {
    RundotGameAPI.iap.spendCurrency.mockResolvedValueOnce({ success: false, error: 'INSUFFICIENT_FUNDS' });
    expect((await purchaseProduct('premium_convert', 100)).outcome).toBe('insufficient_funds');
  });

  it('classifies a network error', async () => {
    RundotGameAPI.iap.spendCurrency.mockResolvedValueOnce({ success: false, error: 'NETWORK_ERROR' });
    expect((await purchaseProduct('premium_convert', 100)).outcome).toBe('network_error');
  });

  it('throws KitIapError on an unexpected transport reject', async () => {
    RundotGameAPI.iap.spendCurrency.mockRejectedValueOnce(new Error('bridge'));
    await expect(purchaseProduct('premium_convert', 100)).rejects.toBeInstanceOf(KitIapError);
  });
});

describe('getRunbucksIcon', () => {
  it('returns the base64Data string from the SDK envelope', async () => {
    RundotGameAPI.iap.getCurrencyIcon.mockResolvedValueOnce({ base64Data: 'data:image/png;base64,XYZ' });
    expect(await getRunbucksIcon()).toBe('data:image/png;base64,XYZ');
  });
});

describe('openPlatformStore', () => {
  it('returns the store result', async () => {
    RundotGameAPI.iap.openStore.mockResolvedValueOnce({ purchased: true, newBalance: 1500 });
    expect(await openPlatformStore()).toEqual({ purchased: true, newBalance: 1500 });
  });
});

describe('subscriptions', () => {
  it('isSubscribed delegates to the SDK tier check', async () => {
    RundotGameAPI.iap.isUserSubscribed.mockResolvedValueOnce(true);
    expect(await isSubscribed('PLUS')).toBe(true);
    expect(RundotGameAPI.iap.isUserSubscribed).toHaveBeenCalledWith('PLUS');
  });

  it('isSubscribed throws KitIapError on failure', async () => {
    RundotGameAPI.iap.isUserSubscribed.mockRejectedValueOnce(new Error('x'));
    await expect(isSubscribed('CORE')).rejects.toBeInstanceOf(KitIapError);
  });

  it('getSubscriptionPackages returns the runtime-priced packages', async () => {
    RundotGameAPI.iap.getSubscriptions.mockResolvedValueOnce({
      CORE: [{ interval: 'weekly', price: 1.99, currencyCode: 'USD', description: 'Core' }],
    });
    const packs = await getSubscriptionPackages('CORE');
    expect(packs['CORE']?.[0]?.price).toBe(1.99);
  });

  it('purchaseSubscription forwards tier + interval', async () => {
    await purchaseSubscription('PRIME', 'monthly');
    expect(RundotGameAPI.iap.purchaseSubscription).toHaveBeenCalledWith('PRIME', 'monthly');
  });
});

describe('hasMadePurchase', () => {
  it('returns the SDK value', async () => {
    RundotGameAPI.iap.hasUserMadePurchase.mockResolvedValueOnce(true);
    expect(await hasMadePurchase()).toBe(true);
  });

  it('returns false on error (best-effort)', async () => {
    RundotGameAPI.iap.hasUserMadePurchase.mockRejectedValueOnce(new Error('x'));
    expect(await hasMadePurchase()).toBe(false);
  });
});
