# Xscape architecture draft

**Draft v1, proposed and not yet approved.** This is a first-look survey and a proposed direction, not a commitment to rewrite or to change live behavior.

Survey of `/workspace/xscape-site` at commit `c9b766f` (branch `main`), taken Wednesday, Nov 11, 2026, America/New_York. Live site: https://kgallagher2-sx.github.io/xscape/. GitHub: `kgallagher2-sx/xscape`.

This clone was **4 commits behind `origin/main`** when the survey started (`f870469`, two stamp commits, and `0dd6a77` on the Gorehorn axe / lab frames). Those commits also sat on worktree `/workspace/xscape-art/wt` (`art/fixes-20261111`). Two QA worktrees exist at `/workspace/qa/checkout-340eb55` and `/workspace/qa/checkout-c875ffc`. **This draft did not pull, branch, stash, or edit anything in the shared clone.** While the draft was being written, some other process fast-forwarded this clone’s `main` to `cf00b66` (Gorehorn axe follow-up plus more stamps). Line numbers and hashes in the body still refer to `c9b766f` only.

This is a first draft for Kellen. Nothing here has been committed to the game repo.

---

## (a) Current state

Xscape is a portrait, tick-based (600 ms) OSRS-style phone game shipped as a static GitHub Pages site plus a Supabase backend. There is no bundler, no `package.json`, no TypeScript, no `.github/workflows`, no linter, and no `.gitignore`. Scripts are plain `.js` files loaded with `<script>` tags, talking to each other through `window` globals. A service worker (`sw.js`) caches same-origin GETs.

### Size

| Area | Evidence |
|---|---|
| `.js` files | **26,529** lines (`wc -l *.js`) |
| `index.html` | **8,236** lines: ~1,024 of CSS (`<style>` at 17–1040), ~726 of markup, and about **6,448** lines of inline JavaScript across four `<script>` blocks (lines 4, 1777–7941, 7953–8008, 8012–8234) |
| Other HTML | `lab.html` 1,041; `raid.html` 818; `privacy.html` 107; `terms.html` 97 |
| Docs / SQL | `BACKEND.md` 152; `RAID_DESIGN.md` 127; **33** files under `supabase/` |
| Release tooling | `scripts/stamp-build.sh` (54 lines) — the only file in `scripts/` |
| Art / QA shots | 4 PWA icons; `partyhat.png`; **501** images under `screens/` (~126 MB). `git ls-files screens` tracks **139**; the rest are untracked in this clone. |
| Git history | **109** commits, all authored `kgallagher2-sx`, all on `main`, all dated 2026-11-09 (13), 2026-11-10 (77), or 2026-11-11 (19). Zero merge commits. |

### Pages and load order

**`index.html` (hub + Jad + every solo boss + raid-in-hub + duels + cloud).** Script order:

1. Line 4: `window.XSCAPE_BUILD = "20261111084604-c875ffc"` (stamped).
2. Lines 1767–1776, art and stats, no cache-bust query: `partyhat-img.js`, `whip-img.js`, `sprites.js`, `widow-sprites.js`, `knight-sprites.js`, `gorehorn-sprites.js`, `colossus-sprites.js`, `lab-gear.js`, `kree-sprites.js`, `stats.js`.
3. Lines 1777–7941: the host engine — constants, `ITEMS` / `LOADOUTS` / `SHOP` / `MONSTERS`, combat math, tiles and pathing, inventory/bank, profile I/O, Jad fight, audio, canvas `frame` / `gameTick`, cutscenes, equipment UI, `window.KellenScape` / `window.Xscape` API (7798–7908), and explicit `window.*` exports (7914–7939).
4. Lines 7942–7952: `item-icons.js`, `supplies.js`, `raid-sprites.js`, `raid.js`, `kree.js`, `widow.js`, `knight.js`, `gorehorn.js`, `colossus.js`, `hub.js`, `duel.js`.
5. Lines 7953–8008: `install()` / `installIntoGame()` for each module, then `showTitle()`, `requestAnimationFrame(frame)`, `applyTestQuery()`, `applyOpenQuery()`.
6. Lines 8009–8011: CDN `@supabase/supabase-js@2`, then `cloud.js`, then `trade.js`.
7. Lines 8012–8234: service-worker register (`sw.js?v=` + `XSCAPE_BUILD`) and the `version.json` force-update watcher.

**`raid.html`** is a standalone Gloamhold page. It does *not* load the host engine. Order (536–541, 815–816): `partyhat-img.js`, `whip-img.js`, `sprites.js`, `raid-sprites.js`, `stats.js`, `raid.js`, then later the Supabase CDN and `cloud.js`. Raid therefore carries its own `TICK_MS`, item tables, and combat fallbacks.

**`lab.html`** is the sprite / gear lab. Order (419–426) uses stale cache-bust queries: `partyhat-img.js?v=35-5`, `whip-img.js?v=35-5`, `sprites.js?v=35-5`, `widow-sprites.js?v=35-5`, then `knight-sprites.js?v=37`, `gorehorn-sprites.js?v=37`, `colossus-sprites.js?v=37`, `lab-gear.js?v=37`. It registers `sw.js?v=35-5` (line 430). It does not load `kree-sprites.js` or the game engine.

### Module map

Each game module is an IIFE that writes one `window.Xscape*` object, then `install()` hooks `window.Scenes` and/or wraps host functions. Dependencies are implicit: a file calls `typeof global.foo === "function"` and falls back if the host is missing (so `raid.html` can boot without `index.html`).

