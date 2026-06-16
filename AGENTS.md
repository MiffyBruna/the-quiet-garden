<agents-index>
[RUN.game SDK Docs]|root:./.rundot-docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|.:{README.md}|readme:{entitlements-api.md,shop-api.md}|rundot-developer-platform:{deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ADS.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,AUDIO_GEN.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,CONTEXT.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,EXPERIMENTS.md,FILES.md,GACHA_SYSTEM.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STORAGE.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>

# Agent Orientation — Stay Awhile Jam Kit

You're helping a creator build a **cozy game** for the Stay Awhile jam on Run.Game. This kit is a
**bare scaffold**, not a game: a blank welcome screen, the Run.Game SDK plumbing pre-wired in
`src/services/*`, and a cozy theme. There is deliberately no sample game, no mechanics, no genre engine.
The creator brings the idea; you help them build *their* game, not a copy of someone else's.

**Don't be prescriptive.** Cozy is a feeling, not a formula — farming, decorating, tending, tidying,
collecting, wandering, journaling, brewing, whatever the creator dreams up. Your job is to give them
freedom and reach for the right SDK surface when they need it, not to impose a loop. If you find
yourself adding "the standard cozy mechanic," stop and ask the creator what *they* want instead.

## Read these before touching code

1. **[`README.md`](README.md)** — what the kit is and how to build on it.
2. **[`docs/sdk-wiring.md`](docs/sdk-wiring.md)** — what each `src/services/*` SDK wrapper does and
   where to extend.
3. **[`docs/cozy-recipes.md`](docs/cozy-recipes.md)** — wiring patterns that combine surfaces (daily
   check-in, growth timers, gifting, a cosmetic shop, a rewarded boost). Plumbing patterns, never a
   prescribed loop.
4. **`.rundot-docs/`** — the Run.Game SDK reference, regenerated on `npm install`. **Read the doc for any
   SDK surface before writing code against it** (the agents-index above lists every surface).

## What's in the box

- **`src/services/*`** — opinionated, fail-loud wrappers around the SDK: STORAGE, TIME, ADS (rewarded
  only), PURCHASES, LEADERBOARD, NOTIFICATIONS, ANALYTICS, SHARING, LIFECYCLES, ENVIRONMENT. Your game
  code never calls `RundotGameAPI.*` directly — the wrappers own the error contracts and SDK quirks.
- **`src/theme/*`** — a small theme-token system (edit `src/theme/default.ts` to change the look).
- **`src/starter/*`** — the blank welcome screen. Replace this folder with your game. `src/App.tsx` is
  a one-line indirection to the active root.

## SDK surfaces worth reaching for in a cozy game

Cozy games lean on a different set of surfaces than competitive ones. Read the linked doc under
`.rundot-docs/rundot-developer-platform/api/` before wiring each. Reach for these:

- **STORAGE** ([`STORAGE.md`](.rundot-docs/rundot-developer-platform/api/STORAGE.md)) — persist the world:
  what they've grown, decorated, collected. Wrapper: `src/services/storage.ts`. The same doc covers
  **`sharedStorage`**, per-player cross-app buckets, so a player's pantry or progress can travel between
  your apps. No wrapper yet; add one per `docs/sdk-wiring.md` if you need it. (Player-to-player gifting
  is a different pattern: SHARING + CONTEXT, see `docs/cozy-recipes.md`.)
- **TIME** ([`TIME.md`](.rundot-docs/rundot-developer-platform/api/TIME.md)) — daily rhythms, day/night,
  "come back tomorrow." Always anchor timers on server time, never the device clock. `src/services/time.ts`.
- **Growth timers & rest meters** — seeds that sprout while the player is away, bread that bakes
  overnight, a stamina meter that refills with rest. No dedicated surface needed: store a planted-at
  timestamp in the save (STORAGE) and compare against server time (TIME) on load. The full pattern is in
  [`docs/cozy-recipes.md`](docs/cozy-recipes.md). Cozy framing matters: timers are "come back tomorrow"
  warmth, never a grind gate or a pay-to-skip lever.
- **NOTIFICATIONS** ([`NOTIFICATIONS.md`](.rundot-docs/rundot-developer-platform/api/NOTIFICATIONS.md)) —
  a *gentle* nudge ("your garden missed you"), never streak-pressure nagging. `src/services/notifications.ts`.
- **Asset generation** — make cozy art and sound solo:
  [`IMAGE_GEN.md`](.rundot-docs/rundot-developer-platform/api/IMAGE_GEN.md),
  [`SPRITE_GEN.md`](.rundot-docs/rundot-developer-platform/api/SPRITE_GEN.md),
  [`THREE_D_GEN.md`](.rundot-docs/rundot-developer-platform/api/THREE_D_GEN.md),
  [`AUDIO_GEN.md`](.rundot-docs/rundot-developer-platform/api/AUDIO_GEN.md) for ambient soundscapes.
- **PURCHASES / SHOP / ENTITLEMENTS**
  ([`PURCHASES.md`](.rundot-docs/rundot-developer-platform/api/PURCHASES.md),
  [`SHOP.md`](.rundot-docs/rundot-developer-platform/api/SHOP.md),
  [`ENTITLEMENTS.md`](.rundot-docs/rundot-developer-platform/api/ENTITLEMENTS.md)) — cozy monetization is
  cosmetic: decoration packs, themes, seeds. `src/services/iap.ts`.
- **ADS** ([`ADS.md`](.rundot-docs/rundot-developer-platform/api/ADS.md)) — rewarded-only and optional.
  Cozy games shouldn't nag; a gentle "watch to restock" is the ceiling. `src/services/ads.ts`.
- **SHARING** ([`SHARING.md`](.rundot-docs/rundot-developer-platform/api/SHARING.md)) — let players show
  off their space; organic growth fits cozy better than ads. `src/services/sharing.ts`.
- **CONTEXT** ([`CONTEXT.md`](.rundot-docs/rundot-developer-platform/api/CONTEXT.md)) — read the params a
  player arrived with (share link, notification tap) so a friend's invite or gift lands them in the right
  place immediately. The receiving half of SHARING and gifting.
- **AI** ([`AI.md`](.rundot-docs/rundot-developer-platform/api/AI.md)) — optional cozy NPC dialogue / a
  chatty companion.
- **HAPTICS, SAFE_AREA, LIFECYCLES, ANALYTICS, PROFILE** — polish and plumbing: tactile feedback, layout
  insets, save-on-background, measurement, who's playing.

**Leaderboards: co-opetition, not a high-score ladder.** A cutthroat ranking isn't cozy. If you surface
[`LEADERBOARD.md`](.rundot-docs/rundot-developer-platform/api/LEADERBOARD.md) at all, frame it as
co-opetition — celebrate participation and shared/community goals (gardens grown this week, most welcomed
visitors, a collective harvest), not winners and losers. Daily-period boards are the lowest-pressure
option: everyone gets a fresh start every morning. `src/services/leaderboard.ts` is neutral; the
framing is the creator's call.

**Probably skip for cozy** (they pull toward competitive or grindy genres): BIGNUMBERS, GACHA_SYSTEM,
PVP_SYSTEM, MULTIPLAYER. Skip the server-side simulation recipes too (SERVER_AUTHORITATIVE,
SIMULATION_CONFIG, BUILDING_TIMERS, ENERGY_SYSTEM): timers work fine client-side with TIME + STORAGE
(see [`docs/cozy-recipes.md`](docs/cozy-recipes.md)), and the simulation system is more setup than a jam
game needs.

## Project conventions (keep these intact)

- **Run.Game SDK calls go through `src/services/*`.** Your game code never calls `RundotGameAPI.*`
  directly — the wrappers own the error contracts and SDK quirks.
- **Fail loud.** When an SDK call fails, throw or surface a typed error. Don't paper over failures with
  fallback values. Fire-and-forget is allowed only when annotated with a `// best-effort:` reason.
- **Original names only.** Module names, theme, content, and asset filenames must be original — build
  something that doesn't look like anyone else's jam entry.
- **Read the SDK docs, don't guess.** `.rundot-docs/` is the retrieval source of truth for any surface.

## Adding images and other assets

**The creator's own assets come first.** If they upload, attach, or point you at their own art or audio,
always prefer it. If they don't have assets, gently mention that free, ready-to-use ones (art, audio, and
more) live at [https://github.com/series-ai/jam-ready-assets](https://github.com/series-ai/jam-ready-assets),
and generating with the asset-gen surfaces works too. Whatever the source, drop files into the folders
below.

Anything the game loads at runtime — images, audio, video — **must exist as a real file in the build**,
and the deployed bundle is exactly what `npm run build` writes to `dist/`. A bare string path like
`<img src="lantern.png" />` with no backing file is not bundled by Vite and **404s in the deployed game**,
even when `npm run dev` happened to resolve it.

So: **drop image files into `public/cdn-assets/` (or `public/`) first, then reference them by the
resulting path** — never name a file in code and assume it resolves.

- **Small (<100KB) — `public/`.** Reference by its root-absolute path: `public/lantern.png` → `/lantern.png`.
- **Large (>100KB) — `public/cdn-assets/`.** Load it with `RundotGameAPI.cdn.fetchAssets('name.png')`.
  `rundot deploy` uploads that folder to the CDN and versions it. See
  [`public/cdn-assets/README.md`](public/cdn-assets/README.md).

When you generate or add an asset (including AI-generated art), create the file under one of those folders
**first**, then reference it by the path that follows.

## Before you submit your game

- **Update to the latest CLI first.** Before you submit/publish a game from Studio (or run `rundot
  deploy`), **ask your agent to update to the latest Run.Game CLI** and re-check:
  ```bash
  rundot --version
  rundot update      # run this, then re-check — submitting on an old CLI is not supported
  ```
- **Check your assets ship.** Run `npm run build` and confirm every image, sound, and video the game
  references is present in `dist/`. A path with no backing file under `public/` (or `public/cdn-assets/`)
  404s in the live game — see "Adding images and other assets" above.
- **Replace the placeholder thumbnail.** `public/thumbnail.jpg` ships as a kit placeholder; swap in your
  own art (exactly 512×512 JPG) before deploying. The CLI rejects a deploy that still uses a default
  thumbnail. See `.rundot-docs/rundot-developer-platform/setting-your-game-thumbnail.md`.

## Harness-specific notes

- **Claude Code:** [`CLAUDE.md`](CLAUDE.md).
- **Gemini CLI:** [`GEMINI.md`](GEMINI.md).
- **Codex / Cursor / others:** this file is your entry point; use the docs index above.
