# Cardamom

A personal recipe manager for two: recipes, groceries, pantry, meal plan, menus, cook mode. Version 1.1.0.

Live at https://brianmckee1310-debug.github.io/cardamom/ (published from `docs/` on `main`).

- `npm run build` builds the site into `dist/`
- `npm test` runs unit tests; `PAPRIKA_EXPORT=/path/Export.bin npm test` also reads a real export
- `npm run e2e -- /path/Export.bin` runs the browser walk-through (needs Chrome at /usr/bin/google-chrome)
- `npm run package` builds everything and writes `out/cardamom-site-<v>.zip` and the source zip
- `npm run roadmap` prints the phases

Deploy: build, copy `dist/` over `docs/`, commit and push. Pages serves `main` / `/docs`.
Sync is live: Supabase URL and publishable key are baked in at build time via `VITE_SB_URL` and
`VITE_SB_KEY` (both are safe to publish; the data is protected by row-level security).
The Gemini key is NOT in this repo and must never be: it is entered per device under More.

History is in HISTORY.md, architecture notes in NOTES.md (grep them, do not cat them).