| File | Lines | Role | Defines (window) | Mainly consumes |
|---|---:|---|---|---|
| `index.html` (inline JS) | ~6,448 | Host engine + Jad + CSS/UI + profile + version watcher | `G`, `Profile`, `Scenes`, `TILE`, `ITEMS`, `LOADOUTS`, `MONSTERS`, `EQUIP_SLOTS`, `Xscape` / `KellenScape`, many functions (`combatVsMonster`, `processMovement`, `saveProfile`, …) | Art globals from earlier tags; later modules via `Scenes` / `Xscape*` |
| `cloud.js` | 2,420 | Supabase auth, cloud save, presence, shop/kill RPCs, shared 600 ms clock | `XscapeCloud` (assigned twice, 2320 and 2412). Monkey-patches `saveProfile`, `enterScene`, `equipItem`, `ownItem`, `buyShopItem`, and others | `Profile`, `G`, host functions, `@supabase/supabase-js` |
| `lab-gear.js` | 2,908 | Player draw for all facings, hand anchors, lab item catalog, tweak persistence | Many bare globals: `drawLabPlayer`, `heroHands`, `shotForWeapon`, `LAB_TIER_LABEL`, … (2889–2908) | `ITEMS` or its own `LAB_ITEMS`; `weaponAnimAt` from `sprites.js`; `PARTYHAT_DATA_URI` / `WHIP_DATA_URI` |
| `hub.js` | 2,855 | West Bank hub: tiles, NPCs (Kael, Oswin, …), bank, boss menu, party | `XscapeHub` | `G`, `Profile`, `XscapeTrade`, `XscapeRaid`, `XscapeCloud` |
| `raid.js` | 3,517 | Gloamhold rooms, group lockstep, loot, **seeded** tick sim | `XscapeRaid`, fills `XscapeItems` / `ITEMS` with raid uniques | Host combat if present; else internal `RAID_ITEMS` / `HOST_MONSTERS`. Looks for a **`XscapeCombat` object that does not exist anywhere in the tree** (lines 123–124, 221–222, 296–297) |
| `sprites.js` | 1,602 | Player / Jad / whip / partyhat / logo; `SPRITES_VERSION = 12` | Bare functions: `drawPlayerSprite`, `weaponAnimAt`, `drawXscapeLogo`, … | `PARTYHAT_DATA_URI`, `WHIP_DATA_URI` |
| `supplies.js` | 1,400 | Shop prices, potions/food, 8-slot hotbar, **overwrites** `addToInventory`, `addToBankStore`, `normalizeContainers`, `bankList` (212–269) | `XscapeSupplies`, `openSupplyShop`, `closeSupplyShop` | `Profile`, `PlayerStats`, host inventory helpers |
| `duel.js` | 1,286 | Duel Arena challenges, escrow, **deterministic** hit rolls from challenge id + tick | `XscapeDuel` | `ITEMS`, `EQUIP_SLOTS`, shared tick from `XscapeCloud` |
| `widow.js` | 1,216 | Widow Queen solo fight | `XscapeWidow` | Host tiles, combat, supplies, `XscapeWidowArt` |
| `widow-sprites.js` | 1,200 | Widow + minion art | `XscapeWidowArt` | canvas only |
| `colossus.js` | 1,002 | Drowned Colossus | `XscapeColossus` | host + `XscapeColossusArt` |
| `gorehorn.js` | 1,004 | Gorehorn (also sets `gorehornSetMultiplier` at line 40) | `XscapeGorehorn` | host + `XscapeGorehornArt` |
| `knight.js` | 975 | Hollow Knight-King | `XscapeKnight` | host + `XscapeKnightArt` |
| `kree.js` | 956 | Vaelkor the Stormwing | `XscapeKree` | host + bare `drawKreeArra` etc. |
| `raid-sprites.js` | 884 | Gloamhold rooms / monsters | `XscapeRaidSprites` | canvas only |
| `trade.js` | 773 | Two-screen player trading | `XscapeTrade` | `XscapeCloud`, `Profile`, `canTradeItem` |
| `item-icons.js` | 603 | Pixel inventory icons | `XscapeIcons` | `gpStyle` |
| `kree-sprites.js` | 435 | Vaelkor / aviansie art as **bare functions** (`drawKreeArra`, `drawKreeHpBar`, …) — no `XscapeKreeArt` wrapper | those functions | canvas only |
| `stats.js` | 418 | Skill levels, potion boosts, 100-tick decay, antipoison | `PlayerStats`, `Xscape.stats`, `KellenScape.stats` | `Profile` |
| `knight-sprites.js` | 364 | Knight-King art | `XscapeKnightArt` | canvas only |
| `gorehorn-sprites.js` | 349 | Gorehorn art | `XscapeGorehornArt` | canvas only |
| `colossus-sprites.js` | 307 | Colossus art | `XscapeColossusArt` | canvas only |
| `sw.js` | 45 | Cache-first fallback, `version.json` bypass, lab files uncached | `BUILD` / `CACHE` | — |
| `partyhat-img.js` / `whip-img.js` | 5 each | Base64 data URIs | `PARTYHAT_DATA_URI`, `WHIP_DATA_URI` | — |

`privacy.html` and `terms.html` have no game scripts. `manifest.json` describes the PWA (start_url `./`, portrait, icons under `icons/`).

### Shared engine — where it lives, and where it is copied

There is no `combat.js` or `engine.js`. The shared engine is the big inline script in `index.html`, plus a few later overlays (`stats.js`, `supplies.js`, `lab-gear.js`). Boss modules reimplement the same glue instead of importing it.

**Tick loop.** `const TICK_MS = 600` at `index.html:1783`. The canvas loop is `frame` (6194–6286): if `G.scene` is hub / duel / raid / kree / widow / knight / gorehorn / colossus, it delegates to that module’s `hostFrame` and returns; otherwise it accumulates `acc` and calls `gameTick` (4981–5033) while `acc >= TICK_MS`. `gameTick` itself also switches on scene and calls `hostTick` for raid and the five later bosses, then runs the Jad-only body (prayer drain, telegraph, `processMovement`, `tickTileAttacks`, player attack, healers).

`const TICK_MS` (and `PLAYER_ATTACK_TICKS`, etc.) are **not** assigned to `window`. A top-level `const` in one classic script tag is not visible to later tags, and is not a `window` property. Boss files write `global.TICK_MS || 600` and `global.PLAYER_ATTACK_TICKS || 4`, so they always hit the fallback. The values happen to match today. Raid and cloud each declare their own `TICK_MS = 600` (`raid.js:9`, `cloud.js:11`). Hub reads `typeof TICK_MS === "number" ? TICK_MS : 600` (`hub.js:10`) — that works on `index.html` only if a `var TICK_MS` leaked; as written it is a `const` in another tag, so hub also likely falls back, except when `cloud.js` later exposes `tickMs()`. Cloud also runs a server-offset lockstep clock (`cloud.js` ~1379–1524) that duels and hub walking use.

