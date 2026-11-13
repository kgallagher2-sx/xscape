# Gloamhold — Raid Design

Plans index: [docs/README.md](../README.md). Some early TODOs below have since shipped; status is noted without deleting the original items.

A completely original raid for Xscape. No Jagex names, lore, or art.

## Pitch

Beneath a drowned moon sits **Gloamhold**, a sealed crypt-fortress of glass-black stone. Its master, **Morvane the Unsleeping**, was a war-priest who refused death and stitched his soul into the vault. The halls still answer him: tiles shift, prayers gutter out, and his crown changes with every strike. Adventurers come for the relics sealed with him. Almost none leave.

Starter gear makes a full clear nearly impossible — you can learn the rooms, maybe farm mid-tier pieces from earlier chests, but Morvane will outlast your supplies unless your flicks and steps are almost perfect. With vault-forged gear and clean execution, he is hard but fair.

## How to start

- Hub button **Gloamhold** on the title screen, or
- Open `raid.html`, or
- `index.html?test=raid` (and other `?test=raid-*` shortcuts)

Portrait phone layout, 0.6s ticks, protection prayers 1 / 2 / 3. Tap a floor tile to walk (one tile per tick). The crossbow fires on its own at your current target. Tap an add to switch targets. Eat and sip on the next tick and delay your next shot, same as the Jad fight.

## Rooms (in order)

1. **The Veil Gate** — Teaching room. A sequence of rune tiles lights up; step them in order (three rounds, longer each time). Meanwhile **gloom lances** mark your tile and land 2 ticks later. Finish the sequences to open the gate. Fail a round = a heavy hit and a retry of that round.
2. **Supply alcove** — Chest. Limited sharks / prayer pots.
3. **The Wailing Court** — Mini-boss **the Pale Warden** (mage / range prayer switches, 2-tick tells) plus **Cinder Shades** (melee). Shades must be killed; if they live too long they heal the Warden or explode on you. A mid-tier gear piece can roll from the chest here (the intended starter-gear upgrade path).
4. **Supply alcove** — Chest (sharks, a prayer pot, sometimes a brew).
5. **The Eclipse Corridor** — Dodge gauntlet, almost no DPS check. Waves of row / column / checker / single-safe-tile patterns with 2-tick (later 1-tick) marks. Survive every wave and step the exit sigil.
6. **Supply alcove** — Last chest (tighter, may include a ranging pot).
7. **The Hollow Throne** — Morvane, four phases.
8. **The Vault Chest** — Loot roll, then back to the hub with new gear unlocked.

A small map along the top of the arena shows your place in the raid. Dying offers **Retry room** (restores the snapshot from when you entered that room) or **Hub**. Loot still requires a Morvane kill.

## Morvane — phases

Boss id `morvane`. 720 HP. High defence. Readable pose + audio tells (violet lift = magic, shard throw = missiles, sword slam = melee). Color supports the pose; it is never the only tell.

| Phase | HP | Name | What happens |
|---|---|---|---|
| 1 | 720–504 (100–70%) | Twin Crowns | Mage / range swap. Attack speed 6 ticks, 3-tick telegraph. After each hit, a **gloomburst** marks your current tile and lands in 2 ticks. |
| 2 | 504–288 (70–40%) | Court of Shades | Speed 5, telegraph 2. Melee stomps join the mix. 2 shades every 16 ticks — kill them or they heal him / explode. Every 20 ticks a **crown sigil** lights; stand on it within 4 ticks or take Judgment. Standing still for 3 ticks triggers a stillness bolt (damage + prayer drain). |
| 3 | 288–108 (40–15%) | Nightfall | Speed 4, telegraph 2 (sometimes 1). Forced mage/range flicks every attack. Whole rows or columns go unsafe. A prayer-drain pulse every 8 ticks unless you are on the moon tile. Occasional **triple style** combo (mage → range → melee in tight windows). |
| 4 | 108–0 (15–0%) | The Eye Opens | Enrage. Speed 3, telegraph 1. More tiles unsafe. Stillness punished in 2 ticks. Column **eye beams** with a 1-tick dodge. Prayer drains faster. Short, tick-perfect, lethal if sloppy. |

## Combat and gear

Uses the shared item table and OSRS accuracy / max-hit math once that system is in the game. Until then the raid ships its own adapter with the same formulas and the same item ids, so drops plug into the hub gear view later.

- Player assumed 99 ranged / 99 defence / 99 prayer / 99 hp.
- **Starter (nerfed):** Worn crossbow, patched leather. Low range attack / strength. Fine against shades, poor against Morvane.
- **Mid-tier (early chests):** Tempered crossbow, duskhide pieces. Makes the throne room *possible* for a clean run.
- **Gloamhold uniques (final chest only):** clearly the best gear in the game.

See the item list in `raid.js` (`RAID_ITEMS`). Unique highlights:

- **Hollowbolt crossbow** (weapon) — best range attack / strength
- **Veilhide body / chaps / vambraces**
- **Unsleeping stole** (neck, prayer bonus)
- **Crownshard boots**
- **Gloamheart cape**

## Loot

**Final vault chest**

