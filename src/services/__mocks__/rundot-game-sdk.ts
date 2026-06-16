/**
 * Configurable fake `RundotGameAPI` for service-wrapper unit tests.
 *
 * Tests inject this with:
 *
 *   vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));
 *
 * The default export mimics the real SDK's `RundotGameAPI` shape closely enough
 * for the wrappers (the surfaces in src/services/*). It is NOT a full SDK fake —
 * only the methods the kit's wrappers touch are implemented, and each is a
 * `vi.fn()` so a test can override behavior per-case
 * (`api.appStorage.getItem.mockResolvedValueOnce(...)`) and assert call args.
 *
 * `resetRundotMock()` restores every method to its benign default and clears an
 * in-memory `appStorage` map. Call it in `beforeEach` so cases don't leak state.
 *
 * Why a hand-written fake and not `vi.mock(..., factory)` inline per test: the
 * wrappers share the storage/time surfaces (ads reads the storage counter and
 * server time), so a single shared, stateful fake keeps cross-surface tests
 * honest — the ads daily-cap test exercises the real storage + time code paths.
 */
import { vi } from 'vitest';

/** Backing store for the fake appStorage bucket. */
const appStorageMap = new Map<string, string>();

function makeStorageBucket() {
  return {
    getItem: vi.fn(async (key: string): Promise<string | null> => {
      return appStorageMap.has(key) ? appStorageMap.get(key)! : null;
    }),
    setItem: vi.fn(async (key: string, value: string): Promise<void> => {
      appStorageMap.set(key, value);
    }),
    removeItem: vi.fn(async (key: string): Promise<void> => {
      appStorageMap.delete(key);
    }),
    clear: vi.fn(async (): Promise<void> => {
      appStorageMap.clear();
    }),
    length: vi.fn(async (): Promise<number> => appStorageMap.size),
    key: vi.fn(async (index: number): Promise<string | null> => {
      return [...appStorageMap.keys()][index] ?? null;
    }),
    getAllItems: vi.fn(async (): Promise<string[]> => [...appStorageMap.keys()]),
    getAllData: vi.fn(async (): Promise<Record<string, string>> => Object.fromEntries(appStorageMap)),
    setMultipleItems: vi.fn(async (items: { key: string; value: string }[]): Promise<void> => {
      for (const { key, value } of items) appStorageMap.set(key, value);
    }),
    removeMultipleItems: vi.fn(async (keys: string[]): Promise<void> => {
      for (const k of keys) appStorageMap.delete(k);
    }),
  };
}

/** A minimal Decimal-ish stand-in for `numbers.Decimal`. */
class FakeDecimal {
  constructor(public readonly value: string | number) {}
  toString(): string {
    return String(this.value);
  }
}

function makeLifecycleHook() {
  return vi.fn((_cb: () => void) => ({ unsubscribe: vi.fn() }));
}

