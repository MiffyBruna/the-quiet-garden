/**
 * PURCHASES service — RunBucks spend + subscriptions.
 *
 * Contract: docs/sdk-wiring.md § PURCHASES. Wraps `RundotGameAPI.iap`. Exposes
 * a typed RunBucks-spend transaction ({@link purchaseProduct}) and the
 * subscription tier surface, rather than the raw SDK. Your game names its own
 * products; premium-priced goods you settle against a local ledger never reach
 * the SDK.
 *
 * SDK shape notes (verified against the installed types, which differ from the
 * PRD/brief):
 *  - `iap.spendCurrency(productId, amount)` resolves `{ success, error? }` —
 *    there is NO `newBalance` field. We re-fetch the balance after a successful
 *    spend so callers still get an up-to-date number.
 *  - `iap.getCurrencyIcon()` resolves `{ base64Data }`, not a bare URL string.
 *  - `SubscriptionInterval` is lowercase: `'weekly' | 'monthly' | 'annual'`.
 *
 * Fail-loud split: a balance read failing is load-bearing (the shop can't render
 * without it) → throws {@link KitIapError}. A purchase has expected non-error
 * branches — USER_CANCELLED is silent, INSUFFICIENT_FUNDS routes to the store —
 * so {@link purchaseProduct} returns a typed result instead of throwing on those;
 * it throws {@link KitIapError} only on an unexpected transport reject.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/**
 * A RunBucks-spend product id — a string you choose per transaction (e.g.
 * 'unlock_theme', 'decor_pack'). The spend amount is passed separately to
 * {@link purchaseProduct}. Goods you settle against a local ledger never reach
 * the SDK, so they aren't product ids here.
 */
export type KitProductId = string;

/** Platform subscription tiers, lowest → highest. */
export type KitSubscriptionTier = 'CORE' | 'PLUS' | 'PRIME' | 'ULTIMATE';

/** Subscription billing intervals (SDK casing). */
export type KitSubscriptionInterval = 'weekly' | 'monthly' | 'annual';

/** Typed IAP failure (load-bearing balance/transport failures). */
export class KitIapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KitIapError';
  }
}

/** Outcome categories of a purchase attempt. */
export type PurchaseOutcome =
  | 'success'
  | 'user_cancelled'
  | 'insufficient_funds'
  | 'network_error'
  | 'failed';

/** Typed purchase result. `newBalance` is present only on success. */
export interface KitPurchaseResult {
  outcome: PurchaseOutcome;
  /** Refetched balance after a successful spend; undefined otherwise. */
  newBalance?: number;
  /** Raw SDK error string, when one was provided. */
  reason?: string;
}

/** Classify an SDK error string into a {@link PurchaseOutcome}. */
function classifyPurchaseError(error: string | undefined): PurchaseOutcome {
  if (!error) return 'failed';
  const e = error.toUpperCase();
  if (e.includes('CANCEL')) return 'user_cancelled';
  if (e.includes('INSUFFICIENT')) return 'insufficient_funds';
  if (e.includes('NETWORK') || e.includes('TIMEOUT')) return 'network_error';
  return 'failed';
}

/** Current RunBucks balance. Load-bearing → throws {@link KitIapError}. */
export async function getRunbucksBalance(): Promise<number> {
  try {
    return await RundotGameAPI.iap.getHardCurrencyBalance();
  } catch (err) {
    throw new KitIapError(`getRunbucksBalance failed: ${String(err)}`);
  }
}

/**
 * Spend RunBucks on a product. Returns a typed {@link KitPurchaseResult}:
 * `success` (with refetched balance), `user_cancelled`/`insufficient_funds`/
 * `network_error`/`failed` for expected non-error branches. The SDK auto-opens
 * the platform top-up flow when the player has insufficient RunBucks, so an
 * `insufficient_funds` outcome reflects a player who declined that flow.
 * Throws {@link KitIapError} only on an unexpected transport reject.
 */
export async function purchaseProduct(
  productId: KitProductId,
  amount: number,
): Promise<KitPurchaseResult> {
  let result: { success: boolean; error?: string };
  try {
    result = await RundotGameAPI.iap.spendCurrency(productId, amount);
  } catch (err) {
    throw new KitIapError(`purchaseProduct(${productId}) failed: ${String(err)}`);
  }

  if (result.success) {
    let newBalance: number | undefined;
    try {
      newBalance = await RundotGameAPI.iap.getHardCurrencyBalance();
    } catch {
      // balance refetch is non-critical to a completed purchase; leave undefined
    }
    return newBalance === undefined
      ? { outcome: 'success' }
      : { outcome: 'success', newBalance };
  }

  return { outcome: classifyPurchaseError(result.error), reason: result.error };
}

/** Open the platform RunBucks store ("Get more Runbucks" CTA). */
export async function openPlatformStore(): Promise<{ purchased: boolean; newBalance: number }> {
  try {
    return await RundotGameAPI.iap.openStore();
  } catch (err) {
    throw new KitIapError(`openPlatformStore failed: ${String(err)}`);
  }
}

/**
 * The RunBucks currency icon as a base64 data string, for the shop UI. Cached on
 * app launch by the caller. Throws {@link KitIapError} on failure.
 */
export async function getRunbucksIcon(): Promise<string> {
  try {
    const { base64Data } = await RundotGameAPI.iap.getCurrencyIcon();
    return base64Data;
  } catch (err) {
    throw new KitIapError(`getRunbucksIcon failed: ${String(err)}`);
  }
}

/**
 * Whether the player has ever made a purchase on RUN. Used for analytics /
 * conversion analysis only — NOT to gate features or change pricing (the kit
 * ships fixed pricing). Best-effort: false on error.
 */
export async function hasMadePurchase(): Promise<boolean> {
  try {
    return await RundotGameAPI.iap.hasUserMadePurchase();
  } catch (err) {
    console.warn('[kit/sdk] iap:hasMadePurchase:', err);
    return false;
  }
}

/**
 * Whether the player has `tier` or higher (the SDK respects the tier hierarchy).
 * Load-bearing for content gating → throws {@link KitIapError}.
 */
export async function isSubscribed(tier: KitSubscriptionTier): Promise<boolean> {
  try {
    return await RundotGameAPI.iap.isUserSubscribed(tier);
  } catch (err) {
    throw new KitIapError(`isSubscribed(${tier}) failed: ${String(err)}`);
  }
}

/**
 * Subscription packages for the paywall, with runtime-fetched localized prices
 * (never hardcoded). Optionally filtered to one tier. Throws {@link KitIapError}
 * on failure (the paywall shows a retry).
 */
export async function getSubscriptionPackages(
  tier?: KitSubscriptionTier,
): Promise<Record<string, Array<{ interval: KitSubscriptionInterval; price: number; currencyCode: string; description: string }>>> {
  try {
    return await RundotGameAPI.iap.getSubscriptions(tier);
  } catch (err) {
    throw new KitIapError(`getSubscriptionPackages failed: ${String(err)}`);
  }
}

/**
 * Trigger the checkout flow for a subscription. Returns `{ success }`. Throws
 * {@link KitIapError} on an unexpected transport reject.
 */
export async function purchaseSubscription(
  tier: KitSubscriptionTier,
  interval: KitSubscriptionInterval,
): Promise<{ success: boolean }> {
  try {
    return await RundotGameAPI.iap.purchaseSubscription(tier, interval);
  } catch (err) {
    throw new KitIapError(`purchaseSubscription(${tier}, ${interval}) failed: ${String(err)}`);
  }
}