**Combat math.** Documented at `index.html:1922–1923` and implemented at 2647–2819: `effectivePlayerLevel`, `hitChance`, `maxHitFrom`, `rollHit`, `combatVsMonster`, `monsterVsPlayer`, `meleeSetMaxHit` (which calls `window.gorehornSetMultiplier`). `rollHit` (2665–2667) uses unseeded `Math.random` via `rand` (4722). `MONSTERS` (2518+) has 13 entries (Jad, healer, Kree + three minions, Widow + baby + skel, Knight-King + spectral knight, Gorehorn, Colossus). Raid monsters live in `raid.js` (internal `MONSTERS` plus `HOST_MONSTERS` around 154–168) and are not in the host table.

Every solo boss copies the same hit wrapper: `combatVsMonster` / `monsterVsPlayer` if present, else a hardcoded `{ maxHit, chance }`, then `rollHit` or `irand`. See e.g. `widow.js:226–230` and `567–570`, `kree.js:203–206`, `knight.js:260–264` and `346–353`, and the same pattern in `gorehorn.js` / `colossus.js`.

**Prayer.** Host: `setPrayer` (`index.html:5154`), drain every 2 ticks (`PRAYER_DRAIN_EVERY`, 1833 and 4997–5002), buttons 5169+. Raid duplicates drain and `setPrayer` (`raid.js:25`, 1270, 2043). Duel has its own `applyPrayer` / `PRAY_DRAIN` and a tick-locked queue (`duel.js` ~890–906).

**Pathing.** Host tiles: `TILE` at 2867, `queueMoveTo` / `processMovement` at 2948–3016 (walk 1 tile / run 2, axis-aligned, no pathfinding). `queueMoveTo` forwards hub / duel / raid clicks to those modules. Widow, Knight, Gorehorn, and Colossus mutate the shared `TILE.rows` from 1 to 5 via `claimTiles` / `releaseTiles` (e.g. `widow.js` ~51+, `knight.js:26` and 41–50). Raid has its own `COLS` / `ROWS` grid and click handler.

**Inventory / bank.** Host: caps, `ownItem`, `equipItem`, `normalizeContainers`, profile fields (`index.html:2243–2497`, save at 3813–3838). `supplies.js` then **replaces** several of those functions so food and potions stack and shop buys work. Cloud wraps `ownItem` / `equipItem` / `saveProfile` again.

**Rendering and hand anchors.** `sprites.js` has the older front-view player, Jad, whip, and logo. `lab-gear.js:1638–1757` is the shared facing-aware layer: `heroHands`, `twoHandPose`, `shotForWeapon`, `isTwoHandedWeapon`. Side-view anchors are hard-coded pixel offsets (e.g. front right hand `{ x: -12.4, y: -9.6 }`). Boss sprite files draw their own monsters and sometimes a copied HP-bar helper (`drawKreeHpBar` is called from `widow.js:796`).

**RNG.** See section below. Only raid (LCG) and duels (hash of challenge id + tick) are deterministic. Everything else uses `Math.random`.

### Content-as-code

Almost all content is hardcoded in JS, often in more than one file.

- **Items / loadouts / shop (gear).** `const ITEMS` at `index.html:1963` — **51** ids (starter green d’hide through Colossus uniques and the blue partyhat). `LOADOUTS` (2044) has 8 presets: `starter`, `tier2`, `armadyl`, `widow`, `kingsguard`, `gorehorn`, `colossus`, `gloamhold`. `SHOP` (2088) is seven mid-tier purchases with prices inlined. `lab-gear.js` has a parallel `LAB_ITEMS` (**53** ids) and `LAB_LOADOUTS`. Overlap with `ITEMS` is 44. Lab-only: raid uniques plus `abyssal_whip`. Host-only: the leather / bronze starter set. `raid.js` defines `RAID_ITEMS` / `HOST_RAID_ITEMS` / `HOST_UNIQUES` and `registerItems()` copies them into `window.ITEMS` if missing.
- **Supplies / vendors.** `supplies.js:9–37` — `PRICES` and `SHOP_ROWS` (Oswin: swordfish through antipoison, including prayer potion at 82,000). Shop behavior is also enforced server-side in `supabase/supply_trader.sql` and related migrations. NPC wiring lives in `hub.js`.
- **Drop tables.** Each boss file has a `DROP` array and a 1/6 unique roll (`UNIQUE_RATE` or `UNIQUE_DENOM = 6`) plus 2–4M GP if the set is complete. Widow 27–35, Kree 26–31, Knight 17–25, Gorehorn 17–24, Colossus 17–25. Jad GP is `JAD_KILL_GP_MIN/MAX` 2–3M (`index.html:1835–1836`) after the Fire cape, handled in `awardJadWinReward` and cloud `record_jad_kill`. Raid final loot is `rollFinalLoot` in `raid.js` (~1843+: 2–8M GP, uniques, 10% second unique).
- **Boss phases and timings.** Constants at the top of each boss file (HP, telegraph length, attack speed, max hits, web/tornado/charge intervals). Phase machines are `tick()` switch statements (`idle` / `telegraph` / `recover`, plus per-boss states like `wave`, `grab`, `eels`, `charge`, `stomp`, `sweep`). Jad timings are host constants (`JAD_ATTACK_SPEED_TICKS = 8`, `TELEGRAPH_TICKS_*`, `index.html:1786–1816`) and `gameTick` / `startTelegraph`. Raid rooms and Morvane’s four HP phases are code in `raid.js` (`tickGate`, `tickCourt`, `tickThrone`, …) and described in `index.html` help copy and `RAID_DESIGN.md`.
- **SQL as a second source of truth.** 33 migration-style files under `supabase/` (GP amounts, unique ownership, potion doses, raid loot, duel escrow, save revision). Client and SQL can drift; several commits in this history exist only to reconcile them (e.g. Kree GP, prayer potion price, Jad kill bank rollback).

There is no JSON/YAML content pack, no data directory, and no schema version on the item table.

### Randomness and headless simulation

**`Math.random` call sites (65):** `index.html` 25, `kree.js` 11, `widow.js` 8, `colossus.js` 6, `knight.js` 6, `gorehorn.js` 6, `colossus-sprites.js` 1, `raid.js` 1 (id generation only, line 444), `cloud.js` 1 (Jad nonce, line 2025). Uses: hit rolls (`irand` / `rand` / `rollHit`), style picks, loot, splat jitter, screen shake, particles, audio noise, lava pops.

**Seeded RNGs that already exist:**

