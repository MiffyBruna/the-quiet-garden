/**
 * Service-layer runtime helpers shared across the SDK wrappers.
 *
 * Two responsibilities:
 *
 *  1. `catchVoid` — the kit's standard wrapper for *best-effort* SDK calls
 *     (analytics, log, fire-and-forget notifications). Per the SDK's
 *     error-handling guidance, every call returns a promise that can reject and
 *     an unhandled rejection crashes the host back to the RUN catalog. Wrapping
 *     a best-effort call in `catchVoid` swallows the transport error so a flaky
 *     analytics flush never takes the game down. Load-bearing calls do NOT use
 *     this — they use try/catch and throw a typed kit error instead.
 *
 *  2. `installUnhandledRejectionGuard` — the global safety net from
 *     docs/sdk-wiring.md (rule 2). It is a *last resort*, not a substitute for
 *     per-call wrapping: if a single `.catch()` is ever missed, this keeps the
 *     stray rejection from being treated as a fatal RUNTIME_ERROR. The app boot
 *     path installs it once.
 */

/**
 * Attach a `.catch()` to any thenable returned by a fire-and-forget SDK call.
 *
 * Accepts `unknown` because some SDK methods are typed `void` yet still return a
 * rejectable promise at runtime. Non-thenables pass through untouched.
 *
 * @param result the return value of the best-effort SDK call
 * @param label short tag for the warning log, e.g. `'analytics:game_opened'`
 */
export function catchVoid(result: unknown, label: string): void {
  try {
    if (
      result != null &&
      typeof result === 'object' &&
      'catch' in result &&
      typeof (result as Promise<unknown>).catch === 'function'
    ) {
      (result as Promise<unknown>).catch((err: unknown) => {
        // best-effort: log and move on; never rethrow
        console.warn(`[kit/sdk] ${label}:`, err);
      });
    }
  } catch {
    // defensive: catchVoid itself must never throw
  }
}

let guardInstalled = false;

/**
 * Install the global `unhandledrejection` safety net. Idempotent — calling more
 * than once (e.g. across HMR reloads) installs the listener only once.
 *
 * @returns a disposer that removes the listener (used on HMR teardown).
 */
export function installUnhandledRejectionGuard(): () => void {
  if (typeof window === 'undefined' || guardInstalled) {
    return () => {};
  }
  const handler = (event: PromiseRejectionEvent): void => {
    console.warn('[kit/sdk] unhandled rejection (safety net):', event.reason);
    // Prevent the host from treating the stray rejection as a fatal crash.
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', handler);
  guardInstalled = true;
  return () => {
    window.removeEventListener('unhandledrejection', handler);
    guardInstalled = false;
  };
}
