# Xscape animation plan

Status: **planning only** (Kellen, Nov 13, 2026). No code yet.

Kellen: "we need to add attack/movement animations for everything. Lots of bosses are missing animations. Even our player could have better animations."

Owner: Item & Character Design (art) with Gameboy (hook-up). Related: boss mechanics plan (new attacks need their own animation and tell) and BOSS B1.1 top-down arenas.

## ANIM-0 Audit (first step)
- **Do:** list every unit (player, all 8 bosses, all minions, Gloamhold monsters) and every action it has (idle, walk/run, each attack, special moves, hit, death, flying for Vaelkor). Mark each one as animated, static, or missing.
- **Done when:** the audit table is in this file.
- **Verify:** Kellen reviews the table.

## ANIM-1 Shared animation system
- **Do:** one sprite-animation helper (frames per action, ticks per frame, attack wind-up timed to the hit tick) used by every scene, instead of per-boss one-offs.
- **Done when:** the player and one boss use it.

## ANIM-2 Player
- **Do:** walk and run cycles, an attack animation per weapon style (melee stab/slash/crush, bow, crossbow, staff and wand cast), eat/drink, hit and death.

## ANIM-3 Bosses and minions
- **Do:** every attack and special move gets its own wind-up so it doubles as the visual tell for the prayer or dodge. Include the new boss plan mechanics: Vaelkor take-off, air phase and landing (B6.1), Widow web and spider burst (B2.4), Knight-King spectral knights (B3.4).
- **Order:** follow the boss mechanics plan order, so each boss is animated once, after its mechanics are final.

## Rules
- Original art only. No labels on boss buttons, no overhead names, no floating narration callouts.
- Must stay smooth on a phone (390x844).

## Open decisions for Kellen
- ANIM-Q1: frame budget/style (simple 2–4 frame pixel loops vs smoother).
- ANIM-Q2: do the player first, or bundle the player with the first boss pass?
