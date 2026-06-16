# Getting Started

Clone the kit, boot it, and build your own cozy game on top of it.

The kit wires up the Run.Game SDK for you: saving, server time, in-app purchases, rewarded ads,
notifications, sharing, and analytics. `npm run dev` boots a blank welcome screen. There's no game
here, that's yours to build.

---

## Prerequisites

- **Node 20 or newer.** The Vite scaffold and Rundot SDK both require modern Node.
- **The Rundot CLI.** Install one-liners are in [`.rundot-docs/rundot-developer-platform/getting-started.md`](../.rundot-docs/rundot-developer-platform/getting-started.md). On Windows: `irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex`. macOS / Linux: the equivalent in the same doc. **Keep it up to date** — `rundot update`.
- **A Rundot account.** The CLI prompts on first run; sign in via the standard flow.

---

## Steps

```bash
# 1. Clone the kit into a new project
git clone https://github.com/series-ai/stay-awhile-jam-kit.git my-cozy-game
cd my-cozy-game

# 2. Install dependencies. The SDK's postinstall script regenerates .rundot-docs/ locally.
npm install

# 3. REQUIRED. The kit ships no game ID, so this creates yours and writes it
#    to game.config.prod.json. Must run before `npm run dev`. Rename later anytime.
rundot init

# 4. Boot the dev sandbox.
npm run dev
```

Step 4 opens a URL the CLI prints. You'll see the Run.Game playground sandbox hosting the kit's blank
welcome screen. Replace `src/starter/*` with your game, and reach for the SDK through the wrappers in
`src/services/*` as you build.

### Game-jam entry

`game.config.prod.json` ships `"kitId": "stay-awhile"`. `rundot init` reads it and stamps your new game
with that kit id, which is how a published game auto-enters the Stay Awhile jam while the submission
window is open. Leave it in place to compete; remove the line if you don't want the game tied to the jam.

---

## Make it yours

Build whatever cozy game you want — the kit doesn't impose a genre or a loop. Edit `src/theme/default.ts`
for your look, replace `src/starter/*` with your screens, and reach for SDK surfaces through
`src/services/*` as you need them. **All SDK access goes through `src/services/*`** — don't call
`RundotGameAPI.*` from your app code.

For *which* surfaces fit a cozy game (save state, growth timers, gentle notifications, AI art & audio
generation, cosmetic purchases, sharing and gifting, and a co-opetition take on leaderboards), read
[`../AGENTS.md`](../AGENTS.md). For wiring patterns that combine them, read
[`cozy-recipes.md`](cozy-recipes.md). For what each wrapper does, read
[`sdk-wiring.md`](sdk-wiring.md). Before writing code
against any SDK surface, read its doc under [`../.rundot-docs/`](../.rundot-docs/).

---

## Deploying

**Replace the placeholder thumbnail first.** The kit ships a placeholder `public/thumbnail.jpg`; swap in
your own 512×512 JPG before deploying (the CLI rejects deploys that still use a default thumbnail).

**Update the CLI before you submit.** Submitting/publishing a game from Studio (or `rundot deploy`) on an
old CLI is not supported — update first:

```bash
rundot --version
rundot update      # then re-check
rundot deploy
```

`rundot deploy` builds and uploads to your Rundot project, and the CLI prints a share URL when done. Full
deploy guide in [`.rundot-docs/rundot-developer-platform/deploying-your-game.md`](../.rundot-docs/rundot-developer-platform/deploying-your-game.md).

---

## Building with an AI assistant

If you're coding with Claude Code, Cursor, Gemini, or another agent, the repo ships orientation files —
[`../AGENTS.md`](../AGENTS.md), [`../CLAUDE.md`](../CLAUDE.md), [`../GEMINI.md`](../GEMINI.md) — that point
your assistant at the SDK doc index and the surfaces worth reaching for in a cozy game. Start your
assistant by having it read `AGENTS.md`; it'll then know the services-layer rule, the asset rule, and
where the SDK reference lives, so it can help you build *your* game with creative freedom.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` fails with peer-dep warnings about `@series-inc/rundot-game-sdk` | Node version too old | Upgrade to Node 20+ |
| `.rundot-docs/` is missing after `npm install` | SDK postinstall didn't run (skipped via `--ignore-scripts` or pnpm strict mode) | Reinstall with `npm install` (no flags) or run the SDK's postinstall manually |
| `rundot init` prompts for login every time | CLI credential cache not persisted | See [`.rundot-docs/rundot-developer-platform/troubleshooting.md`](../.rundot-docs/rundot-developer-platform/troubleshooting.md) |
| `npm run dev` boots but the sandbox shows a blank page beyond the welcome screen | `game.config.prod.json` missing or malformed (likely `rundot init` skipped) | Run `rundot init` |
| Submitting from Studio fails or behaves oddly | CLI out of date | `rundot update`, then retry |
| Port conflict on `npm run dev` | Another Vite or Rundot session already on the default port | Stop the other session or set a different port via `vite.config.ts` |

SDK-side troubleshooting lives in [`.rundot-docs/rundot-developer-platform/troubleshooting.md`](../.rundot-docs/rundot-developer-platform/troubleshooting.md) and [`.rundot-docs/rundot-developer-platform/error-handling.md`](../.rundot-docs/rundot-developer-platform/error-handling.md).