/** Build a fresh mock object graph. */
function buildMock() {
  return {
    appStorage: makeStorageBucket(),

    // Time methods live flat on the default export (not under a `time`
    // namespace) — mirror the installed SDK types the wrappers compile against.
    requestTimeAsync: vi.fn(async () => ({
      serverTime: 1_700_000_000_000,
      localTime: 1_700_000_000_000,
      timezoneOffset: 0,
      formattedTime: '',
      locale: 'en-US',
    })),
    formatTime: vi.fn((_ts: number) => ''),
    formatNumber: vi.fn((v: number) => String(v)),
    getFutureTimeAsync: vi.fn(async () => 0),

    numbers: {
      isBigNumber: vi.fn((v: unknown) => v instanceof FakeDecimal),
      normalize: vi.fn((v: string | number) => new FakeDecimal(v)),
      format: {
        incremental: vi.fn((v: { toString(): string }) => v.toString()),
      },
      calculateGeometricSeriesCost: vi.fn(
        (base: number | string) => new FakeDecimal(base),
      ),
      calculateMaxAffordableDecimal: vi.fn(() => 0),
      formatDecimalCurrency: vi.fn((v: { toString(): string }) => v.toString()),
      Decimal: FakeDecimal,
    },

    notifications: {
      scheduleAsync: vi.fn(async (_t: string, _b: string, _s: number, id?: string) => id ?? 'notif-id'),
      cancelNotification: vi.fn(async (_id: string) => true),
      getAllScheduledLocalNotifications: vi.fn(async () => [] as Array<{ id: string }>),
      isLocalNotificationsEnabled: vi.fn(async () => true),
      setLocalNotificationsEnabled: vi.fn(async (_enabled: boolean) => true),
    },

    ads: {
      isRewardedAdReadyAsync: vi.fn(async () => true),
      showRewardedAdAsync: vi.fn(async () => true),
      showInterstitialAd: vi.fn(async () => true),
    },

    iap: {
      getHardCurrencyBalance: vi.fn(async () => 1000),
      spendCurrency: vi.fn(async () => ({ success: true })),
      openStore: vi.fn(async () => ({ purchased: false, newBalance: 1000 })),
      getCurrencyIcon: vi.fn(async () => ({ base64Data: 'data:image/png;base64,AAAA' })),
      getSubscriptions: vi.fn(async () => ({})),
      purchaseSubscription: vi.fn(async () => ({ success: true })),
      isUserSubscribed: vi.fn(async () => false),
      hasUserMadePurchase: vi.fn(async () => false),
    },

    leaderboard: {
      createScoreToken: vi.fn(async () => ({ token: 't', startTime: 0, expiresAt: 0, mode: 'default' })),
      submitScore: vi.fn(async () => ({ accepted: true, rank: 1 })),
      getPagedScores: vi.fn(async () => ({
        variant: 'standard',
        entries: [],
        totalEntries: 0,
        playerRank: null,
        periodInstance: 'alltime',
      })),
      getMyRank: vi.fn(async () => ({ rank: 1, totalPlayers: 1, trustScore: 100, periodInstance: 'alltime' })),
      getPodiumScores: vi.fn(async () => ({
        variant: 'highlight',
        entries: [],
        totalEntries: 0,
        playerRank: null,
        periodInstance: 'alltime',
        context: {
          topEntries: [],
          beforePlayer: [],
          afterPlayer: [],
          totalBefore: 0,
          totalAfter: 0,
          omittedBefore: 0,
          omittedAfter: 0,
        },
      })),
    },

    analytics: {
      recordCustomEvent: vi.fn(async () => undefined),
      trackFunnelStep: vi.fn(async () => undefined),
    },

    social: {
      shareLinkAsync: vi.fn(async () => ({ shareUrl: 'https://run.game/s/abc', shareLinkId: 'abc' })),
      createQRCodeAsync: vi.fn(async () => ({
        shareUrl: 'https://run.game/s/abc',
        qrCode: 'data:image/png;base64,AAAA',
        shareLinkId: 'abc',
      })),
    },

    lifecycles: {
      onPause: makeLifecycleHook(),
      onResume: makeLifecycleHook(),
      onSleep: makeLifecycleHook(),
      onAwake: makeLifecycleHook(),
      onQuit: makeLifecycleHook(),
    },

    system: {
      getEnvironment: vi.fn(() => ({
        isDevelopment: false,
        platform: 'web',
        platformVersion: '1.0',
      })),
      getDevice: vi.fn(() => ({
        screenSize: { width: 1280, height: 720 },
        viewportSize: { width: 1280, height: 720 },
        orientation: 'landscape',
        pixelRatio: 1,
        fontScale: 1,
        deviceType: 'desktop',
        hapticsEnabled: false,
        haptics: { supported: false, enabled: false },
      })),
      isMobile: vi.fn(() => false),
      isWeb: vi.fn(() => true),
      getSafeArea: vi.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
    },

    app: {
      getMyRole: vi.fn(async () => 'none' as 'owner' | 'editor' | 'none'),
    },

    log: vi.fn(() => undefined),
    error: vi.fn(() => undefined),
  };
}

/** The single shared mock instance — the wrappers import this as the SDK. */
const RundotGameAPI = buildMock();

/**
 * Restore every mock method to its default and clear stateful stores.
 * Call in `beforeEach`. Rebuilds from a fresh graph so per-test
 * `mockResolvedValueOnce`/`mockImplementation` overrides don't leak.
 */
export function resetRundotMock(): void {
  appStorageMap.clear();
  const fresh = buildMock();
  // Re-assign every top-level surface in place so the shared reference the
  // wrappers captured stays valid.
  Object.assign(RundotGameAPI, fresh);
}

/** Direct handle to the appStorage backing map (for test setup/assertions). */
export function __appStorageMap(): Map<string, string> {
  return appStorageMap;
}

export { FakeDecimal };
export default RundotGameAPI;
