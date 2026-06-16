<agents-index>
[RUN.game SDK Docs]|root:./.rundot-docs|version:5.14.0|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|.:{README.md}|readme:{entitlements-api.md,shop-api.md}|rundot-developer-platform:{deploying-your-game.md,error-handling.md,getting-started.md,initializing-your-game.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ACCESS_GATE.md,ADS.md,AI.md,ANALYTICS.md,APP.md,ASSETS.md,BIGNUMBERS.md,BUILDING_TIMERS.md,CONTEXT.md,EMBEDDED_LIBRARIES.md,ENERGY_SYSTEM.md,ENTITLEMENTS.md,ENVIRONMENT.md,EXPERIMENTS.md,GACHA_SYSTEM.md,HAPTICS.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LOGGING.md,MULTIPLAYER.md,NAVIGATION.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,SHOP.md,SIMULATION_CONFIG.md,STORAGE.md,TIME.md,UGC.md,VIDEO.md}</agents-index>

# Gemini CLI — Stay Awhile Jam Kit

Start by reading [`AGENTS.md`](AGENTS.md) for the project intro, the doc index, and the conventions to keep intact. This file holds Gemini-specific notes only.

## Assets

The creator's own assets always come first; if they upload or attach art or audio, use it. For creators without assets, free ready-to-use art, audio, and more live at [https://github.com/series-ai/jam-ready-assets](https://github.com/series-ai/jam-ready-assets). See "Adding images and other assets" in `AGENTS.md` for where files go.

## Tooling mapping

Where `AGENTS.md` or other docs reference Claude-Code-specific surfaces (`mcp__*`, `Skill`, `Agent` tool), translate to your equivalent:

- File edits → your built-in file edit tool
- Shell commands → your shell execution tool
- Browser interaction → your browser-driving tool, pointed at a signed-in browser (see below)

## Previewing the game

The game runs inside the Run.Game playground sandbox, which needs a Firebase OAuth sign-in popup. Run `npm run dev` and open the printed URL in a normal browser where you're signed in to Run.Game; SDK-authenticated calls fail silently inside sandboxed preview iframes that block the popup. Don't run a second preview server alongside `npm run dev`.
