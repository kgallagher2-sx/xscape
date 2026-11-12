# Xscape fix plan

Source review: snapshot in `xscape-main.zip` (build `20261111224507-090c8ec`). File:line references point at that snapshot. Re-check them against `main` before starting each task.

**Guiding rule: the server is the source of truth.** The client may *ask* for changes and *display* state. It never decides which GP or items exist or who owns them. Each task below either moves a decision to the server or makes the client agree with what the server already decided.

Every task has:
- **Do**: the change.
- **Done when**: acceptance criteria.
- **Verify**: the follow-up check, run by QA or by whoever didn't write the change. A task isn't closed until its Verify passes.

Phases are ordered by risk. Phase 1 blocks everything else, because until it lands any player can mint items.

---

## Phase 0: Foundations (needed to verify everything else)

### 0.1 Staging Supabase project
- **Do:** Create a second Supabase project (free tier) and apply every `supabase/*.sql` in the order production used. Point a `?backend=staging` query flag in `cloud.js` at it.
- **Done when:** the game boots against staging, sign-in works, and a Jad kill records.
- **Verify:** `select proname from pg_proc` on staging and on prod return the same function list. Diff the live `pg_get_functiondef` for each `public.*` / `game.*` RPC between the two.

### 0.2 Fix migration ordering
- **Do:** The SQL files have no order prefix, so nobody can tell which definition of a function is live. Rename them `NNNN_name.sql` in the order they were applied to prod (ask whoever applied them, or match `pg_get_functiondef` output). Add `supabase/README.md`: "new migrations get the next number; never edit an applied file."
- **Done when:** applying the files in numeric order to an empty project reproduces prod's function definitions.
- **Verify:** apply from scratch to a throwaway project and diff the function definitions against prod. No differences.

### 0.3 Security test script
- **Do:** Add `tests/sql/exploits.sh` (or a small Node script using `@supabase/supabase-js`). It signs in as two test users on staging and attempts every exploit in Phase 1, one function per exploit. Each test expects **rejection**.
- **Done when:** the script runs end to end against staging. Before Phase 1 lands, every test fails, which proves the exploits are real.
- **Verify:** after each Phase 1 task, its test flips to pass. The full script is green before Phase 1 ships to prod.

### 0.4 Two-client test setup
- **Do:** Document how to run two signed-in clients side by side (two browser profiles, or desktop + phone) against staging, with a debug overlay showing tick number, HP of both sides, and a state hash. Raid already has `syncRaidDebugTile`; extend that idea to duels.
- **Done when:** QA can start a duel and a 2-player raid on staging and see the overlay on both screens.
- **Verify:** QA records one clean duel and one clean raid as the baseline for Phase 5.

---

## Phase 1: Server owns GP and items (economy)