- `raid.js:110–118` — `makeRng(seed)` is a 32-bit LCG (`imul(s, 1664525) + 1013904223`). Combat, hazards, and loot in a raid go through this. `XscapeRaid.simulate(opts)` (2510–2526) runs a full auto raid with `seed`, `loadout`, optional `skill` / `policy`, up to `maxTicks` (default 4000), with `_silent: true` and no requirement that a canvas exist. `checkFighterSetBonuses()` (2528–2540) is an assert-style self-check that throws on failure.
- `duel.js:89–117` and `906–915` — `hashStr` + `rand01(cid, tick, salt)` so both clients replay the same hits from the challenge id and tick. This is lockstep, not a batch simulator.

**What is not headless or deterministic:**

- `simulateJadKill` (`index.html:2821–2851`) only shoots the player at Jad with `rollHit` or expected damage. No Jad attacks, movement, prayer, healers, or seed. Fine as a DPS estimate, not a fight replay.
- Solo bosses (Kree, Widow, Knight, Gorehorn, Colossus, Jad in `gameTick`) all use `Math.random`, `requestAnimationFrame`, DOM, and `global.G`. They expose helpful QA hooks (`godMode`, `killBoss`, `giveGear`, `testHit`, `rollLoot`, `freeze`, `?test=<boss>` / `?test=<boss>-loot`) but there is no batch tick function you can call from Node.
- Visual RNG (shake, particles, splat offsets) is mixed into the same `Math.random` stream as combat and loot, so even a later seed would jitter when anything draws.

`XscapeCombat.rollPlayerHit({ rng })` is already called as a preferred path in `raid.js:296–297`, but **`XscapeCombat` is never defined**. That is the intended seam for a shared, rng-injectable combat module.

### Tests, shortcuts, scripts, CI, lint

- **No** `package.json`, **no** `.github/`, **no** eslint/prettier/jest/vitest, **no** automated test files, **no** lint script. `scripts/` contains only `stamp-build.sh`.
- **URL shortcuts**, applied after boot by `testFlag` / `applyTestQuery` (`index.html:6756`, 7254–7307) and `cloud.js` `isTestMode` / `isDevLogin` (37–51):
  - `?test=hub` | `bank` | `hubchat` (optional `?who=` name)
  - `?test=raid…` (any flag starting with `raid`; may bounce to `raid.html?test=` from `raid.js:2853–2855`)
  - `?test=kree` | `kree-loot` | `widow` | `widow-loot` | `knight` | `knight-loot` | `gorehorn` | `gorehorn-loot` | `colossus` | `colossus-loot` (skip briefing; `-loot` forces the unique set)
  - `?test=intro` | `firstkill` | `cape` | `fireball`
  - `?open=equipment`
  - `?dev=1` or `?devlogin=1` — hidden email/password login (`BACKEND.md`, `cloud.js:43–51`)
- In-fight QA APIs on each `Xscape*` object (`godMode`, `killBoss`, `giveGear`, `testHit`, hazard launchers) and `window.Xscape` (`simulateJadKill`, `testFireball`, `getState`, `setDebug`, …).
- `screens/` holds hundreds of manual QA screenshots (`v23-…` through `v44-…`), including `v44-cloudtest-*`. That is the current test record: eyes and PNGs, not a command.

### Save format

**localStorage keys** (canonical map is `STORAGE` at `index.html:1837–1852`):

| Key | Purpose |
|---|---|
| `kellenscape-profile` | Character blob (see below) |
| `kellenscape-player-name` | Display name (also inside the profile) |
| `kellenscape-runs`, `kellenscape-best`, `kellenscape-last` | Local Jad run history / PB |
| `kellenscape-muted` | Audio |
| `kellenscape-tutorial-seen`, `kellenscape-intro-seen` | Onboarding flags |
| `kellenscape-raid-brief-seen`, `…-kree-brief-seen`, `…-widow-brief-seen`, `…-knight-brief-seen`, `…-gorehorn-brief-seen`, `…-colossus-brief-seen` | Per-fight briefing flags (also written from some boss files via their own `STORAGE_BRIEF` constants) |
| `kellenscape-quick-slots` | Hotbar layout (`supplies.js:7`) |
| `kellenscape-legacy-device`, `kellenscape-legacy-checked`, `kellenscape-cloud-migrated`, `kellenscape-guest-continue` | Cloud migration / guest gates (`cloud.js:78–81`) |
| `xscape-lab-gear-tweaks` | Lab only (`lab-gear.js:239`) |

**sessionStorage:** `xscape-reload-n` / `xscape-reload-at` / `xscape-reload-aim` (update loop guard, `index.html:8065–8077`); `xscape-pending-jad` (unconfirmed Jad payout, `cloud.js:2020`).

**Profile blob** written by `saveProfile` (3813–3838): `name`, `gp`, `hasFireCape`, `seenFirstKill`, `levels`, `equipment`, `unlockedItems`, `bank`, `inventory`, `raidCompletions`, `raidBestTicks`, per-boss kill counts and best ticks (`kree`, `widow`, `knight`, `gorehorn`, `colossus`). There is **no `version` or `schema` field**. `loadProfile` (3749–3811) fills missing fields with defaults, runs `migrateLegacyStarter` and `maybeGrantLegacyFireCape`, then `normalizeContainers`. A thrown `JSON.parse` wipes the in-memory character back to starter defaults (the `catch` at 3785) but does not always clear the bad key — next save may overwrite.

**Cloud.** `cloud.js` pushes via RPC `save_player_state` with `{ levels, equipment, unlockedItems, bank, inventory, settings, revision }` (`pushStateOnce`, 2160–2204). GP and kill counters are **not** written by this RPC; they change through `record_jad_kill`, shop, duel escrow, raid clear, and similar (`supabase/cloud_save_revision.sql` header). `player_state.revision` is an optimistic-concurrency token: a stale write returns `{ stale, profile }` and the client applies the cloud copy (2193–2196). `applyCloudProfile` (263–337) copies cloud fields onto `Profile` and immediately writes localStorage. Settings (muted, briefs, quick slots) ride inside the payload; knight/gorehorn/colossus brief flags are **not** in the `settings` slice that `pushStateOnce` builds (2173–2178 lists raid/kree/widow only).

