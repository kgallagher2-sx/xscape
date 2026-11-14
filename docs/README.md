# Xscape plans and docs

For the release-wide picture — vision, milestones M0–M5, dependencies, and how we work — start at the **[release roadmap](ROADMAP.md)**. This index remains the catalog of individual plans and the consolidated [open decisions for Kellen](#open-decisions-for-kellen). When it is time to execute a plan item, open the linked doc from here or from the roadmap — do not hunt around the tree.

Plans live in [`docs/plans/`](plans/). Reference docs that bots and release steps use stay at the repo root (they are listed below). Historic paths such as `XSCAPE_FIX_PLAN.md` at the root are short stubs that point here.

**Do not delete or rewrite Kellen's decisions.** If a task is finished, mark **Status** and keep the original Do / Done when / Verify text.

---

## Recommended execution order

1. **Fix plan follow-ups F1, F7, and F10 first** ([`plans/XSCAPE_FIX_PLAN.md`](plans/XSCAPE_FIX_PLAN.md) — F1 closes the `merge_local_save` mint path, F7 is targeting / auto-retaliate, F10 is the late-fight consumable flush).
2. **The rest of F2–F9**, plus leftover review findings on items already marked Done but 🟡/❌ (especially 1.2, 4.7, 6.3). Re-check against `main` before starting; the 12 Nov review is the status snapshot in that doc.
3. **Remaining fix-plan phases 5, 7, and 0** — group raid / duel sync (5.1–5.2), the Jad → Magmor / Kree → Vaelkor / Armadyl → Stormwing renames (7.1–7.6, including 7.5b), and the skipped staging foundations (0.1–0.4) needed for some Verify steps.
4. **Boss mechanics** ([`plans/BOSS_MECHANICS_PLAN.md`](plans/BOSS_MECHANICS_PLAN.md)) — B1 arena engine, then a B9 feedback pass, Widow as the pilot (B2, including Kellen's 13 Nov B2.4), Colossus (B5), Knight and Gorehorn (B3–B4, including B3.4), then B6 / B7 / B8 once their open decisions are answered.
5. **IDEAS items** ([`plans/IDEAS.md`](plans/IDEAS.md)) only once an idea has been written into a plan with Do / Done when / Verify. Until then they stay in the brainstorm log.

Phase 4.5 of the fix plan is an audit that is **blocked on Kellen** (FIX-4.5-*). Do not change those numbers until he answers.

---

## Document catalog

| Doc | Purpose | Status | Owner | What's next |
|---|---|---|---|---|
| [ROADMAP.md](ROADMAP.md) | Top-level release overview: vision, milestones M0–M5, mermaid dependency flow, parallel tracks, and how we work. | Living overview. Does not change existing decisions. | Kellen (direction); Gameboy maintains the doc. | Current front is M0 (F1, F7, F10 first). Confirm or cut the M3 launch set when ready. |
| [plans/XSCAPE_FIX_PLAN.md](plans/XSCAPE_FIX_PLAN.md) | Bug / economy / combat / scenes / performance / rename work. Kellen's 12 Nov review and follow-ups **F1–F10**. Each task has Do / Done when / Verify. | In progress. Many Phase 1–6 items shipped; F1–F10 and phases 5, 7, 0 are still open. 4.5 waiting on Kellen. | Gameboy leads execution; Kellen signs off on balance and policy. | F1, F7, F10, then remaining F-items and phases 5 / 7 / 0. |
| [plans/BOSS_MECHANICS_PLAN.md](plans/BOSS_MECHANICS_PLAN.md) | 9×9 arena engine and boss reworks. Includes Kellen's 13 Nov decisions: **B2.4** (Widow), **B3.4** (Knight-King minions), **B6.1** (Vaelkor redesign). Planning only until the bug-fix run reaches this step. | Not started in code. Several design decisions already recorded. | Boss Mechanics; Kellen signs off on feel and numbers through Gameboy. | After the fix-plan steps above: B1 → B9 → B2 → B5 → B3/B4 → B6/B7/B8. |
| [plans/RAID_DESIGN.md](plans/RAID_DESIGN.md) | Gloamhold raid design, rooms, Morvane phases, loot, and shipped live-balance notes. | Mostly shipped as a first-class hub scene. Early TODOs RAID-T2–T4 are done; RAID-T1 should be re-checked. Later room/arena work is **B8**. | Raid / Gameboy for glue; Boss Mechanics for encounter feel. | Re-check RAID-T1; any 9×9 or room-size change waits on B8. |
| [plans/IDEAS.md](plans/IDEAS.md) | Future-game brainstorm and Kellen's 12 Nov decisions log (The Deep, open world, economy, Mining, and the ideas he liked). | Brainstorm. Not an execution plan. | Kellen (direction); Gameboy to turn picked ideas into plans. | Leave until an item is specified as a plan. |
| [plans/appendices/COMBAT_RULES_DIFF.md](plans/appendices/COMBAT_RULES_DIFF.md) | Appendix to fix-plan Phase 4. Baseline, shipped 4.1–4.6 diffs, and the 4.5 potion/food audit. | Audit shipped. §6 open questions are FIX-4.5-a–g. | Combat / Gameboy. | Wait on Kellen, then apply only what he approves. |
| [plans/appendices/REWARD_RPC_AUDIT.md](plans/appendices/REWARD_RPC_AUDIT.md) | Appendix to fix-plan F1 / 1.9. Reward RPC and SECURITY DEFINER audit. | Batch reds mostly closed; leftover reds and larger holes remain. | Gameboy / backend. | F1 (drop `merge_local_save`); then RPC-* items as Kellen and the bug run allow. |
| [plans/proposals/MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) | Spell-based magic proposal (copied from `/workspace/xscape-mechanics/` so it lives with the plans). | **Proposal only — not approved.** Do not implement until Kellen signs off through Gameboy. | Needs Kellen through Gameboy. Related: BOSS-B3.4-spell. | Answer MAGIC-Q1–Q4, then a real plan with Do / Verify if approved. |
| [plans/ANIMATION_PLAN.md](plans/ANIMATION_PLAN.md) | Attack and movement animations for the player, all bosses and minions. Includes the art pipeline decision frame (3D-to-sprite vs layered 2D, ANIM-ART). | Planning only. Starts with the ANIM-0 audit; boss animations follow the boss mechanics order. | Item & Character Design (art) with Gameboy (hook-up). | ANIM-0 and ANIM-ART-0 audits; answer ANIM-Q1, ANIM-Q2, ANIM-Q3. |

### Reference (stay at repo root)

These are operational reference, not execution plans. They were **not** moved: scripts, `OWNERS.md`, `CLAIM.md`, and day-to-day bot workflow still use the root paths.

| Doc | Purpose | Status | Owner | What's next |
|---|---|---|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Code map, save/cloud, stamp/release survey, wider refactor ideas (including seeded `simulate()`). | Reference. Some “next” work is already pulled into the fix or boss plans. | Code Architect / Gameboy. | Use as a map; don't treat leftover refactor ideas as the current bug run. |
| [BACKEND.md](../BACKEND.md) | Supabase, auth, RPCs, cloud login. | Reference. | Gameboy / backend. | Consult when touching RPCs or auth. |
| [CLAIM.md](../CLAIM.md) | File-claim protocol before edits. | Live process. | All bots. | Add a line before editing; remove it in the same finishing push. |
| [OWNERS.md](../OWNERS.md) | Who owns which files; sign-off rules. | Live process. | Code Architect maintains the file; owners as listed. | Coordinate before editing a claimed path. |
| [RELEASE.md](../RELEASE.md) | Stamp, `version.json`, Pages confirm. | Live process. | Gameboy. | Follow on every client ship. |

A root [PLANS.md](../PLANS.md) also points at the [roadmap](ROADMAP.md) first, then this index.

### External (not copied, except the magic proposal)

`/workspace/xscape-mechanics/` also has `MECHANICS_BIBLE.md` (implemented-mechanics audit at an older revision) and other proposals (boss weakness, Gloamhold loot, Knight-King damage). Those were **not** brought in: they are not approved execution plans, and several are superseded by the boss plan or by later live code. Link them from a future plan if Kellen picks one up.

---

## Open decisions for Kellen

Pulled from the docs above. IDs are stable; use them in chat and in commits. **Resolved** items stay listed so nothing looks “lost.” Count of **open** items: **29** (25 in approved or in-progress plans, plus 4 on the unapproved magic proposal).

### Fix plan — policy

| ID | Status | Decision | Source |
|---|---|---|---|
| FIX-Q1 | Done | Widow “red dart” was melee-from-range (fixed by 4.8). Her intended ranged attack is a boss-mechanics change. | [Fix plan, Open questions](plans/XSCAPE_FIX_PLAN.md#open-questions-for-kellen) |
| FIX-Q2 | Done (Kellen, Nov 12) | Leaving mid-fight (3.1): no loot, no kill, no death penalty. | Same |
| FIX-Q3 | Done (Kellen, Nov 12) | Weapon ranges (4.7): wands and crossbows 5 tiles, 2-handed staves and bows 7; melee 1, halberd 2. | Same |
| FIX-Q4 | Done (Kellen, Nov 13) | Existing dupes (1.5, 1.2): leave them alone, it's pre-launch. | Same |
| FIX-Q5 | Done (Kellen, Nov 13) | Legacy imports (1.4): retire local saves. Every guest gets a real server account (unique ID, server-authoritative like signed-in players); after the Magmor hook, prompt to upgrade the same account with email / Sign in with Apple / Google, keeping all progress. See GUEST-1. | Same |

### Fix plan — 4.5 combat / supplies (audit done, numbers not changed)

Full write-up: [COMBAT_RULES_DIFF.md §6](plans/appendices/COMBAT_RULES_DIFF.md).

| ID | Status | Decision | Source |
|---|---|---|---|
| FIX-4.5-a | Done (Kellen, Nov 13) | Gloam brew Defence: cap it. Base the boost on the normal (unboosted) level so re-sips top back up instead of stacking (99 gives 120). Formula is level-relative so it carries over to LEVEL-REDO. | Appendix §6 item 2; fix plan 4.5 |
| FIX-4.5-b | Done (Kellen, Nov 13) | Raid Gloam heal: base it on the fighter's real Hitpoints level, not a hardcoded 99 (no change today; fits LEVEL-REDO). | Appendix §6 item 3 |
| FIX-4.5-c | Moot (Kellen, Nov 13) | Duel Arena is being hidden (too close to OSRS); see PVP-1. |
| FIX-4.5-d | Moot (Kellen, Nov 13) | Duel Arena is being hidden (too close to OSRS); see PVP-1. |
| FIX-4.5-e | Done (Kellen, Nov 13) | One combat system for everything: all hits, including boss specials, use the shared accuracy/Defence formula (npcHitChance etc.). Every special attack must explicitly spec what's special about it (ignores Defence, ignores prayer, drains Defence, typeless, etc.); anything unspecified follows the normal rules. Apply to Warden / Morvane / shade and every special in the boss plan. |
| FIX-4.5-f | Done (Kellen, Nov 13) | One stat entry per monster (single source of truth); formula wins unless the boss plan deliberately overrides; exact numbers settled in the B9 balance pass. |
| FIX-4.5-g | Done (Kellen, Nov 13) | One stat entry per monster (single source of truth); formula wins unless the boss plan deliberately overrides; exact numbers settled in the B9 balance pass. |

### Reward RPC audit — larger holes

| ID | Status | Decision | Source |
|---|---|---|---|
| RPC-1 | Done (Kellen, Nov 13) | Remove the legacy world-boss kill path (kill RPC with no start row) before launch; every kill must come from a server-started fight. Pairs with F5. | [REWARD_RPC_AUDIT.md](plans/appendices/REWARD_RPC_AUDIT.md) |
| RPC-2 | Done (Kellen, Nov 13) | Server computes the Magmor (Jad) best score from the fight it timed (start_boss_fight row); ignore the client p_score. | Same |
| RPC-3 | Done (Kellen, Nov 13) | Add a few-second server cooldown between accepted trades (trade_accept) to slow trade bots. | Same |
| RPC-4 | Done (Kellen, Nov 13) | Superseded by NET-1: raids (and PvP) will be server-run, so no client reports deaths. Until then the host stays the source of truth. | Same |
| RPC-5 | Done (Kellen, Nov 13) | Replace the hard-coded admin UUID with assignable account roles before launch. See ROLES-1. | Same |

### Boss mechanics

| ID | Status | Decision | Source |
|---|---|---|---|
| BOSS-B1.4 | Done (Kellen, Nov 13, revised) | ONE camera system game-wide: a flat 2D camera that follows the player but clamps at the edges of the current area. A scene that fits the screen never scrolls (whole room in view, like today's boss rooms); in larger areas and the open world it keeps the player centered except near edges. Design rule: boss rooms are sized to fit a phone screen. Never 3D or rotating; 2D pixel art; characters turn to face their target. M1 foundation (CAMERA-1). | [Boss plan, Open decisions](plans/BOSS_MECHANICS_PLAN.md#open-decisions) |
| BOSS-B6-arena | Done (Kellen, Nov 13) | Vaelkor moves to the shared arena engine. 'Flying' is only a targeting flag (no special flight code). Normal state: flying, so melee can NEVER hit him; ranged and magic can. Below 75%: 'flies higher' = untargetable by every style; player must kill the 3 minions; then he returns to normal flying (ranged/magic only) at the HP he left at. | [Boss plan](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B7-lane | Done (Kellen, Nov 13) | Magmor gets a real room on the shared arena engine (trial fight teaches the same movement as everywhere else). | [Boss plan](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B8-rooms | Done (Kellen, Nov 13) | Gloamhold raid rooms move onto the shared arena engine (raids are boss fights in sequence); done with the NET-1 server work. | [Boss plan](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B9-bands | Done (Kellen, Nov 13) | Target kill time 2-4 minutes in the boss's intended gear. No best-in-slot rule (BiS will change over time). Raid room targets follow the same intended-gear rule. Tested in the balance pass. | Same |
| BOSS-B3.4-spell | Folded into MAGIC-BOOK (Nov 13) | Multi-target spell for the six spectral knights gets designed in the spellbook session. | [B3.4](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B6.1-info | Done (Kellen, Nov 13) | Write Vaelkor's info page from the decided mechanics (flying: melee can't reach; at 75% flies out of reach and summons 3 minions; whirlwinds; returns when they die). | See plan |
| BOSS-B6.1-hp | Done (Kellen, Nov 13) | Minion HP 75 for now; tune in the balance pass. Max hit 18. | See plan |

### Magic proposal (not approved)

| ID | Status | Decision | Source |
|---|---|---|---|
| MAGIC-Q1 | Done (Kellen, Nov 13) | Runes come from inventory stacks you bring into the fight (not the bank). | [MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) |
| MAGIC-Q2 | Done (Kellen, Nov 13) | Nightfall staff is a rune-CHARGED weapon: runes are loaded in as charges, its built-in attack works like any weapon (no spell selection), recharge with runes. Numbers in the balance pass. | [MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) |
| MAGIC-Q3 | Done (Kellen, Nov 13) | Folded into MAGIC-BOOK (staff gating and the Ashen staff get decided with the full spellbook). | [MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) |
| MAGIC-Q4 | Done (Kellen, Nov 13) | Folded into MAGIC-BOOK (out-of-runes behaviour decided with the full spellbook). | [MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) |

### IDEAS (direction already recorded; numbers not)

| ID | Status | Decision | Source |
|---|---|---|---|
| IDEAS-ECON | Done (Kellen, Nov 13) | Cut raw GP from boss drops by about half and add gold sinks; exact numbers in the economy pass. | See plan |

---

## Combining notes

Nothing in Kellen's decision text was deleted. Overlap was handled by **moving** supporting audits next to the plan they feed, not by merging files together:

- `docs/COMBAT_RULES_DIFF.md` → `docs/plans/appendices/COMBAT_RULES_DIFF.md`, pointed from fix plan 4.5.
- `docs/REWARD_RPC_AUDIT.md` → `docs/plans/appendices/REWARD_RPC_AUDIT.md`, pointed from F1 / 1.9.
- The magic proposal was copied into `docs/plans/proposals/` (still marked not approved).
- Root and `docs/` stubs keep old links (including the comment in `supabase/20261112_08_phase1_1_9_reject_anonymous.sql`) resolvable without editing applied migrations.


Animation-plan open decisions **ANIM-Q1**, **ANIM-Q2**, and **ANIM-Q3** live in the [animation plan](plans/ANIMATION_PLAN.md) and are sequenced in the [roadmap](ROADMAP.md#m1-foundations).


## GUEST-1 Server-side guest accounts (Kellen, Nov 13, 2026; App Store mindset)
- Every guest gets a unique server account on first launch (e.g. Supabase anonymous sign-in), not a phone/browser-only save. App Store builds won't have browser cookies to rely on.
- Guests play through the server exactly like real players (same RPCs, GP and items server-side). Guest mode exists only to cut sign-up friction.
- After Magmor hooks them, prompt to convert the guest into a full account (email, Sign in with Apple, Google) by linking the identity to the same user id, so nothing is lost.
- Build note: several RPCs reject anonymous users today (1.9, supabase/20261112_08_phase1_1_9_reject_anonymous.sql). Trial accounts must be allowed through the Magmor path (start_boss_fight, record_jad_kill, saves) and blocked server-side from post-trial content until converted.
- Replaces today's rule "guests aren't stored in the cloud" once built. Old local saves stop being importable.
- Naming (Kellen, Nov 13): call it a TRIAL, not a guest. The trial ends when the player beats Magmor and gets the Fire cape. They then either stop, or sign in / sign up (Google, Apple, email) on the same account to unlock the rest of the game. GUEST-Q1 resolved: trial = Magmor only.
- Open: GUEST-Q2 resolved (Kellen, Nov 13): delete unconverted trial accounts after 30 days with no play; the phone stores only the login/session token (no game data), so the same account resumes until then. GUEST-Q3 resolved: reinstalling or switching phones loses an unconverted trial; the Fire cape screen says sign up to keep your progress.


## LEVEL-REDO Leveling system redo (Kellen, Nov 13, 2026; needs a design session)
- Today every account starts at 99 in Attack, Strength, Defence, etc. Kellen expects to redo leveling (design direction: WoW-style leveling with a small grind), and isn't sure the 1-99 scale will stay.
- Every level-based number (potion and brew boosts like FIX-4.5-a, the raid heal hardcoded to 99 HP in FIX-4.5-b, accuracy and max-hit formulas, gear requirements, boss tuning) must be rechecked when this lands. Write formulas relative to the player's level, never hardcode 99.
- Placement: decide in the roadmap before M2 boss tuning and the M3 economy pass.


## PVP-1 Duel Arena hidden; new PvP before launch (Kellen, Nov 13, 2026)
- Hide the Duel Arena now (too similar to OSRS). Don't delete its code yet.
- Keep the Duel Arena itself (the area/building); it will be repurposed for the new PvP content. (Correction, Kellen Nov 13: he meant the arena, not jewelry.)
- Earmark: design and build our own PvP (and possibly staking) content BEFORE launch. Belongs in roadmap M3. Needs a design session.


## NET-1 Server-run multiplayer (Kellen, Nov 13, 2026) - REVISIT BEFORE BUILDING
- Direction: raids and PvP run on our own game server (authoritative tick loop). Phones send inputs only and draw what the server says. No player's client can cheat the result, and host lag no longer affects the party.
- Replaces the Phase 5 approach (leader's phone simulates the fight) in XSCAPE_FIX_PLAN.md. Phase 5 bug fixes only matter if we ship before NET-1.
- Likely shape: a small Node game server (e.g. Fly.io) sharing combat code with the client; Supabase stays for accounts, saves, GP/items and loot.
- Long-term goal (Kellen, Nov 13): EVERYTHING lives on the server (Path B): fully cheat-proof, phones are never a bottleneck, and we can diagnose any problem because all game state and logs are server-side. Path A is only a possible staging step on the way.
- Open paths, write both and decide at the server planning session:
  - Path A: server runs raids + PvP only; solo bosses stay on the phone with today's server checks (timed fights, server-rolled loot). Cheaper, works on weaker connections.
  - Path B: server runs all combat, solo too. Fully cheat-proof; more hosting cost; every fight needs a connection.
- Caveats to settle then: hosting cost grows with players (~$10-50/mo at start, Kellen OK with that); scaling plan; region/latency; disconnect and reconnect rules; fallback if the server is down.
- Placement: roadmap M1 foundations (shared combat engine with B1), needed before the new PvP (PVP-1) and before the raid redesign ships.


## ROLES-1 Admin and moderator roles (Kellen, Nov 13, 2026)
- Server-side role table; roles are assigned to accounts (no hard-coded ids). Must be done before launch.
- Admin and moderator are DIFFERENT roles:
  - Admin: full control of the game (game settings and flags, account actions, all history tools, assigning roles).
  - Moderator: less power than admin but more than a player (e.g. mute a player, view chat/trade history for reports).
- Open for a later session: the exact permission list per role, mute/ban lengths, audit log of every mod/admin action, and how players report others.


## MAGIC-BOOK First complete spellbook (Kellen, Nov 13, 2026) - design session needed before magic is built (M1)
- Any spell can be cast with NO weapon; you only need the runes in your inventory. Staffs and wands boost magic, they are not required in general.
- Some higher-level spells may still require a tier 1/2/3 staff to cast; that gating gets defined per spell.
- Spells will go beyond combat (utility, travel, skilling, etc.).
- Deliverable: the full first spellbook. For every spell: name, purpose (combat or utility), level/unlock gate, staff requirement if any, rune cost, effect/max hit, targets (incl. the multi-target spell from BOSS-B3.4-spell), and out-of-runes behaviour.
- Replaces MAGIC_SYSTEM_PROPOSAL.md as the source of truth once written; absorbs MAGIC-Q3, MAGIC-Q4 and BOSS-B3.4-spell.

- ANIM-Q1 (Kellen, Nov 13): 2–4 frame pixel loops for launch; smoother animation is a post-launch improvement, not a launch requirement.


## TUTORIAL-1 Guided first Magmor fight (Kellen, Nov 13, 2026) - launch-critical
- Goal: the trial must hook players and teach everything needed to beat Magmor, so they convert to real accounts. UX must be incredible and intuitive.
- Today: bank walkthrough, then a challenge to kill Magmor, with no tips during the fight.
- Add in-fight guidance during the first trial fight (contextual, shown at the moment it matters):
  - Prayer: prompt to turn on the right protection prayer, and teach the visual tell the boss gives before each attack style.
  - Low HP: highlight the food (e.g. shark) on the quick bar and prompt to eat.
  - Potions: explain what each potion does, highlighted when useful.
  - Healers: when they spawn, alert that they heal Magmor and must be killed or pulled away (aggroed).
  - Other mechanics Magmor has, each taught the first time it appears.
- Must respect the standing UI rules (no overhead names, no floating narration callouts, no labels on boss buttons): design tips as a tutorial layer (e.g. highlights, short coach cards) and confirm the style with Kellen.
- Decided (Kellen, Nov 13): the fight PAUSES for tutorial tips. Server-run works: solo fight, so the client asks the server to hold the tick loop; boss freezes; resumes on tap. Only in solo tutorial fights, never in raids/PvP. The server timer used for kill checks and scores excludes paused time.
- Decided: no death explanation screen.
- Decided (Kellen, Nov 13, revised): tips keep playing on every attempt until the player's FIRST Magmor kill / Fire cape, then stop for good (so a death before e.g. healers doesn't skip later lessons). No replay setting; afterwards players use the boss info button next to the boss at selection.
- Decided (Kellen, Nov 13): tip style = while paused, dim the screen slightly, spotlight the thing being taught (prayer button, food, healer, boss tell), and show a short tip bubble anchored next to it; tap to resume. Floating tips are an approved exception to the no-floating-narration rule ONLY while the fight is paused in the tutorial.
- Decided (revised): keep a skip button so players who already know the fight can turn the tips off before their first kill.
- Placement: M3 launch content, built alongside the Magmor arena move (BOSS-B7) and the trial flow (GUEST-1).


## RELIC-DESIGN (design session, Kellen, Nov 14, 2026)
- Source: relics drop ONLY in The Deep.
- Slots: start with 1; 2nd and 3rd unlock through progression, tied to the LEVEL-REDO system (exact unlock points decided there). Max 3 equipped.
- Tiers, no upgrading: deeper floors unlock higher tiers and chances scale with depth (example numbers, final in balance pass):
  - Tier 1: floors 1-19 scale 1%->10%, capped at 10% after floor 20.
  - Tier 2: floors 20-39 scale 1%->10%, capped at 10% from 40.
  - Tier 3: floor 40+ scaling up; tiers 1 and 2 stay at their 10% caps.
- A higher tier is a stronger version of the same relic (e.g. Tier 2 Ember Heart burns longer/harder).
- Relics change how you play rather than adding raw stats, and work everywhere.
- Relics are untradeable. Duplicates can be stored in the bank or sold to a Relic trader NPC at the entrance of The Deep.
- Death in The Deep: you lose EVERYTHING you carried, including equipped relics. Only banked relics are safe. The Relic trader lets you buy back your GEAR only, for a price (number in economy pass); inventory items and relics cannot be bought back.
- Launch relic list (draft approved as a starting point, Kellen Nov 14; numbers are placeholders for the balance pass; Tier 1/2/3):
  - Offense: Ember Heart (first hit burns 3/5/8 per tick for 5 ticks); Twin Fang (every 6th/5th/4th attack hits twice); Blood Price (+10/15/20% damage below half HP).
  - Survival: Hollow Crown (once per fight, a killing hit leaves you at 1/10/25 HP); Stone Skin (after 3 ticks without damage, next hit -20/35/50%); Leech Ring (heal 3/5/8% of damage dealt).
  - Utility: Gale Feather (2-tile movement for 3/4/5 s after dodging a special); Prayer Bead (prayer drains 15/25/35% slower); Deep Lantern (reveals ore veins and trap tiles; Tier 3 also stairs).
  - Each relic lists exactly what it changes; everything else follows normal combat rules.
- Status: RELIC-DESIGN done enough to plan The Deep. Remaining open: the "per what" of spawn rates (per floor, chest or boss), decided when The Deep is planned.

## DEEP-DESIGN (design session, Kellen, Nov 14, 2026)
- Floors: regular monster rooms (screen-sized, with ore veins), a boss floor every 10, a camp floor every 10 (Kellen, revised).
- NO bank floors or bank chests in the Deep. Banking and resupply mid-run go through companion favor (spend favor to send loot home or bring supplies).
- Camp floors (Kellen, Nov 14): FINAL contents are the supply tent, one tier chest, and the exit ladder. Nothing else.
- Death: lose everything (see RELIC-DESIGN); IDEAS.md "death keeps part of loot" is superseded.
- Exits: each camp floor has a ladder straight to the top of the Deep; leaving that way keeps everything you carry. Between camps, only companion favor gets loot home.
- Every dive starts at floor 1. Future idea: quests that unlock starting from deeper floors.
- Camp placement: one camp on a RANDOM floor within each block of 10 floors. Camps are "raided" for a small amount of supplies (a little food, maybe a potion) and hold the exit ladder.
- Boss floors always spawn an exit ladder after the boss dies, so there are 2 exits per 10 floors (boss + random camp).
- Boons (working name): NOT picked from cards. Each Deep boss carries one boon; defeating the boss transfers it to you for the rest of that dive. Boons are temporary run perks (like a potion boost lasting the dive), lost when you leave or die. Only bosses grant them.
- A boss's boon is hidden until you defeat it (surprise reveal on kill).
- Deep bosses: The Deep has its OWN new bosses from launch (not reused Magmor/Vaelkor/raid bosses). Needs a DEEP-BOSSES design session.
- Deep bosses = one boss per relic (9 at launch, matching the launch relic list). Each boss has its relic attached and uses it against you (e.g. the Ember Heart boss burns you; the Hollow Crown boss survives one killing hit). New relics later bring new bosses.
- REVISED relic sources (Kellen, Nov 14): relics must be RARE (a weeks-long goal, never 3 best relics in a day).
  - Lore: relics are ancient artifacts people hid at their camps; you find them there.
  - Floor types: (1) regular floors: mining-focused with ore veins and a few easy "annoyance" monsters; (2) camp floors (one random floor per 10): a tent to search for small supplies (e.g. 2 sharks, maybe 1 dose of prayer potion if lucky), ONE tier chest, and the exit ladder; (3) boss floors (relic bosses, exit ladder after the kill).
  - One tier chest per 10 floors, on the camp floor. The chest's tier shows which relic tier it can roll; opening it rolls the relic chance.
  - Depth unlocks higher-tier chests and raises the chance a chest is higher tier, but never guarantees it (a deep chest can still be Tier 1).
  - Earlier "chest after every floor" line is superseded. Boss kill = one extra relic roll at that depth's rates (keep or revisit given rarity goal).
- CLARIFIED relic rolls (Kellen, Nov 14):
  - Camp chest: roll 1 decides the chest's tier (deeper = better odds of a higher tier). Then a single chance (max 10%) to get a relic OF THAT TIER. A Tier 3 chest can only give a Tier 3 relic; there is no separate relic-tier roll inside the chest.
  - Boss: its own relic drop at 5%. The relic's tier and which relic it is are based on the current floor depth, NOT the boss's theme. Replaces the earlier "boss = extra chest roll" line.
- Duo dives: yes, planned (after NET-1 game server). Friends depth leaderboard proposed.
- Anti-rush (Kellen, Nov 14): the ladder down on each regular floor is locked. Each ore mined or monster killed has a 25% chance to drop a key that unlocks it (about 4 actions per floor on average; tune in balance pass). Boss floors: the boss must die to continue (boss-wall CONFIRMED by Kellen, Nov 14).
- Ores (working names, Kellen Nov 14): copper/tin (1+), iron (5+), emberite (20+), voidstone (40+), plus COAL as the filler ore. Smelting = main ore + coal into ingots; Smithing turns ingots into pickaxes, woodcutting axes and other tools. Ore can also be sold to traders; later feeds infusions. Rarer ores need higher Mining level and better pickaxes (proposed).
- Smithing makes TOOLS ONLY at launch; combat gear stays from drops (smithed gear maybe later).
- Pickaxes: better pickaxes mine faster, and rare ores require a minimum pickaxe tier (e.g. iron pick for emberite, emberite pick for voidstone; exact gates in balance pass).
- Regular-floor monsters drop: the 25% key chance plus occasional coal or small gold.
- Inventory: normal inventory on dives; ore, food and loot compete for space; companion favor sends items home.
- Still open: DEEP-BOSSES session (9 relic bosses), all numbers (balance pass).
- Companion favor: companions do NOT follow you. Spend favor to call one; each call is one trip that brings requested supplies from your bank and takes chosen items back to the bank. Every call costs favor.
- Favor source (Kellen, Nov 14; approved Nov 12): favor is earned by helping companions on their Expeditions, not inside the Deep.
- Favor call cost (Kellen, Nov 14): scales with BOTH depth (deeper = pricier) and how many items the companion carries (each way). Exact numbers in balance pass.
- Friends leaderboard (Kellen, Nov 14): ranks friends by deepest floor ever reached, floor shown next to each name.

## DEEP-BOSSES (design session, Kellen, Nov 14, 2026)
- 9 new Deep bosses, one per launch relic; each uses its relic against the player.
- Boss pick: each boss floor rolls a RANDOM boss from the 9; it uses its relic at the tier for that depth (T1 floors 1-19, T2 20-39, T3 40+).
- No repeats: within one dive, a boss can't appear again until all 9 have appeared (shuffle-bag).
- Boss concepts (LOCKED by Kellen, Nov 14; names are working names):
  - Cinderling Matron (Ember Heart): first hit sets you burning; outheal the burn or end it fast.
  - Gnashjaw (Twin Fang): every Nth attack hits twice; count swings, pray/eat before the double.
  - The Bled King (Blood Price): hits harder below half HP; burst him through the last half.
  - Hollow Warden (Hollow Crown): survives one killing blow at low HP; save a special/burst for the second "death".
  - Granite Brute (Stone Skin): armor hardens after 3 ticks without taking damage; keep steady pressure.
  - Mire Leech (Leech Ring): heals off damage she deals; protect-pray and deny her healing.
  - Galewing (Gale Feather): dashes 2 tiles after her specials; track and reposition.
  - Chanter Below (Prayer Bead): prayer lasts much longer; switch attack styles around it.
  - Lantern Wraith (Deep Lantern): reveals and seeds trap tiles; watch the floor.
- Still open: each boss's attacks, specials, HP and numbers; boss art; boon strength numbers (balance pass).
- Boons (Kellen, Nov 14): each boss's hidden boon is a WEAKER version of its own relic, lasting the rest of the dive (lost on leaving or death). Still hidden until the kill.
- Boon stacking (Kellen, Nov 14): boons stack; you keep every boon earned in the dive until you leave or die.
- Boon + matching relic (Kellen, Nov 14): a boon ADDS to the same relic if equipped (e.g. Blood Price + Bled King boon add together) for the rest of the dive.
- Depth scaling (Kellen, Nov 14): each boss has a base stat line; HP and max hit rise every 10 floors, on top of its relic tier. Numbers in balance pass.
- Companion calls on boss floors (Kellen, Nov 14): allowed before engaging; NO calls once the boss fight starts.
- Boss drops (Kellen, Nov 14): besides the separate 5% relic chance, ore and a little gold, both scaling with depth (keeps gold hard). Numbers in balance pass.
- Difficulty (Kellen, Nov 14): Deep bosses are DEMI-BOSSES, easier than existing bosses (Magmor, Vaelkor, raids). Keep the mechanics; target kill time about 1 minute (main bosses stay 2-4 min).
- Cinderling Matron (LOCKED, Kellen, Nov 14): basic fire bolt (Magic, Protect from Magic blocks). Ember Heart: her first landed hit burns you 5 ticks at the depth's relic tier. Special every 5th attack: fire bomb on a tile that glows red 2 ticks before landing; step off to avoid. Below half HP: bomb tiles keep burning, so the room fills up; finish her fast. Tells are body glow and red tile, no text.
  - Animations: idle, fire bolt cast, body glow, bomb throw plus red tile telegraph, bomb land, burning tile loop, burn on player, hit, death.
- Gnashjaw (Kellen, Nov 14): melee bite (Protect from Melee); must walk up to bite. Twin Fang: every 6th attack bites twice, the second bite ignores prayer; jaw glows first (eat or step away). Special: 3-tile lunge along a line marked on the floor first; step out of the line. Below half HP: double bite every 4th attack.
  - Animations: walk, bite, jaw-glow wind-up, double bite, lunge line telegraph, lunge, hit, death.
- The Bled King (Blood Price): ranged blood darts (Protect from Missiles). Special every 5th attack: blood pool on 2 tiles that glow dark red 2 ticks first; standing in one drains HP. Blood Price: below half HP his body swells red and his hits deal more. He has no healing; burst him down.
  - Animations: idle, dart throw, pool cast plus tile telegraph, enraged swell (below half), hit, death.
- Hollow Warden (Hollow Crown): melee scythe sweep (Protect from Melee), alternating with a magic skull (Protect from Magic); weapon swap is the tell. Hollow Crown: the first killing blow leaves him at low HP while his crown flares and he kneels for 2 ticks, then rises; save a special for the second death. Special: a 3x3 shadow ring around him, telegraphed 2 ticks, step out.
  - Animations: idle, scythe sweep, skull cast, weapon swap, shadow ring telegraph, kneel and crown flare, rise, hit, death.
- Granite Brute (Stone Skin): slow, heavy melee slam (Protect from Melee). Stone Skin: after 3 ticks of taking no damage, stone plates cover him and the next hit he takes is reduced. Special: ground pound that cracks the floor in a cross shape, telegraphed 2 ticks.
  - Animations: walk, slam, stone-plates-forming, plates shatter on hit, ground pound plus cross telegraph, hit, death.
- Mire Leech (Leech Ring): magic sludge spit (Protect from Magic). Leech Ring: heals a share of damage she deals, shown as a green pulse back to her. Special: 2 leech pods that crawl toward you and heal her if they reach her side; tap them to kill them.
  - Animations: idle, spit, heal pulse, pod spawn, pod crawl, pod death, hit, death.
- Galewing (Gale Feather): ranged feather volley (Protect from Missiles). Special: wind gust pushes a row of tiles (telegraphed 2 ticks); after the special she dashes 2 tiles at a time for a few seconds, so you track her and reposition.
  - Animations: idle hover, volley, gust telegraph plus gust, dash, hit, death.
- Chanter Below (Prayer Bead): magic chant bolt (Protect from Magic). Prayer Bead: shows a glowing ward for one combat style; while it's up, that style deals much less damage, and the ward lasts much longer than normal. Switch styles around it. Special: a silencing note that drains your prayer points, telegraphed by a rising hum glow.
  - Animations: idle, chant cast, ward up (one look per style), ward fade, silencing note wind-up and cast, hit, death.
- Lantern Wraith (Deep Lantern): magic lantern flare (Protect from Magic). Deep Lantern: her lantern lights hidden trap tiles across the room for 2 ticks; she also seeds new trap tiles. Special: lantern goes dark and the room dims for a few ticks; only lit traps stay visible.
  - Animations: idle float, flare, lantern reveal pulse, trap seed, room dim and relight, trap trigger, hit, death.
- Animation rule (Kellen, Nov 14): every Deep boss tell, attack, special and phase change needs its own proper animation before it ships, in the style of the existing bosses. No text-based tells.
- Multi-target (Kellen, Nov 14): each of the 5 combat spells (Spark, Arc, Flare, Crest, Spire) has a 3x3 area version that hits ALL enemies in a 3x3 square. 10 combat spells total. Covers BOSS-B3.4-spell (six spectral knights). Area version cost/damage in balance pass.
- Utility spells at launch (Kellen, Nov 14): Home teleport (back to town; not usable in the Deep or mid-fight), Light (a buff lasting about 10 minutes that works like a small Deep Lantern), Superheat (smelt ore to an ingot on the spot). Bones to food: NO.
- Staff gating (Kellen, Nov 14): single-target combat spells and utility spells need NO staff. Only 3x3 area spells need one: tier 1 staff for Spark/Arc, tier 2 for Flare, tier 3 for Crest/Spire.
- Out of runes (Kellen, Nov 14; closes MAGIC-Q4): no attack, the spell chip flashes red, NO auto-fallback to a cheaper spell or melee. Player taps the chip to pick an affordable spell.
