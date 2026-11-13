> **Combat rule (Kellen, Nov 13, 2026, FIX-4.5-e):** all combat uses one shared system. Every special attack must list everything special about it (ignores Defence, ignores prayer, drains Defence, typeless, etc.). Anything not listed follows the normal accuracy, Defence and prayer rules.

# Xscape boss mechanics plan

Plans index: [docs/README.md](../README.md). This run is executed after the bug-fix plan's F-items and remaining phases.

This run is separate from the bug run in [`XSCAPE_FIX_PLAN.md`](XSCAPE_FIX_PLAN.md). It covers the arena changes that came out of the Widow investigation, the known boss design problems, and a place to record Kellen's boss feedback before any code is written.

File:line references point at the `xscape-main.zip` snapshot (build `20261111224507-090c8ec`). Re-check them against `main` before starting.

Same format as the bug plan: each task has **Do**, **Done when** and **Verify**. A task is closed only when its Verify step passes, run by someone other than the author.

---

## Design rules (decided)

1. **Boss melee reach is 2 tiles**, measured from the edge of the boss's body (Chebyshev distance; diagonals count). Normal-size monsters keep reach 1.
2. **Boss bodies are solid.** Players and other NPCs can't stand on tiles a boss occupies. A moving boss blocks whatever tiles its body covers on each tick.
3. **Boss rooms are 9×9.** That gives a stationary 3×3 boss in the centre a ring of tiles 3 away, out of melee reach:
   ```
   3 3 3 3 3 3 3 3 3
   3 2 2 2 2 2 2 2 3
   3 2 1 1 1 1 1 2 3
   3 2 1 W W W 1 2 3
   3 2 1 W W W 1 2 3
   3 2 1 W W W 1 2 3
   3 2 1 1 1 1 1 2 3
   3 2 2 2 2 2 2 2 3
   3 3 3 3 3 3 3 3 3
   ```
4. **The player checks their own weapon range.** Clicking a target out of range walks you toward it until you're in range, then you attack. (Shared helper from bug-plan task 4.7.)
5. **A boss that doesn't chase uses its ranged attacks when you're out of melee reach.** Out-of-reach play should still require prayer switching: no single protection prayer should block everything a boss does at any range.
6. **The info page matches the code.** Every attack, its style, its max hit and what blocks it is listed. Any mechanics change updates the page in the same task.

## Prerequisites from the bug run

These must be done first, because this run builds on them:
- 4.3 one combat pipeline (all boss hits go through `XscapeCombat`)
- 4.7 shared reach and path-toward helpers
- 4.8 boss melee reach rules (re-check on land, no melee projectiles)
- 4.9 footprint blocking
- 3.2 / 3.3 scene `exit` cleanup and the scene registry
- Phase 7 renames, so this plan can use **Magmor** and **Vaelkor** in code

---

## B1: Shared arena engine

The current boss arenas use `TILE` in `index.html:2659`: a fixed 5 columns, rows stacked in perspective, tile size about 57 px, and movement that goes straight (columns first, then rows) with no pathfinding. The hub and duel already fit a 9×9 walkable grid on a phone at about 41 px per tile (`hub.js:222`, Duel Arena screenshot `screens/v36-duel-before-arena-a.png`). The raid has BFS pathfinding (`raid.js:1083`). B1 combines those pieces into one arena module every boss uses.

### B1.1 Look: top-down (decided)
- **Decision:** 9×9 boss arenas are **top-down**, like the hub and duel arenas. The boss is drawn larger than its footprint and overlaps the tiles behind it, so it still feels big. The current perspective boss view (`screens/v37-knight-arena.png`) is retired as each boss moves over.
- **Do:** Item & Character Design mocks Widow top-down on a 390 px-wide phone: 3×3 body centred, player in the outer ring, HUD unchanged. Agree draw order (tiles → shadows/telegraphs → units sorted by row → projectiles → splats).
- **Done when:** Kellen approves the mock screenshot.
- **Verify:** the screenshot is stored in `screens/` (`git add -f`), and B2.1 matches it.