**Corruption / clobber risks:** local and cloud can disagree for a guest vs signed-in session; `applyCloudProfile` can overwrite a newer local inventory if the revision check is skipped; a Jad payout is protected by `pendingJad.dirty` and `sessionStorage` because reloads used to grant (or roll back) GP twice (several Nov 10 commits); `saveProfile` has an empty `catch`; two tabs can still race (cloud serializes with `pushInFlight`, but the loser is dropped as stale and the local tab is reset to cloud); there is no checksum and no schema version, so a future field rename has no migration switch.

### Release, service worker, `version.json`

Agreed release convention (confirmed by Gameboy in `50c9904`, after this survey snapshot): stamp a **UTC** `YYYYMMDDHHMMSS-<short HEAD hash>` into `index.html` and `sw.js`, push, confirm `version.json`. See `RELEASE.md` for the current script.

What the tree did at survey time (`c9b766f`), and what changed after:

- `scripts/stamp-build.sh` writes the same `BUILD` id into `version.json`, the `window.XSCAPE_BUILD` assignment (must match exactly once), and `var BUILD` in `sw.js`. The default id is **UTC** (`date -u +%Y%m%d%H%M%S`) plus `git rev-parse --short=7 HEAD`. `builtAt` is always UTC ISO with a Z. If a caller passes a `BUILD` whose 14-digit stamp is more than 5 minutes off current UTC, the script warns (and does not fail) so a local America/New_York timestamp does not slip in. Tags are UTC; do not switch them to New York time.
- At `c9b766f` the checked-in stamp was `"20261111084604-c875ffc"` with `"builtAt": "2026-11-11T13:46:04Z"`. That 14-digit prefix was America/New_York 08:46:04, while `builtAt` was the UTC equivalent, and the hash was **parent** `c875ffc`, not `c9b766f`. That is what you get if you pass `BUILD=$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)` (local time) *before* committing the stamp. **The running client’s build id never equals the commit that contains it.** The later UTC default and warning in `50c9904` are meant to stop that New York / UTC mix.
- `sw.js` (45 lines): `skipWaiting` + `clients.claim`; deletes every Cache Storage bucket whose name is not `xscape-${BUILD}`; **does not intercept** `version.json`; for other same-origin GETs, `fetch({ cache: "no-store" })`, then (except `lab.html` / `lab-gear.js`) puts a copy in the current bucket; on network failure, serves the cached copy (lab is not served stale).
- The page polls `version.json?cb=<now>&v=<BUILD>` every 3 minutes, on focus, and 1.5 s after boot (`index.html:8113–8233`). A mismatch shows “New version — tap to update,” or auto-reloads if not mid-fight (`isMidFight`, 8034–8052). Two reloads within a guard window fall back to the banner so a bad stamp cannot loop.

**How mixed versions can still be served:**

1. **Unstamped pushes.** `XSCAPE_BUILD` and `version.json` stay on the old id, the SW cache *name* does not change, and the update banner stays quiet. Online fetches use `no-store`, so a healthy network usually gets new files — but a failed fetch of even one script falls back to a **previous copy of that one file** sitting in the same cache bucket, next to freshly fetched siblings.
2. **Script tags on `index.html` have no `?v=`.** `lab.html` does, but those queries are frozen at `v=35-5` / `v=37` and its SW URL is `sw.js?v=35-5`, so a lab session can run a different worker than the game.
3. **Pages deploy lag.** `version.json` and `index.html` / `kree.js` / `lab-gear.js` are separate objects. A client can see a new `version.json`, reload, and still get an old JS file (CDN/Pages) or the reverse.
4. **`skipWaiting` + `clients.claim`.** A tab mid-fight keeps its already-parsed JS, then later fetches (save, next navigation) may go through the new worker.
5. **Parent-hash stamps** make “am I on commit X?” unanswerable from the on-screen build tag (`shortBuildLabel` shows `vc875ffc` while HEAD is `c9b766f`).

### Git history and collision signs

- Direct commits to `main`, 109 deep, one author name, **no merges, no reverts, no feature-branch workflow** in this clone (the only extra branch is `art/fixes-20261111`, already ahead of this `main`).
- Cadence is a collision factory: **77 commits on Nov 10**, 19 more by 08:46 on Nov 11. Several pairs landed within a minute, including **0 s** (`c6beeb9` Gloamhold engine and `28b3e7b` hub hook; `f6772d2` raid design/sprites and the engine commit), **9 s** (Widow Weaver kit `11e9e0c` then stamp `194fd39`), **17 s** (raid hazards `e243b2a` then stamp `8790ce2`), **26 s** (Knight-King / raid set-bonus fix `71f4153` then Widow/Kree/Gorehorn/Colossus guest-gate fix `340eb55` — different bosses, same file neighborhood), **25 s** (prayer-potion price SQL `c3898e4` then shop accept `6de2eda`).
- **File churn (name-only, all 109 commits, excluding `screens/`):** `index.html` **91**, `sw.js` 69, `version.json` 62, `cloud.js` 30, `hub.js` 27, `raid.js` 24, `lab-gear.js` 19, `lab.html` 18, `sprites.js` 13, `raid.html` 12, `supplies.js` and `kree.js` 11. The host file is in almost every change. Stamp files move whenever anyone releases, so they conflict with whatever else is in the same commit window.
- The morning of Nov 11 is a string of bundled hotfixes after three melee bosses landed in 20 minutes the night before (Knight-King `cac33e8` 23:22, Gorehorn `8744280` 23:31, Colossus `d62bf77` 23:41). Commit subjects like “Fix Gorehorn retry combat, Colossus banners and eels, and Widow skeleton stacking” (`99eba3a`) are several bots’ bugs fixed in one shot on `main`.
- Parallel worktrees and a `main` that was already behind `origin/main` during this survey are the same pattern in the filesystem: several agents editing one shared clone / one branch.

---

## (b) Problems (ranked by impact on multi-bot work and testability)

1. **Everyone lands on `main`, and almost everyone touches `index.html`.** 91 of 109 commits edit that 8,236-line file (CSS, markup, engine, Jad, items, save, version watcher). There are no branches, no CODEOWNERS, no claim/lock, no CI gate. Two legitimate fixes 26 seconds apart will conflict or silently overwrite. This is the binding constraint on having Gameboy, Boss Mechanics, Item & Character Design, and QA in the same repo.

