# CLAUDE.md — Working rules for this repo

This file tells Claude (or any future session) how this project is built and
how to make changes consistently. Read this before editing frontend code.

## Project shape

- `frontend/` — React + Vite app (AU Service Requests portal)
  - `src/pages/` — one file per route (SettingsPage.jsx, AdminPage.jsx, etc.)
  - `src/components/` — shared UI (Layout.jsx, NotificationsBell.jsx, Modal.jsx…)
  - `src/context/AuthContext.jsx` — auth/user state
  - `src/lib/` — api client, permissions, statuses, csv helpers
  - `src/styles/global.css` — the ONLY stylesheet; no CSS modules, no styled-components
- `backend/` — Node server (`server.js`), `schema.sql`, `seed.js`

## Design system (styles/global.css)

- All colors/spacing come from CSS variables defined in `:root` — never hardcode
  hex colors in components. Key tokens:
  - `--forest`, `--forest-light`, `--forest-tint` — primary brand green
  - `--gold`, `--gold-strong`, `--gold-tint` — accent
  - `--ink`, `--ink-soft`, `--ink-faint` — text
  - `--surface`, `--surface-sunken`, `--bg`, `--line`, `--line-strong`
  - `--radius-sm/md/lg`, `--shadow-card`, `--shadow-pop`
- Fonts: `--font-display` (Fraunces, headings), `--font-body` (Inter),
  `--font-mono` (IBM Plex Mono).
- Buttons: use `.btn` + a modifier (`.btn-primary`, `.btn-gold`, `.btn-ghost`,
  `.btn-danger`), optionally `.btn-sm`.
- Cards: use `.card` + `.card-pad` for padded content cards. (`.card` alone has
  no padding — always pair it with `.card-pad` unless you're deliberately
  building a custom layout like `.settings-card`.)
- Forms: `.field` wraps a `label` + `.input`/`.select`/`.textarea`.
- Icon buttons in the header (settings gear, notifications bell) share the
  `.notif-bell` base class for sizing/hover background, plus their own class
  (`.settings-btn`, and the bell's own icon span `.notif-bell-icon`) for
  distinct hover animations. When adding a new header icon button, follow this
  pattern rather than inventing new one-off styles.
- Icons are unicode/emoji glyphs (⚙ 🔔 ☰ ＋ ▤), not an icon library — stay
  consistent with that rather than pulling in SVG icon sets.

## Conventions to follow when editing

1. Keep everything in `global.css` — don't introduce new stylesheets or
   inline `<style>` blocks for anything reusable. Small one-off layout
   tweaks via `style={{ ... }}` in JSX are fine (the existing code already
   does this for spacing).
2. Match existing naming: kebab-case CSS classes, PascalCase components.
3. Any new interactive element (button, link) should have a `transition` on
   the properties it animates and respect `:hover` **and** `:focus-visible`
   together — don't animate only on mouse hover.
4. Keep animations short and subtle (150–650ms), consistent with what's
   already in the file (`bell-ring`, `settings-in`, `notif-pop`, `banner-in`).
5. Before adding a new card/page, check `pages/*.jsx` for an existing pattern
   to copy (`page-header` + `eyebrow` + `page-title` + `page-sub`, then one or
   more `.card.card-pad` blocks).
6. Don't touch `backend/` unless the task explicitly requires an API change —
   most UI requests only need `frontend/src`.

## How this repo gets updated in this workflow

The person works from an uploaded zip, asks for changes, and gets a
re-zipped project back. Chat history and session notes for that workflow are
kept in `CHAT_HISTORY.md` at the repo root — append to it, don't overwrite it.

## RULE: name every delivered zip uniquely

Never deliver the zip as a bare `AU_Service-main.zip` — the browser appends
`(1)`, `(2)`, etc. on repeat downloads to the same folder, and then the
PowerShell block has to guess which one is current. Always suffix it with a
timestamp: `AU_Service-main_YYYYMMDD-HHMMSS.zip` (build it with
`Get-Date -Format 'yyyyMMdd-HHmmss'` when zipping). This also makes it
trivial to script "grab the newest one" instead of hardcoding a filename —
see the push block below.

## RULE: pushing the zip to GitHub — always give one PowerShell block

When the person needs to get an updated zip onto GitHub, give them a single
copy-pasteable PowerShell block that goes all the way from unzipping to
pushing — never split it into "first do X, then run this other script."
Base it on this template (adjust the glob pattern / repo folder name /
remote / branch to match the actual delivered zip and repo). It finds the
most recently downloaded zip automatically, so it keeps working even with
the `(1)`/`(2)` suffixes Windows adds on repeat downloads, and always
extracts into the SAME fixed destination folder (not one named after the
timestamped zip) so `.git` persists across sessions instead of the
fresh-`.git`-every-time problem from before:

```powershell
# --- 0. Go to the folder where the zip was downloaded ---
cd $HOME\Downloads

# --- 1. Find the newest matching zip (handles (1)/(2) suffixes) and unzip
#        into a FIXED destination folder name, not the zip's own name ---
$destName = "AU_Service-main"
$zip = Get-ChildItem ".\AU_Service-main*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Expand-Archive -Path $zip.FullName -DestinationPath ".\$destName" -Force

# --- 2. Flatten if the zip has one top-level folder inside itself ---
$inner = Get-ChildItem ".\$destName"
if ($inner.Count -eq 1 -and $inner[0].PSIsContainer) {
    Move-Item "$($inner[0].FullName)\*" ".\$destName" -Force
    Remove-Item $inner[0].FullName -Recurse -Force
}
cd ".\$destName"

# --- 3. Git init (skip init/checkout if .git already exists) ---
if (-not (Test-Path ".git")) {
    git init
    git checkout -b main
}

# --- 4. Remote (add if missing, update if it already exists) ---
if ((git remote) -contains "origin") {
    git remote set-url origin https://github.com/zementaye/AU_Service.git
} else {
    git remote add origin https://github.com/zementaye/AU_Service.git
}

# --- 5. Stage, commit, push ---
git add -A
git commit -m "Update from Claude session"
git push -u origin main
```

Notes to carry along with this block whenever it's given:
- If `running scripts is disabled` shows up first, that's execution policy,
  not this block — `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
  fixes it for the current terminal session only.
- HTTPS pushes prompt for a GitHub Personal Access Token, not the account
  password (unless Git Credential Manager / SSH is already configured).
- If `git push` is rejected as non-fast-forward AND `git init` in this run
  said "Initialized empty Git repository" (i.e. there was no existing
  `.git` to skip past), the local folder lost its git history since the
  last push — most likely the Downloads folder got wiped/re-extracted
  between sessions. Since the delivered zip is always the full cumulative
  project (a superset of whatever's already on GitHub, never a diff), the
  fix is simply `git push -u origin main --force` — nothing is lost. Longer
  term, tell the person to stop re-extracting into Downloads each time
  (which often gets cleared) and instead keep one persistent working copy
  (e.g. `C:\Projects\AU_Service`) so `.git` survives between sessions and
  pushes stay incremental.
- If `git push` is rejected as non-fast-forward for any OTHER reason
  (remote has commits from elsewhere, e.g. someone else pushed, or an
  auto-created README, and the local `.git` DID already exist before this
  run), the fix is `git pull origin main --allow-unrelated-histories` then
  push again — don't force-push in this case, since local isn't guaranteed
  to be a superset.
- `git commit` will report "nothing to commit" harmlessly if the zip's
  contents didn't actually change since the last push — that's not an error.
