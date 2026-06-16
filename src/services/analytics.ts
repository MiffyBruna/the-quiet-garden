/**
 * ANALYTICS service — typed, best-effort telemetry.
 *
 * Contract: docs/sdk-wiring.md § ANALYTICS. Wraps
 * `RundotGameAPI.analytics`. Two entry points: {@link track} for custom events
 * and {@link funnel} for funnel steps. Both are fire-and-forget — every call
 * attaches `.catch(() => {})` via {@link catchVoid} so the analytics pipeline
 * being down can never crash the game. There are NO fail-loud paths here.
 *
 * The kit ships a fixed set of always-on event names (the union below). They're
 * what the kit needs for its own observability and can't be disabled. Creators
 * add their own via `track('custom_<name>', ...)`; the union accepts any
 * `custom_`-prefixed string for that escape hatch while keeping the built-ins
 * type-checked.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { catchVoid } from './_runtime';

/** The kit's always-on events (docs/sdk-wiring.md § ANALYTICS). */
export type KitBuiltinEvent =
  | 'game_opened'
  | 'session_end'
  | 'screen_viewed'
  | 'store_opened'
  | 'iap_purchase_started'
  | 'iap_purchase_complete'
  | 'iap_purchase_failed'
  | 'first_purchase'
  | 'rewarded_ad_offered'
  | 'rewarded_ad_watched'
  | 'rewarded_ad_dismissed'
  | 'rewarded_ad_failed'
  | 'rewarded_ad_cap_hit'
  | 'leaderboard_submit_failed'
  | 'subscription_status_checked'
  | 'subscription_purchase_started'
  | 'subscription_purchase_complete';

/** Any kit event: a built-in, or a creator's `custom_`-prefixed event. */
export type KitAnalyticsEvent = KitBuiltinEvent | `custom_${string}`;

/** Event payload — snake_case keys, JSON-serializable values. */
export type KitAnalyticsParams = Record<string, string | number | boolean>;

/**
 * Record a custom event. Fire-and-forget: the returned promise's rejection is
 * swallowed. Returns nothing — callers never await analytics.
 */
export function track(event: KitAnalyticsEvent, params?: KitAnalyticsParams): void {
  catchVoid(
    RundotGameAPI.analytics.recordCustomEvent(event, params),
    `analytics:${event}`,
  );
}

/** Default funnel name when a caller doesn't pass one. Your game defines its own. */
export const KIT_PRIMARY_FUNNEL = 'default';
export const KIT_PRIMARY_FUNNEL_ORDER = 1;

/**
 * Track a funnel step. Fire-and-forget. The kit ships no funnel of its own —
 * define your game's funnels and pass `funnelName`/`funnelOrder` (use a distinct
 * `funnelOrder` per funnel).
 */
export function funnel(
  step: number,
  name: string,
  funnelName: string = KIT_PRIMARY_FUNNEL,
  funnelOrder: number = KIT_PRIMARY_FUNNEL_ORDER,
): void {
  catchVoid(
    RundotGameAPI.analytics.trackFunnelStep(step, name, funnelName, funnelOrder),
    `analytics:funnel:${funnelName}:${name}`,
  );
}
