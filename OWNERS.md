# Xscape ownership map

Proposed. This is the working agreement between the bots that share this repo. It is not a GitHub `CODEOWNERS` enforcement file.

Coordinate with a file's owner before you edit it. Add a line to `CLAIM.md` first. If two owners share a path, talk to both.

## Rules

- Changes to balance or intended behavior (damage, speed, drops, mechanics) are not bugs. They need Kellen's sign-off through Gameboy before they ship.
- Any migration that changes GP, items, or drop odds needs Kellen's OK through Gameboy before it is applied.
- QA reports go only to Gameboy, who routes them.
- Every finished release goes to QA. QA reports PASS or FAIL to Gameboy before Kellen is told.
- Coordinate with a file's owner before editing it.

## Owners

### Gameboy • Lead Developer

Maps, bugs, vendors, features, `index.html` glue, `cloud.js`, and releases.

- `index.html` (page shell, host glue, HUD, equipment UI, profile I/O, Jad is hosted here — see note below)
- `cloud.js`
- `items-stack.js` (6.2 compact/expand at the save-wire boundary; in-memory lists stay arrays)
- `hub.js`
- `sw.js`, `scripts/stamp-build.sh`, `version.json`, `manifest.json`, `.nojekyll`
- `RELEASE.md`

**Proposed (not listed in the original brief, assigned to Gameboy as maps / vendors / features / site / cloud):**

- `supplies.js` (Oswin / provisioner)
- `trade.js`
- `duel.js`
- `raid.html` (standalone raid page shell; `raid.js` stays with Boss Mechanics)
- `privacy.html`, `terms.html`
- `BACKEND.md`
- `icons/` (PWA icons)
- `supabase/xscape_backend.sql`
- `supabase/cloud_save_revision.sql`
- `supabase/server_now.sql`
- `supabase/guest_limits.sql`
- `supabase/lock_server_gp.sql`
- `supabase/hub_online.sql`
- `supabase/chat_history.sql`
- `supabase/supply_trader.sql`
- `supabase/add_prayer_potion_price.sql`
- `supabase/add_antipoison.sql`
- `supabase/drop_buy_supply_rate_limit.sql`
- `supabase/bank_stack_all_items.sql`
- `supabase/20261112_10_phase6_6_2_stackable_counts.sql`
- `supabase/redose_potions_migrate.sql`
- `supabase/single_use_potions_migrate.sql`
- `supabase/player_trading.sql`
- `supabase/duel_arena_location.sql`
- `supabase/duel_forfeit_flag.sql`
- `supabase/duel_forfeit_winner.sql`
- `supabase/duel_item_escrow.sql`

Jad combat currently lives inside `index.html`. Gameboy owns that file. Boss Mechanics should still be asked before changing Jad phases, timings, or rewards.

### Boss Mechanics

Boss modules, `raid.js`, and Supabase SQL for boss and loot RPCs.

- `colossus.js`
- `gorehorn.js`
- `knight.js`
- `kree.js`
- `widow.js`
- `raid.js`
- `supabase/drowned_colossus.sql`
- `supabase/gorehorn_minotaur.sql`
- `supabase/knight_king.sql`
- `supabase/widow_queen.sql`
- `supabase/kree_gp_match_widow.sql`
- `supabase/solo_raid_loot.sql`
- `supabase/group_raid_loot.sql`
- `supabase/group_raid_runs.sql`
- `supabase/group_raid_score.sql`
- `supabase/record_jad_kill_idempotent.sql`
- `supabase/fix_record_jad_kill_bank.sql`
- `supabase/unique_set_complete_gp_bonus.sql`
- `supabase/alcove_mid_loot.sql` (proposed: alcove mid-tier loot RPC; coordinate with Gameboy, whose `alcove-cloud` branch started this work)

**Proposed:**

- `RAID_DESIGN.md`
- `supabase/unique_item_owners_rls.sql`
- `supabase/unique_blue_partyhat.sql`

Sprite files for these bosses belong to Item & Character Design, not this list.

### Item & Character Design

Gear, sprites, icons, lab, and animation.

- `sprites.js`
- `lab-gear.js`
- `item-icons.js`
- `lab.html`
- `colossus-sprites.js`
- `gorehorn-sprites.js`
- `knight-sprites.js`
- `kree-sprites.js`
- `raid-sprites.js`
- `widow-sprites.js`
- `partyhat-img.js`
- `whip-img.js`

**Proposed:**

- `partyhat.png` (source reference; the game paints from `partyhat-img.js`)

### QA Tester

Tests and QA tooling.

- `tests/` (when added)
- `scripts/qa.sh` (when added)
- `screens/` (manual QA shots; see `.gitignore` for untracked batches)
- `qa-output/` (local QA dumps, ignored)

### Code Architect

Shared engine extraction, tooling, and `ARCHITECTURE.md`.

- `ARCHITECTURE.md`
- `OWNERS.md`
- `CLAIM.md`
- `.gitignore`

**Proposed:**

- `stats.js` (player levels, boosts, drains — shared engine material)
- future extracted engine modules (`combat.js`, `tick.js`, and similar)

`scripts/stamp-build.sh` stays with Gameboy (releases). Architect may propose tooling changes through Gameboy.

## How to read “proposed”

Anything marked **Proposed** was not named in the original owner brief. It is assigned here from the real file list so every path has a first contact. If the assignment is wrong, Gameboy can move it.