2. **There is no automated test and no one-command QA.** Behavior is checked with `?test=` URLs and PNGs in `screens/`. Raid’s `simulate` and `checkFighterSetBonuses` are unused by any runner. A typo in `combatVsMonster` or a loot change is a live-site find. QA cannot lock a seed and replay a Widow fight.

3. **The shared engine is not a module, so it is copied.** Five solo bosses (~1,000 lines each) repeat `irand`, `playerSpeed` / `attackSpeed`, hit wrappers, `hostFrame` accumulators, 1/6 loot + set-bonus GP, win/lose cards, `claimTiles`, and shake jitter. Those copies already disagree: Kree delegates to `global.playerSpeed()` (`kree.js:303–309`); Gorehorn / Knight / Colossus re-read `ITEMS[weapon].speed` themselves; Widow uses a separate `attackSpeed()` (`widow.js:536–541`) that defaults magic to 5. Raid and Jad have still more copies of prayer drain and tick math. A combat fix must be made in many places, and bots will miss one.

4. **Content is duplicated catalogs, not data.** Items live in `ITEMS`, `LAB_ITEMS`, and `RAID_ITEMS` (already out of sync: 51 vs 53 ids). Drop tables, prices, and phase timings are constants in boss files *and* in SQL *and* in help HTML. Adding a unique means editing index, lab-gear, a boss module, often a sprite file, often a Supabase script, and hoping the names match.

5. **Randomness is global `Math.random`, shared with presentation.** Solo fights and Jad cannot be replayed. Loot, hits, and screen-shake consume the same stream. Headless sim exists only for Gloamhold (and a Jad DPS sketch). The `XscapeCombat` hook raid already calls is a vacant lot.

6. **Release stamping and caching can serve mixed builds.** Parent-hash stamps, unstamped follow-up commits, script tags without cache-bust queries, and per-file Cache Storage fallbacks mean a phone can run `hub.js` from Tuesday next to `widow.js` from Wednesday without the update banner firing. `lab.html` is pinned to `?v=37` / `sw.js?v=35-5`. An earlier mix of America/New_York timestamps with UTC `builtAt` was addressed in `50c9904`: stamps now default to UTC and warn if a passed timestamp is more than five minutes off UTC. Keep tags in UTC; do not recommend New York–local stamps.

7. **Saves have cloud revision but no schema version.** `kellenscape-profile` is a schemaless blob. `loadProfile`’s `catch` resets to starter on parse failure. Cloud `revision` prevents some overwrites but a stale tab still loses its local inventory. Brief flags and some kill fields are incomplete in the cloud settings slice. Two sources of truth (localStorage + Supabase RPCs) plus monkey-patched `saveProfile` make it easy to drop a new field on one path only.

8. **Hidden global contract.** Later scripts depend on `window` exports that are easy to get wrong (`const TICK_MS` not on `window`; `supplies.js` and `cloud.js` wrapping host functions; `TILE.rows` mutated in place). `kree-sprites.js` is bare functions while every other boss art file uses an `Xscape*Art` object. `gorehorn.js` line 1 still describes “cone sweeps, spectral ring, armor shatter” — leftover from a Knight-King copy-paste, a tell that bosses were forked, not composed.

9. **No ignore file, and `screens/` is huge.** 501 images, 139 tracked, the rest untracked in this clone. A bot that `git add .` will shove QA screenshots onto `main` and blow up every subsequent pull.

10. **`raid.html` is a second app.** It boots a subset of scripts and re-declares items, monsters, and combat fallbacks. Features and fixes must be thought through twice (in-hub raid vs standalone page).

---

## (c) Target design

No rewrite. Keep the Pages + Supabase shape, the 600 ms tick, and the `window.Xscape*` names so existing `?test=` hooks and install paths keep working. Move boundaries until a bot can finish a job without opening `index.html`.

### Module boundaries

- **`index.html`** shrinks to shell: markup, CSS, script tags, boot, service-worker registration. No item tables, no combat math, no Jad loop inlined.
- **`engine/` (or a short list of root files at first):** `combat.js` (`window.XscapeCombat` — items, monsters, loadouts, `rollHit(rng)`, `combatVsMonster`, `monsterVsPlayer`), `tick.js` (clock, `TICK_MS` exported on the API), `tiles.js` (grid, `processMovement`, hazards), `inventory.js` (bank/inv/equip; supplies hooks in, does not overwrite), `save.js` (profile schema + migrations), `prayer.js`. One official export surface; no extra `window.foo` unless it is on that surface.
- **`content/`** JSON (or a single `content.js` generated from JSON) for items, vendors, drop tables, boss phase tables (HP, speeds, telegraph, unique denom, GP ranges). Boss code reads data; it does not own the catalog. Lab and raid consume the same files.
- **Boss modules** stay `kree.js` + `kree-sprites.js` (and the same for widow/knight/gorehorn/colossus/jad/raid). They register phases and art against the engine. They do not implement `irand`, loot rolls, or `hostFrame` accumulators. Art files all use the same `Xscape*Art` wrapper. Hand anchors stay in one place (`lab-gear.js` today, later `hero.js`).
- **`hub.js`, `duel.js`, `trade.js`, `cloud.js`, `supplies.js`** keep their jobs but stop monkey-patching when the engine offers an explicit hook (`onSave`, `onOwnItem`).
- **`raid.html` / `lab.html`** load the same engine + content + the scripts they need. No second item table.

### Shared engine, data, RNG, headless tick

- All hit and loot rolls take an `rng` argument. Default rng can still be `Math.random` for live play. Visual jitter uses a **separate** stream or stays unseeded and is skipped when `silent`.
- Implement the `XscapeCombat` object `raid.js` already probes (`getItem`, `rangeMaxHit`, `rollPlayerHit({ rng })`).
- Every fight, including Jad and solos, exposes `newState(opts)` + `tick(state)` + `simulate({ seed, loadout, policy, maxTicks })` on the same pattern as `raid.js:2510`. Canvas is optional. That is what makes CI possible.
- Drop tables, shop prices, and phase timings have one data definition; SQL migrations are generated or checked against it so GP amounts cannot drift.

### Test layout and one QA command

```
tests/
  combat.test.js      # seeded hit chances, max hits, set bonuses
  loot.test.js        # 1/6 unique, set-complete GP, no dupes
  raid.test.js        # XscapeRaid.simulate({ seed: 1 }) golden + checkFighterSetBonuses
  bosses/             # headless tick snippets per boss, once solos are simulatable
  save.test.js        # loadProfile migrations
scripts/qa.sh         # the one command QA Tester and CI run
```

