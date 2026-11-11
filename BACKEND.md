# Xscape cloud backend

Xscape now saves characters in Supabase (Postgres + Auth + Realtime). GitHub Pages still hosts the game. The client lives in `cloud.js` so fight files can keep changing without merge pain.

Project: `uakiqnjvqjkogpczwxdu` (us-east-1, free). URL: `https://uakiqnjvqjkogpczwxdu.supabase.co`.

The anon / publishable key is shipped in `cloud.js` on purpose. The service role key is never in the client.

## Auth

Players sign in with **Google**, **Discord**, or **GitHub** (all free OAuth apps), or **Play as guest** (anonymous, later linkable). An email magic-link option is on the login screen. Sign in with Apple is coded (`ENABLE_APPLE` in `cloud.js`) but hidden — it needs a paid Apple Developer account ($99/yr).

After a permanent sign-in, if the account has no adventurer name yet, the game asks for a unique in-game name (1–16 characters).

`?devlogin=1` shows a hidden email/password fallback that maps `name` to `name@players.xscape.game`. It is not on the normal UI.

### Dashboard toggles Kellen must flip

The MCP tools cannot change Auth settings. Do these in the Xscape project:

1. **Authentication → Sign In / Providers**  
   (`https://supabase.com/dashboard/project/uakiqnjvqjkogpczwxdu/auth/providers`)

   - **Allow anonymous sign-ins** (sometimes listed under Auth general / providers as “Allow anonymous sign-ins”): **ON**. Needed for Play as guest and for `linkIdentity`.
   - **Allow manual linking**: **ON**. Needed so a guest can later link Google / Discord / GitHub without losing the character.
   - Leave **Email** enabled if you want the magic-link option.
   - **Confirm email** can stay on. Magic links confirm themselves. It does not affect OAuth or (pre-confirmed) test logins.

2. **Authentication → URL Configuration**  
   (`https://supabase.com/dashboard/project/uakiqnjvqjkogpczwxdu/auth/url-configuration`)

   - **Site URL:** `https://kgallagher2-sx.github.io/xscape/`
   - **Redirect URLs** (allow-list), add all of:
     - `https://kgallagher2-sx.github.io/xscape/`
     - `https://kgallagher2-sx.github.io/xscape`
     - `https://kgallagher2-sx.github.io/xscape/index.html`
     - `https://kgallagher2-sx.github.io/xscape/raid.html`

3. Enable **Google**, **Discord**, and **GitHub** on the same Providers page and paste each Client ID + Secret (steps below). Until a provider is enabled, its button shows **Coming soon**; guest play still works once anonymous sign-ins are on.

If anonymous sign-ins are still off, the game says so and still lets people play offline. New (non-legacy) unsigned players are limited the same way as guests (Jad + starter kit only).

### Google Cloud OAuth (free)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and pick or create a project.
2. Open **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding / Audience). Set User Type to **External**, add an app name (Xscape), support email, and the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**. Application type: **Web application**.
4. **Authorized JavaScript origins:**
   - `https://kgallagher2-sx.github.io`
   - Optionally `http://localhost:8000` (or whatever port you use) while testing, then remove it later.
5. **Authorized redirect URIs** — this must be the Supabase callback, not the GitHub Pages URL:
   - `https://uakiqnjvqjkogpczwxdu.supabase.co/auth/v1/callback`
6. Create, then copy the **Client ID** and **Client Secret**.
7. In Supabase: **Authentication → Sign In / Providers → Google** → enable → paste Client ID and Client Secret → Save. The same callback URL is shown on that page if you need to copy it again.

### Discord Developer Portal (free)

