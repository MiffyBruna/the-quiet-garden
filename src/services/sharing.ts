/**
 * SHARING service — share links for whatever moment your game wants to celebrate.
 *
 * Contract: docs/sdk-wiring.md § SHARING. The SDK names this surface `social`;
 * the kit keeps the readable `sharing.ts` name and calls `social` internally.
 *
 * Genre-neutral on purpose: there's no built-in trigger. Call {@link shareMoment}
 * from wherever a share makes sense in your game (a finished room, a season
 * change, a gift), passing a title, an optional description/image, and any extra
 * params your receiver-side wants. The QR variant ({@link createShareQRCode}) is
 * shipped for in-person / kiosk sharing; the caller decides whether to render it.
 *
 * `shareParams` values must be strings (SDK constraint) — numbers are stringified
 * here so callers pass natural types.
 *
 * Fail-loud: sharing is best-effort. A `shareLinkAsync` reject silently dismisses
 * the share UI and logs a warning — it's not user-actionable. Returns `null` on
 * failure so the caller can no-op cleanly. Desktop clipboard fallback is handled
 * by the SDK.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** Identifier baked into every kit share payload (receiver-side branching). */
export const KIT_SHARE_KEY = 'stay-awhile-jam';

/** What to share. Only `title` is required; everything else is optional. */
export interface ShareInput {
  /** Headline for the share card. */
  title: string;
  /** Optional supporting line. */
  description?: string;
  /** Optional share image (HTTPS). */
  imageUrl?: string;
  /** Optional extra params for receiver-side branching (stringified for you). */
  params?: Record<string, string | number>;
}

/** Build the `Record<string, string>` share params, kit-stamped. */
function buildShareParams(input: ShareInput): Record<string, string> {
  const params: Record<string, string> = { kit: KIT_SHARE_KEY };
  for (const [key, value] of Object.entries(input.params ?? {})) {
    params[key] = String(value);
  }
  return params;
}

/** Build the OpenGraph metadata for a share. */
function buildMetadata(input: ShareInput): { title: string; description: string; imageUrl?: string } {
  const meta: { title: string; description: string; imageUrl?: string } = {
    title: input.title,
    description: input.description ?? '',
  };
  if (input.imageUrl) meta.imageUrl = input.imageUrl;
  return meta;
}

/**
 * Create and invoke a share link. Returns the share URL, or `null` if sharing
 * failed (best-effort — dismiss the UI silently).
 */
export async function shareMoment(input: ShareInput): Promise<string | null> {
  try {
    const { shareUrl } = await RundotGameAPI.social.shareLinkAsync({
      shareParams: buildShareParams(input),
      metadata: buildMetadata(input),
    });
    return shareUrl;
  } catch (err) {
    console.warn('[kit/sdk] sharing:shareLink:', err);
    return null;
  }
}

/** A QR code for in-person sharing: the data-URL image plus its share URL. */
export interface KitQRCode {
  qrCode: string;
  shareUrl: string;
}

/**
 * Generate a QR code for a share (in-person / kiosk). Returns `null` on failure
 * (best-effort). Default-off — the caller decides whether to render it.
 */
export async function createShareQRCode(input: ShareInput): Promise<KitQRCode | null> {
  try {
    const { qrCode, shareUrl } = await RundotGameAPI.social.createQRCodeAsync({
      shareParams: buildShareParams(input),
      metadata: buildMetadata(input),
      qrOptions: { size: 512, margin: 4, format: 'png' },
    });
    return { qrCode, shareUrl };
  } catch (err) {
    console.warn('[kit/sdk] sharing:createQRCode:', err);
    return null;
  }
}
