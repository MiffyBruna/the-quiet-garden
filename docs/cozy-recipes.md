# Cozy SDK Recipes

Wiring patterns that combine Run.Game SDK surfaces for things cozy games tend to want: daily check-ins,
things that grow while you're away, gifts between friends, a small cosmetic shop, an optional rewarded
boost. These are plumbing patterns. None of them is "the cozy loop", and your game doesn't need any of
them; reach for a recipe when your idea calls for it.

Every snippet goes through the kit's wrappers in `src/services/*` (never `RundotGameAPI.*` directly).
Where a recipe needs a surface the kit hasn't wrapped yet, add a wrapper first; the steps are in
[`sdk-wiring.md`](sdk-wiring.md) under "Adding a new SDK surface". And before wiring any surface, read
its doc under [`../.rundot-docs/rundot-developer-platform/api/`](../.rundot-docs/rundot-developer-platform/api/).

---

## Daily check-in reward

A small "welcome back" when the player returns each day: water refilled, a fresh visitor, one new seed.

**Surfaces:** TIME ([`TIME.md`](../.rundot-docs/rundot-developer-platform/api/TIME.md)) +
STORAGE ([`STORAGE.md`](../.rundot-docs/rundot-developer-platform/api/STORAGE.md)) +
NOTIFICATIONS ([`NOTIFICATIONS.md`](../.rundot-docs/rundot-developer-platform/api/NOTIFICATIONS.md)).

The SDK has no streak or daily-bonus API; this pattern is the whole feature. Two rules make it sturdy:

1. **The day boundary comes from server time**, never the device clock (a player can roll their clock).
2. **The claim state lives in the save**, so it survives reinstalls and follows the player across devices.

```ts
import { getServerNow } from '../services/time';
import { loadSave, persistSave } from '../services/storage';
import { scheduleNotification } from '../services/notifications';

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function claimDailyGift(): Promise<boolean> {
  const [now, save] = [await getServerNow(), await loadSave()];
  const today = utcDay(now);
  if (save.data['lastClaimDay'] === today) return false; // already claimed

  await persistSave({
    ...save,
    data: { ...save.data, lastClaimDay: today /* + whatever the gift grants */ },
  });
  // best-effort: one kind reminder tomorrow, not streak pressure
  await scheduleNotification('daily_gift', {
    title: 'The kettle is on',
    body: 'Something small is waiting for you.',
    delaySeconds: 24 * 60 * 60,
  });
  return true;
}
```

Keep it kind. One notification, soft copy, and no lost-streak punishment; a cozy game forgives a missed
day.

---

## Things that grow while you're away

Seeds that sprout overnight, bread that bakes while the player sleeps, a stamina meter that refills with
rest. No dedicated SDK surface needed: store a planted-at timestamp in the save, compare it against
server time on load. Offline growth is just arithmetic.

**Surfaces:** TIME ([`TIME.md`](../.rundot-docs/rundot-developer-platform/api/TIME.md)) +
STORAGE ([`STORAGE.md`](../.rundot-docs/rundot-developer-platform/api/STORAGE.md)), both already wrapped.

The one rule: **the timestamp math runs against `getServerNow()`, never `Date.now()`**, so rolling the
device clock doesn't fast-forward the garden.

```ts
import { getServerNow } from '../services/time';
import { loadSave, persistSave } from '../services/storage';
import { scheduleNotification } from '../services/notifications';

const GROW_MS = 8 * 60 * 60 * 1000; // 8 hours, tune per plant

export async function plantSeed(plot: string): Promise<void> {
  const [now, save] = [await getServerNow(), await loadSave()];
  await persistSave({ ...save, data: { ...save.data, [`plot_${plot}`]: now } });
  // best-effort: a soft heads-up when it's ready
  await scheduleNotification(`sprout_${plot}`, {
    title: 'Something sprouted',
    body: 'Your seedling is up.',
    delaySeconds: GROW_MS / 1000,
  });
}

export async function isSprouted(plot: string): Promise<boolean> {
  const [now, save] = [await getServerNow(), await loadSave()];
  const plantedAt = save.data[`plot_${plot}`] as number | undefined;
  return plantedAt !== undefined && now - plantedAt >= GROW_MS;
}
```

