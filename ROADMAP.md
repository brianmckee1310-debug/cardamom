# Cardamom roadmap

Personal Paprika-style recipe manager for Brian and his wife. Updated 2026-11-13, version 1.0.0.

| # | Phase | Status | Model and effort |
|---|-------|--------|------------------|
| 1 | Recipe library and Paprika import/export | Done | |
| 2 | Kitchen tools: groceries, pantry, planner, menus, cook mode, timers, voice | Done | |
| 3 | Smart importing: links, share, clipboard, photo scan, social, barcode, nutrition, category suggestions | Done (built; AI parts not yet tried with a real key) | |
| 4 | Household sync and live calendar feed in the Cairn Supabase project; permanent web address | Next | Opus 5, low effort |
| 5 | Polish from real kitchen use (month view, multiple grocery lists, reordering) | Later | Opus 5, medium effort |
| 6 | Alexa skill, only if voice mode is not enough | Later | Opus 5.5, high effort |

## Phase 4 checklist
- Run `supabase/schema.sql` in the Cairn project (all tables are prefixed `cardamom_`).
- Deploy edge functions `cardamom-ics` (public, no JWT check) and `cardamom-fetch`.
- Build with `VITE_SB_URL` and `VITE_SB_KEY`, deploy, create both accounts, create household on Brian's phone, join on the other.
- Needs: the Supabase connector working in the session, and an empty GitHub repo named `cardamom` (or keep using Netlify).

## Checked on 2026-11-13
- All 473 recipes and 537 photos from the real Paprika export import in about 9 seconds in Chrome.
- 17 unit tests and a 48-step browser walk-through pass at phone and laptop sizes.

## Not yet verified
- Anything that needs the Gemini key, a real camera or microphone, or a real phone install.
- Sync code and database script (written, never run against the database).
- Public page-fetch services used for link import before sync is on.