### B1.2 `arena.js` module
- **Do:** New `window.XscapeArena`. It provides:
  - `create({cols, rows, blocked})`
  - a fit-to-screen layout, reusing `hub.js` `layout()` / `tilePx()` logic
  - `tileAt(x,y)` for taps
  - `tileCenter(col,row)`
  - `isBlocked(col,row)`, which combines static blockers (pillars) with dynamic ones (boss bodies)
  - `path(from, to)` (BFS, moved from `raid.js:1083` so both share it)
  - `distToBody(col,row, body)` (Chebyshev to a footprint)
  - `nearestTileWithin(reach, body, from)` (used by path-toward)
  
  Run and walk speeds (1 or 2 tiles per tick) stay as today.
- **Done when:** a test scene can make a 9×9 arena, block tiles, path around them, and map taps to tiles correctly.
- **Verify:**
  - Unit tests for the path, distance and nearest-tile helpers on 9×9 with a 3×3 and a 5×5 body: pathing around the body, no path through blocked tiles, and correct distance rings (the map above).
  - On a phone, tapping each corner tile selects that tile.

### B1.3 Moving bodies
- **Do:**
  - A boss is `{col, row, size}`, its top-left tile plus its size. Each tick, moving bosses take one step toward "within melee reach of the player".
  - A boss can't step onto the player or other units. If blocked, it waits or sidesteps.
  - Following OSRS, if the player ends up under a boss's body (possible only through a spawn or knockback), the boss can't melee them that tick and must step off.
  - Minions use the same step function at size 1.
- **Done when:** walking bosses chase, stop at reach 2, and never overlap the player or each other.
- **Verify:** Run a headless sim of 500 ticks with a scripted player running in circles, asserting every tick that nothing overlaps and that the boss is within reach 2 whenever it attacks with melee.

### B1.4 Tile size check and optional camera
- **Do:** On the smallest supported phone (360 px CSS width), measure tile size. If it's under 36 px, add a camera that follows the player, keeping a 7×7 view, with the boss always on-screen through an edge arrow. Otherwise **skip the camera**.
- **Done when:** the decision is recorded with the measured px.
- **Verify:** On a 360 px device or emulator, QA can reliably tap any tile, with fewer than 1 mis-tap in 20.

### B1.5 Distance-map check for every boss
- **Do:** For each boss, generate the distance map for its arena, body size and start position. Confirm that some tiles are outside melee reach, and that every mechanic's landing tiles (webs, rocks, hazards) are reachable and escapable in the telegraph time.
- **Verify:** The map image is attached to that boss's task and reviewed by Boss Mechanics.

---

## B2: Widow Queen (pilot)

