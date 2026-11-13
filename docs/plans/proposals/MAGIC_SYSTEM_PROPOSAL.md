# Magic system proposal

> **Status:** Proposal only — **not approved**. Copied unchanged (aside from this banner) from `/workspace/xscape-mechanics/MAGIC_SYSTEM_PROPOSAL.md` on 13 November 2026 so it can be referenced with the other plans. Do not implement until Kellen signs off through Gameboy. Open questions are **MAGIC-Q1** through **MAGIC-Q4** in the [plans index](../../README.md#open-decisions-for-kellen).

Proposal only. No code, SQL, or database was changed. Kellen signs off through Gameboy.

**Current PvM formula** (`combat.js:489-496`): `max = floor(weapon.magicBase × (1 + mdmg/100))`. Accuracy uses Magic level and `amagic`; max hit does not use Magic level. A Magic potion is +4 level (`stats.js:97-99`) and only helps accuracy. Everyone starts at 99 (`combat.js:212-213`).

**Proposed formula:** `max = floor(spellBase × (1 + mdmg/100))`. The spell is the base, the way bolts are the ranged base; the staff or wand adds `mdmg`, the way `rstr` boosts ammo. Weapons drop `magicBase`.

There are **no shop staffs today**. The only live magic weapon is the Widow Weaver wand (`magicBase` 30, `mdmg` 12, speed 5, 1h) plus the spellbook (`mdmg` 8). Bolts are not consumed. Bank already stacks every id (`parse_bank_items`, unique cap 200, copy cap 100,000). Inventory is 28 unstacked slots. Item ids must match live `ok_item_id`: `^[a-z0-9_]{2,40}$` (underscores, not hyphens). Supplies are bought with `buy_supply_item` (server-priced; qty currently capped at 28) and consumed client-side mid-fight; `save_player_state` writes the reduced inventory/bank on fight end / hub enter.

---

## 1. Spell list

v1 is one Ember line, five tiers, modelled on the OSRS fire line. Weaker elements (Gust / Brine / Loam) and a second “veil” spellbook (freeze / heal) are deferred — they are mostly cosmetic at a given tier, and effects need a later balance pass.

The game has a Magic skill, but every account is 99, so level requirements do not gate anyone today. They are recorded for fidelity and a future training mode. v1 gate: a staff or wand is equipped, and the runes are in inventory.

| Id | Name | Tier feel | Base | Magic lvl (flavour) | Runes / cast | Effect (v1) |
| --- | --- | --- | ---: | ---: | --- | --- |
| `ember_spark` | Ember spark | strike | 8 | 1 | 1 ember, 1 wisp | Damage only |
| `ember_arc` | Ember arc | bolt | 12 | 17 | 2 ember, 1 coil | Damage only |
| `ember_flare` | Ember flare | blast | 16 | 41 | 3 ember, 1 veil | Damage only |
| `ember_crest` | Ember crest | wave | 20 | 62 | 4 ember, 1 vein | Damage only |
| `ember_spire` | Ember spire | surge, this game’s top standard | **30** | 81 | 5 ember, 1 omen | Damage only |
| `nightfall` | Nightfall | powered, Nightfall staff only | **38** | — | 5 ember, 1 omen, 1 vein | Damage only |

`ember_spire` is 30, not OSRS surge’s 24, so the current Widow kit stays at 37: `floor(30 × 1.26) = 37`. See §4.

**Deferred:** other elements; a Veil book (a short freeze); a Heart book (heal 25% of damage dealt). None of those ship in v1.

---

## 2. Runes

Stackable supplies, `kind: "rune"`. Underscore ids.

| Id | Name | Shop price | Role |
| --- | ---: | ---: | --- |
| `ember_rune` | Ember rune | 20 | Element |
| `wisp_rune` | Wisp rune | 20 | Spark catalyst |
| `coil_rune` | Coil rune | 80 | Arc catalyst |
| `veil_rune` | Veil rune | 200 | Flare catalyst |
| `vein_rune` | Vein rune | 400 | Crest / Nightfall catalyst |
| `omen_rune` | Omen rune | 600 | Spire / Nightfall catalyst |

Deferred (not sold in v1): `gust_rune`, `brine_rune`, `loam_rune` at 15 each.

**Per-cast GP:** spark 40, arc 120, flare 260, crest 480, spire 700, Nightfall 1,100. A ~53-cast Widow trip on Spire is ~37k, about 10–25% of a 150–400k unique kill. A long raid (~200 casts of Nightfall) is ~220k against a 2–8M clear. Shop packs of 100 / 500 / 1,000. A 1,000 ember pack is 20k; a 500 omen pack is 300k.

**Stacking:** bank already stacks (one unique toward the 200 cap). Inventory should treat each rune type as **one of the 28 slots** with a quantity, storage still a `text[]` of one entry per copy (same as the bank). `buy_supply_item` must allow rune qty above 28 and add to an existing stack without burning more bag slots; overflow goes to the bank as it does today. You withdraw runes before a fight, the way you bring food.

**Fallback**, if the inventory-cap change is too much SQL: consume from the bank directly and skip withdrawing. Phone-friendly, less OSRS-like.

**Out of runes:** **no attack, and a clear message** (“Out of runes — Ember spire”). Do not swing, do not start the weapon cooldown, do not fall back to a cheaper spell or to melee. Auto-fallback would silently drop a 30-base spell to an 8-base spark mid-fight. The player taps the weapon (or the HUD spell chip) and picks a cheaper spell. Repeat the message at most every few ticks.

---

## 3. Weapon rework

Staffs and wands **never melee**. `style: "magic"`, and `playerStyle` treats `kind: "staff"` / `"wand"` as magic even after `magicBase` is removed. Out of runes, or with no spell selected: no attack, as in §2, plus “Choose a spell” and the selector opens if nothing is selected. On equip, default to the highest spell the weapon can cast (Nightfall if this is that staff, otherwise Spire).

| Weapon | Slot / speed | mdmg | amagic | Cast mode | Notes |
| --- | --- | ---: | ---: | --- | --- |
| **Ashen staff** (`ashen_staff`) — **new shop staff** | 2h, speed 5 | 0 | 20 | Autocast standard spells only | Gear shop, **400k**, via `buy_shop_item` / `shop_price`. Lets magic exist before Widow. No built-in spell. |
| **Widow Weaver wand** | 1h, speed 5 | 12 | 80 | Autocast standard spells | Drop `magicBase` 30. Book unchanged (`mdmg` 8, shield). |
| **Nightfall staff** | 2h, speed 5 | 20 | 95 | Built-in **Nightfall** (base 38), and can autocast standard spells | 2h sheds the book, as the loot proposal already assumed. Built-in spell is how the kit still hits 52. |

No other live magic weapons. Powered style is OSRS-faithful (a staff with its own spell, plus optional cheaper autocast).

---

## 4. Rebalance check

Formula used below: `floor(spellBase × (1 + mdmg/100))`. Widow robes are `mdmg` 6; book 8; wand 12; total kit **26**. Unsleeping vestments are hood 3 + top 4 + bottom 3 + staff 20 + charm 4 + ring 3 = **37** (GLOAMHOLD_LOOT_PROPOSAL.md §3).

| Kit | Spell / base | mdmg | Before (magicBase) | After | Flag |
| --- | --- | ---: | ---: | ---: | --- |
| Widow wand + book + robes | Spire 30 | 26 | `floor(30 × 1.26) = 37` | **37** | **Unchanged** |
| Widow wand + robes, no book | Spire 30 | 18 | 35 | 35 | Unchanged |
| Widow wand + book, no robes | Spire 30 | 20 | 36 | 36 | Unchanged |
| Widow wand only | Spire 30 | 12 | 33 | 33 | Unchanged |
| Ashen staff, no mage gear | Spire 30 | 0 | n/a | **30** | New, below Widow |
| Ashen staff + Widow robes + book (1h would be needed; staff is 2h so **no book**) | Spire 30 | 6 | n/a | 31 | New stepping stone |
| Nightfall staff + full Unsleeping set, built-in Nightfall 38 | 38 | 37 | Proposed `floor(38 × 1.37) = 52` | **52** | **Hits the tier-3 target** |
| Same kit, autocasting Spire 30 | 30 | 37 | n/a | 41 | Below 52; this is the conservation option |
| Nightfall staff alone, Nightfall 38 | 38 | 20 | n/a | 45 | Still above Widow 37 |
| Nightfall + Widow robes only (no book, 2h) | 38 | 26 | n/a | 47 | Mid overlap, fine |

Magic potion: no max-hit change, before or after.

**PvP flag:** `combatVsPlayer` (`combat.js:535-538`) does **not** use `magicBase`. It uses `maxHitFrom(magic level, mstr || amagic)`, so a Widow kit is about **38**, not 37. Propose duels use the same spell × mdmg formula. That is a small Widow duel change (38 → 37) and it is what lets Nightfall be 52 in the Arena too.

---

## 5. Autocast UI and state

- **State:** `Profile.autocast` = a spell id (`ember_spire`, `nightfall`, …).
- **Server:** persist in the existing `player_state.settings` JSON as `settings.autocast`. No new column. `save_player_state` already writes `settings`. Gameboy adds the field in `cloud.js` `localPayload` / `applyProfile` (same pattern as `quickSlots`).
- **UX (390×844):** a spell chip on the fight HUD (next to prayer) shows the current spell and a rune count. Tapping the chip, or tapping a worn staff/wand in the equipment overlay, opens a small grid: five standard cells, plus Nightfall when that staff is equipped. Each cell shows name, current max hit, rune icons, and grey-out if unaffordable. Changing spell is instant and saves with the next flush. Default on first equip: highest allowed spell.
- **Consumption:** deduct runes **on each cast attempt**, including misses, not on hit. Client-side, mid-fight, like sharks (`supplies.js` `consumeOne` → `markDirty` → `flushSave` on fight end and hub enter). Prefer inventory stacks; do not deduct if the attack is refused. Jad’s free kit does not include runes — magic in the Caves spends real runes.
- **Anti-cheat:** same trust model as food. GP and purchases stay server-only (`buy_supply_item`). There is no per-cast RPC. A client can skip deductions the same way it can skip eating a shark; do not make runes stricter than supplies. Optional later audit is out of scope.
- **Raid:** copy `autocast` onto each fighter at run start (`f.autocast`). Guests send it with their loadout. Host `rollPlayerHit` / `playerAttack` reads that field and deducts from that fighter’s brought rune stacks.

---

## 6. Touchpoints

| File | Function / hook | Change |
| --- | --- | --- |
| `combat.js` | `ITEMS`, `SHOP`, `playerStyle`, `combatVsMonster`, `combatVsPlayer` | Add spells table, rune items, Ashen staff, Nightfall staff; drop `magicBase`; max = spell × mdmg; style from `kind` staff/wand; duels use the same formula; shop row for the staff. |
| `combat.js` / new `spells.js` | helpers | `spellById`, `spellMaxHit(eq, spellId)`, `canCast`, `consumeRunes`, `defaultAutocast`. Prefer one module so bosses do not fork the math. |
| `supplies.js` | `PRICES`, `SHOP_ROWS`, `isSupplyId`, `registerItems`, shop qty, `flushSave` | Sell rune packs; stackable rune kind; consume helper used by combat. |
| `index.html` | `renderEquipmentOverlay`, fight HUD, Jad `fire` (`~4478`), gear shop, bank/inventory UI | Spell chip + selector grid; staff never melee; inventory stack display; `buy_shop_item` for Ashen staff; debug plate uses selected spell. Stay out of `showTitle` / `routeTitle`. |
| `widow.js` | `playerStyle`, `fireBolt` | Use shared `playerStyle`; call `canCast` / `consumeRunes` before the hit; do not key style off `magicBase`. |
| `kree.js`, Jad path, `knight.js`, `gorehorn.js`, `colossus.js` | `fireBolt` / player attack | Same `canCast` / `consumeRunes` hook when style is magic. |
| `raid.js` | `playerStyleFrom`, `rollPlayerHit`, `playerAttack`, `HOST_RAID_ITEMS` | Nightfall + vestment items; per-fighter `autocast`; refuse the attack when runes or a spell are missing; do not start `atkCd` on a refused cast. |
| `duel.js` | hit roll | Spell formula + rune consume; no melee on a staff. |
| `item-icons.js`, `sprites.js`, `lab-gear.js` | paint / held / kind | Staff vs wand anim already exists; rune icons from Item & Character Design. |
| `cloud.js` (**Gameboy**) | `localPayload`, `applyProfile` | Persist and restore `settings.autocast`. Do not edit until he takes it. Watch `confirmedFunds` so a mid-fight rune spend is not overwritten by a pending shop buy. |
| SQL | `is_supply_item`, `supply_price`, `supply_shop_id`, `buy_supply_item`, `shop_price`, `shop_bundle_ids` if needed | Add the six rune ids and prices; raise qty cap for rune packs; inventory unique-stack cap for `kind` rune. `ok_item_id` already allows these ids. `save_player_state` needs no new column if autocast lives in `settings`. Ashen staff is a gear-shop price, not a supply. |

---

## Open questions for Kellen

1. **MAGIC-Q1** Inventory-slot stacks (recommended) vs consuming straight from the bank (simpler SQL).
2. **MAGIC-Q2** Nightfall as a powered built-in spell at base 38 (recommended, keeps max 52) vs only autocasting Spire (full set would be 41, below the loot-proposal target).
3. **MAGIC-Q3** Adding the 400k Ashen staff so magic is not locked behind Widow.
4. **MAGIC-Q4** Confirm no mid-fight auto-fallback when runes run out.
