# Cardamom

A personal recipe manager for two: recipes, groceries, pantry, meal plan, menus, cook mode. Version 1.0.0.

- `npm run build` builds the site into `dist/`
- `npm test` runs unit tests; `PAPRIKA_EXPORT=/path/Export.bin npm test` also reads a real export
- `npm run e2e -- /path/Export.bin` runs the browser walk-through (needs Chrome at /usr/bin/google-chrome)
- `npm run package` builds everything and writes `out/cardamom-site-<v>.zip` (deploy this) and the source zip
- `npm run roadmap` prints the phases

Deploy: drag `out/cardamom-site-<v>.zip` onto Netlify's Deploys page, or publish `dist/` with GitHub Pages.
Sync: run `supabase/schema.sql` in the Supabase project, deploy the two functions in `supabase/functions`,
then build with `VITE_SB_URL` and `VITE_SB_KEY` set (or enter them in the app under More, Household and sync).

History is in HISTORY.md, architecture notes in NOTES.md (grep them, do not cat them).
