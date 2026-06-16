/**
 * STORAGE service — local-first save state on `RundotGameAPI.appStorage`.
 *
 * Contract: docs/sdk-wiring.md § STORAGE. One canonical, single-blob save under
 * `kit_save_v1`. Schema version lives in the key suffix so migrations can run on
 * load. Big numbers are persisted as strings (the SDK's `BE:` convention) — this
 * layer treats the save as an opaque versioned envelope and does not interpret
 * the payload beyond its schema version.
 *
 * Fail-loud (docs/sdk-wiring.md): every failure is surfaced as a typed
 * {@link KitStorageError} with a `code` so callers (welcome-back modal, retry
 * queue) branch explicitly. No silent default substitution — a corrupt save
 * throws CORRUPT, never quietly resets the player's progress.
 *
 * Why `appStorage` and not `ownerStorage`/`deviceCache`: save state is per-title
 * and must be cloud-synced. See the contract doc for the scope rationale.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** Current save schema version. Bump when adding a migration. */
export const SAVE_SCHEMA_VERSION = 1;

/** Canonical save key. The `_v1` suffix carries the schema version. */
export const SAVE_KEY = `kit_save_v${SAVE_SCHEMA_VERSION}`;

/** Default save-throttle interval (ms) for the active-play autosave loop. */
export const DEFAULT_SAVE_INTERVAL_MS = 30_000;

/** Per-value byte ceiling enforced by the platform bucket (8 KiB). */
const VALUE_BYTE_LIMIT = 8 * 1024;

/** How many times to retry a rate-limited write before giving up. */
const MAX_RETRIES = 3;

/**
 * The versioned save envelope. `data` is the opaque game-state blob your game
 * owns; this service only reads/writes/validates the envelope.
 */
export interface KitSaveState {
  /** Schema version this blob was written with. */
  version: number;
  /** Server-ms timestamp of the write (anchor for any time-based accrual). */
  savedAt: number;
  /** Opaque game-state payload, owned by your game. */
  data: Record<string, unknown>;
}

/** Failure categories the storage layer surfaces to callers. */
export type KitStorageErrorCode = 'CORRUPT' | 'QUOTA' | 'OFFLINE' | 'UNKNOWN';

/** Typed storage failure. Callers branch on `code`, never on the message text. */
export class KitStorageError extends Error {
  constructor(
    public readonly code: KitStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KitStorageError';
  }
}

/** A schema migration: a pure `(prev) => next` transform run on load. */
export type SaveMigration = (prev: KitSaveState) => KitSaveState;

/**
 * Ordered migration chain. `MIGRATIONS[n]` upgrades a v(n+1) save to v(n+2).
 * Empty at v1 — the first real migration lands here when SAVE_SCHEMA_VERSION
 * bumps to 2. Lives inline rather than in a separate dir until there's one to
 * write (keeps the v1 kit lean; the contract's `storage-migrations/` dir is the
 * home once migrations exist).
 */
export const MIGRATIONS: readonly SaveMigration[] = [];

/** A fresh save envelope for first launch. */
export function defaultSaveState(): KitSaveState {
  return { version: SAVE_SCHEMA_VERSION, savedAt: 0, data: {} };
}

/** UTF-8 byte length of a string (the platform measures values in bytes). */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** True when an SDK rejection looks like a rate-limit (429) response. */
function isRateLimited(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; error?: unknown; message?: unknown };
  if (e.code === 'RATE_LIMITED') return true;
  if (typeof e.error === 'object' && e.error != null) {
    const inner = e.error as { code?: unknown };
    if (inner.code === 'RATE_LIMITED') return true;
  }
  // The 429 path uses a non-envelope shape: { error: 'Too Many Requests', ... }
  if (e.error === 'Too Many Requests') return true;
  if (typeof e.message === 'string' && /too many requests|429/i.test(e.message)) return true;
  return false;
}

/** True when an SDK rejection indicates the bucket is over quota. */
function isQuotaExceeded(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; error?: unknown };
  if (e.code === 'QUOTA_EXCEEDED') return true;
  if (typeof e.error === 'object' && e.error != null) {
    return (e.error as { code?: unknown }).code === 'QUOTA_EXCEEDED';
  }
  return false;
}

/**
 * Parse and validate a raw stored string into a {@link KitSaveState}, running
 * the migration chain to bring it up to the current schema. Throws
 * `KitStorageError('CORRUPT', ...)` on malformed JSON, missing/unknown version,
 * or a version newer than this build understands — fail loud.
 */
