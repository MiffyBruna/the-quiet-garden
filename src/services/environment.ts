/**
 * ENVIRONMENT service — platform/dev-mode detection + debug-console gating.
 *
 * Contract: docs/sdk-wiring.md § ENVIRONMENT. Wraps `RundotGameAPI.system`
 * (and `RundotGameAPI.app.getMyRole` for the role gate). The PRD's
 * `environment.isDevelopment` path does not exist — the real path is
 * `system.getEnvironment().isDevelopment`, exposed here as {@link isDev} so
 * callers don't depend on the SDK structure.
 *
 * No fail-loud paths (contract): these are pre-flight checks. On any SDK error
 * the wrapper returns a safe default (treat as production / web / non-privileged)
 * so a flaky environment call can never surface the debug console to a player.
 *
 * Device info is cached on first read — the SDK guidance is that it doesn't
 * change during a session.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** Player role within the game, per `RundotGameAPI.app.getMyRole`. */
export type KitRole = 'owner' | 'editor' | 'none';

/** Cached device info — `getDevice()` is stable for the session. */
type DeviceInfo = ReturnType<typeof RundotGameAPI.system.getDevice>;
let cachedDevice: DeviceInfo | null = null;

/** Whether the game is running in the dev sandbox. Safe default: false. */
export function isDev(): boolean {
  try {
    return RundotGameAPI.system.getEnvironment().isDevelopment;
  } catch (err) {
    console.warn('[kit/sdk] environment:isDev:', err);
    return false;
  }
}

/** Quick mobile check. Safe default: false. */
export function isMobile(): boolean {
  try {
    return RundotGameAPI.system.isMobile();
  } catch {
    return false;
  }
}

/** Quick web check. Safe default: true (web is the broadest fallback). */
export function isWeb(): boolean {
  try {
    return RundotGameAPI.system.isWeb();
  } catch {
    return true;
  }
}

/** Cached device info. Returns null only if the very first read fails. */
export function getDevice(): DeviceInfo | null {
  if (cachedDevice) return cachedDevice;
  try {
    cachedDevice = RundotGameAPI.system.getDevice();
    return cachedDevice;
  } catch (err) {
    console.warn('[kit/sdk] environment:getDevice:', err);
    return null;
  }
}

/** Drop the cached device info (test hook / forced refresh). */
export function resetDeviceCache(): void {
  cachedDevice = null;
}

/** Safe-area insets (host chrome + device notches), per `system.getSafeArea`. */
export type SafeAreaInsets = ReturnType<typeof RundotGameAPI.system.getSafeArea>;

/**
 * Safe-area padding the layout must respect to clear host chrome
 * (toolbar / feedHeader) and device notches. The host renders the game in a
 * viewport smaller than `100vh`; read this and pad your root so bottom UI (a
 * tab bar, a toolbar) isn't pushed under the chrome or below the visible area.
 *
 * Safe default: all-zero insets, so a failed read just means no extra padding —
 * never a crash or hidden UI. Synchronous, matching the SDK; the host keeps the
 * value current across rotation.
 */
export function getSafeArea(): SafeAreaInsets {
  try {
    return RundotGameAPI.system.getSafeArea();
  } catch (err) {
    console.warn('[kit/sdk] environment:getSafeArea:', err);
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/**
 * The player's role within this game. Safe default: `'none'` (least privilege)
 * on any error, so a failed role check never grants debug access.
 */
export async function getMyRole(): Promise<KitRole> {
  try {
    return await RundotGameAPI.app.getMyRole();
  } catch (err) {
    console.warn('[kit/sdk] environment:getMyRole:', err);
    return 'none';
  }
}

/**
 * Two-stage debug-console gate (contract):
 *  1. In dev (`isDev()` true) → visible.
 *  2. In production → visible only to the owner/editor (so a creator can inspect
 *     their live game without players seeing the controls).
 *
 * For every other player in production this resolves false. Async because the
 * role check is async; callers gate the debug-console row's render on it.
 */
export async function canSeeDebugConsole(): Promise<boolean> {
  if (isDev()) return true;
  const role = await getMyRole();
  return role === 'owner' || role === 'editor';
}
