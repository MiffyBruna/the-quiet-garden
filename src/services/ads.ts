/**
 * ADS service — rewarded-only, by design.
 *
 * Contract: docs/sdk-wiring.md § ADS. Rewarded ads only — forced ads damage trust.
 * The kit exposes exactly two primitives plus the placement type. There is NO
 * interstitial export here. `RundotGameAPI.ads.showInterstitialAd` exists in the
 * SDK; a creator who wants forced ads has to edit this file to wrap it — making
 * the antipattern a visible, deliberate code change.
 *
 * Daily cap (contract): 5 rewarded views per UTC day across all placements,
 * enforced client-side with an `appStorage` counter keyed on the server-time
 * UTC day (not `Date.now()` — see time.ts for why the client clock is untrusted).
 *
 * Desktop (contract / ADS.md): the Ads API isn't supported on Desktop, so
 * {@link isRewardedAdReady} returns false there and the UI hides the CTA cleanly
 * rather than showing a broken button.
 *
 * Fail-loud split: a not-ready ad is NOT an error (returns false, hide the CTA).
 * An ad that *rejects mid-show* (network outage, host rejection) silently grants
 * the base reward — we don't punish the player for an ad-network blip — and logs
 * `rewarded_ad_failed` so creators can monitor the rate.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { getServerNow } from './time';
import { track } from './analytics';

/**
 * A rewarded-ad placement id — a string you choose per reward in your game
 * (e.g. 'restock_shop', 'speed_up_growth'). No interstitial, no banner.
 */
export type KitRewardedPlacement = string;

/** Default rewarded views allowed per UTC day across all placements. */
export const DEFAULT_DAILY_CAP = 5;

/** Storage key for the daily-cap counter. */
const CAP_KEY = 'kit_ad_cap_v1';

let dailyCap = DEFAULT_DAILY_CAP;

/** Override the daily cap (creator-configurable). */
export function setDailyAdCap(cap: number): void {
  dailyCap = cap;
}

interface CapState {
  /** UTC day key, e.g. `'2026-05-28'`. */
  day: string;
  /** Views consumed today. */
  count: number;
}

/** UTC day key (`YYYY-MM-DD`) for a Unix-ms timestamp. */
function utcDayKey(serverNowMs: number): string {
  return new Date(serverNowMs).toISOString().slice(0, 10);
}

/** Read today's cap state, resetting the counter when the UTC day rolled over. */
async function readCapState(): Promise<CapState> {
  const today = utcDayKey(await getServerNow());
  let raw: string | null = null;
  try {
    raw = await RundotGameAPI.appStorage.getItem(CAP_KEY);
  } catch (err) {
    // Counter read failure is best-effort: assume an unused day rather than
    // blocking the player. Worst case a player gets a few extra views.
    console.warn('[kit/sdk] ads:cap-read:', err);
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<CapState>;
      if (parsed.day === today && typeof parsed.count === 'number') {
        return { day: today, count: parsed.count };
      }
    } catch {
      // corrupt counter — treat as a fresh day
    }
  }
  return { day: today, count: 0 };
}

/** Persist the cap state. Best-effort — a failed write doesn't block play. */
async function writeCapState(state: CapState): Promise<void> {
  try {
    await RundotGameAPI.appStorage.setItem(CAP_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[kit/sdk] ads:cap-write:', err);
  }
}

/** True when the host is a desktop web client, where ads are unsupported. */
function isDesktop(): boolean {
  try {
    if (!RundotGameAPI.system.isWeb()) return false;
    return RundotGameAPI.system.getDevice().deviceType === 'desktop';
  } catch {
    return false;
  }
}

/**
 * Whether a rewarded ad can be shown for `placement` right now. Returns false
 * (hide the CTA — not an error) when: on desktop, the daily cap is reached, or
 * the SDK reports no ad available.
 */
export async function isRewardedAdReady(placement: KitRewardedPlacement): Promise<boolean> {
  if (isDesktop()) return false;

  const cap = await readCapState();
  if (cap.count >= dailyCap) return false;

  let ready = false;
  try {
    ready = await RundotGameAPI.ads.isRewardedAdReadyAsync();
  } catch (err) {
    console.warn(`[kit/sdk] ads:ready ${placement}:`, err);
    return false;
  }
  if (ready) {
    track('rewarded_ad_offered', { placement });
  }
  return ready;
}

/** Result of presenting a rewarded ad: did the player earn the reward? */
export interface RewardedAdResult {
  rewarded: boolean;
}

/**
 * Present a rewarded ad for `placement`.
 *
 * - Cap reached → `{ rewarded: false }`, logs `rewarded_ad_cap_hit`. Does not
 *   throw (the UI is expected to hide CTAs when the cap is hit; this guards the
 *   path where a CTA is stale).
 * - Watched fully (SDK resolves true) → increments the cap, logs
 *   `rewarded_ad_watched`, returns `{ rewarded: true }`.
 * - Dismissed early (SDK resolves false) → logs `rewarded_ad_dismissed`,
 *   returns `{ rewarded: false }`. No cap increment.
 * - SDK rejects mid-show → grant the base reward anyway (`{ rewarded: true }`),
 *   log `rewarded_ad_failed`. Don't punish the player for an outage.
 */
export async function presentRewardedAd(
  placement: KitRewardedPlacement,
): Promise<RewardedAdResult> {
  const cap = await readCapState();
  if (cap.count >= dailyCap) {
    track('rewarded_ad_cap_hit', { placement });
    return { rewarded: false };
  }

  try {
    const watched = await RundotGameAPI.ads.showRewardedAdAsync({ adDisplayName: placement });
    if (watched) {
      await writeCapState({ day: cap.day, count: cap.count + 1 });
      track('rewarded_ad_watched', { placement });
      return { rewarded: true };
    }
    track('rewarded_ad_dismissed', { placement });
    return { rewarded: false };
  } catch (err) {
    // Ad-network outage: grant the base reward, log for monitoring, no cap hit.
    console.warn(`[kit/sdk] ads:show ${placement}:`, err);
    track('rewarded_ad_failed', { placement });
    return { rewarded: true };
  }
}