`scripts/qa.sh` (also `npm test` once a minimal `package.json` exists) should: run the unit tests in Node (engine + content have no DOM), then optionally boot a local static server and smoke the `?test=` URLs. A failing combat number or a broken `simulate({seed:1})` is a red command, not a missing screenshot. Screenshots in `screens/` stay as visual regression for Item & Character Design, and are gitignored by default unless explicitly added.

### Save versioning

Add `schema: 1` (or similar) to the profile blob and to `save_player_state`. `loadProfile` and `applyCloudProfile` run a numbered `migrations[]` list. Never wipe a parse failure silently — keep the raw key, flag it, and refuse to overwrite cloud until the player confirms. Include every brief flag and kill field in the cloud settings slice. Keep the revision token.

### Ownership map (CODEOWNERS-style)

This is a proposal, not an existing file. Paths are today’s names plus the target splits.

| Owner | Owns | Does not own |
|---|---|---|
| **Gameboy** | Hub / maps, vendors, features, engine *glue* (boot, scene graph, `index.html` shell, `hub.js`, movement pad, HUD chrome, `sw.js` release glue) | Boss phase numbers, item art, test guts |
| **Boss Mechanics** | `kree.js`, `widow.js`, `knight.js`, `gorehorn.js`, `colossus.js`, Jad tick/phase code, `raid.js` encounter rooms, phase/drop *data* | Shared `combat.js`, sprites, icons |
| **Item & Character Design** | `lab-gear.js`, `*-sprites.js`, `item-icons.js`, `sprites.js`, `partyhat-img.js`, `whip-img.js`, `lab.html`, hand anchors, animation timings | Combat formulas, drop rates (those are Boss Mechanics + data review) |
| **QA Tester** | `tests/`, `scripts/qa.sh`, `?test=` shortcuts, `screens/` (local), bug repros | Shipping untested changes to engine APIs |
| **Code Architect** | Shared engine modules, tooling (`stamp-build.sh`, `qa.sh`, CI), this `ARCHITECTURE.md`, content schema, save migrations, CODEOWNERS | Day-to-day boss feel or pixel tweaks |

Release stamping is Gameboy + Architect. SQL in `supabase/` is Architect + the owner of the feature (shop → Gameboy, loot → Boss Mechanics, saves → Architect).

---

## (d) Multi-bot workflow

Until this exists, bots will keep committing through one GitHub user onto `main` 26 seconds apart.

1. **Short-lived branches**, one job each: `boss/widow-web-delay`, `art/gorehorn-axe`, `qa/loot-seeds`. Open against `main`. No direct pushes to `main` except the release stamp (or a fast-forward merge of a already-stamped release branch).
2. **Small commits**, one concern each. Do not bundle “fix Knight targeting + raid set bonuses + loot test” or “rename text + add Antipoison” if two owners touched them. Do not combine a feature with `stamp-build.sh`.
3. **Claim / lock note.** A repo file `CLAIM.md` (or `locks/<name>.md`) that a bot writes *before* editing a hot file: who, branch, files, time started. TTL of a few hours. If `index.html` or `lab-gear.js` or `cloud.js` is claimed, the other bot waits or splits the work. This is advisory, but it is cheaper than another 26-second collision. Keep the claim file’s own commits off feature PRs (or accept the tiny merge tax).
4. **Rebase or merge `main` just before push.** With four bots, assume `index.html` moved.
5. **Release step (one owner at a time):** merge the work you want; on a clean `main`, run `./scripts/stamp-build.sh` with the default UTC id (or an explicit `BUILD="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=7 HEAD)"`). Do not pass an America/New_York timestamp. Commit *only* `version.json`, `index.html` (the one BUILD assignment), and `sw.js`; push; load the live site, tap the build tag, and confirm `version.json` matches the stamp and a hard reload is not mixing lab `?v=37` assets. See `RELEASE.md`. Do not stamp from a dirty tree. The short hash is `HEAD` at stamp time (usually the parent of the stamp commit) unless `version.json` later records a separate `commit` field.
6. **Rollback:** revert the release commit (or push the previous `version.json` / `BUILD` triple) so the update banner offers the last good id. Because SW cache *names* include the BUILD, an old client that already activated a bad build will drop that bucket when the previous BUILD’s worker claims again. If a bad deploy also wrote a bad `combat.js`, reverting the feature PR and re-stamping is the path — not hand-editing production.
7. **QA gate.** `scripts/qa.sh` must be green before merge once it exists. Manual `?test=` smokes still happen for UI, but they are not the only gate.

---

## (e) Migration plan

Small, behavior-preserving steps. Each one should be mergeable on its own, with a QA check that does not require the later steps. Estimates are engineering time for one focused bot, not calendar time. “Risk” is chance of breaking a live fight or a save.

### Step 1 — Workflow only: claims, ignore rules, ownership, stamp checklist

- **Why first:** Stops the bleeding without touching runtime code. Other bots can keep shipping bosses while this lands.
- **Size:** S (a few hours).
- **Risk:** None for players.
- **Touches:** new `.gitignore` (ignore untracked QA screenshot batches only; do not ignore tracked `screens/` shots or any PNG the site serves), new `OWNERS.md`, new `CLAIM.md`, and a short `RELEASE.md` that documents the **current** UTC stamp flow and `version.json` confirm. Do **not** change `scripts/stamp-build.sh` — Gameboy already set the default to UTC in `50c9904` and added a warning when a passed timestamp is more than five minutes off UTC. Tags stay UTC; do not recommend America/New_York. Optionally add `commit` next to `build` in `version.json` later (still backward compatible; the watcher only reads `build`).
- **QA:** Script still rewrites exactly one `XSCAPE_BUILD` and one `var BUILD`. `git status` on a clean engine tree does not list hundreds of PNGs. No game behavior change.

### Step 2 — Extract `combat.js` as `window.XscapeCombat` (cut-and-load, no formula changes)