1. Sign in at [discord.com/developers](https://discord.com/developers) → **Applications → New Application** → name it Xscape.
2. Open **OAuth2**.
3. **Redirects → Add Redirect** and paste:
   - `https://uakiqnjvqjkogpczwxdu.supabase.co/auth/v1/callback`
4. Save. Copy **Client ID** and **Client Secret** from Client information.
5. In Supabase: **Authentication → Sign In / Providers → Discord** → enable → paste Client ID and Client Secret → Save.

### GitHub OAuth App (free)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**  
   (or [github.com/settings/developers](https://github.com/settings/developers)).
2. **Application name:** Xscape  
   **Homepage URL:** `https://kgallagher2-sx.github.io/xscape/`  
   **Authorization callback URL:** `https://uakiqnjvqjkogpczwxdu.supabase.co/auth/v1/callback`  
   Leave Device Flow unchecked.
3. Register, copy the **Client ID**, then **Generate a new client secret**.
4. In Supabase: **Authentication → Sign In / Providers → GitHub** → enable → paste Client ID and Client Secret → Save.

### Email magic link (optional, free, limited)

The “Or email a login link” control uses Supabase’s built-in mailer. On the free plan that mailer only allows a few messages per hour (typically around two). For a friends game this is enough to try; a custom SMTP provider removes the cap. Confirm the Site URL / redirect allow-list above so the link returns to the game.

### Sign in with Apple (later)

Not shown in the UI. To enable later: enroll in the Apple Developer Program, create a Services ID and a `.p8` key, paste them under **Authentication → Sign In / Providers → Apple**, set `ENABLE_APPLE = true` in `cloud.js`, and rotate the secret every 6 months.

## Guest vs legacy players

- **New guests** (anonymous, or a brand-new phone with no local save) may only fight **TzTok-Jad in tier 1 starter gear**. Shop, non-starter equipment, Gloamhold, Kree’arra, leaderboard submission, and the online lobby / duels are locked behind an OSRS-styled **Sign in to save your progress** sheet (Google / Discord / GitHub). After a guest Jad win, the Fire cape and kill stay on the guest account, the cape stays in the bank, and a post-fight nudge asks them to sign in / link. Linking with `linkIdentity` keeps the same user id, so progress is not lost.
- **Legacy local players** (a `kellenscape-profile` already on the device the first time this cloud build loads) are **not** downgraded. They keep full access until they sign in, and they see a **Sign in to save your progress** banner on the hub.

Server-side, `auth.jwt()->>'is_anonymous'` is checked on RPCs. Guests can `record_jad_kill` (cape + kc, **no GP**, no leaderboard row). `record_kree_kill`, `record_raid_clear`, `buy_shop_item`, `migrate_local_save`, `merge_local_save`, and duel / party RPCs reject anonymous users. `save_player_state` forces starter kit for guests. The leaderboard trigger skips anonymous users.

## Local → cloud import

Friends already have progress in `localStorage` (`kellenscape-profile`: name, GP, Fire cape, equipment / bank, Jad / Kree / Gloamhold counts, and so on).

On **first permanent sign-in** on that phone:

1. If the cloud account has **no character yet** (`migrated_at` is empty and no GP / cape / kills), `migrate_local_save` imports the local profile once. Caps: GP ≤ 80M, kill counts ≤ 2000, only item ids matching `^[a-z0-9_]{2,40}$`. Best times only move if they are at least 20 ticks.
2. If **both** a cloud character and a local save have progress, the game asks which to keep. **Keep cloud** applies the server character. **Use this phone’s save** calls `merge_local_save` (greatest of GP/kills, union of known items, still capped) — it will not wipe a cloud character or accept unknown loot.
3. The phone is then marked with `kellenscape-cloud-migrated=<user id>` so the prompt does not repeat. After that, the **server is the source of truth**; `localStorage` stays as an offline cache.

Guests do **not** run the full import (that would let a guest stash shop loot and then link). Import runs after they become a permanent user, while `migrated_at` is still empty, so a guest’s Jad / cape plus any pre-existing local legacy save can still come across.

## Schema (public, RLS on every table)

| Table | Purpose |
| --- | --- |
| `profiles` | id, unique username, GP, fire cape, kill counts, best times. Players can SELECT their own row only. Writes go through RPCs. |
| `player_state` | equipment, bank, unlocked items, levels, settings. Own row SELECT/UPDATE. |
| `leaderboard` | Public-read copy of names + kc + best times, filled by a trigger (signed-in players only). |
| `duel_challenges` | Pending / accepted / declined invites and a pretend-GP stake field. |
| `parties`, `party_members` | Group-raid lobby foundation (invite codes, max 4). |

Private logic lives in the unexposed `game` schema (`SECURITY DEFINER`, fixed `search_path`). `public.*` RPCs are invoker wrappers.

Reward RPCs roll GP with the live caps: Jad 2–3M after the cape (0 on the first cape, 0 for guests), Kree 150k–400k, Gloamhold 2–8M, shop prices matching the client. A 1/6 unique roll on Kree or the Widow Queen pays a 2–4M GP bonus instead of a duplicate when the set is already complete. Rate limits stop trivial double-claims.

## Multiplayer: what works now vs next

**Works now**

- Hub **Online** panel (hidden for restricted guests).
- Presence list of signed-in players on the `xscape-hub` Realtime channel.
- **Challenge to duel** — both sides see the invite (broadcast + `duel_challenges` + Realtime). Accept / decline / cancel. Stakes are pretend GP only; they are recorded, not escrowed yet.
- Friends leaderboard on the hub (Jad kc and best time).

**Planned (stubbed)**

- Full duel combat netcode (`duel:{id}` broadcast of ticks, prayers, hits; escrow GP on accept; payout on complete). The Duel Arena button opens the lobby and says combat is next.
- Group raids: `create_party` / `join_party` / `leave_party` and `party:{code}` presence already exist in the database. No in-raid lockstep yet.

## Client hooks

`cloud.js` is loaded from `index.html` and `raid.html` after the game scripts. It wraps `saveProfile`, `commitLogin`, `showTitle`, shop / raid / Kree entry, `equipItem`, and `showWinCard` so other people can keep editing the fight files.

A “Saved to cloud” line appears on the hub when a named character is signed in.

## Caveats

- OAuth buttons stay **Coming soon** until those providers are enabled in the dashboard.
- Guest and magic-link sign-in need the anonymous / email settings above.
- Built-in magic-link mail is tightly rate-limited on the free plan.
- This is a friends game: GP and loot go through capped RPCs, but a determined client can still lie about a kill. Combat will need a server authority later if that starts to matter.
- Duel stakes are not escrowed until combat exists, so nobody can lose GP in the lobby.
- `localStorage` remains the offline cache. Clearing the site data also clears the Supabase session (the game would ask them to sign in again, then restore from the cloud).
