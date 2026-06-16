<source-index>
root:.|.:{.prettierrc.json,AGENTS.md,CLAUDE.md,GEMINI.md,README.md,game.config.prod.json,index.html,package-lock.json,package.json,pnpm-workspace.yaml,tsconfig.json,tsconfig.node.json,vite.config.ts,vitest.config.ts}|.claude:{launch.json}|.rundot:{cli_hooks.json}|.runstudio:{metadata.json}|docs:{cozy-recipes.md,getting-started.md,sdk-wiring.md}|public/cdn-assets:{README.md}|src:{App.tsx,index.css,main.tsx,vite-env.d.ts}|src/components:{ErrorBoundary.tsx}|src/services:{_runtime.ts,ads.ts,analytics.ts,environment.ts,iap.ts,leaderboard.ts,lifecycles.ts,notifications.ts,sharing.ts,storage.ts,time.ts}|src/services/__mocks__:{rundot-game-sdk.ts}|src/services/__tests__:{ads.test.ts,analytics.test.ts,environment.test.ts,iap.test.ts,leaderboard.test.ts,lifecycles.test.ts,notifications.test.ts,sharing.test.ts,storage.test.ts,time.test.ts}|src/starter:{StarterApp.tsx}|src/test:{setup.ts}|src/theme:{applyTheme.ts,default.ts,index.ts,types.ts}
</source-index>

<agents-index>
[RUN.game SDK Docs]|root:./.rundot-docs|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|.:{README.md}|readme:{entitlements-api.md,shop-api.md}|rundot-developer-platform:{deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,runtime-environment.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ADS.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,AUDIO_GEN.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CLIPS.md,CONTEXT.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,EXPERIMENTS.md,FILES.md,GACHA_SYSTEM.md,HAPTICS.md,IMAGE_GEN.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,PVP_SYSTEM.md,RATE_LIMITS.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,SPRITE_GEN.md,STORAGE.md,SYSTEM.md,THREE_D_GEN.md,TIME.md,UGC.md,VIDEO.md,VIDEO_GEN.md}</agents-index>

# Claude Code — Stay Awhile Jam Kit

Start by reading [`AGENTS.md`](AGENTS.md) for the project intro, the doc index, and the conventions to keep intact. This file holds Claude-Code-specific notes only.

## Assets

The creator's own assets always come first; if they upload or attach art or audio, use it. For creators without assets, free ready-to-use art, audio, and more live at [https://github.com/series-ai/jam-ready-assets](https://github.com/series-ai/jam-ready-assets). See "Adding images and other assets" in `AGENTS.md` for where files go.

## Previewing the game

The game runs inside the Run.Game playground sandbox, which needs a Firebase OAuth sign-in popup (to `playground-venus-app.firebaseapp.com`). Sandboxed in-editor preview tools that block cross-origin popups — including Claude Code's `mcp__Claude_Preview__*` — let the page load but SDK-authenticated calls fail silently.

To exercise the real game:

- Run `npm run dev` and open the printed URL in a normal browser where you're signed in to Run.Game.
- For automated browser interaction, drive that signed-in browser (e.g. via the Chrome MCP tools), not an isolated preview iframe.
- Don't run a second preview server alongside `npm run dev` — it causes port collisions and stale-cache cross-talk with the playground.

## Type checking

`npm run typecheck` (`tsc --noEmit`) is the fast correctness check. The production build (`tsc && vite build`) excludes test files, so a strict-mode violation in a test won't fail the build but will fail `npm test`. Prefer reading the source or running `typecheck` over asking a preview server for errors.