Client-side state means a determined player could edit their own garden. For a jam that's fine; nobody
else's game gets hurt.

The cozy framing is the point: a growth timer says "come back tomorrow and see", never "wait 4 hours or
pay to skip". If the timer makes the player feel gated instead of anticipatory, shorten it or remove it.

---

## Gifting between friends

A player sends a friend a seed, a recipe, or a decoration; the friend opens the link and the gift is
there.

**Surfaces:** SHARING ([`SHARING.md`](../.rundot-docs/rundot-developer-platform/api/SHARING.md)) to send +
CONTEXT ([`CONTEXT.md`](../.rundot-docs/rundot-developer-platform/api/CONTEXT.md)) to receive.

The gift travels inside the share link's params (keep the payload small; IDs, not asset blobs). The
sender side uses the kit's sharing wrapper:

```ts
import { shareMoment } from '../services/sharing';

await shareMoment({
  title: 'I grew this for you',
  params: { gift: 'seed_lavender', from: playerName },
});
```

On the receiving side, check the launch context at boot and branch early; a player tapping a gift link
expects to land on the gift, not the title screen. `context` has no kit wrapper yet (add
`src/services/context.ts` per [`sdk-wiring.md`](sdk-wiring.md)); inside it you'll read
`shareParams` and hand back a typed gift, something like:

```ts
const gift = await getIncomingGift(); // wrapper around context.shareParams
if (gift) acceptGift(gift);           // plant it, shelve it, say thanks
```

Related, different problem: `sharedStorage` ([`STORAGE.md`](../.rundot-docs/rundot-developer-platform/api/STORAGE.md))
moves **one player's own data between apps** (a pantry shared by your garden game and its companion).
It is not a player-to-player mailbox; gifts go through share links as above.

---

## A small cosmetic shop

Cozy monetization is cosmetic: decoration packs, themes, seed varieties. Mechanics never sit behind a
paywall.

**Surfaces:** PURCHASES ([`PURCHASES.md`](../.rundot-docs/rundot-developer-platform/api/PURCHASES.md),
wrapped in `src/services/iap.ts`), plus SHOP ([`SHOP.md`](../.rundot-docs/rundot-developer-platform/api/SHOP.md))
and ENTITLEMENTS ([`ENTITLEMENTS.md`](../.rundot-docs/rundot-developer-platform/api/ENTITLEMENTS.md)) when
you want a server-configured catalog and ownership tracking instead of rolling your own.

The simple version needs only the existing wrapper:

```ts
import { getRunbucksBalance, purchaseProduct, openPlatformStore } from '../services/iap';

const balance = await getRunbucksBalance();
const result = await purchaseProduct('decor_meadow_pack', 50); // 50 RunBucks
if (result.outcome === 'success') unlockDecorPack('meadow');
if (result.outcome === 'insufficient_funds') await openPlatformStore(); // top up, then retry
```

Show the price and exactly what's in the pack before the spend. Record what's owned in the save (or in
ENTITLEMENTS if you adopt it) so purchases survive across devices.

---

## An optional rewarded boost

A rewarded ad fits cozy only as a gentle, player-initiated extra: "watch to restock the seed basket",
"watch to invite one more visitor today". Never a wall, never a popup.

**Surfaces:** ADS ([`ADS.md`](../.rundot-docs/rundot-developer-platform/api/ADS.md)), wrapped
rewarded-only in `src/services/ads.ts` (the kit deliberately exports no interstitials; forced ads damage
trust). The wrapper already caps views at 5 per UTC day and hides on desktop.

```ts
import { isRewardedAdReady, presentRewardedAd } from '../services/ads';

if (await isRewardedAdReady('restock_basket')) {
  const { rewarded } = await presentRewardedAd('restock_basket');
  if (rewarded) restockSeedBasket();
}
```

Only render the button when `isRewardedAdReady` says so, and make declining cost nothing; the basket
refills tomorrow anyway (see the daily check-in recipe).