### 1.1 Remove direct writes to `player_state`
- **Why:** `xscape_backend.sql:1063` grants `UPDATE` on `player_state` to every signed-in user, and the `player_state_update_own` policy (`:1082`) lets them write their own row. Anyone can PATCH their inventory over the REST API and skip every check in `save_player_state`.
- **Do:** New migration: `REVOKE UPDATE ON public.player_state FROM authenticated; DROP POLICY player_state_update_own ON public.player_state;`. Keep SELECT.
- **Done when:** the only way to change `player_state` is through `save_player_state` and the other RPCs.
- **Verify:**
  - The exploit test does `PATCH /rest/v1/player_state` with a fake item and gets 401/403.
  - Normal play still saves (equip an item, reload, it's still equipped).

### 1.2 `save_player_state` can only rearrange, not create
- **Why:** The live definition (`alcove_grant_merge.sql:131-141`) stores whatever inventory, bank and equipment the client sends, as long as the item ids match a regex. This is the root of item minting, and also of item *loss* (see 2.1).
- **Do:** Rewrite it as a conservation check.
  1. Load the stored row. Count every item id across inventory + bank + equipment, before and after.
  2. **Gear and uniques** (anything not consumable): counts must be identical. The client may only move them between containers. Reject the save if any count rises or falls.
  3. **Consumables** (food, potions, runes): counts may only *decrease* (eaten, drunk, cast). Rises only come from the shop, trade or loot RPCs, which update the stored row themselves.
  4. Potion doses: a 4-dose potion becoming a 3-dose is a valid decrease. Define a dose table server-side (`game.potion_family`) so the check understands families.
  5. Container caps and equip-slot validity are checked server-side (slot matches the item's slot, two-handers clear the shield).
  6. On rejection, return `{ok:false, profile}` with the server copy so the client resyncs, just like the existing `stale` path.
- **Done when:** the server's item counts change only through loot, shop, trade, duel or consumption.
- **Verify:**
  - Exploit tests: adding an item gets rejected. Duplicating an item into both bank and inventory gets rejected. *Removing* a gear item gets rejected (it isn't lost).
  - Regular play on staging: bank/withdraw, equip and unequip every slot, drink potions down to empty vials, cast spells, eat food. Every save is accepted and nothing is reverted unexpectedly. Check `cloud.js` logs for any `ok:false`.

### 1.3 Duel settlement agreed by both sides
- **Why:** In `duel_forfeit_winner.sql:75-77`, whoever calls `settle_duel` first names the winner and the server believes them. A player can call it 4 seconds in, name themselves, and collect both stakes regardless of the fight.
- **Do:**
  1. Add `from_report uuid, to_report uuid, from_hp int, to_hp int, reported_at timestamptz` to `duel_challenges`.
  2. `settle_duel` records the caller's claimed winner and final HP. It pays out only when **both** reports exist and agree.
  3. If the reports disagree, or only one arrives within 60 s: refund both stakes and mark the duel `disputed`. (Once 5.2 lands, disputes should be very rare. Count them.)
  4. Forfeit stays one-sided, but only the *caller* can lose by forfeit (that's already the case).
  5. The "opponent gone 2 min" auto-win keeps using `player_is_gone`.
  6. `refund_duel` (`duel_item_escrow.sql:596-602`) must not be callable by a single player once status = `fighting`. It may only be reached through the dispute or timeout path.
  7. Require the server-side elapsed time `now() - fight_started_at` to be at least `p_ticks * 0.6s - slack`, so a client can't claim a 100-tick fight after 4 seconds.
- **Done when:** a single client can't decide a duel.
- **Verify:**
  - Exploit test: player A calls settle naming A, while B names B or never reports. Result: no payout, both refunded.
  - Normal duel on two clients: payout happens once, to the right player.
  - Mid-fight `refund_duel` from the losing side is rejected.

### 1.4 Close the 80M import for new accounts
- **Why:** `migrate_local_save` (`xscape_backend.sql:346`) accepts up to 80M GP once per account, and new accounts start with `migrated_at` NULL. Any alt can import 80M and trade it to a main.
- **Do:**
  1. Set `migrated_at = now()` in `handle_new_user` for every account created after this migration.
  2. Choose one of the following for the remaining legacy un-migrated accounts and record the decision:
     - Freeze imports entirely. Recommended: the legacy window has passed.
     - Import with `gp = 0` and only allow-listed starter or Jad items.
  3. Remove `merge_local_save` GP "greatest of" logic. Server GP wins.
- **Done when:** no RPC can raise GP from a client-supplied number.
- **Verify:**
  - Exploit test: a fresh account calls `migrate_local_save({gp: 80000000})` and gp stays 0.
  - `grep -n "p_profile->>'gp'\|->>'gp'" supabase/*.sql` finds no live definition that writes it to `profiles.gp`.

### 1.5 Stop alcove grants from respawning
- **Why:** `merge_alcove_grants` (`alcove_grant_merge.sql:61-79`) runs on every save and puts back any granted item that isn't currently held. A player can trade the item away and get it back again, without limit.
- **Do:**
  1. Add `merged_at timestamptz` to the claim/grant rows.
  2. Merge only rows where `merged_at IS NULL`, then set it.
  3. Backfill `merged_at = now()` for every row already merged.
  4. Remove the call from `save_player_state` once the backfill has run (it was meant as a one-off).
- **Done when:** a grant lands at most once per claim.
- **Verify:**
  - Exploit test: claim, trade the item to a second account, save, and the item does not reappear.
  - Run a query for players who hold more copies of an alcove item than they have claims. Report the list to Kellen so a decision can be made on existing dupes.

### 1.6 Group raid payouts need real elapsed time
- **Why (plain version):** Each raid run can only be completed once; that part works. But the leader can **start a new run and complete it immediately**. `complete_raid_run` (`gloamhold_t3_loot.sql:241`) only checks that the client *says* it took at least 20 ticks. It never checks how much real time has passed since the run started, and it never applies the `last_raid_at` cooldown. Each member's score also comes from the client (`p_scores`), and score drives loot up to 8M. So a leader plus an alt can loop start → complete → start → complete every few seconds and print GP.
- **Do:**
  1. Reject completion unless `now() - raid_runs.started_at >= interval '<minimum realistic clear>'`. Ask Boss Mechanics for the fastest legitimate clear; use about 80% of it.
  2. Check `p_ticks * 0.6s <= now() - started_at + slack`.
  3. Per-member cooldown on `last_raid_at`, matching solo `record_raid_clear`.
  4. Cap each member's score by a server-side function of run duration and party size. Long term, the server should compute score from per-room events instead of taking it from the client.
  5. Find and commit the missing `set_party_ready` / run-start SQL. It's called from `cloud.js:2932` but isn't in the repo.
- **Done when:** a raid pays out at most once per realistic clear time per player.
- **Verify:**
  - Exploit test: start + complete within 5 s is rejected. Two completions inside the cooldown: the second is rejected. A score of 10^9 gets capped.
  - A real 2-player clear on staging pays both players.

### 1.7 Staking one stackable item must not wipe the stack
- **Why:** `take_held_item` uses `array_remove` (`duel_item_escrow.sql:97,100`), which deletes *every* copy of that id. `give_held_items` (`:129-133`) can drop payouts the same way.
- **Do:** Use `game.inventory_remove_one` (already exists) and an append-based give. Grep all live SQL for other `array_remove` uses on inventory or bank, and fix those too.
- **Done when:** staking or paying out N items moves exactly N.
- **Verify:** Stake 1 shark from a stack of 20 and confirm 19 remain. Win the duel and confirm the stakes add on top. Repeat with runes.

### 1.8 Revoke client access to internal `game.*` helpers
- **Why:** `duel_item_escrow.sql:709-711` grants `authenticated` access to helpers like `game.return_stake_to_player(uid, gp, items)`, which give anything to anyone. They are protected only because the `game` schema isn't exposed in the API settings.
- **Do:** `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM authenticated, anon;`. Grant back only what's needed, which should be nothing, since the `public.*` wrappers are SECURITY DEFINER. Add the same REVOKE at the end of every future migration that touches `game`.
- **Done when:** `authenticated` has EXECUTE on no `game.*` function.
- **Verify:** Query `information_schema.routine_privileges` for `grantee='authenticated' AND routine_schema='game'` and get 0 rows. Run a full duel, trade and raid on staging to confirm nothing broke.

### 1.9 Sweep every reward RPC for the same holes
- **Do:** For each RPC that adds GP or items (`record_*_kill`, `record_raid_clear`, `buy_shop_item`, `claim_alcove_*`, trade, duel), list in a table:
  - whether it's rate-limited
  - whether it checks real elapsed time
  - whether it has an idempotency key
  - whether it trusts any client number other than ticks
  - whether it rejects anonymous users when it should
- **Done when:** every row is green, or has a written reason (e.g. "Jad kill trusts the client; accepted for now").
- **Verify:** a second person reviews the table against the live `pg_get_functiondef`.

---

## Phase 2: Players never lose items

### 2.1 Client normalization must not drop unknown items
- **Why:** The patched `normalizeContainers` (`supplies.js:309-341`) deletes any id not in `ITEMS`. The original in `index.html` deliberately kept them. If `raid.js` fails to load once, all raid uniques are removed from the bank and that state is saved.
- **Do:**
  1. Keep unknown ids in both inventory and bank. Display them as a generic "Unknown item" icon rather than hiding them.
  2. Restore the `reclaimStrayWornItems` call the patch dropped.
  3. Hidden-item filtering affects *display only*; it must never change `P.bank` / `P.inventory`.
- **Done when:** normalization never changes an item's total count.
- **Verify:**
  - Block `raid.js` in DevTools (Network → block request URL), load the game, open the bank, then unblock and reload. The raid uniques are all still there.
  - With 1.2 in place the server would also reject this save. Confirm the client logs a rejection *zero* times during normal play.

### 2.2 Pre-save sanity guard (defence in depth)
- **Do:** In `pushStateOnce` (`cloud.js`), compare the outgoing gear count to the last server-confirmed copy. If any non-consumable count dropped, don't push. Log it and resync from the server instead.
- **Done when:** the client never even asks to delete gear.
- **Verify:** Run `Profile.bank.pop()` in the console, then trigger a save. The push is skipped, a warning is logged, and after resync the item is back.

### 2.3 Local save quota failures are visible
- **Do:** `saveProfile`'s empty `catch` (`index.html:3877`) should log and surface a one-time warning. Fixing the rune storage in 6.2 removes the main cause.
- **Verify:** Fill localStorage in DevTools, play, and the warning appears.

---

## Phase 3: Time and scenes

### 3.1 Background tab behaviour matches "the game can't be paused"
- **Context:** The fight currently runs only in the browser. When the app is backgrounded the browser stops the loop, then on return replays every missed tick in a single frame (`index.html:6371`). So the outcome already matches your rule: the fight continued while you were away. The problems are that it's invisible (you're dead before the screen redraws) and that closing or reloading the app instead of switching back avoids the fight entirely.
- **Do:**
  1. Keep catching up, but spread it over frames: run at most N ticks per frame (e.g. 10) until caught up, with the screen rendering in between, so the player sees what happened. Keep the existing hub `dt` cap for the hub only.
  2. Compute `G.elapsedMs` from the tick count (`ticks * TICK_MS`), not wall time, so reported kill times are consistent.
  3. Leaving mid-fight (reload, close, or being away longer than X minutes) counts as a **loss**. Record a fight start server-side (`start_fight(boss)` returns a fight id). A kill must reference an open fight id. An open fight id that's never completed expires as a death. This also gives every kill RPC a real start time for the elapsed-time checks in 1.9.
- **Done when:** backgrounding never pauses the fight, and leaving never avoids its outcome.
- **Verify:**
  - Start Jad, background the app for 60 s, and return. The catch-up is visible, and HP and prayer match what 100 ticks should do.
  - Start Jad and reload. The fight counts as lost, and no kill can be submitted for that fight id.

### 3.2 Knight-King, Gorehorn and Colossus cleanup on exit
- **Why:** These scenes define `leave`, but `enterScene` only calls `exit` (`index.html:6829`), so leaving skips their cleanup entirely. The result is that the next **Jad** fight runs on a 5-row arena, music keeps playing, and supplies aren't saved. This is a one-word fix, separate from the planned reworks of those bosses.
- **Do:** Rename `leave` to `exit` in `knight.js:1200`, `gorehorn.js:993` and `colossus.js:988`, add the `id` field, and stop the music on Knight's online-win path (`knight.js:1078`).
- **Verify:** Fight each of the three, leave, then start Jad. The arena is 1 row, no boss music, and supplies used in the previous fight are saved.

### 3.3 One scene registry (prevents 3.2 recurring)
- **Do:** Replace the copied 8-way scene if-chains in `frame`, `gameTick`, `keydown`, `pointerdown`, `isMidFight` and `hideAllOverlays` with one `Scenes` registry. Each scene declares `{id, frame, tick, key, click, overlays, isFight, enter, exit}`. `enterScene` warns in the console if a scene has `leave` but no `exit`.
- **Verify:** Each of the 8 scenes enters, plays and exits. Adding a dummy scene means editing one file.

---

## Phase 4: One combat ruleset everywhere

**Why things diverged:** Each boss file was copied from the previous one and carries its own copy of the combat glue. Shared constants such as `PRAYER_DRAIN_EVERY` are declared with `const` in `index.html`, which isn't visible on `window`. Each boss file therefore falls back to its own hardcoded default, and the copies picked different numbers: Kree and Widow use 2, Knight, Gorehorn and Colossus use 6. Widow has its own `attackSpeed()` (`widow.js:534`) that hardcodes 5 ticks for magic, and its own hit code (`widow.js:580`) that never calls `meleeSetMaxHit`, which is where the Gorehorn low-HP bonus lives. Fix the pattern, not just the numbers: every fight calls the shared functions in `combat.js`.

### 4.1 Export the shared constants and delete the fallbacks
- **Do:** Put `TICK_MS`, `PLAYER_ATTACK_TICKS`, `PRAYER_DRAIN_EVERY` and `CONSUME_COOLDOWN_TICKS` on `window.XscapeCombat.const` (and `window`). Then delete every `global.X || N` fallback in the boss, raid, duel and hub files.
- **Done when:** `grep -nE "global\.(TICK_MS|PLAYER_ATTACK_TICKS|PRAYER_DRAIN_EVERY)\s*\|\|" *.js` returns nothing.
- **Verify:** With one prayer on, count ticks per prayer point lost at Jad, Kree, Widow, Knight, Gorehorn, Colossus, the raid and a duel. All the numbers are identical. Write them into the test in 4.6.

### 4.2 One prayer drain function
- **Do:** Move drain into `combat.js` (`XscapeCombat.drainPrayer(G)`), including the prayer bonus if one exists. Remove the copies in each boss file, `raid.js:25/1270/2043` and `duel.js` `PRAY_DRAIN`.
- **Verify:** Same as 4.1, plus the raid and duel numbers match the solo bosses.

### 4.3 One attack speed and max-hit pipeline
- **Do:**
  1. Every fight gets attack speed from `XscapeCombat.playerSpeed(eq)` (`combat.js:303`). Delete Widow's `attackSpeed()` and the per-boss `playerSpeed()` copies (kree, knight, gorehorn, colossus).
  2. Give every weapon in `ITEMS` an explicit `speed` so no fallback is ever used.
  3. Every player hit goes through one `XscapeCombat.playerHit(monId, eq, opts) → {maxHit, chance}`. It applies stat boosts, gear bonuses, prayer bonuses and set effects (Gorehorn low-HP, any future set) in one place. The boss files call it; they don't compute hits themselves.
  4. Raid uses the same function with the fighter's own gear and stats (`raid.js:387/411` become thin wrappers).
- **Done when:** the same gear and stats produce the same speed, max hit and accuracy against the same defence at every boss.
- **Verify:** The table test (4.6) covers Gorehorn set at 10% HP, tentacle whip, a staff with a spell and a crossbow. Max hit and speed are identical across all fight modules. Then in game: Gorehorn set at low HP visibly hits harder at Widow.

### 4.4 Defence boosts and drains affect incoming hits
- **Why:** `npcHitChance` always uses defence level 99 (`combat.js:883-889`), so Super defence, Gloam brew's defence part and boss defence drains do nothing.
- **Do:** Pass the current boosted or drained defence level (`PlayerStats.level("defence")`) into the NPC hit-chance calculation for all fights. Same for raid fighters (per-fighter stats) and duels (each side's stats).
- **Verify:**
  - Unit test: the same monster attack has lower hit chance at boosted defence 118 than at 99, and higher at drained 80.
  - In game: compare damage taken over 50 Jad attacks with and without Super defence (use `godMode` plus a damage log).

### 4.5 Potion and food audit
- **Behaviour you want:** a potion or food can always be consumed, even at full stats or HP. That is what the code does today, so the Super restore item from the review is **not** a bug and gets no change.
- **Do:** For every consumable in `supplies.js` `PRICES`, write down what it should do (stats, amount, duration, decay). Then check each one in each fight type (solo boss, raid, duel) that:
  - the boost is applied
  - the boost is *used* by the combat math (4.3 and 4.4)
  - it decays on the shared 100-tick timer in `stats.js`
  - the consume cooldown is the same everywhere
- **Done when:** the table is all green.
- **Verify:** QA drinks each potion and reads `Xscape.getState()` before and after. Each boosted stat changes max hit, accuracy or defence as expected. Re-check after 100 ticks.

### 4.6 Combat rules test (locks Phase 4)
- **Do:** `tests/combat.test.js` (Node's built-in test runner, no dependencies) loads `combat.js` and `stats.js` with a fake `window`. It asserts:
  - speeds, max hits and accuracy for a fixed table of loadouts × monsters
  - prayer drain rate
  - defence-boost effect
  - Gorehorn set multiplier
  
  Add `scripts/qa.sh` to run it.
- **Verify:** Changing one weapon speed by 1 makes the test fail.

### 4.7 Player-side weapon range
- **Answer to "boss or player checks range?":** The player checks. You attack with your weapon's reach, and if the target is out of range you walk toward it until you're in range, then attack. Raid already does exactly this (`raid.js:1635-1750`: `meleeReachFor`, `inMeleeReach`, `pathTowardReach`), so it's the template. The solo bosses never check.
- **Do:**
  1. Move `meleeReachFor` / `inReach` / `pathTowardReach` into `combat.js` as shared helpers. Reach comes from the item (`reach` field, default 1 for melee; the halberd already has `reach: 2`).
  2. Decide ranged and magic ranges too (OSRS-style: magic 10, crossbows 7–8, etc.). Add `range` to those items.
  3. In each solo boss attack path: if out of range, set the player path toward the nearest in-range tile and don't attack this tick. Once in range, attack on the next tick that's off cooldown.
  4. Bosses that are never reachable by melee (Kree flying, Colossus on a fixed tile) need a reachable tile or must stay deliberately melee-immune. Flag them to Boss Mechanics, since that's a design decision.
- **Done when:** no weapon hits from outside its range in any fight.
- **Verify:** At each boss, a whip from 3 tiles away walks up, then hits. A crossbow at 2 tiles hits without moving. A melee hit never registers from outside reach (check the damage log).

### 4.8 Boss melee must not hit from range (Widow's "red dart")
- **Why:**
  1. Widow chooses melee when you're adjacent at the start of her tell (`widow.js:166`).
  2. When the attack fires, `fireAttack` (`widow.js:183-196`) launches it at your *current* position, wherever you are.
  3. The red line drawn for non-mage shots (`widow.js:714-719`) flies to you.
  4. `applyWidowHit("melee")` (`widow.js:207`) lands it without checking adjacency again.

  The result is that stepping away during a melee tell still gets you hit at range by a red dart. Protect from Magic can't block it, because it's a melee hit, and the info page doesn't mention it. This is the same reach rule as 4.7, applied to monsters.
- **Rule (decided):** every boss's melee reach is **2 tiles**, measured from the edge of the boss's footprint (Chebyshev distance; diagonals count). Bosses are large, so 2 instead of the usual 1. Regular-size monsters (babies, skeletons, raid adds) keep reach 1.
- **Interim exception: Widow stays at reach 1 for this bug run.** In today's 5×5 cave a 2-tile reach covers every tile you can stand on, so she would never use magic. She moves to reach 2 when she gets her 9×9 room (`BOSS_MECHANICS_PLAN.md`, B1). Before applying reach 2 to any other boss, draw its arena's distance map and confirm some tiles are still out of reach. Any boss where none are keeps reach 1 until its arena is redone.
- **Do:**
  - Give each boss a `meleeReach: 2` in its monster data, and use the shared reach helper from 4.7 (footprint-aware) everywhere a boss decides on, or lands, a melee attack.
  - **Choosing:** a boss may only pick melee if the player is within reach. Widow's `isAdjacent` check (`widow.js:67`) reads her `meleeReach` (1 for now). Widow doesn't chase, so outside reach she uses her ranged option (magic today).
  - **Landing:** re-check reach against the player's tile when the hit lands. If the player has stepped out of reach, it whiffs: no damage, no splat.
  - Draw melee as the lunge only, never as a projectile.
  - Apply the same two rules to Kree, Knight, Gorehorn, Colossus and the raid bosses.
  - Update each boss info page that says "next to her/him" to say "within 2 tiles".
- **Done when:** no boss melee can damage a player more than 2 tiles from its footprint when it lands, and every boss chooses melee using the same rule.
- **Verify:**
  - At Widow (reach 1 for now), stand next to her. Her melee tell can trigger, and Protect from Melee blocks it (blue 0).
  - Stand in the bottom row (2 away). She never chooses melee.
  - Start a melee tell next to her, then step away before it lands. No red dart and no damage.
  - Repeat at each boss that has melee, using that boss's reach. Add a unit test for the reach helper with 3×3 and 5×5 footprints.

### 4.9 Players and minions can't stand inside a boss
- **Why:** `widow.js` defines `inFoot()` (`:59`) but nothing calls it. A player can walk into Widow's 3×3 body and stand inside her, and baby spiders and skeletons can too. Check the other bosses for the same gap.
- **Do:**
  - In `queueMoveTo` / `processMovement` (`index.html:2749, 2783`), treat footprint tiles as blocked for the scene that owns them. Each boss scene supplies `isBlocked(col,row)`.
  - Tapping a footprint tile sets the boss as the target instead of walking there.
  - Today's movement goes straight, columns first and then rows, with no pathfinding. When the straight route crosses a blocked tile, step around it: try the row move first, and otherwise stop next to the boss. Full BFS pathfinding comes with the arena engine in `BOSS_MECHANICS_PLAN.md`.
  - Minion movement (`stepToward` in `widow.js`, and the equivalents in other bosses) skips blocked tiles the same way.
- **Done when:** no player or minion position is ever inside a boss footprint.
- **Verify:**
  - Tap every Widow footprint tile. The player never enters it; each tap targets her.
  - Walk from the bottom-left to the top-right corner. The player goes around her body.
  - Over a full fight, add a dev assertion each tick that player and minions are outside `FOOT`. It never fires.

---

## Phase 5: Multiplayer sync

**Principle:** In a raid the leader's client simulates everyone; in a duel each client simulates both players. Each client may only send *its own player's inputs*, stamped with the tick they apply on. The server settles results only when the clients agree (1.3, 1.6). The long-term direction for "server is the source of truth" is a server-side simulation, but that's a large separate project. This phase makes the clients agree reliably first.

### 5.1 Group raid
1. **A guest's movement moves the leader** (`raid.js:1732`, `3579-3581`). `pathTowardReach` calls `sendRaidInput`, which writes into `inputs[group.localId]`, the leader's own slot on the leader's machine.
   - **Do:** When simulating any fighter, set `f.path` directly. `sendRaidInput` may only be called from local UI handlers. Add a guard: `sendRaidInput` throws in dev if called during simulation.
2. **Guests cast spells with the leader's runes** (`raid.js:1759-1763`).
   - **Do:** Each fighter carries its own rune and supply counts, sent in the guest's hello and kept in the leader's state. `tryCastSpell` takes the fighter, not the global `Profile`. Runes used by a guest are deducted from *that guest's* account by the server (raid completion reports per-member consumables; validated under 1.2's "consumables only go down" rule).
3. **Only one fighter can attack per tick** (`raid.js:1737, 1772`).
   - **Do:** Move `_playerAttackTick` and `_tooFarAt` onto each fighter. Include them in `pushFighter` / `pullFighter`.
4. **The leader's Run/Walk applies to everyone** (`raid.js:995`).
   - **Do:** Add `run: bool` to each fighter's input. `stepFighterMove` reads the fighter's own flag.
5. **A guest's gear is lost at raid start** (`raid.js:3612-3617, 3908-3915, 3547, 3516`).
   - **Do:** The guest resends hello every 2 s until a leader state message contains its real gear. The leader never sends gear *back* to the guest's own copy. Send the full supplies object, including swordfish and dark crab.
   - Ideally the leader gets each guest's gear from the **server** (the party RPC returns each member's equipment), not from the guest. That way gear can't be faked.

**Verify (whole of 5.1):** Using the 0.4 two-client setup on staging:
- a guest with a whip out of reach walks up while the leader doesn't move
- the guest's mage uses the guest's runes (check both accounts after the raid)
- two fighters with matching cooldowns both hit on the same tick (damage log)
- guest runs while leader walks
- a guest joining before the leader keeps their gear
- three full clears with no desync on the debug overlay

### 5.2 Duels
- **Do:**
  1. Every input (prayer, attack, move, eat) carries `applyTick = currentTick + INPUT_DELAY` (e.g. 2 ticks). The receiver queues it and applies it exactly on that tick. Both clients apply their own inputs with the same delay, so both sides run identical sequences. The tick in the payload is currently ignored (`duel.js:873, 896-899`).
  2. A client doesn't advance past tick T until it has the opponent's input packet for T (an empty packet if nothing happened). This is standard lockstep. Replace the 20-tick catch-up cap and the one-sided 8 s freeze with this rule. A long stall uses the forfeit timeout.
  3. Each tick packet carries a hash of both HPs plus prayer. On mismatch, log it, show a "desync" banner, and settle as a dispute (refund) under 1.3.
- **Verify:**
  - Two clients with simulated latency (DevTools throttling, 300 ms on one). Over 20 duels, zero hash mismatches.
  - A prayer switched at tick T shows the same damage on both screens.
  - Both clients report the same winner, and the server pays once.

---

## Phase 6: Phone performance

### 6.1 Stop redoing HUD work every frame
- **Do:**
  1. `updateHud()` / `XscapeSupplies.refresh()` run only when something changed. Use a `dirty` flag set by inventory, prayer, HP or stat changes, not every rAF.
  2. Use the hoisted `POTION_ID_RE` (`supplies.js:83`) in `parseDose` instead of building a RegExp per call (`:131`).
  3. Cache family counts, recomputed when the inventory changes.
- **Verify:**
  - Chrome Performance recording, 30 s of Jad on a mid-range Android (or 4× CPU throttle), with 5k runes in inventory. Before and after: scripting time per frame. Target under 4 ms per frame and no GC sawtooth from RegExp allocation.
  - Hotbar counts stay correct after eating, drinking and casting.

### 6.2 Store stackables as counts
- **Do:** Runes (and ideally all stackables) become `{id: count}` instead of one array entry each. This change needs matching server work: `save_player_state` and the 1.2 conservation check, the shop, trade and escrow. Migrate existing rows in one SQL migration, keeping the old format readable for one release.
- **Verify:**
  - A player with 50k runes has a small save payload (check the request size in the Network tab).
  - Buying, casting, trading and staking runes all keep exact counts.
  - Old saves load correctly.

### 6.3 Don't save on every cast or bite
- **Do:** During a fight, mark the save dirty but only flush (localStorage + `save_player_state`) at fight end, on `visibilitychange: hidden`, or every 30 s. Out of combat, keep the current debounce.
- **Verify:** Over a 2-minute fight with 40 casts, the Network tab shows at most about 5 save requests. Killing the tab mid-fight loses at most 30 s of consumable use, which is acceptable since the server only lets consumables go down.

---

## Phase 7: Finish the Jad → Magmor, Kree → Vaelkor and Armadyl → Stormwing renames

**Current state (snapshot):** all text players can see already uses **Magmor, the Molten Titan** and **Vaelkor the Stormwing**. What's left is under the hood:
- **Code identifiers:** about 190 `jad` and 130 `kree` uses, plus names like `JAD_KIT`, `pendingJad`, `XscapeKree`, `drawKreeArra`, `kree-help`.
- **Files:** `kree.js`, `kree-sprites.js`.
- **Scene ids and test URLs:** `kree`, `?test=kree`, `?test=kree-loot`.
- **Saved data:**
  - profile fields: `jadKills`, `jadBestTicks`, `kreeKills`, `kreeBestTicks`
  - localStorage and session keys: `kellenscape-kree-brief-seen`, `xscape-pending-jad`
  - DB columns: `jad_kills`, `jad_best_ticks`, `jad_best_score`, `last_jad_at`, `last_jad_nonce`, `kree_kills`, `kree_best_ticks`, `last_kree_at`
  - RPCs: `record_jad_kill`, `record_kree_kill`
- **Comments and docs:** `ARCHITECTURE.md`, `BACKEND.md`, `OWNERS.md`, `RAID_DESIGN.md`.

One earlier find-and-replace went wrong: `combat.js:322` now says "OSRS Magmor, the Molten Titan is defence 480". That comment compares against the real OSRS Jad, so it should say TzTok-Jad.

**Armadyl → Stormwing:** item display names already say Stormwing (`combat.js:75-78`). What's left:
- **Item ids:** `armadyl_helmet`, `armadyl_chestplate`, `armadyl_chainskirt`, `armadyl_crossbow`.
- **Internal labels on the set:** `tier: "armadyl"` (gear-tier tag, e.g. `combat.js:217`), `kind: "armadyl"` (tells `lab-gear.js` how to draw the pieces), and `LOADOUTS.armadyl` (`combat.js:160`, a preset outfit of the full set + fire cape used by `cloneLoadout()` for test/QA gear and the lab — not what players start with; that is `LOADOUTS.starter`).
- **Art and lab references:** `kree-sprites.js`, `lab-gear.js`, `lab.html`, `item-icons.js`.
- **Comments.**
- **Four SQL files:** `xscape_backend.sql`, `widow_queen.sql`, `unique_set_complete_gp_bonus.sql`, `kree_gp_match_widow.sql`.

Item ids are the riskiest part of any rename. They're stored in every player's inventory, bank, equipment and unlocked items (local and server). They're also in unique-ownership rows, trade and duel escrow and history, and the loot pools. That's why they get their own task (7.5b).

**New internal ids (confirmed):** `magmor`, `vaelkor`, and the `stormwing_` item prefix: `stormwing_helm`, `stormwing_chestplate`, `stormwing_chainskirt`, `stormwing_crossbow`. The tier tag, the lab `kind`, and the `LOADOUTS` preset key all become `stormwing`.

Saved data has to be renamed without breaking old saves or old clients. Do it in this order, one task at a time.

### 7.1 Comments, docs and in-file names (no saved data)
- **Do:**
  - Rename local variables, functions, constants, DOM ids and CSS classes (for example `JAD_MAX_HP` to `MAGMOR_MAX_HP`, `kree-help` to `vaelkor-help`, `drawKreeArra` to `drawVaelkor`).
  - Fix the comments and the four `.md` files, and the `combat.js:322` comment.
  - Leave references to *OSRS's* Jad and Kree'arra where they're real-world comparisons; label them "OSRS TzTok-Jad".
- **Done when:** `grep -niE "\bjad|kree" *.js *.html *.md` only matches saved-data names (7.3–7.5) and deliberate OSRS references.
- **Verify:** Run a full Magmor fight and a full Vaelkor fight, including loot and the briefing card. Run every `?test=` URL. There are no console errors, and every DOM id lookup still resolves; add a dev check in boot that warns on `getElementById` returning null for any listed id.

### 7.2 Files, global objects, scene ids and test URLs
- **Do:**
  - Rename `kree.js` to `vaelkor.js` and `kree-sprites.js` to `vaelkor-sprites.js`. Update the script tags in `index.html` and `lab.html`, and the precache list in `sw.js`.
  - Rename `window.XscapeKree` to `window.XscapeVaelkor`. Keep `XscapeKree` as an alias for one release, with a console warning.
  - Rename scene ids from `kree` to `vaelkor`. The Jad fight's scene, if it has an id, becomes `magmor`.
  - `?test=` accepts both old and new names for one release.
- **Verify:**
  - A hard reload, then an offline reload with the service worker serving cache, both load the new files.
  - `?test=vaelkor`, `?test=vaelkor-loot` and `?test=kree` (alias) all work.
  - Leaving the fight cleans up properly (scene `exit` runs).

### 7.3 Client saved data (profile + localStorage), with migration
- **Do:**
  - `loadProfile` reads the new keys (`magmorKills`, `vaelkorKills`, …) and falls back to the old ones. `saveProfile` writes only the new keys.
  - Same for localStorage keys: read the old key, write the new key, then delete the old one.
  - `applyCloudProfile` maps the server's names (old or new) onto the new fields.
  - If the save schema version from the Phase 2 / `ARCHITECTURE.md` save task exists by then, this is migration #1.
- **Verify:**
  - Load a saved old-format profile fixture (with `jadKills: 12, kreeKills: 4`). It shows 12 and 4, and after one save the stored profile has only the new keys.
  - Briefing-seen flags survive the rename, so the briefing doesn't pop up again.

### 7.4 Database: new RPC names with old ones as wrappers
- **Do:**
  - Add `record_magmor_kill` and `record_vaelkor_kill` with identical bodies. Turn the old `record_jad_kill` and `record_kree_kill` into one-line wrappers that call the new ones, so old cached clients keep working.
  - Switch `cloud.js` to the new names.
  - Remove the wrappers once `version.json` has been on the new build for at least a week.
- **Verify:** Exploit tests from 0.3 pass against both names. A kill recorded through the old name and one through the new name land in the same column. Rate limits are shared, so alternating names can't bypass the cooldown.

### 7.5 Database columns
- **Do:**
  - In one migration, `ALTER TABLE … RENAME COLUMN` for each `jad_*` and `kree_*` column, and update every function, view, trigger and leaderboard row that references them.
  - The JSON that `profile_payload` returns sends **both** old and new field names for one release, then only the new ones.
  - Run on staging first.
- **Verify:**
  - On staging, search every function body for the old names: `select proname from pg_proc where prosrc ~* 'jad_|kree_'` returns nothing except the 7.4 wrappers.
  - Compare the leaderboard and a sample of profiles before and after: same numbers.
  - Then apply to prod and repeat the check.

### 7.5b Item ids `armadyl_*` → `stormwing_*`
- **Do:**
  1. **Alias table, one source:** `ITEM_ID_ALIASES = { armadyl_helmet: "stormwing_helm", armadyl_chestplate: "stormwing_chestplate", armadyl_chainskirt: "stormwing_chainskirt", armadyl_crossbow: "stormwing_crossbow" }`. It lives in `combat.js` with a matching `game.item_alias(text)` SQL function.
  2. **Client:**
     - `ITEMS`, `LAB_ITEMS`, `LOADOUTS`, icons and art use the new ids.
     - Every place an id enters the client goes through the alias map first: `loadProfile`, `applyCloudProfile`, trade and duel payloads, loot results, and lab tweak keys in `xscape-lab-gear-tweaks`.
     - Put the mapping in one `canonicalItemId()` used by `normalizeContainers`; the existing `canonicalSupplyId` is the model.
  3. **Server, one migration:**
     - Rewrite the ids in `player_state` (inventory, bank, equipment, unlocked items), in the unique-ownership table, in open trade and duel escrow rows, and in loot pool definitions.
     - Every RPC that accepts item ids runs them through `game.item_alias` first, so old cached clients sending `armadyl_*` still work. This includes `save_player_state` and its conservation check from 1.2, so the check compares canonical ids.
     - History tables (completed trades and duels) can keep the old ids. Readers canonicalize them.
  4. Keep the alias map permanently; it costs nothing. Remove only the old ids from `ITEMS`.
- **Done when:** no live data holds an `armadyl_*` id, and an old client that sends one still works.
- **Verify:**
  - Staging, before the migration: give a test account the full set (some pieces equipped, some banked), one piece in an open trade, and one staked in a duel.
  - Run the migration.
  - The account shows four Stormwing pieces in the same places. The trade and the duel complete with the right item.
  - `select count(*) from player_state where (inventory::text || bank::text || equipment::text || unlocked_items::text) ilike '%armadyl%'` returns 0.
  - An old-format save fixture with `armadyl_crossbow` equipped loads with the Stormwing crossbow equipped.
  - The 1.2 conservation check accepts a save from an old client that still uses `armadyl_*` ids.
  - The set-complete bonus from Vaelkor still triggers for a player with the full set.

### 7.6 Final sweep
- **Do:** `grep -rniE "jad|kree|armadyl" .` across the repo and `supabase/`. Every remaining hit is a deliberate OSRS reference, a compatibility alias with a removal date, or a migration file that has already been applied (never edit those). Record the remaining aliases and their removal dates in `RELEASE.md`.
- **Verify:** QA does a full play-through on the live build (Magmor kill, Vaelkor kill, leaderboard, hub boss menu, info pages). Players see no old names, and no errors.

---

## Out of scope (separate projects)
- **Boss mechanics run:** see `BOSS_MECHANICS_PLAN.md`. It covers the 9×9 arena engine, Widow's ranged attack, the Gorehorn, Colossus and Knight-King reworks, and Kellen's boss feedback.
- Server-side fight simulation (true server authority for kills).
- The wider refactor in `ARCHITECTURE.md` (content JSON, seeded `simulate()` for every boss), except the parts pulled in above.

## Open questions for Kellen
1. ~~Widow damage through Protect from Magic~~ **Resolved:** the "red dart" is her melee hitting from range (fixed by 4.8). Her intended ranged attack is a boss-mechanics change (see Out of scope).
2. **Leaving mid-fight (3.1):** should it count as a death with any penalty, or just no loot and no kill count?
3. **Ranged/magic ranges (4.7):** what numbers per weapon?
4. **Existing dupes (1.5, 1.2):** once found, should they be removed, left alone, or converted to GP?
5. **Legacy imports (1.4):** freeze them entirely, or allow GP-less imports for a while longer?

## Suggested order and sizing
| Order | Tasks | Size |
|---|---|---|
| 1 | 0.1, 0.2, 0.3 | S–M |
| 2 | 1.1, 1.8, 1.7, 1.4, 1.5 (small SQL, high value) | S each |
| 3 | 2.1, 2.2, 3.2 (small client fixes) | S each |
| 4 | 1.3, 1.6, 1.9 | M |
| 5 | 1.2 (largest server change; needs 0.3 green first) | L |
| 6 | 4.1 → 4.6, then 4.7 | M–L |
| 7 | 0.4, 5.1, 5.2 | L |
| 8 | 3.1, 3.3, 6.1 → 6.3, 2.3 | M |
| 9 | 4.8, 4.9 (can go earlier, alongside step 3) | S–M |
| 10 | 7.1 → 7.6 (7.1 can start any time; 7.3–7.5b after Phase 1, since they touch the same SQL and saves; 7.5b after 1.2 so the conservation check knows about aliases) | M–L |