**Today:**
- She's stationary, with a 3×3 body at cols 1–3, rows 2–4, on a 5×5 grid.
- She only picks melee (when you're adjacent) or magic (`widow.js:163-168`).
- Unblockable damage comes from spiders, skeletons and poison.

### B2.1 Move her to 9×9
- **Do:**
  - Arena 9×9, body 3×3 at cols 3–5, rows 3–5, solid.
  - Player starts in the bottom ring.
  - Melee reach 2, removing the bug-run interim value of 1.
- **Verify:** The distance map matches the design rules diagram. From the outer ring she never chooses melee. From distance 1–2 she can, and Protect from Melee blocks it.

### B2.2 Add her ranged attack
- **Do:**
  - New ranged projectile with its own sprite (clearly different from the green magic venom) and its own audio tell.
  - She uses it alongside magic when you're out of melee reach. The style mix is a tuning value, starting at 50/50 and random per attack, so you must watch the tell and switch.
  - Add a `ranged` entry to `monsterVsPlayer("widow-queen", …)` with its own max hit.
  - Protect from Missiles blocks it.
  - Update the info page.
- **Done when:** standing at range with one prayer up takes damage from the other style.
- **Verify:**
  - Over 100 attacks at range, the logged style split is within the tuned ratio ±10%.
  - Correct prayer blocks 100%; wrong prayer takes damage.
  - The two projectiles are distinguishable in a muted screen recording.

### B2.3 Retune her mechanics for 9×9
- **Do:** Re-place webs (landing tiles chosen near the player, with a 3-tick shadow that's escapable at walk speed), spider drop positions, skeleton spawn edges and walk speed so they still arrive in a comparable time, and the enrage double-web.
- **Verify:** Headless sim with a scripted "perfect" player, who always dodges and prays correctly, takes only the intended unavoidable damage (spiders, skeletons). A scripted "no-prayer" player dies within the target time window.

### B2.4 Kellen's Widow changes (Nov 13, 2026, planning only)
- **Status:** Open (planning only; not yet in code).
- **Skeletons walk faster:** 1 tile per tick, the same as the player's walk speed (they are far too slow today).
- **Web special:** when you are caught in the web and the baby spiders come out, each spider hit does **4–8 damage**, typeless: no prayer blocks it and Defence does not reduce it.

---

## B3: Hollow Knight-King

**Today:** He walks (`knight.js`). Before the armour shatter, his only damage is Crownfall, so Protect from Melee makes the early fight close to free.

### B3.1 Move to 9×9 with chase (uses B1.3)
### B3.2 Rework the attack mix so Protect from Melee alone isn't enough
### B3.3 Retune spectral knights / sweep / judgement for the bigger room
- **Verify (all of B3):**
  - Distance map reviewed.
  - A scripted Protect-from-Melee-only player takes meaningful damage.
  - A perfect player wins in the target time with starter, mid and best gear (record the numbers).

### B3.4 Kellen's Knight-King minion changes (Nov 13, 2026, planning only)
- **Status:** Open (planning only; not yet in code).
- **Bug to check first:** his 6 spectral knights don't seem able to hit anything today. Find out why before retuning.
- **Minion hits:** small hits, about **4–6 max**, with **lower accuracy** than a normal monster, because there are 6 of them.
- **Intent:** the group should push the player toward a way to hit several enemies at once.
- **New idea (not in the game yet):** a multi-target magic spell, such as a small area burst. It needs a design in the magic system (rune cost, targets, max hit) and Kellen's sign-off.

## B4: Gorehorn, the Minotaur

**Today:** He walks (`gorehorn.js:82, 542`). Every attack (basic, charge, rocks) is tagged melee (`gorehorn.js:259, 308`), so Protect from Melee blocks everything.

### B4.1 Move to 9×9 with chase
### B4.2 Give at least one attack a different style or make it unblockable-but-dodgeable
For example, the charge is a telegraphed line you must step out of, and prayer doesn't help.
### B4.3 Check the Gorehorn set's low-HP bonus is still fair in the new fight
- **Verify:** same pattern as B3.

## B5: Drowned Colossus

**Today:**
- It's stationary.
- Every attack (wave, grab, eels) is tagged melee (`colossus.js:197, 218, 314`), so the "stand on a rock" mechanic doesn't matter under Protect from Melee.
- Any tap breaks the grab (`colossus.js:710`).
- A melee player on row 0 is never in range of its basic attack.

### B5.1 Move to 9×9, centred, with a solid body
### B5.2 Make the wave require the rock, regardless of prayer
### B5.3 Make the grab a real mechanic
For example, it needs N taps in a window, or a specific action, or it deals damage over time until broken.
### B5.4 Mixed attack styles at range
Same rule as Widow: it doesn't chase, so out of reach it must use ranged and magic.
- **Verify:** same pattern as B3, plus:
  - A scripted player who ignores the rock dies to the wave.
  - The grab can't be broken by a single tap.

## B6: Vaelkor the Stormwing

**Today:** He's stationary and flying. Melee can never reach him or his bodyguards (`kree.js:371`).
- **Decide:** keep the "ranged and magic only" identity (it's like OSRS Kree'arra) and move him to 9×9, or leave his arena as-is.
- **Do:** whichever is decided, apply design rules 2, 4 and 6.
- **Verify:** distance map; info page states that melee can't reach him.

### B6.1 Kellen's Vaelkor redesign (Nov 13, 2026, planning only)
- **Status:** Open (planning only; not yet in code).
Goal: less like OSRS Kree'arra; the bodyguards become a summoned phase.
- **Start:** no minions in the room at the start; Vaelkor fights alone.
- **Below 75% HP:** he flies higher (out of reach of every style, untargetable) and summons his 3 minions. He keeps dropping whirlwinds on tiles during this phase.
- **Minions (3):** one melee, one ranged, one magic. They chase the player and attack from their own reach: melee 1 tile, ranged 4 tiles, magic 4 tiles. HP raised to about **75** each (numbers to confirm in a balance pass).
- **All 3 dead:** Vaelkor comes back down to "finish the job" and is targetable again for the rest of the fight.
- **Decided (Nov 13):** he returns at the HP he left at (so about 75%). Whirlwinds fall 1.25x as often while he is in the air. Minion max hit is **18** for each style (melee, ranged, magic); actual damage still scales with the player's gear and Defence.
- **Decided (Nov 13, arena):** shared arena engine. 'Flying' is a targeting flag only. Normal flying: melee can never hit him, ranged and magic can. High phase (below 75%): untargetable by all styles until all 3 minions die, then back to normal flying.
- Open: info page text.

## B7: Magmor, the Molten Titan

**Today:** a single-row lane (`TILE.rows = 1`), the guest and starter fight.
- **Decide:** keep the lane (it's the tutorial fight and simple on purpose), or move to the arena engine.
- **Decided (Kellen, Nov 13):** move Magmor to a real room on the shared arena engine.
- **Verify:** the guest flow still works end to end, from a starter kill to the Fire cape.

## B8: Gloamhold raid

**Today:** its own grid (`raid.js:10-11`, `COLS=5`, `ROWS=1`) with BFS pathfinding, and its own copy of the combat code.
- **Decide:** move the raid rooms onto `arena.js`, or leave them for a dedicated raid run.
- **Decided (Kellen, Nov 13):** move the raid rooms onto the shared arena engine, together with the NET-1 server work.
- **Verify:** three group clears on staging with no desync (same check as bug-plan 5.1).

---

## B9: Kellen's boss feedback (fill in before starting B2–B8)

For each boss, record:

| Boss | What feels wrong today | Intended feel / identity | Attacks to add, remove or change | Target kill time (starter / mid / best gear) | Must-keep |
|---|---|---|---|---|---|
| Widow Queen | Ranged attack missing; melee hits from range (bug run); skeletons too slow | | Add ranged (B2.2); faster skeletons; web spiders 4–8 typeless (B2.4) | | |
| Hollow Knight-King | Protect from Melee trivialises early fight; minions never seem to hit | | 6 minions hit 4–6 with low accuracy; push multi-target play (B3.4) | | |
| Gorehorn | All attacks melee | | | | |
| Drowned Colossus | All attacks melee; rock and grab don't matter | | | | |
| Vaelkor | Too close to OSRS Kree'arra | Solo start, summoned-guard phase | Minions summoned below 75%; air phase with whirlwinds; ~75 HP minions (B6.1) | | |
| Magmor | | | | | |
| Gloamhold (Morvane) | | | | | |

Each filled-in row becomes concrete tasks under its B-section. Balance changes still need Kellen's sign-off through Gameboy ([`OWNERS.md`](../../OWNERS.md)).

---

## Verification pattern for every boss (B2–B7)
1. **Distance map** (B1.5) reviewed.
2. **Headless sim** with three scripted players:
   - perfect (always dodges, always the right prayer)
   - one-prayer (holds a single protection prayer)
   - idle
   
   Record kill time, damage taken and death rate over 50 seeded runs. Each boss gets target bands. Perfect should win, one-prayer should take heavy damage, idle should die. This needs the seeded `simulate()` work from [`ARCHITECTURE.md`](../../ARCHITECTURE.md), step 7; until then, use manual runs with `godMode` and a damage log.
3. **Manual QA** on a phone: every attack seen and its prayer check confirmed, info page read against what happened, scene `exit` cleanup checked (start the next fight and confirm a clean arena).
4. **Server:** the kill RPC's minimum-time check (bug-plan 1.9) is updated to the new realistic fastest kill.

## Suggested order
1. B1.1 (mock) → B1.2 → B1.3 → B1.4 → B1.5
2. B9 feedback session
3. B2 Widow (pilot; proves the engine)
4. B5 Colossus (stationary like Widow)
5. B3 Knight and B4 Gorehorn (walking bosses; uses B1.3)
6. B6 / B7 / B8 decisions

## Open decisions
Status of each item: **needs Kellen**. Stable IDs (also in the [plans index](../README.md#open-decisions-for-kellen)):

1. **BOSS-B1.4** — B1.4: camera, only if tiles are too small on 360 px phones.
2. **BOSS-B6-arena** — B6: Vaelkor arena.
3. **BOSS-B7-lane** — B7: Magmor lane.
4. **BOSS-B8-rooms** — B8: raid rooms.
5. **BOSS-B9-bands** — Per-boss target kill times and damage bands (B9).

Related, still **needs Kellen** (already decided text is unchanged above): **BOSS-B3.4-spell** (multi-target magic spell in B3.4), **BOSS-B6.1-info** (Vaelkor info page text), **BOSS-B6.1-hp** (minion HP “about 75”, confirm in a balance pass).
