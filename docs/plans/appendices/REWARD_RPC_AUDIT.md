# Reward RPC and SECURITY DEFINER audit

Appendix to the [fix plan](../XSCAPE_FIX_PLAN.md) F1 / 1.9. Outstanding reds and “larger holes for Kellen” are listed in the [plans index](../../README.md#open-decisions-for-kellen). Content below is unchanged.

Audit date: 2026-11-12 (America/New_York). Live project `uakiqnjvqjkogpczwxdu`, after Phase 1 batch 3 (tasks 1.2, solo `record_raid_clear` wall-clock, and world-boss start nonces). Function bodies were re-read with `pg_get_functiondef` during batch 2 and the new batch-3 functions were applied on this date. Public wrappers remain `SECURITY DEFINER` with `SET search_path` from batch 1 (task 1.8).

Legend: **yes** / **no**. Red rows are marked **RED**.

## Reward RPCs

| RPC | Rate-limited | Real elapsed time | Idempotency key | Trusts client numbers other than ticks | Rejects anonymous | Notes |
|---|---|---|---|---|---|---|
| `record_jad_kill` | yes (12s `last_jad_at`) | yes, when a `start_boss_fight('jad')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (`p_nonce`, plus a server start nonce) | yes (`p_score` updates `jad_best_score`; loot/GP is server-rolled) | yes | Batch 3: wrapper asserts elapsed against the latest unconsumed start. Cached old clients with no start row still use the 12s cooldown + 20-tick floor (legacy). `p_score` is still trusted for `jad_best_score`. |
| `record_kree_kill` | yes (20s `last_kree_at`) | yes, when a `start_boss_fight('kree')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (server start nonce; consumed after a successful record) | no (`p_item_ids` is accepted but the server rolls loot) | yes (wrapper, 1.9) | Batch 3: same elapsed check as Jad. Legacy path if no start row. |
| `record_widow_kill` | yes (20s `last_widow_at`) | yes, when a `start_boss_fight('widow')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (server start nonce; consumed after a successful record) | no (server rolls) | yes (wrapper, 1.9) | Batch 3: elapsed check on all six bosses. |
| `record_colossus_kill` | yes (20s `last_colossus_at`) | yes, when a `start_boss_fight('colossus')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (server start nonce; consumed after a successful record) | no (server rolls) | yes (wrapper, 1.9) | Batch 3: elapsed check on all six bosses. |
| `record_gorehorn_kill` | yes (20s `last_gorehorn_at`) | yes, when a `start_boss_fight('gorehorn')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (server start nonce; consumed after a successful record) | no (server rolls) | yes (wrapper, 1.9) | Batch 3: elapsed check on all six bosses. |
| `record_knight_kill` | yes (20s `last_knight_at`) | yes, when a `start_boss_fight('knight')` row exists (`elapsed >= p_ticks*0.6s - 3s`); otherwise the old 20-tick floor only | yes (server start nonce; consumed after a successful record) | no (server rolls) | yes (wrapper, 1.9) | Batch 3: elapsed check on all six bosses. |
| `record_raid_clear` (solo) | yes (30s `last_raid_at`) | yes (requires an active `solo_raid_runs` row; 65s / 109 ticks; `p_ticks*0.6s <= elapsed + 3s`) | yes (`p_nonce`) | partial (`p_score` is capped by `game.cap_raid_score(..., 1)` before `roll_group_raid_loot`) | yes | Batch 3: same floor and cap as group 1.6. No start → rejected (`No active raid`). |
| `start_boss_fight` | yes (40 starts / 10 minutes) | n/a (issues the start nonce) | yes (server nonce) | no (boss id is a catalog key) | yes | New in batch 3. Client `cloud.js` calls this from hooked `startFight` (all six bosses, including Jad). Test-mode query flags skip it so instant loot hooks stay on the legacy record path. |
| `complete_raid_run` (group) | yes (30s `last_raid_at` per member, 1.6) | yes (65s / 109 ticks, plus `p_ticks*0.6s <= elapsed + 3s`) | yes (run id; repeats return `already`) | partial (`p_scores` and `p_dead` are client-supplied; scores are capped by `game.cap_raid_score`) | yes | Floor and cap added in 1.6. See reasoning in `supabase/20261112_07_phase1_1_6_raid_timing.sql`. |
| `buy_shop_item` | yes (2s `last_purchase_at`) | n/a | no | no (server prices; item id is a catalog key) | yes (wrapper, 1.9) | Anon rejection added in 1.9. |
| `buy_supply_item` | yes (short cooldown; `is_anonymous` already in `game.*`) | n/a | no | no (server prices and qty-checked) | yes | |
| `claim_alcove_mid` | yes (tied to an in-progress run / `merged_at` after 1.5) | partial (run must exist and have `started_at`; no extra duration floor) | yes (`p_nonce`) | no (server rolls GP / mid loot) | yes | Membership is checked. Not a full raid-clear payout. |
| `trade_request` / `trade_set_offer` / `trade_accept` / `trade_accept_request` / `trade_decline` / `trade_cancel_open` | no dedicated cooldown | n/a (two-sided accept) | no (trade id acts as the row key) | yes (each side's offer GP/items are client-chosen, then escrowed from that player's own inventory) | yes (on the `game.*` bodies that check it) | Two-party confirmation is the main control. A cooldown would be a later hardening, not a missing uid scope. |
| `create_duel_challenge` / `respond_duel_challenge` / `escrow_duel` | expiry window on the challenge | n/a (pre-fight) | no (challenge id) | yes (stakes, after `assert_stake` against the caller's own GP/items) | yes | |
| `settle_duel` | n/a | yes (min 8 ticks, min 4s, and `p_ticks*0.6s - 3s` vs `started_at`) | yes (challenge id; repeats return `already`) | partial (winner is accepted only when both sides agree, or on one-sided forfeit / 2-minute gone path; HP is stored, not trusted for payout) | yes (1.3) | Bilateral reports, 60s single-report timeout, and `refund_duel` lock while fighting landed in 1.3. |
| `refund_duel` | n/a | timeout only (60s after first report, or 30 minutes with no reports) | yes (challenge id) | no | yes (1.3) | Not callable by a single player once `status=fighting` except on that timeout path. Accepted (pre-fight) cancels still work. |

### Red rows (outstanding)

Batch 3 closed the previous reds on solo `record_raid_clear`, the six world-boss `record_*_kill` wrappers (for clients that issue `start_boss_fight`), and `save_player_state` conservation (shipped in **enforce** mode, with a runtime flag to drop to log-only).

Remaining / leftover reds (IDs **RPC-1**–**RPC-5** are also in the [plans index](../../README.md#open-decisions-for-kellen)):

1. **RPC-1 — World-boss legacy path** — if no `game.boss_fight_starts` row exists (cached old client, or a fight already running at deploy), `record_*_kill` still uses only the 12s/20s cooldown and 20-tick floor. New `cloud.js` always starts a fight nonce, so this shrinks as clients update. Worth watching `boss_fight_starts` vs successful records for a week, then rejecting the legacy path.
2. **RPC-2 — `record_jad_kill` `p_score`** — still trusted for `jad_best_score` (loot/GP stays server-rolled). Not a GP cheat, but a leaderboard number.
3. **RPC-3 — Trade / offer values** — still client-chosen, then escrowed from that player's own inventory (unchanged). Optional `trade_accept` cooldown is still open.

### Larger holes for Kellen (not built in this batch)

- **RPC-1** — Drop the world-boss **legacy path** (no start row) once almost every client is on a build that calls `start_boss_fight`.
- **RPC-2** — Cap or ignore `record_jad_kill` `p_score` for `jad_best_score`.
- **RPC-3** — Optional short cooldown on `trade_accept` to slow trade-bot cycling.
- **RPC-4** — `report_raid_deaths` can mark other party members dead (needed for the host, but it is a trusted client list). Worth a later look, not a one-line fix.
- **RPC-5** — Admin RPCs (`admin_chat_history`, `admin_trade_history`) are allow-listed to a single admin UUID. Fine today; a role table would be cleaner than a hard-coded id.
- Watch `game.save_rejections` after 1.2 enforce ships (operational, not a design fork). Flip `game.runtime_flags.save_conservation` to `log_only` if real players are blocked by a missed raise path; flip back to `enforce` once that path is an RPC.

## SECURITY DEFINER audit (all 44 public functions)

All 44 `public` functions are `SECURITY DEFINER` and have `SET search_path` (batch 1). DEFINER bypasses RLS, so each must scope reads and writes itself. The public objects are thin wrappers; the `game.*` bodies are what must use `auth.uid()`.

`server_now` has no `auth.uid()` and does not need one (it returns `now()`). `is_anonymous` is an internal helper, not one of the 44 wrappers.

| Public function | `auth.uid()` scoping in `game.*` | Relies on RLS? | `SET search_path` | Notes / fix |
|---|---|---|---|---|
| `admin_chat_history` | yes (allow-listed admin UUID, else `'Not allowed'`) | no | yes | Read-only admin log. |
| `admin_trade_history` | yes (same allow-list) | no | yes | Read-only admin log. |
| `buy_shop_item` | yes (`profiles` / `player_state` for `uid`) | no | yes | 1.9: wrapper rejects anonymous. |
| `buy_supply_item` | yes | no | yes | Already rejected anonymous. |
| `claim_alcove_mid` | yes (caller must be on the run) | no | yes | |
| `claim_display_name` | yes (updates caller's profile) | no | yes | |
| `complete_raid_run` | yes (must be a party member; loot written per member after that check) | no | yes | |
| `create_duel_challenge` | yes (stakes taken from `uid`) | no | yes | |
| `create_party` | yes (leader = `uid`) | no | yes | |
| `escrow_duel` | yes (participant only) | no | yes | |
| `hub_heartbeat` | yes (updates caller's presence) | no | yes | |
| `hub_online` | yes (presence list; no writes to other users' inventories) | no | yes | |
| `join_party` | yes (inserts `uid`) | no | yes | |
| `leave_party` | yes (deletes `uid`) | no | yes | |
| `merge_local_save` | yes | no | yes | Legacy import path; still constrained by 1.4. |
| `migrate_local_save` | yes | no | yes | Same. |
| `my_duel_challenges` | yes (from/to = `uid`) | no | yes | |
| `my_party` | yes | no | yes | |
| `my_profile` | yes | no | yes | |
| `my_trade` | yes | no | yes | |
| `post_chat_message` | yes (inserts as `uid`) | no | yes | |
| `record_colossus_kill` | yes (updates `uid` only) | no | yes | 1.9 anon reject. |
| `record_gorehorn_kill` | yes | no | yes | 1.9 anon reject. |
| `record_jad_kill` | yes | no | yes | |
| `record_knight_kill` | yes | no | yes | 1.9 anon reject. |
| `record_kree_kill` | yes | no | yes | 1.9 anon reject. `p_item_ids` ignored. |
| `record_raid_clear` | yes | no | yes | |
| `record_widow_kill` | yes | no | yes | 1.9 anon reject. |
| `refund_duel` | yes (participant only) | no | yes | Fighting refunds locked in 1.3 except timeout. |
| `report_raid_deaths` | yes (caller must be in the run; may flag other members) | no | yes | See larger holes. |
| `require_signed_in` | yes (`auth.uid()` required) | no | yes | |
| `respond_duel_challenge` | yes (the challenged `uid`) | no | yes | |
| `save_player_state` | yes (writes `uid` only) | no | yes | 1.2 conservation: unknown ids / caps / slots always reject; gear counts must match; consumables may only decrease. `game.save_rejections` has no client access. Runtime flag `save_conservation` is `enforce`. |
| `server_now` | n/a (no user rows) | no | yes | |
| `set_party_ready` | yes (`UPDATE ... WHERE user_id = uid`) | no | yes | Live SQL committed as `supabase/party_ready_and_start.sql`. |
| `settle_duel` | yes (participant only) | no | yes | 1.3 bilateral reports. |
| `start_party` | yes (leader = `uid`) | no | yes | Snapshot committed with `set_party_ready`. |
| `start_solo_raid_run` | yes (inserts `uid`) | no | yes | |
| `start_boss_fight` | yes (inserts `uid`) | no | yes | Batch 3. |
| `trade_accept` | yes (party to the trade) | no | yes | |
| `trade_accept_request` | yes | no | yes | |
| `trade_cancel_open` | yes (own open trade) | no | yes | |
| `trade_decline` | yes | no | yes | |
| `trade_request` | yes | no | yes | |
| `trade_set_offer` | yes (own offer side only) | no | yes | |

### DEFINER issues found or fixed

- **Found:** every public wrapper already had `SECURITY DEFINER` and `SET search_path` from batch 1. The `game.*` bodies already used `auth.uid()` (or an admin allow-list) and did not depend on RLS to stop cross-user writes.
- **Fixed (small, 1.9):** `record_colossus_kill`, `record_gorehorn_kill`, `record_knight_kill`, `record_widow_kill`, `record_kree_kill`, and `buy_shop_item` now reject `game.is_anonymous()` on the public wrapper. `settle_duel` / `refund_duel` also reject anonymous as part of 1.3.
- **Not a defect:** `server_now` has no uid filter.
- **Fixed in batch 3:** solo `record_raid_clear` wall-clock + `cap_raid_score`; `start_boss_fight` + elapsed checks on all six world-boss wrappers; `save_player_state` conservation in enforce mode.
- **Not fixed here:** world-boss legacy path when no start row exists; `record_jad_kill` `p_score` for best-score; trade cooldown / `report_raid_deaths` (listed above for Kellen).
