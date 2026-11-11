# Xscape release flow

This documents the release process as it works today, including `scripts/stamp-build.sh` after Gameboy’s change in `50c9904`. Do not treat this as a proposal to change the script.

Live site: https://kgallagher2-sx.github.io/xscape/

Pages deploys from `main`. A release is a commit that stamps a matching BUILD id into `version.json`, `index.html`, and `sw.js`, then a push, then a check that the live `version.json` shows that id.

## What the stamp script does

Run from the site root, or pass the root as the first argument:

```
./scripts/stamp-build.sh
./scripts/stamp-build.sh /path/to/xscape-site
BUILD=custom-id ./scripts/stamp-build.sh
```

The script exits if `index.html` or `sw.js` is missing from that root.

**Default BUILD** (when the `BUILD` environment variable is unset):

`$(date -u +%Y%m%d%H%M%S)-<short hash>`

- The timestamp is **UTC**, 14 digits, so tags sort by time.
- The short hash is `git rev-parse --short=7 HEAD` when the directory is a git repo. If git is unavailable, the id is the UTC timestamp alone.

**`builtAt`:** always UTC with a Z, from `date -u +%Y-%m-%dT%H:%M:%SZ`. That value is written into `version.json` next to `build`.

**If `BUILD` is already set:** the script uses that string as the id. If the value looks like `YYYYMMDDHHMMSS` with an optional `-<suffix>` or `.<suffix>`, the script compares the 14-digit stamp to the current UTC time. If it is more than 5 minutes off, it prints a warning to stderr (it does not fail) and reminds the caller that tags should use UTC, with this example:

```
BUILD="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=7 HEAD)" ./scripts/stamp-build.sh .
```

The warning exists so a New York–local timestamp does not slip in by accident.

The BUILD id must match `[A-Za-z0-9._-]+`. The script then:

1. Writes `version.json` as `{"build": "<id>", "builtAt": "<UTC Z time>"}`.
2. Replaces the single `window.XSCAPE_BUILD = "..."` assignment in `index.html`. It errors if it does not find exactly one match.
3. Replaces the single `var BUILD = "..."` assignment in `sw.js`. It errors if it does not find exactly one match.

`index.html` registers the service worker as `sw.js?v=` plus `XSCAPE_BUILD`. Clients compare that embedded id to `version.json` (fetched with `cache: no-store`) and show the update banner, or reload, when they differ.

The stamp uses the current `HEAD` hash *before* the stamp commit, so the id’s short hash is usually the parent of the commit that contains the stamp, not that commit itself.

## Release steps

1. Start from a clean `main` that already has the work you want to ship. Do not mix feature edits into the stamp commit. Run the script from the site root: `./scripts/stamp-build.sh`. Leave `BUILD` unset unless you are passing an explicit **UTC** id.
2. That bumps the tag in `index.html` and `sw.js`, and writes the same id to `version.json`. Commit only those three files, with a message such as `Stamp version.json with the current build.`
3. Push to `origin main`. Do not force-push.
4. Confirm the live file: https://kgallagher2-sx.github.io/xscape/version.json — `build` must match the id you just stamped, and `builtAt` should be the UTC time with a Z. On the live game, the build tag (or a hard reload after the banner) should show that same build.

Every finished release then goes to QA. QA reports PASS or FAIL to Gameboy before Kellen is told.

## Rollback

Never force-push.

1. `git revert` the bad commit (the stamp, and the feature commit if that is what broke the site). Do not rewrite history.
2. Re-stamp with `./scripts/stamp-build.sh` so `index.html`, `sw.js`, and `version.json` share a new UTC BUILD. Clients that still have the bad build will see a mismatch against the new `version.json`.
3. Push to `origin main`.
4. Confirm the live `version.json` shows the new id, then have QA verify the rolled-back site.

## Known issue (not fixed here)

`lab.html` still loads scripts with stale cache-bust queries (`?v=35-5`, `?v=37`) and registers `sw.js?v=35-5`. That pin is not updated by `stamp-build.sh`. The lab can therefore run a different service worker and older cached lab assets than the game. Leave it as is until a separate, agreed change.
