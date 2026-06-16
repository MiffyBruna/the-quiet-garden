/**
 * LIFECYCLES service — host pause/resume/sleep/awake/quit hooks.
 *
 * Contract: docs/sdk-wiring.md § LIFECYCLES. Wraps `RundotGameAPI.lifecycles`
 * (plural — the SDK exposes `lifecycles`, not `lifecycle`). The kit registers
 * five hooks; the actual side effects (persist save, refresh time, cancel
 * notifications, etc.) are passed in by the boot path so this layer stays pure
 * infrastructure.
 *
 * Two infrastructure guarantees from the contract:
 *  1. Every registered disposer is tracked on a module-level array so
 *     {@link disposeKitLifecycles} can detach them all on HMR teardown —
 *     otherwise hot-reload would stack duplicate listeners.
 *  2. Hook callbacks are wrapped so a thrown/rejected callback is caught and
 *     logged, never propagated to the SDK (which would crash the host).
 *
 * `onSleep` is the load-bearing persistence hook, not `onQuit` (forced quits and
 * OOM kills skip `onQuit`). The caller is expected to persist save state on both
 * `onPause` and `onSleep`; this layer just delivers the events safely.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** The five lifecycle hooks the kit wires. */
export interface KitLifecycleHandlers {
  onPause?: () => void | Promise<void>;
  onResume?: () => void | Promise<void>;
  onSleep?: () => void | Promise<void>;
  onAwake?: () => void | Promise<void>;
  onQuit?: () => void | Promise<void>;
}

/** Active disposers, so {@link disposeKitLifecycles} can detach all of them. */
const disposers: Array<() => void> = [];

/**
 * Wrap a caller callback so a synchronous throw or a rejected promise is caught
 * and logged rather than propagating into the SDK's event dispatch.
 */
function guarded(label: string, cb: () => void | Promise<void>): () => void {
  return () => {
    try {
      const maybe = cb();
      if (maybe && typeof (maybe as Promise<void>).catch === 'function') {
        (maybe as Promise<void>).catch((err: unknown) => {
          console.warn(`[kit/sdk] lifecycles:${label} (async):`, err);
        });
      }
    } catch (err) {
      console.warn(`[kit/sdk] lifecycles:${label}:`, err);
    }
  };
}

/**
 * Register the kit's lifecycle handlers. Idempotent-by-teardown: call
 * {@link disposeKitLifecycles} before re-registering (the boot path does this on
 * HMR). Returns the same disposer for convenience.
 *
 * Each `RundotGameAPI.lifecycles.on*` returns a `{ unsubscribe }` subscription;
 * we normalize it to a plain disposer function.
 */
export function registerKitLifecycles(handlers: KitLifecycleHandlers): () => void {
  const hooks: Array<[keyof KitLifecycleHandlers, (cb: () => void) => { unsubscribe: () => void }]> = [
    ['onPause', RundotGameAPI.lifecycles.onPause],
    ['onResume', RundotGameAPI.lifecycles.onResume],
    ['onSleep', RundotGameAPI.lifecycles.onSleep],
    ['onAwake', RundotGameAPI.lifecycles.onAwake],
    ['onQuit', RundotGameAPI.lifecycles.onQuit],
  ];

  for (const [name, register] of hooks) {
    const cb = handlers[name];
    if (!cb) continue;
    try {
      const sub = register(guarded(name, cb));
      disposers.push(() => sub.unsubscribe());
    } catch (err) {
      // Registration itself failing is best-effort — log and skip this hook.
      console.warn(`[kit/sdk] lifecycles:register ${name}:`, err);
    }
  }

  return disposeKitLifecycles;
}

/**
 * Detach every registered lifecycle listener. Called on HMR teardown so a
 * hot-reload doesn't leak stacked listeners. Safe to call when nothing is
 * registered.
 */
export function disposeKitLifecycles(): void {
  while (disposers.length > 0) {
    const dispose = disposers.pop();
    try {
      dispose?.();
    } catch (err) {
      console.warn('[kit/sdk] lifecycles:dispose:', err);
    }
  }
}
