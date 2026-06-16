/**
 * NOTIFICATIONS service — local re-engagement reminders.
 *
 * Contract: docs/sdk-wiring.md § NOTIFICATIONS. Wraps
 * `RundotGameAPI.notifications`. The kit ships no built-in triggers — you
 * schedule your own with {@link scheduleNotification}, passing an id and copy.
 * Every kit id is namespaced (`kit_*`) so the cancel sweep can clear the kit's
 * notifications without touching anything you scheduled outside this wrapper.
 *
 * Best-effort throughout (contract): notifications are NOT load-bearing. If
 * scheduling fails (permission denied, transport error) the game must keep
 * working — every call is wrapped and swallows its error. We never throw, and
 * we never prompt for permission as a side effect: scheduling is skipped
 * silently when `isLocalNotificationsEnabled()` is false. Enabling notifications
 * happens only through the explicit Settings toggle ({@link setNotificationsEnabled}).
 *
 * Cozy note: keep it kind. A gentle, infrequent nudge ("your garden missed you")
 * fits a cozy game; a streak-pressure nag does not. Positive framing only.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { catchVoid } from './_runtime';

/** A creator-chosen reminder id. Namespaced to `kit_<id>` for the cancel sweep. */
export type KitNotificationId = string;

/** Stable, namespaced SDK id for a kit reminder. */
function sdkId(id: KitNotificationId): string {
  return `kit_${id}`;
}

/** What to schedule. You own the copy and the timing. */
export interface KitNotification {
  title: string;
  body: string;
  /** Delay from now, in seconds. */
  delaySeconds: number;
}

/**
 * Schedule a local reminder. Best-effort: returns the scheduled id on success,
 * or `null` if it was skipped (notifications off) or failed. Never throws, never
 * prompts for permission.
 */
export async function scheduleNotification(
  id: KitNotificationId,
  notification: KitNotification,
): Promise<string | null> {
  try {
    const permitted = await RundotGameAPI.notifications.isLocalNotificationsEnabled();
    if (!permitted) return null; // skip silently — no nag, no permission loop
  } catch (err) {
    console.warn(`[kit/sdk] notifications:permission-check ${id}:`, err);
    return null;
  }

  try {
    const scheduled = await RundotGameAPI.notifications.scheduleAsync(
      notification.title,
      notification.body,
      notification.delaySeconds,
      sdkId(id),
    );
    return scheduled ?? null;
  } catch (err) {
    console.warn(`[kit/sdk] notifications:schedule ${id}:`, err);
    return null;
  }
}

/**
 * Cancel a single kit reminder by id. Best-effort, fire-and-forget — used when
 * the player does the thing the reminder was for.
 */
export function cancelKitNotification(id: KitNotificationId): void {
  catchVoid(
    RundotGameAPI.notifications.cancelNotification(sdkId(id)),
    `notifications:cancel ${id}`,
  );
}

/**
 * Cancel every pending reminder in the kit's namespace. Wire this to
 * `lifecycles.onResume` so players aren't pinged about something they already
 * did by opening the app. Best-effort: a failed enumeration or cancel is logged
 * and swallowed.
 */
export async function cancelAllKitNotifications(): Promise<void> {
  let pending: Array<{ id: string }>;
  try {
    pending = await RundotGameAPI.notifications.getAllScheduledLocalNotifications();
  } catch (err) {
    console.warn('[kit/sdk] notifications:enumerate:', err);
    return;
  }
  for (const n of pending) {
    if (typeof n.id === 'string' && n.id.startsWith('kit_')) {
      catchVoid(
        RundotGameAPI.notifications.cancelNotification(n.id),
        `notifications:cancel-sweep ${n.id}`,
      );
    }
  }
}

/** Whether local notifications are currently permitted. Best-effort: false on error. */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    return await RundotGameAPI.notifications.isLocalNotificationsEnabled();
  } catch (err) {
    console.warn('[kit/sdk] notifications:isEnabled:', err);
    return false;
  }
}

/**
 * Toggle local notifications. Only ever called from the explicit Settings
 * toggle — never automatically. Best-effort: returns the resulting state, or
 * the requested state optimistically if the SDK call fails.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  try {
    await RundotGameAPI.notifications.setLocalNotificationsEnabled(enabled);
    return enabled;
  } catch (err) {
    console.warn('[kit/sdk] notifications:setEnabled:', err);
    return enabled;
  }
}
