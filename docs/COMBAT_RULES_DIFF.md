# Combat rules refactor — baseline and diff (Phase 1 batch 6, tasks 4.1–4.6)

Captured 12 November 2026, America/New_York.

This document locks the pre-refactor combat numbers, records what moved, and
explains every difference. Apart from task 4.4 (defence boosts and drains now
affect incoming hit chance) and the documented bug fixes below, **no combat
numbers changed**.

Method: `stats.js` + `combat.js` loaded in a Node `vm` with a fake `window`
and `Profile.levels` all 99. Loadouts:

| Key | Gear | Weapon speed |
|---|---|---|
| ranged_t1 | `LOADOUTS.starter` (green d'hide + rune crossbow + mithril bolts) | 4 |
| ranged_t3 | `LOADOUTS.armadyl` | 4 |
| melee_t1 | `LOADOUTS.kingsguard` (sword) | 4 |
| melee_t3 | `LOADOUTS.gorehorn` (axe; full set) | 7 |
| magic_t1 | ashen staff + ashen robes | 5 |
| magic_t3 | `LOADOUTS.widow` (wand) | 5 |

Canonical constants (now on `window` and `XscapeCombat.const`):
`TICK_MS=600`, `PLAYER_ATTACK_TICKS=4`, `PRAYER_DRAIN_EVERY=2`,
`CONSUME_COOLDOWN_TICKS=3`.

The locking test is `tests/combat.test.js`, run with `scripts/qa.sh`.

---

## 1. Player outgoing at defence 99, HP 99

Pre and post are identical for every boss × loadout at HP 99. Sample vs Jad
(Magmor); the same loadout produces the same speed / max / chance against each
other boss except for that boss's defence (chance only):

| Loadout | Style | Speed | Max hit | Chance vs Jad |
|---|---|---|---|---|
| ranged_t1 | ranged | 4 | 17 | 77.458% |
| ranged_t3 | ranged | 4 | 35 | 83.138% |
| melee_t1 | slash | 4 | 22 | 81.675% |
| melee_t3 | crush | 7 | 30 | 85.663% |
| magic_t1 | magic | 5 | 20 | 91.962% |
| magic_t3 | magic | 5 | 37 | 96.242% |

Selected other chances at HP 99 (unchanged):

| Boss | Loadout | Chance |
|---|---|---|
| Kree / Vaelkor | ranged_t1 | 25.706% |
| Widow | magic_t3 | 56.412% |
| Widow | melee_t3 | 39.967% |
| Gorehorn | melee_t3 | 45.550% |
| Colossus | melee_t1 | 31.027% |
| Knight-King | melee_t3 | 65.593% |

---

## 2. Gorehorn set at 10 HP (documented 4.3 bug fix)

Multiplier is `1 + (maxHp − hp) / 100` = 1.89 at HP 10 of 99. Crush max 30
becomes 56. Chance is unchanged.

| Fight | Pre max | Post max | Notes |
|---|---|---|---|
| Jad, Kree, Colossus, Gorehorn, Knight-King | 56 | 56 | Already applied `meleeSetMaxHit` |
| Widow | **30** | **56** | Widow's `fireBolt` never called the set multiplier. Now every fight goes through `XscapeCombat.playerHit`, so Widow matches the others. |

This is the only outgoing-damage change. Speed stays 7.

---

## 3. Incoming (boss vs player) at defence 99

At the default defence of 99, every boss × style chance and formula max hit
is identical pre and post. Starter loadout (`ranged_t1`):

| Boss | Style | Formula max | Chance | Expected / hit |
|---|---|---|---|---|
| Jad / Magmor | ranged | 97 | 94.612% | 45.887 |
| Jad / Magmor | mage | 97 | 91.852% | 44.548 |
| Kree / Vaelkor | ranged | 71 | 83.286% | 29.567 |
| Kree / Vaelkor | mage | 21 | 75.875% | 7.967 |
| Kree / Vaelkor | slash | 26 | 68.886% | 8.955 |
| Widow | mage | 28 | 83.682% | 11.716 |
| Widow | slash | 30 | 76.493% | 11.474 |
| Colossus | crush | 30 | 75.815% | 11.372 |
| Gorehorn | crush | 30 | 82.097% | 12.314 |
| Knight-King | slash | 30 | 79.554% | 11.933 |

Live caveats (unchanged by this batch, not unified):

- Knight, Gorehorn, and Colossus **basic melee** still uses `opts.max = BASIC_MAX` **28**,
  not the formula max of 30. The chance above still applies; expected live
  damage is `chance × 14`, not `chance × 15`. Their live basic style is
  `"melee"` which normalizes to **crush** (the Knight slash row above is the
  formula style, not the live basic hit).
- **Vaelkor the Stormwing melee asymmetry is intended.** Kellen confirmed
  on 12 November 2026, 12:35 PM America/New_York, that you cannot melee
  him because he flies (`MONSTERS["kree-arra"].flying = true`). Not a bug;
  no combat numbers were changed for this.
- Raid Warden / Morvane / shade incoming uses **special accuracy**, not
  `npcHitChance`: Warden 22 @ 0.80; Morvane P1–P4 42/48/55/65 @
  0.88/0.90/0.93/0.96; shade 6 @ 0.70. Task 4.4 does **not** change those
  numbers. See open questions.

---

## 4. Prayer drain (documented 4.1 / 4.2 bug fix)

Canonical rule, now used everywhere combat.js is loaded: **1 prayer point
every 2 ticks** (0.5 / tick). With one prayer on, 99 prayer lasts 198 ticks
≈ 118.8 s. First drain is on tick 2 (tick 1 is a no-op), same as the previous
Jad/Kree/Widow/raid pattern.

| Scene | Pre (points / tick) | Post | Why it moved |
|---|---|---|---|
| Jad / Magmor | 1 every 2 ticks | unchanged | already canonical |
| Kree / Vaelkor | 1 every 2 ticks | unchanged | already canonical |
| Widow | 1 every 2 ticks | unchanged | already canonical |
| Raid (base) | 1 every 2 ticks | unchanged | already canonical |
| Raid Morvane phase 4 | +1 extra on the shared drain | unchanged | boss mechanic, kept |
| Colossus | **1 every 6 ticks** | **1 every 2 ticks** | `PRAYER_DRAIN_EVERY` was not on `window`; the file fell back to `\|\| 6` |
| Gorehorn | **1 every 6 ticks** | **1 every 2 ticks** | same fallback bug |
| Knight-King | **1 every 6 ticks** | **1 every 2 ticks** | same fallback bug |
| Duel | **3 every tick** | **1 every 2 ticks** | local `PRAY_DRAIN = 3` applied every tick. This is a large feel change (99 prayer lasted ~33 ticks / ~20 s; it now lasts ~198 ticks / ~119 s) and is required so drain is identical across fights. |

`drainPrayer` lives in `combat.js` as `XscapeCombat.drainPrayer`.

**Worn prayer bonus slows drain (approved by Kellen, 12 November 2026,
12:35 PM America/New_York).** Resistance is the OSRS shape
`60 + 2 × prayerBonus`, so the effective rate is the base rate
(1 point per 2 ticks) times `60 / (60 + 2 × bonus)`. +0 is unchanged
(+30 lasts 2×). Drain accumulates as a fraction every tick and negative
bonus clamps to 0. This is the shared function, so it applies at every
boss, in hosted and standalone raids, and in duels.

Item audit: no `combat.js` ITEMS entry currently has a `pray` / `prayer`
bonus field (starter and black d'hide, glory, fury, fire cape, Stormwing,
Widow Weaver, Kingsguard, Gorehorn, Kraken/coral, Eclipse, Unsleeping
robes/charm, Hollowplate, Nightfall, etc.). The only items that already
had a prayer stat are the Gloamhold / raid uniques, stored as
`bonuses.other.prayer` on standalone `RAID_ITEMS` and now also as
`bonuses.pray` on the hosted copies (same existing numbers, not new
balance):

| Item | Prayer bonus |
|---|---|
| Unsleeping stole | +8 |
| Gloamheart cape | +2 |
| Veilhide body | +1 |
| Veilhide chaps | +1 |
| **Best worn total** | **+12** |

At +12, factor is 60/84 ≈ 0.714, so 99 prayer lasts about 1.4×
(~277 ticks / ~166 s) versus 198 ticks / ~119 s at +0. Vault-curse
instant prayer hits in the raid are unchanged (they are not the
per-tick drain).

Standalone `raid.html` does not load `combat.js` (ITEMS conflict risk). It
keeps local `TICK_MS=600` / `PRAYER_DRAIN_EVERY=2` / `CONSUME_CD=3` and uses
`XscapeCombat` when hosted from `index.html`.

---

## 5. Task 4.4 — defence boosts and drains now affect incoming hits

Before: `npcPlayerDefenceLevel` always used `NPC_PLAYER_LEVEL` (99), so Super
defence, the defence part of a Gloam brew, and boss defence drains did
nothing to NPC hit chance. (A `defRoll` was computed from the live defence
level inside `monsterVsPlayer`, but live damage used `npcHitChance`.)

After: `npcHitChance` reads `PlayerStats.level("defence")`, and for magic
defence the 0.7 defence + 0.3 magic mix uses current defence and current
magic. At defence 99 the chances match the baseline exactly (section 3).

Super defence at base 99 is `5 + floor(99 × 0.15)` = **118**.
A −19 drain (the 80-defence probe below) is a severe drain for contrast.
Morvane's withering gaze is −5 (99 → 94); that delta is smaller than the 80
probe and, in the live raid, still does not change special-accuracy hits.

### Impact vs starter gear (ranged_t1)

Expected damage assumes a uniform 0..max roll on a hit (`expected = chance × max / 2`).
"Over 50 attacks" is 50 × that, for the in-game compare Kellen asked for.

**Jad / Magmor, ranged attack, max 97** (this is the live hit):

| Defence | Hit chance | Expected / hit | Expected over 50 hits |
|---|---|---|---|
| 99 (no pot) | 94.612% | 45.887 | 2294.33 |
| 118 (Super defence) | 93.655% | 45.423 | 2271.13 |
| 80 (drained) | 95.568% | 46.351 | 2317.53 |

- Super defence: chance **−0.957 pp**, expected **−0.464 / hit**, **−23.20 over 50 hits** (−1.01%).
- Defence 80: chance **+0.957 pp**, expected **+0.464 / hit**, **+23.20 over 50 hits** (+1.01%).

**Widow, mage attack, max 28** (live hit):

| Defence | Hit chance | Expected / hit | Expected over 50 hits |
|---|---|---|---|
| 99 | 83.682% | 11.716 | 585.78 |
| 118 (Super defence) | 81.700% | 11.438 | 571.90 |
| 80 (drained) | 85.817% | 12.014 | 600.72 |

- Super defence: chance **−1.982 pp**, expected **−0.277 / hit**, **−13.88 over 50 hits** (−2.37%).
- Defence 80: chance **+2.135 pp**, expected **+0.299 / hit**, **+14.94 over 50 hits** (+2.55%).

**Kree / Vaelkor, ranged attack, max 71** (live hit; bigger swing because Kree's accuracy is mid-roll rather than near-capped):

| Defence | Hit chance | Expected / hit | Expected over 50 hits |
|---|---|---|---|
| 99 | 83.286% | 29.567 | 1478.33 |
| 118 (Super defence) | 80.319% | 28.513 | 1425.65 |
| 80 (drained) | 86.253% | 30.620 | 1531.00 |

- Super defence: chance **−2.967 pp**, expected **−1.053 / hit**, **−52.67 over 50 hits** (−3.56%).
- Defence 80: chance **+2.967 pp**, expected **+1.053 / hit**, **+52.67 over 50 hits** (+3.56%).

**Gorehorn crush** (formula max 30 shown first; live basic max is 28):

| Defence | Chance | E/hit at max 30 | E/50 at max 30 | E/hit at live 28 | E/50 at live 28 |
|---|---|---|---|---|---|
| 99 | 82.097% | 12.314 | 615.72 | 11.494 | 574.68 |
| 118 | 78.918% | 11.838 | 591.88 | 11.049 | 552.43 |
| 80 | 85.275% | 12.791 | 639.56 | 11.939 | 596.93 |

- Super defence, live basic: **−22.25 over 50 hits** (−3.87%).
- Defence 80, live basic: **+22.25 over 50 hits** (+3.87%).

Boss **max hits do not change**. Only chance (and therefore expected damage)
moves. The effect is modest at Jad (already very accurate) and more visible
at Widow / Kree / Gorehorn.

Gloam brew defence at 99 current is `2 + floor(99 × 0.20)` → **120**, slightly
stronger than Super defence 118. A −5 withering-gaze drain (def 94) is a
smaller chance bump than the def-80 probe.

---

## 6. Task 4.5 — potion and food audit

Desired behaviour (per the plan): a potion or food can always be consumed,
even at full stats or HP. Super restore being drinkable at full is **not** a
policy bug.

What each `supplies.js` PRICES consumable should do (unchanged amounts):

| Item | Effect |
|---|---|
| Swordfish | heal 14 |
| Shark | heal 20 |
| Dark crab | heal 22 |
| Prayer potion | prayer `7 + floor(base × 0.25)` (31 at 99) |
| Super restore | prayer `8 + floor(base × 0.25)` (32 at 99) and restore drained combat stats toward base (does not stack past base) |
| Super attack / strength / defence | `5 + floor(base × 0.15)` (99 → 118) |
| Ranging potion | `4 + floor(base × 0.10)` |
| Magic potion | +4 |
| Gloam brew | HP `+ (2 + floor(base × 0.15))` (can overheal); defence `+ (2 + floor(current × 0.20))`; other combat `− (2 + floor(current × 0.10))` |
| Antipoison | 150 ticks (90 s) |

Decay is the shared 100-tick (60 s) timer in `stats.js`. `PlayerStats.tick()`
already runs in Jad, Kree, Widow, Knight, Gorehorn, Colossus, and raid.
Consume cooldown is `CONSUME_COOLDOWN_TICKS = 3` everywhere combat.js is
loaded.

### Clear bugs fixed

`canUse` / `applyEffect` in `supplies.js`, and `eatShark` / `sipPot` /
`resolveConsumables` in `index.html`, refused food at full HP and prayer /
Super restore at full prayer. They now always allow the consume (heal or
restore may be 0). This matches the plan's stated desired behaviour.

Boosts from Super attack/strength/ranging/magic were already used by
outgoing `playerHit` once `PlayerStats` was the source of combat levels.
Super defence, brew defence, and defence drains were **applied** to
`PlayerStats` but **ignored** by incoming math; that is the 4.4 fix.

### Open questions (not changed)

1. ~~**Prayer-bonus drain.**~~ **Resolved (Kellen, 12 November 2026,
   12:35 PM America/New_York):** worn prayer bonus slows drain via the
   OSRS `60 + 2 × bonus` resistance in `XscapeCombat.drainPrayer`. See
   section 4. Most main-game items still have no prayer stat; the
   highest existing set is the raid stole/cape/veilhide total of +12.
2. **Gloam brew stacking.** Defence boost is `+20% + 2` of *current*, so
   re-sipping can climb well past 120. Attack/strength/ranged/magic shrink
   the same way. Is that intended?
3. **Raid Gloam heal** hardcodes a 99-HP base rather than the fighter's
   actual hitpoints level.
4. **Duel potions.** Duels snapshot `Profile.levels` (typically 99) into the
   loadout and have no mid-fight potions. They do **not** read live
   `PlayerStats`, so a pre-duel Super defence does not change incoming or
   outgoing. Applying live boosts mid-duel would also be asymmetric PvP
   unless both sides get them. Boosted levels must never be written to
   `save_player_state`.
5. **Duel magic max-hit** uses a unique formula, not `spellMaxHitFrom` /
   `playerHit`. Left alone so PvP numbers do not move.
6. **Raid special accuracy** (Warden / Morvane / shade) does not use
   `npcHitChance`, so 4.4 and Morvane's withering gaze still do not affect
   those incoming hits. Should specials use formula defence?
7. **Raid shade** host `defLevel` 8 vs legacy `MONSTERS.shade` `defLevel` 5
   was already flagged; not unified here.
8. Knight / Gorehorn / Colossus live basic max of 28 vs formula 30 is an
   existing override, not a plan bug.

---

## 7. Diff summary (everything that moved)

| Change | Kind |
|---|---|
| Incoming hit chance now follows current defence / magic (Super defence 118 lowers chance; drains raise it). At defence 99, numbers match the baseline. | **4.4 intended** |
| Widow + full Gorehorn set at low HP: player max 30 → 56, matching every other fight. | **4.3 bug fix** |
| Knight, Gorehorn, Colossus prayer drain 1/6 ticks → 1/2 ticks. | **4.1/4.2 bug fix** (wrong `\|\| 6` fallback) |
| Duel prayer drain 3/tick → 1 every 2 ticks. | **4.1/4.2 bug fix** (required for identical drain; large feel change) |
| Food / prayer / Super restore can be consumed at full. Amounts unchanged. | **4.5 clear bug** vs the desired always-consumable rule |
| Raid hyphenated xbows (`worn-xbow`, `tempered-xbow`, `hollowbolt-xbow`) now have explicit `speed: 4` (same as the previous fallback). | documentation / 4.3 completeness; **no number change** |

Nothing else in the player or incoming tables moved.

---

## 8. How to re-run the lock

```sh
./scripts/qa.sh
# equivalent: node --test tests/combat.test.js
```

The test asserts the HP-99 table, Gorehorn-set max 56 at HP 10 on every boss
(including Widow), prayer drain of 10 points over 20 ticks, Super defence
118 lowering Jad's ranged chance to the locked 93.655%, drained defence 80
raising it to 95.568%, and that `rune_crossbow` speed is 4 (changing it by 1
fails the lock).
