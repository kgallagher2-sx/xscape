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
| FIX-4.5-f | Needs Kellen | Raid shade host `defLevel` 8 vs legacy table 5. Not unified. | Appendix §6 item 7 |
| FIX-4.5-g | Needs Kellen | Knight / Gorehorn / Colossus live basic max 28 vs formula 30 (existing override). | Appendix §6 item 8; also listed under 4.5 Status |

### Reward RPC audit — larger holes

| ID | Status | Decision | Source |
|---|---|---|---|
| RPC-1 | Needs Kellen (related work is F5) | Drop the world-boss legacy path (kill RPC with no start row) once almost every client calls `start_boss_fight`. | [REWARD_RPC_AUDIT.md](plans/appendices/REWARD_RPC_AUDIT.md) |
| RPC-2 | Needs Kellen | Cap or ignore `record_jad_kill` `p_score` for `jad_best_score`. | Same |
| RPC-3 | Needs Kellen | Optional short cooldown on `trade_accept` to slow trade-bot cycling. | Same |
| RPC-4 | Needs Kellen | `report_raid_deaths` can mark other party members dead (trusted client list). Later look, not a one-line fix. | Same |
| RPC-5 | Needs Kellen | Admin RPCs are allow-listed to a single UUID; a role table would be cleaner. | Same |

### Boss mechanics

| ID | Status | Decision | Source |
|---|---|---|---|
| BOSS-B1.4 | Needs Kellen | Camera, only if tiles are too small on 360 px phones. | [Boss plan, Open decisions](plans/BOSS_MECHANICS_PLAN.md#open-decisions) |
| BOSS-B6-arena | Needs Kellen | Vaelkor arena (B6). Phase redesign B6.1 is otherwise decided. | Same |
| BOSS-B7-lane | Needs Kellen | Magmor lane (B7). | Same |
| BOSS-B8-rooms | Needs Kellen | Gloamhold raid rooms (B8). | Same |
| BOSS-B9-bands | Needs Kellen | Per-boss target kill times and damage bands (B9). | Same |
| BOSS-B3.4-spell | Needs Kellen | Multi-target magic spell to support the six spectral knights. Needs a magic-system design (rune cost, targets, max hit) and sign-off. | [B3.4](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B6.1-info | Needs Kellen | Vaelkor info-page text for the redesign. | [B6.1](plans/BOSS_MECHANICS_PLAN.md) |
| BOSS-B6.1-hp | Needs Kellen | Minion HP “about 75” — confirm in a balance pass. Max hit 18 is already decided. | [B6.1](plans/BOSS_MECHANICS_PLAN.md) |

### Magic proposal (not approved)

| ID | Status | Decision | Source |
|---|---|---|---|
| MAGIC-Q1 | Needs Kellen | Inventory-slot rune stacks (recommended) vs consuming straight from the bank. | [MAGIC_SYSTEM_PROPOSAL.md](plans/proposals/MAGIC_SYSTEM_PROPOSAL.md) |
| MAGIC-Q2 | Needs Kellen | Nightfall as a powered built-in spell at base 38 (recommended) vs only autocasting Spire. | Same |
| MAGIC-Q3 | Needs Kellen | Adding the 400k Ashen staff so magic is not locked behind Widow. | Same |
| MAGIC-Q4 | Needs Kellen | Confirm no mid-fight auto-fallback when runes run out. | Same |

### IDEAS (direction already recorded; numbers not)

| ID | Status | Decision | Source |
|---|---|---|---|
| IDEAS-ECON | Needs Kellen | Cut raw GP from boss drops and add gold sinks. Direction decided 12 Nov; numbers need a balance pass and sign-off before anything ships. | [IDEAS.md, Economy](plans/IDEAS.md) |

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
