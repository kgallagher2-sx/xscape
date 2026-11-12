# Reward RPC and SECURITY DEFINER audit

Audit date: 2026-11-12 (America/New_York). Live project `uakiqnjvqjkogpczwxdu`, after Phase 1 batch 2 (tasks 1.3, 1.6, 1.9). Function bodies were read with `pg_get_functiondef` on that date. Public wrappers were already `SECURITY DEFINER` with `SET search_path` from batch 1 (task 1.8).

Legend: **yes** / **no**. Red rows are marked **RED**.

## Reward RPCs

| RPC | Rate-limited | Real elapsed time | Idempotency key | Trusts client numbers other than ticks | Rejects anonymous | Notes |
|---|---|---|---|---|---|---|
| `record_jad_kill` | yes (12s `last_jad_at`) | no (only `p_ticks < 20`) | yes (`p_nonce`) | yes (`p_score` updates `jad_best_score`; loot/GP is server-rolled) | yes | **RED**: 20-tick (12s) floor is far below a real Jad fight; no wall-clock vs a start RPC. |
| `record_kree_kill` | yes (20s `last_kree_at`) | no (only `p_ticks < 20`) | no | no (`p_item_ids` is accepted but the server rolls loot) | yes (wrapper, 1.9) | **RED**: no nonce, no real elapsed time. Anon rejection added in 1.9. |
| `record_widow_kill` | yes (20s `last_widow_at`) | no (only `p_ticks < 20`) | no | no (server rolls) | yes (wrapper, 1.9) | **RED**: same as other world-boss kills. |
| `record_colossus_kill` | yes (20s `last_colossus_at`) | no (only `p_ticks < 20`) | no | no (server rolls) | yes (wrapper, 1.9) | **RED**: same. |
| `record_gorehorn_kill` | yes (20s `last_gorehorn_at`) | no (only `p_ticks < 20`) | no | no (server rolls) | yes (wrapper, 1.9) | **RED**: same. |
| `record_knight_kill` | yes (20s `last_knight_at`) | no (only `p_ticks < 20`) | no | no (server rolls) | yes (wrapper, 1.9) | **RED**: same. |
| `record_raid_clear` (solo) | yes (30s `last_raid_at`) | no (only `p_ticks < 20`; does not check `solo_raid_runs.started_at`) | yes (`p_nonce`) | yes (`p_score` feeds `roll_group_raid_loot` / GP) | yes | **RED**: 20-tick floor and trusted score; start RPC exists but clear does not use its clock. |
| `complete_raid_run` (group) | yes (30s `last_raid_at` per member, 1.6) | yes (65s / 109 ticks, plus `p_ticks*0.6s <= elapsed + 3s`) | yes (run id; repeats return `already`) | partial (`p_scores` and `p_dead` are client-supplied; scores are capped by `game.cap_raid_score`) | yes | Floor and cap added in 1.6. See reasoning in `supabase/20261112_07_phase1_1_6_raid_timing.sql`. |
| `buy_shop_item` | yes (2s `last_purchase_at`) | n/a | no | no (server prices; item id is a catalog key) | yes (wrapper, 1.9) | Anon rejection added in 1.9. |
| `buy_supply_item` | yes (short cooldown; `is_anonymous` already in `game.*`) | n/a | no | no (server prices and qty-checked) | yes | |
| `claim_alcove_mid` | yes (tied to an in-progress run / `merged_at` after 1.5) | partial (run must exist and have `started_at`; no extra duration floor) | yes (`p_nonce`) | no (server rolls GP / mid loot) | yes | Membership is checked. Not a full raid-clear payout. |
| `trade_request` / `trade_set_offer` / `trade_accept` / `trade_accept_request` / `trade_decline` / `trade_cancel_open` | no dedicated cooldown | n/a (two-sided accept) | no (trade id acts as the row key) | yes (each side's offer GP/items are client-chosen, then escrowed from that player's own inventory) | yes (on the `game.*` bodies that check it) | Two-party confirmation is the main control. A cooldown would be a later hardening, not a missing uid scope. |
| `create_duel_challenge` / `respond_duel_challenge` / `escrow_duel` | expiry window on the challenge | n/a (pre-fight) | no (challenge id) | yes (stakes, after `assert_stake` against the caller's own GP/items) | yes | |
| `settle_duel` | n/a | yes (min 8 ticks, min 4s, and `p_ticks*0.6s - 3s` vs `started_at`) | yes (challenge id; repeats return `already`) | partial (winner is accepted only when both sides agree, or on one-sided forfeit / 2-minute gone path; HP is stored, not trusted for payout) | yes (1.3) | Bilateral reports, 60s single-report timeout, and `refund_duel` lock while fighting landed in 1.3. |
| `refund_duel` | n/a | timeout only (60s after first report, or 30 minutes with no reports) | yes (challenge id) | no | yes (1.3) | Not callable by a single player once `status=fighting` except on that timeout path. Accepted (pre-fight) cancels still work. |

### Red rows (outstanding)

These are the cells that stay red after this batch. 1.3 and 1.6 closed the previous reds on `settle_duel` and `complete_raid_run`. 1.9 only added anonymous rejection on the world-boss / shop wrappers.

1. **`record_raid_clear` (solo)** — still no wall-clock check against `game.solo_raid_runs.started_at`, still a 20-tick floor, and `p_score` still drives loot/GP. Same class of cheat 1.6 just closed for group clears.
2. **World-boss `record_*_kill` (Jad, Kree, Widow, Colossus, Gorehorn, Knight)** — cooldown plus a 20-tick floor only. No start-time row, and only Jad has a nonce. A client can still claim a kill in 12s of real time (20s for the others) once the cooldown elapses. Jad also trusts `p_score` for `jad_best_score`.
3. **`save_player_state` (not a reward RPC, but adjacent)** — Phase 1.2 is still open: a matching revision still lets the client send inventory / bank / equipment / GP-adjacent state. Batch 1 already revoked direct `player_state` REST updates.

### Larger holes for Kellen (not built in this batch)

- Put the same 1.6-style wall-clock minimum and score cap on **solo** `record_raid_clear`, using `start_solo_raid_run`.
- Add start-run RPCs (or reuse an existing one) and a real elapsed-time floor for **Jad and the five world bosses**, plus nonces for the bosses that lack them.
- 1.2 conservation checks on `save_player_state` (inventory/bank/GP cannot appear from nowhere).
- Optional short cooldown on `trade_accept` to slow trade-bot cycling.
- `report_raid_deaths` can mark other party members dead (needed for the host, but it is a trusted client list). Worth a later look, not a one-line fix.
- Admin RPCs (`admin_chat_history`, `admin_trade_history`) are allow-listed to a single admin UUID. Fine today; a role table would be cleaner than a hard-coded id.

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
| `save_player_state` | yes (writes `uid` only) | no | yes | Still trusts the payload (1.2). |
| `server_now` | n/a (no user rows) | no | yes | |
| `set_party_ready` | yes (`UPDATE ... WHERE user_id = uid`) | no | yes | Live SQL committed as `supabase/party_ready_and_start.sql`. |
| `settle_duel` | yes (participant only) | no | yes | 1.3 bilateral reports. |
| `start_party` | yes (leader = `uid`) | no | yes | Snapshot committed with `set_party_ready`. |
| `start_solo_raid_run` | yes (inserts `uid`) | no | yes | |
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
- **Not fixed here:** trusted client numbers on solo raid / boss kills, and `save_player_state` conservation (listed above for Kellen).
