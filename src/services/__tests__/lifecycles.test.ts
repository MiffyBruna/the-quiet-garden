import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import { registerKitLifecycles, disposeKitLifecycles } from '../lifecycles';

beforeEach(() => {
  resetRundotMock();
  disposeKitLifecycles(); // clear any disposers from a prior test
});

describe('registerKitLifecycles', () => {
  it('registers only the handlers it was given', () => {
    registerKitLifecycles({ onPause: () => {}, onSleep: () => {} });
    expect(RundotGameAPI.lifecycles.onPause).toHaveBeenCalledTimes(1);
    expect(RundotGameAPI.lifecycles.onSleep).toHaveBeenCalledTimes(1);
    expect(RundotGameAPI.lifecycles.onResume).not.toHaveBeenCalled();
  });

  it('delivers the event to the caller callback', () => {
    const onPause = vi.fn();
    registerKitLifecycles({ onPause });
    // The wrapper passed a guarded callback to onPause; invoke it.
    const guarded = RundotGameAPI.lifecycles.onPause.mock.calls[0]?.[0] as () => void;
    guarded();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('catches a throwing callback instead of propagating to the SDK', () => {
    registerKitLifecycles({
      onResume: () => {
        throw new Error('boom');
      },
    });
    const guarded = RundotGameAPI.lifecycles.onResume.mock.calls[0]?.[0] as () => void;
    expect(() => guarded()).not.toThrow();
  });

  it('catches a rejected async callback', async () => {
    registerKitLifecycles({
      onSleep: async () => {
        throw new Error('async boom');
      },
    });
    const guarded = RundotGameAPI.lifecycles.onSleep.mock.calls[0]?.[0] as () => void;
    expect(() => guarded()).not.toThrow();
    await Promise.resolve();
  });
});

describe('disposeKitLifecycles', () => {
  it('unsubscribes every registered hook (HMR teardown)', () => {
    const pauseSub = { unsubscribe: vi.fn() };
    const sleepSub = { unsubscribe: vi.fn() };
    RundotGameAPI.lifecycles.onPause.mockReturnValueOnce(pauseSub);
    RundotGameAPI.lifecycles.onSleep.mockReturnValueOnce(sleepSub);

    registerKitLifecycles({ onPause: () => {}, onSleep: () => {} });
    disposeKitLifecycles();

    expect(pauseSub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(sleepSub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('is safe to call with nothing registered', () => {
    expect(() => disposeKitLifecycles()).not.toThrow();
  });
});