- Always: 2–8M GP (in-game only, never real money)
- 1 roll on the unique table:
  - 70% — mid-tier piece or a large GP splash (no unique)
  - 22% — one mid-tier guaranteed if you don't already have the set, else GP
  - 7% — one unique (weighted; Hollowbolt slightly rarer)
  - 1% — two uniques (or unique + mid if the table is thin)
- Unlocked items persist on the profile (`unlockedItems`, `gear`) and can be equipped in the hub gear view once that UI lands.

**Earlier chests**

- Fixed, limited supplies (never enough to face-tank the raid).
- Warden and corridor chests: a modest mid-tier gear chance (no uniques).

## Audio

Dark, tense procedural WebAudio in the same style as the Jad fight: lower, slower, more hollow. Distinct wind-up cues for mage / range / melee, a tile-mark tone, a sigil chime, and an enrage drone in phase 4.

## Debug

`window.Xscape.raid` (also `window.XscapeRaid`):

- `start()`, `skipToRoom(id)`, `skipToPhase(n)`, `godMode(on)`, `giveBestGear()`, `giveStarterGear()`, `openLoot()`, `killBoss()`, `win()`, `getState()`

Query flags: `?test=raid`, `raid-gate`, `raid-court`, `raid-corridor`, `raid-boss`, `raid-boss2`, `raid-boss3`, `raid-enrage`, `raid-loot`.

## Balance targets (first pass)

Simulated with a clean but not perfect player (occasional late prayer / one missed dodge per phase):

- Starter vs Morvane: very low clear rate (under 10% even for strong play; near 0% if sloppy). DPS is too low and supplies run out.
- Mid-tier: roughly 20–40% for clean play.
- Best uniques + clean execution: majority clears, still punishable by a bad enrage.

Numbers will be reported from the headless sim after implementation.

## Open TODOs

- **RAID-T1** (re-check before acting) — Wire to the shared tile-attack helper and item table once that worker lands; keep the same ids and formulas.
- **RAID-T2** — **Done** (as of Nov 2026 on `main`): Embed the raid in `index.html` as a first-class scene (first ship is `raid.html` plus a hub link, same origin / same profile).
- **RAID-T3** — **Done** (hub equipment sheet exists on `main`): Hub gear-equip UI if it is not in yet.
- **RAID-T4** — **Done** (`overlay-raid-tut` / `kellenscape-raid-brief-seen`): A short first-entry briefing card, then skip forever (like the Jad tutorial flag).

## Implementation notes (MECH_V13)

The raid uses the shared 5-tile, 1-row floor (`TILE.cols=5`, `TILE.rows=1`). Movement is left/right, one tile per tick (tap a tile, ◀ ▶, or A/D). Tile-targeted attacks follow the same Vorkath-style rule as the core game: the mark is locked when it is thrown, and you dodge by walking off before it lands.

Items register into the shared `ITEMS` / `LOADOUTS` / `MONSTERS` tables. Mid-tier chest pieces are the existing upgrade-tier gear. Gloamhold uniques (`hollowbolt_xbow`, `hollow_bolts`, `veilhide_*`, `crownshard_boots`, `unsleeping_stole`, `gloamheart_cape`) are the only items better than the upgrade loadout. Equipped gear is stored on `Profile.equipment`.

Morvane is balanced on the same arcade scale as Jad (Jad defence 60). Morvane has defence 90 and high ranged defence, so starter accuracy is poor and upgrade / unique gear is the intended clear path.

How to start: hub button **Gloamhold**, or `?test=raid` (also `raid-gate`, `raid-court`, `raid-corridor`, `raid-boss`, `raid-boss2`, `raid-boss3`, `raid-enrage`, `raid-loot`). Debug: `window.Xscape.raid`.


## Live balance (shipped)

- Floor: 5 tiles × 1 row. Step with ◀ ▶, A/D, or a tap on a tile. Move first, then hazards land.
- Morvane: 140 HP, defence 70, ranged defence 50 (same arcade scale as Jad at defence 60).
- Warden 60 HP, Cinder Shades 16 HP (cap 2).
- Phases by remaining HP: Twin Crowns (>55%), Court of Shades (28–55%), Nightfall (10–28%), The Eye Opens (≤10%).
- Start with 10 sharks and 6 prayer pots. Supply chests along the way. The last alcove also has a brew and a ranging pot.
- Unique (Gloamhold) + clean prayer/dodge play usually clears. Upgrade-tier gear can clear with tight execution. Starter gear is nearly impossible on the throne; the court is a harsh but possible farm.
- The vault chest always drops a Gloamhold unique (10% chance of a second) plus pretend GP. Mid-tier upgrade pieces can appear in earlier chests.
- Enter from the hub button **Gloamhold**, `raid.html`, or `?test=raid` (`raid-gate`, `raid-court`, `raid-corridor`, `raid-boss`, `raid-boss2`, `raid-boss3`, `raid-enrage`, `raid-loot`).
- Debug: `window.Xscape.raid` (or `window.XscapeRaid`) — `start`, `skipToRoom`, `skipToPhase`, `godMode`, `giveBestGear`, `giveStarter`, `giveMid`, `openLoot`, `killBoss`, `win`, `retryRoom`, `getState`, `simulate`.