export function parseKitSaveState(raw: string): KitSaveState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new KitStorageError('CORRUPT', 'save blob is not valid JSON');
  }

  if (parsed == null || typeof parsed !== 'object') {
    throw new KitStorageError('CORRUPT', 'save blob is not an object');
  }
  const env = parsed as Partial<KitSaveState>;
  if (typeof env.version !== 'number' || !Number.isInteger(env.version)) {
    throw new KitStorageError('CORRUPT', 'save blob has no integer version');
  }
  if (env.version > SAVE_SCHEMA_VERSION) {
    throw new KitStorageError(
      'CORRUPT',
      `save version ${env.version} is newer than supported (${SAVE_SCHEMA_VERSION})`,
    );
  }
  if (typeof env.data !== 'object' || env.data == null) {
    throw new KitStorageError('CORRUPT', 'save blob has no data object');
  }

  let state: KitSaveState = {
    version: env.version,
    savedAt: typeof env.savedAt === 'number' ? env.savedAt : 0,
    data: env.data as Record<string, unknown>,
  };

  // Run migrations sequentially from the stored version up to current.
  while (state.version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[state.version - 1];
    if (!migrate) {
      throw new KitStorageError(
        'CORRUPT',
        `no migration from save version ${state.version}`,
      );
    }
    state = migrate(state);
    state = { ...state, version: state.version + 1 };
  }

  return state;
}

/**
 * Load the save. Returns a fresh {@link defaultSaveState} on first launch
 * (absent key). Throws a typed {@link KitStorageError} on any failure —
 * corrupt blob (CORRUPT), transport/offline (OFFLINE), or unknown (UNKNOWN).
 */
export async function loadSave(): Promise<KitSaveState> {
  let raw: string | null;
  try {
    raw = await RundotGameAPI.appStorage.getItem(SAVE_KEY);
  } catch (err) {
    if (isRateLimited(err)) {
      throw new KitStorageError('OFFLINE', `loadSave rate-limited: ${String(err)}`);
    }
    throw new KitStorageError('UNKNOWN', `loadSave failed: ${String(err)}`);
  }
  if (raw == null) return defaultSaveState();
  return parseKitSaveState(raw); // throws CORRUPT on schema mismatch — fail loud
}

/** Sleep helper for the rate-limit backoff (exponential: 100, 200, 400 ms). */
function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
}

/**
 * Persist the save. Serializes the envelope, enforces the 8 KiB value ceiling
 * (throws QUOTA before even attempting the write), and retries a rate-limited
 * write with exponential backoff up to {@link MAX_RETRIES}, then throws OFFLINE.
 * QUOTA_EXCEEDED from the host throws QUOTA; anything else throws UNKNOWN.
 */
export async function persistSave(state: KitSaveState): Promise<void> {
  const envelope: KitSaveState = { ...state, version: SAVE_SCHEMA_VERSION };
  let raw: string;
  try {
    raw = JSON.stringify(envelope);
  } catch (err) {
    throw new KitStorageError('CORRUPT', `save blob is not serializable: ${String(err)}`);
  }

  if (byteLength(raw) > VALUE_BYTE_LIMIT) {
    throw new KitStorageError(
      'QUOTA',
      `save blob is ${byteLength(raw)} bytes, over the ${VALUE_BYTE_LIMIT}-byte value cap`,
    );
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await RundotGameAPI.appStorage.setItem(SAVE_KEY, raw);
      return;
    } catch (err) {
      if (isQuotaExceeded(err)) {
        throw new KitStorageError('QUOTA', `persistSave over quota: ${String(err)}`);
      }
      if (isRateLimited(err)) {
        if (attempt < MAX_RETRIES - 1) {
          await backoff(attempt);
          continue;
        }
        throw new KitStorageError('OFFLINE', `persistSave rate-limited after ${MAX_RETRIES} attempts`);
      }
      throw new KitStorageError('UNKNOWN', `persistSave failed: ${String(err)}`);
    }
  }
}

/** Wipe the save (debug-console "reset state" tool). Throws UNKNOWN on failure. */
export async function clearSave(): Promise<void> {
  try {
    await RundotGameAPI.appStorage.removeItem(SAVE_KEY);
  } catch (err) {
    throw new KitStorageError('UNKNOWN', `clearSave failed: ${String(err)}`);
  }
}
