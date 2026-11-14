(grep this, do not cat it) One line per area.
storage: src/store.js. IndexedDB "cardamom": items (all records, keyed id, field kind), photos (blobs keyed recipeId:idx), kv (settings). Records carry u (updated), dirty, deleted (soft delete, enables undo + sync).
kinds: recipe, grocery, pantry, meal, menu. Recipe fields mirror Paprika's JSON; photos = list of idx, pv = photo version.
navigation: App.jsx keeps a stack of overlays; every push adds a history entry so Android back closes the top one. app.back() returns a promise.
paprika: src/lib/paprika.js streams the zip with fflate so a 90 MB export is never unpacked at once. Extra photos over 500 KB are resized to 1600px on import.
ai: src/lib/gemini.js, key from Settings, model name editable. All calls take fetch as an argument for tests.
web import: src/lib/importers.js. Order: own edge function (when signed in), public CORS proxies, then Gemini opening the URL itself.
sync: src/lib/sync.js + supabase/schema.sql. One table cardamom_items, last write wins, photos in bucket cardamom-photos/<household>/<recipe>/<idx>.
share target: manifest share_target sends ?url=&text= to the app, App.jsx opens the import sheet.
tests: tests/unit (vitest, pure logic), tests/e2e.mjs (Playwright with system Chrome, real export).