- **Why second:** Raid already calls this object. Items, monsters, and math are the most-copied, most-tested-if-we-had-tests core. Getting them out of `index.html` immediately shrinks the conflict magnet and gives Node something to import.
- **Size:** M (about a day, mostly proving byte-for-byte behavior).
- **Risk:** Medium if rushed (every fight reads these functions); low if the extract is a move with no edits and a side-by-side `getState().combat` check.
- **Touches:** new `combat.js` containing `ITEMS`, `LOADOUTS`, `SHOP`, `MONSTERS`, `emptyBonuses` / `b()`, and `index.html:2647–2819` combat functions plus `rollHit` / `rand` with an **optional** `rng` argument that defaults to `Math.random` (same results when omitted). Load it from `index.html` and `raid.html` before the host / `raid.js`. Delete the inlined copies from `index.html` once `window.ITEMS` and `window.XscapeCombat` are assigned. Point `raid.js`’s existing `XscapeCombat` branches at the real object. Do not move CSS, Jad, or tiles yet.
- **QA:** In the browser, `Xscape.getState().combat` on a starter loadout vs Jad matches a pre-extract note (chance, maxHit, atkRoll, defRoll). `?test=kree`, `?test=widow`, `?test=raid`, and a shop open still run. `meleeSetMaxHit` still sees `gorehornSetMultiplier`.

### Step 3 — One QA command that runs what already exists

- **Why third:** Locks the extract and gives QA Tester a job that is not “open the phone and screenshot.” Uses raid’s existing headless path before we invent new ones.
- **Size:** S–M (half a day to a day).
- **Risk:** Low (new files). Tests must not write `localStorage` on the live origin.
- **Touches:** new `package.json` with a test runner (Node’s built-in test runner is enough at first), `tests/combat.test.js` (seeded `rollHit` / `combatVsMonster` fixtures), `tests/raid.test.js` (`checkFighterSetBonuses()` plus `simulate({ seed: 1, loadout: "starter" })` golden mode/ticks/survived), `scripts/qa.sh` that runs them. No CI required yet; add `.github/workflows/qa.yml` in a follow-up once the command is stable.
- **QA:** `scripts/qa.sh` exits 0 on this commit; a deliberate one-line max-hit change fails it.

### Step 4 — Cache-bust script tags and stop mixed SW fallbacks

- **Size:** S. **Risk:** Low–medium (caching). **Touches:** `index.html`, `lab.html`, `raid.html`, maybe `sw.js`.
- Append `?v=${XSCAPE_BUILD}` to every script src (lab already tried this and went stale — generate it from the stamp script, or stamp a single token). Align `lab.html`’s `sw.js?v=` with the same BUILD. Consider not putting a newly fetched file and a stale fallback from the *same* cache bucket on screen without a BUILD check; at least fail closed on HTML/JS when `no-store` fetch fails mid-update.
- **QA:** After a stamp, an open tab sees the banner; after update, DevTools network shows all game scripts with the new query and one cache name.

### Step 5 — Export a real tick/prayer/tiles API; delete `global.TICK_MS || 600` fallbacks

- **Size:** S–M. **Risk:** Low. **Touches:** new `tick.js` or a small export block; `index.html`; every boss file’s `hostFrame` / `playerSpeed`; `hub.js`; `raid.js` can keep its constant but should read the shared one when present.
- Put `TICK_MS`, `PLAYER_ATTACK_TICKS`, `CONSUME_COOLDOWN_TICKS`, `playerSpeed`, `setPrayer` on `XscapeCombat` or `XscapeEngine`. Boss `playerSpeed()` becomes one call. Confirm Widow’s 5-tick wand default still comes from item data, not a side path.

### Step 6 — Shared loot helper and one item catalog

- **Size:** M. **Risk:** Medium (economy). **Touches:** new `content/items.json` (or `content/items.js`), drop tables in each boss file, `LAB_ITEMS`, `RAID_ITEMS`, `supplies.js` `PRICES`, help text only if numbers are generated from data.
- Lab and raid delete their private catalogs and consume the shared one. A missing id fails `scripts/qa.sh`. Unique 1/6 + set-complete GP become one function with an `rng`.

### Step 7 — Seeded headless ticks for Jad, then one solo boss, then the rest

- **Size:** M each (Jad first is the template; Widow/Kree/Knight/Gorehorn/Colossus follow). **Risk:** Medium per boss if tick order changes; keep the live `Math.random` default so play feels the same unless a seed is passed.
- **Touches:** the fight’s `tick()` / `startFight`, plus a `simulate` wrapper. Split visual RNG off the combat stream.
- **QA:** `simulate({ seed, loadout })` is deterministic twice in a row; a `?test=` fight still plays; loot under seed `1` matches a fixture.

### Step 8 — Deduplicate `hostFrame` / win-lose / `claimTiles`

- **Size:** M. **Risk:** Medium (scene teardown). **Touches:** five boss files, host `frame` / `gameTick`.
- After Step 7, the copied accumulators and result cards can move into the engine. Boss files should drop toward phase data + unique mechanics (webs, charges, eels).

### Step 9 — Save schema version and migrations

- **Size:** M. **Risk:** High if botched (characters). **Touches:** `index.html` `loadProfile` / `saveProfile` (or new `save.js`), `cloud.js` `applyCloudProfile` / `pushStateOnce`, `supabase/cloud_save_revision.sql` (add `schema` alongside `revision`).
- **QA:** Load a fixture of an old `kellenscape-profile` (no `colossusKills`, no `schema`) and see defaults fill without wiping GP or bank. A bad JSON does not clobber cloud.

### Step 10 — Shrink `index.html`; add CI; retire `raid.html` duplication last

- Pull Jad, audio, and UI scripts out only after tests cover them. Add CI that runs `scripts/qa.sh` on PRs. Make `raid.html` a thin shell over the same engine (or a query on `index.html`) so Gloamhold is not a second app. None of this is a big-bang rewrite; each extract repeats Steps 2–3.

**Explicitly out of scope until the above exists:** a framework migration, TypeScript conversion of the whole tree, rewriting bosses from scratch, or replacing Supabase.

---

## Survey notes

- Line counts and hashes are from `c9b766f` on this clone, 4 commits behind `origin/main`. Re-read files before executing a step.
- The public Supabase URL and publishable key are already in `cloud.js` and `BACKEND.md` by design; the service role key is not in the client. This draft does not repeat secrets beyond what the repo already ships.
- `gorehorn.js:1` still has the Knight-King comment; useful as a reminder that forked boss files drift.
