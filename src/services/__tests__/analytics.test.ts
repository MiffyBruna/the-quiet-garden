import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import { track, funnel, KIT_PRIMARY_FUNNEL, KIT_PRIMARY_FUNNEL_ORDER } from '../analytics';

beforeEach(() => {
  resetRundotMock();
});

describe('track', () => {
  it('records a typed event with params', () => {
    track('store_opened', { source: 'home' });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('store_opened', {
      source: 'home',
    });
  });

  it('accepts a custom_ prefixed event', () => {
    track('custom_boss_defeated', { boss: 'dragon' });
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('custom_boss_defeated', {
      boss: 'dragon',
    });
  });

  it('never throws when the SDK rejects (best-effort, swallowed)', async () => {
    RundotGameAPI.analytics.recordCustomEvent.mockRejectedValueOnce(new Error('pipeline down'));
    expect(() => track('game_opened')).not.toThrow();
    // Let the swallowed rejection settle without an unhandled-rejection warning.
    await Promise.resolve();
  });
});

describe('funnel', () => {
  it('defaults to the kit primary funnel name and order', () => {
    funnel(1, 'opened');
    expect(RundotGameAPI.analytics.trackFunnelStep).toHaveBeenCalledWith(
      1,
      'opened',
      KIT_PRIMARY_FUNNEL,
      KIT_PRIMARY_FUNNEL_ORDER,
    );
  });

  it('passes through a custom funnel name and order', () => {
    funnel(2, 'item_selected', 'purchase', 2);
    expect(RundotGameAPI.analytics.trackFunnelStep).toHaveBeenCalledWith(2, 'item_selected', 'purchase', 2);
  });

  it('never throws when the SDK rejects', async () => {
    RundotGameAPI.analytics.trackFunnelStep.mockRejectedValueOnce(new Error('x'));
    expect(() => funnel(1, 'opened')).not.toThrow();
    await Promise.resolve();
  });
});
