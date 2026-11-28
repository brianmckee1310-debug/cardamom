# Cardamom roadmap

Personal Paprika-style recipe manager for Brian and his wife. Updated 2026-11-22, version 1.10.0.

Live at https://brianmckee1310-debug.github.io/cardamom/
Code at https://github.com/brianmckee1310-debug/cardamom (Pages serves `main` / `/docs`)
Source on disk at `C:\Users\brian\Claude\Projects\Cardamom`

| # | Phase | Status | Model and effort |
|---|-------|--------|------------------|
| 1 | Recipe library and Paprika import/export | Done | |
| 2 | Kitchen tools: groceries, pantry, planner, menus, cook mode, timers, voice | Done | |
| 3 | Smart importing: links, share, clipboard, photo scan, social, barcode, nutrition, category suggestions | Done (built; AI parts not yet tried with a real key) | |
| 4 | Household sync, live calendar feed, permanent web address | Done | |
| 5 | Daily food log | Done | |
| 6 | Polish and the first shared build | Done | |
| 7 | Shopping and planning upgrade | Done | |
| 8 | Paprika parity, the rest | Done | |
| 9 | Hands-free | Done | |
| 10 | Less scrolling: a recipe in tabs | Done | |
| 11 | Mobile only | Done | |
| 12 | Add to a list by voice | Done (Android trigger still open) | |
| 13 | Hands-free on Android | Done | |
| 14 | What real kitchen use turns up | Next | Opus 5, medium effort — after you have used it |

## Phase 11, done on 2026-11-17 — version 1.8.0

Brian: "I have never and will never use Cardamom on PC, this is mobile-only."

- **The desktop layout is gone.** The sidebar rail, the two-column recipe and the wide-screen
  grid have been deleted rather than left to rot. On anything wider than a phone the app is
  now the phone layout centred in a 480px column, tab bar and all, so there is exactly one
  layout and it is the one that gets the attention.
- **Every tap target is at least 44px** in its short dimension — the size a finger hits
  reliably. An audit of thirteen screens at 412px (a Galaxy S23 Ultra) and again at 360px
  found 30 controls under that: segmented controls at 32px, the list chips and pill buttons
  at 33–34px, Have it / Need it at 34px, the dictate button at 38px, drag handles 34px wide,
  ingredient lines at 39px, and the rating stars at 20×20. All fixed by growing the padding
  rather than the ink, so nothing looks heavier.
- **The recipe page gives its top to the content.** The name is in the bar above, which stays
  put while you scroll, so the heading on the page is smaller and the spacing tighter —
  roughly 40px less before the ingredients start.

### Checked
Thirteen screens audited at 412px and 360px for overflow, tap-target size and header
crowding: no problems at either width, no console errors. The recipe-tab run was re-checked
and extended to assert the new behaviour on a big screen — one pane at a time, centred column,
tab bar aligned to it. 97 unit tests still pass.

### Not verified
A real phone, as ever. The audit measures CSS pixels in a desktop browser pretending to be a
phone; it cannot tell you whether something feels cramped in your hand.

## Phase 10, done on 2026-11-17 — version 1.7.0

Brian: "I prefer how Paprika has an ingredients tab and a directions tab. I loathe scrolling
down screens."

- **A recipe is tabbed on a phone**: Ingredients · Directions · More. Notes, nutrition and
  What's in it moved into More, which only appears when there is something in it.
- **The tabs are sticky** and switching scrolls them to the top, so tapping Directions puts
  step one on screen rather than wherever you happened to be scrolled to.
- **Nothing changed on a wide screen**, where the two columns already sat side by side, and
  printing still puts the whole recipe on the page.

Measured on a seeded recipe with 14 ingredients and 10 steps at 384px: one tab is 952px of
scroll against 1949px for the whole recipe at once.

### Checked
A browser run of 13 checks at phone and desktop width: which pane shows, the first step being
visible after a switch, the sticky behaviour, the More tab appearing only when it has content,
printing showing both halves, and nothing overflowing. No console errors.

## Phase 9, done on 2026-11-17 — version 1.6.0

- **A microphone on every screen**, bottom right. One tap, one sentence, one thing done — not
  an always-on assistant, which would cost battery and mean a hot mic in the kitchen. It says
  back what it did, so you do not have to look. What it understands:
  *add batteries* · *add two pounds of carrots to Costco* · *start a 12 minute timer* ·
  *set a timer for an hour and a half* · *cook the turkey chili* · *open baked ziti* ·
  *show me the pantry* · *log a bowl of oatmeal* · *what's for dinner*.
- **Which list a spoken item lands on.** Brian's call: anything unnamed goes to the default
  Groceries list wherever you are in the app, and naming a list in the sentence sends it there
  instead. If it hears a list name that does not exist it says so rather than guessing, and
  spoken items merge with what is already on the list the same way typed ones do.
- **Home-screen shortcuts.** Long-press the icon for *Speak a command*, *Grocery list* or
  *Log what I ate*. These are deep links (`?voice=1`, `?tab=groceries`, `?log=1`, `?cook=<id>`),
  so they work as plain links too.
- **Dictation** beside the grocery add box and the describe-what-you-ate box, for when a
  command is overkill and you just want to talk into a field.
- **The screen never sleeps.** Always on, no setting, everywhere in the app — not just cook
  mode, which is where it used to stop. The lock is released while the app is in the
  background and re-taken when you come back, so it costs nothing when you are not looking.

### Checked
97 unit tests, 25 of them on the command language alone: list routing, unknown list names,
durations in words and digits, timer-versus-item precedence, recipe matching (including the
case where two recipes match and the shorter name has to win), tabs, and the spoken
confirmations. A browser run covering the mic's position, that it never sits over a list row
even at the end of a 40-item list, the dictation buttons, all four deep links, the manifest
shortcuts, and the mic hiding itself in cook mode. No console errors.

### Not verified
Actual speech. The browser will not hand a synthetic transcript to a page, so everything from
the microphone down to the transcript is untested here — the command layer underneath it is
tested hard, but whether Chrome on your phone hears "add two pounds of carrots to Costco"
correctly is something only you can tell me. Also unverified: whether Android honours the wake
lock in the installed PWA, and the home-screen shortcuts, which need a real install.

### Known limits
Speech recognition needs a network connection and is Chrome-only on Android; on iOS Safari
there is no Web Speech support, so the mic will say the browser cannot listen. Logging food by
voice goes through Gemini, so it needs the key; without it, it opens the log for you instead.

## Phase 8, done on 2026-11-17 — version 1.5.0

- **Subcategories.** A category with `Parent > Child` in its name nests. The picker shows a
  tree you expand and collapse; a parent counts and shows everything beneath it, however deep.
  Renaming carries the children: `Dinner` to `Supper` moves `Dinner > Pasta` with it, and
  re-parenting is just renaming `Soup` to `Dinner > Soup`. A branch cannot be moved inside
  itself. Nothing needed migrating — the stored shape is still a flat list of strings.
- **Drag to reorder**, by a handle so a tap still does what it always did. Three places: the
  aisles, the meal types, and grocery items within their aisle (hand order survives a reload
  and beats alphabetical). Planner days with more than one meal can be dragged too. The handle
  is also a button: focus it and the arrow keys move the row, for anyone not dragging.
- **Aisles are yours.** More → Aisles: add, rename, delete, drag into the order you walk the
  shop. That order is the order the grocery list groups in. Renaming an aisle moves everything
  in it; deleting one moves its items to the last aisle rather than losing them.
- **Meal types are yours.** More → Meal types, same handling, and they drive the planner slots
  and the order meals sit in on a day.
- **Printing.** Beyond a recipe, the grocery list and the planner now print: the tab bar,
  search, buttons and drag handles drop out, cards avoid breaking across pages, and purchased
  items are left off a printed shopping list. Print is in the Groceries list actions and the
  Planner menu.
- **The log over time.** Log → ⋯ → Week and month view: a bar per day against your calorie
  target, and the daily averages for calories, protein, carbs, fat and fiber. Averages count
  only the days you logged, since blank days would drag them down and say nothing.

### Checked
86 unit tests. A scripted phone-width walk-through: 30 checks covering the tree, re-parenting,
dragging with a real mouse drag, keyboard reordering, rename-carries-items, order surviving a
reload, the print stylesheet, and the log chart arithmetic. No console errors, nothing
overflowing. Screens looked at in light and dark.

### Not verified
Dragging with a finger on a real phone — it is built on pointer events and tested with a mouse
drag, which is the same code path, but the feel of it is not something a test can tell you.
Printing was checked by switching the browser to print media, not by printing on paper.

## Phase 7, done on 2026-11-16 — version 1.4.0

Brian's three requests, the four extras he picked, and the cheap Paprika gaps.

- **Check at home first.** Double tap any item — on the grocery list, or while ticking ingredients
  in the add-to-groceries sheet — and it turns amber and moves to a "Check at home first" section
  at the top of the list. Each one resolves with **Have it** (removed, and remembered in the
  pantry) or **Need it** (drops into the normal list). A single tap still just ticks an item off.
- **A whole week to groceries.** The planner has a **To groceries** button for the week on show.
  Ingredients are grouped under their recipe with All/None per recipe; things the pantry says you
  have start unticked.
- **Week at a glance.** A full-screen view of the week: seven days, recipe names, no photos, no
  buttons, and no tab bar over the bottom. The type shrinks until everything fits one screen, so a
  screenshot always has the whole week.
- **Duplicates combine.** Three recipes that each want an onion give one line, "3 yellow onion",
  naming all three recipes. Amounts are only added when the units agree; otherwise they are
  written side by side rather than guessed. "3 cloves garlic" is now filed as garlic, 3 cloves.
- **Lists per store.** Chips across the top of Groceries: the default list plus any you create
  (Costco, hardware store). Items can be moved between lists from the edit sheet.
- **Month view** on the planner: a dot per planned meal, tap a day to see and edit it.
- **What can I make?** on the Pantry tab ranks recipes by how much is already in the house.
- **The pantry fills itself.** Clearing purchased groceries with "remember we have them", or
  tapping Have it, updates the pantry without duplicates. Nobody has to keep it by hand.
- **Pinned recipes** (a strip at the top of Recipes) and **Recently deleted** (under More), both
  of which Paprika has and Cardamom did not.

### Checked
73 unit tests. A scripted phone-width walk-through of every item above: 31 checks, no console
errors, nothing overflowing. Screens looked at by eye in light and dark.

### Not verified
On a real phone: the feel of the double tap (the window is 350 ms), and the haptic tick. The
pantry-driven features are only as good as the pantry, which starts empty.

### Paprika gaps still open (found by comparing against Paprika's own help contents)
Subcategories; an in-app browser (Cardamom uses share-to-app and paste instead); dragging to
reorder. Custom aisles, custom meal types and print layouts were not audited in depth.

## Phase 6, done on 2026-11-15 — version 1.3.0

The first build someone other than Brian uses, so this pass was about the things you notice
in the hand rather than new features.

- **Any amount can be typed.** The quantity on a log entry is now an input as well as a pair
  of +/- buttons, so 1.3 portions is simply typed in. The same control sits in the scale sheet
  on a recipe, where you can type the number of servings you actually want and every
  ingredient line follows. The buttons still walk a ladder of common amounts when you are
  standing on one, and step to the next sensible rung when you are not. Junk input and
  out-of-range numbers fall back to the last good value instead of poisoning a total.
- **Opening a recipe is quicker, and browsing the library is much quicker.** Measured, not
  guessed — see below.
- **Warm stone and taupe, with olive used sparingly.** Cream and warm grey-brown carry the
  app; olive is kept for the active tab, primary buttons, progress bars and the like. Serif
  headings stayed. Every text pair was checked against its background: everything that
  carries meaning clears 4.5:1 in both light and dark.
- **Motion where things used to snap.** Tab changes, pages, sheets, check-offs, toggles,
  stepper changes and list items all move now: opacity plus 7–18px of travel, 180–280ms,
  ease-out, nothing that overshoots. All of it sits under the `prefers-reduced-motion` rule,
  which now also cancels the staggered delays.
- **A kinder first run.** An empty library offers joining the household first, since that is
  what the second person in the house actually needs. Sign-in explains what to do if you have
  no account yet, and the service's own error wording ("Invalid login credentials") is
  translated into something a person can act on. Storage failures now say what to do about it
  rather than printing the browser's message.

### The recipe-opening fix

Profiled against a seeded 473-recipe library with a photo on every recipe, at 384px with the
CPU throttled 4x to stand in for a phone. The cause was not the recipe page: it was that a
62px list thumbnail was decoding the same 1600px, ~425 KB photo as the hero. Browsing the
library left hundreds of full-size bitmaps decoded, and everything after that — including
opening a recipe — ran in the shadow of it.

What changed: a small thumbnail is made once per photo and stored beside it; full-size object
URLs are capped and reused; the one-time thumbnail backfill runs two at a time, newest first,
and stands aside whenever a full photo is being read; the recipe list no longer re-renders
when an overlay opens; the recipe page's ingredient, step and notable parsing is memoised; the
store only invalidates the derived lists a save actually touched; the hero photo starts
loading on the tap rather than after the page mounts; and Supabase, the zip reader and the
barcode decoder moved out of the first load.

Steady state, same library and settings, median of seven opens from deep in a scrolled list:

| | before | after |
|---|---|---|
| Recipe page on screen | 190 ms | 157 ms |
| Ingredients readable | 287 ms | 252 ms |
| Hero photo painted | 298 ms | 271 ms |
| Main thread blocked while opening | 6 ms | 0 ms |
| Blocking time scrolling the library | 287 ms | 67 ms |
| Long tasks scrolling the library | 15 | 6 |
| Decoded image data held after a scroll | 731 megapixels | 12 megapixels |
| JavaScript on first load | 538 KB (163 KB gzipped) | 259 KB (86 KB gzipped) |

The honest reading: on this emulated phone the open itself is 10–17% quicker, which is real
but modest. The large numbers are the scroll and the image memory, and those are the ones
likely to matter most on an actual Galaxy S23 — 731 megapixels of decoded photo is past the
point where a phone starts throwing bitmaps away and decoding them again, which is exactly
what "it took a while" feels like. First load is also half what it was.

### Also fixed in this pass
- Sync credentials were missing from the deployed build, so a fresh install said "sync is not
  switched on yet" and a new person could not join the household without pasting a database
  URL and key by hand. The project's public client credentials are baked back into the build.
- "Portion: one of 2 servings servings" — the word was doubled whenever a recipe's servings
  field already said "servings".
- The sticky action button at the foot of a sheet did not hide what scrolled under it.

## Phase 12, done on 2026-11-18 — version 1.9.0

Adding to a shopping list without opening the app.

- **A token-authenticated endpoint**, `cardamom-add`, alongside the two already deployed. It
  takes a sentence and writes straight to the household's lists. `verify_jwt` is off because a
  Shortcut cannot hold a login; the token is the whole of the authentication.
- **It speaks the app's own language.** "eggs" on its own, "add two pounds of carrots", "add
  nails to the hardware store". No list named means the grocery list. It combines with what is
  already on that list rather than adding a second line. The grammar is not reimplemented
  server-side: `supabase/functions/cardamom-add/lib/` holds copies of `src/lib/voice.js`,
  `grocery.js` and `ingredients.js`, and a unit test fails if the copies drift. **Change
  anything in `src/lib` and you must copy all three across and redeploy the whole function.**
- **Per-device tokens**, made and revoked under More → Add by voice. Named after the phone they
  go on, showing when each was last used. Revoking is a delete, so gone is gone, and one phone's
  token can go without disturbing the other's.
- **Two bugs found by testing the real endpoint.** Dictation writes small numbers as words, so
  "two pounds of carrots" became the item's *name* rather than a quantity and a thing; a leading
  number word is now converted, but only when a unit or "of" follows it, so "four cheese pizza"
  keeps its four. And "a hammer" landed in Meat & Seafood, because the aisle guesser matched
  "ham" inside "hammer" — that one affected typed entry too, not just voice.

### Checked
12 requests against the deployed function: bare item, spoken quantity, duplicate combining,
named list, partial list name, unknown list, explicit `?list=`, product name kept intact, bad
token, empty text, a non-add sentence, and a JSON POST. All behaved. Rows verified in the
database afterwards — right list, right quantity, right aisle. 111 unit tests pass, including
the drift guard on the three copied libraries.

### Not verified
The iPhone Shortcut itself, on a real iPhone — the endpoint it calls is tested, the Shortcut
around it is not. Nothing on Android. And the More → Add by voice screen has only been seen
signed out; making and revoking a token needs an account, which only Brian can create.

## Phase 13, done on 2026-11-22 — version 1.10.0

Brian's goal was hands full, screen off, "hey, add eggs to the grocery list". Android cannot
do the screen-off half, and the research below settles why. What it can do, it now does well.

### What was ruled out, and why — do not revisit
- **Bixby quick commands cannot carry a variable.** A quick command is a fixed stored sentence
  replayed to Bixby as though you had said it. There is no slot for "whatever I say next", so
  the item can never reach the endpoint. Settled from documentation; the phone test was not
  needed.
- **The Google Keep bridge cannot be read back.** Gemini will happily add to a Keep shopping
  list by voice, but the Keep API is Workspace-enterprise only and is not available for
  personal Google accounts, so Cardamom can never see that list. Google's own Keep list adds
  had also been breaking for people around August 2026.
- Taken with the Phase 12 finding (Google removed Assistant triggers that take variable input
  in 2022, and Gemini broke the Tasker workaround), **no supported path exists** on Android for
  a spoken item to reach a web address. Checked 2026-11-22.

### What was built instead
- **Continuous hands-free mode.** Say an item, hear it confirmed out loud, say the next one,
  then say "done". Nothing is tapped between items. It ends on "done", "that's all", "thanks"
  and similar, on the Done button, or on twelve seconds of silence — staying quiet is a
  perfectly good way to finish when your hands are full.
- **An opt-in setting, More → "Start listening when the app opens".** With it on, "Hey Google,
  open Cardamom" lands in listening mode, which is the closest Android gets to the original
  ask: the screen comes on, but nothing is touched. Off by default, because it would otherwise
  hijack opening the app to browse.
- The ways of saying you are finished live in `Voice.jsx`, not in `src/lib/voice.js`, because
  they only mean that inside a session — the endpoint has no use for "done" and the three
  copied libraries stay byte-identical, so the drift guard stays green and the edge function
  did not need redeploying.

### Checked
114 unit tests, including the session-ending phrases against things you would actually buy
("done" ends it, "done pasta" and "thank you cards" do not). Production build clean. The
settings row and the overlay were looked at on the live site.

### Not verified
**The listening loop itself has never heard a human voice.** I cannot speak into your phone,
and speech recognition needs a real microphone, so the add-hear-add-again cycle, the spoken
confirmations and the twelve-second silence timeout are untested end to end. That is the first
thing to try, and the most likely place for something to be wrong.
Nothing has been tried on a real phone at all, and still no account, household or token exists.

## Phase 15 — pre-flight before the first real cook (done 2026-11-27, Opus 5 low/medium)

Two things in one pass: the recipe page was wasting the screen, and the app had never been
read end to end looking for what could go wrong with two people using it at once.

### Density on the recipe page (done)
The header was taking a thousand pixels before the first ingredient. The photo is now a 92px
thumbnail beside the title, prep/cook/serves/difficulty/categories collapse to one quiet line,
and the repeated "Ingredients"/"Directions" headings are gone — the tab already says it. The
Scale button moved into the sticky tab row. Sixteen ingredients now fit on one phone screen
where six did before. Tapping a direction scrolls it to the top, clear of the sticky tabs.

### Bugs found and fixed (done)
1. **The timer could not make a sound.** The AudioContext was opened at the moment the timer
   went off, which is minutes away from the tap that started it — phones refuse to play audio
   from a context first opened away from a gesture, and only allow a handful of contexts per
   page before refusing outright. One context now, opened on the tap. *This is the one to
   test first on a real phone: start a one-minute timer and listen.*
2. **"1 clove + 2 cloves" instead of "3 cloves."** The unit comparison stripped two letters
   from anything ending in "es", so "cloves" became "clov" while "clove" stayed whole and the
   two never matched. Hit cloves, slices, ounces, pieces and packages — garlic especially.
3. **Sync could silently skip recipes.** The pull cursor was a timestamp alone, but a batch
   upsert stamps every row in it identically — importing a Paprika library writes a hundred
   recipes to the same microsecond. A page ending inside such a group then asked for
   "later than that timestamp" and skipped the rest. Those recipes never reached the other
   phone and nothing reported a problem. The cursor is now (updated_at, id).
4. **No error boundary anywhere.** One bad record turned the whole app into a white screen.
   There are now three: around the app, around each tab, and around each overlay, with a
   "go back" that recovers without losing anything.
5. **A recipe whose categories arrived as a string crashed every screen showing it.** Shapes
   are now tidied as records enter the store, so a bad import cannot take a screen down.
6. An unknown saved sort value crashed the library; a stray row from the server could throw
   mid-push; the item editor had an empty half-column leaving a gap.

### Checked
128 unit tests (6 new pinning the merge and the record tidying). A scripted phone-sized browser
walk: write a recipe, tab to directions, tap step 7 and watch it scroll clear of the tab bar,
cook mode through four steps with the timer chip appearing on the right one, add to groceries,
and the three merged lines coming out as "3 cloves", "4 slices", "3 cups". A deliberately
corrupt record was opened to confirm the boundary catches it and "go back" recovers. All six
tabs render with no console errors. Screenshots looked at in light and dark.

### Not verified — try these first on Sunday
- **The timer sound on a real phone.** Fixed blind; headless Chrome cannot prove it. Start a
  one-minute timer, lock the phone, and listen. Vibration is the fallback if sound fails.
- **Sync between two phones.** The cursor fix is reasoned and reviewed, not run against two
  real devices. Worth adding a recipe on one phone and watching it land on the other before
  you rely on it mid-cook.
- Anything needing the camera, the microphone or the Gemini key.
- The new layout on a real Galaxy screen rather than an emulated 412px one.

### Later
- Order the pull by (updated_at, id) on the server side with an index, if sync ever feels slow.
- The service worker still serves a stale lazy chunk after a deploy mid-session; the boundary
  now explains it and offers a reload, but a version check would be cleaner.

## Older notes — checked on 2026-11-15
- 60 unit tests pass (51 from before, plus 9 new covering typed amounts, the stepper ladder,
  bounds and junk input, scaling a line by a typed factor, and the portion wording).
- A scripted browser walk at 384px in light and dark and at 1280px: library, recipe, scale
  sheet, typing 1.3, log, log add, the amount control, groceries, planner, pantry and more.
  No console errors, nothing overflowing its box, no horizontal scroll on any screen.
  Screenshots were looked at by eye in both themes.
- A brand-new install with nothing in it was walked separately for the first-run screens.
- Typing 1.3 was verified end to end: the recipe header reads "1.3 servings" and the log
  preview reads 546 calories against a 420-calorie serving.

## Not yet verified
- Anything needing the Gemini key, a real camera or microphone, or a real phone install —
  the photo scan, describe-what-you-ate and a live barcode scan.
- Sync through the actual app UI — still needs both accounts, which only Brian can create.
  The credentials are in the build again, but a real two-device join has not been run.
- Real-device performance. The numbers above are an emulated phone, not a Galaxy S23.
- The one-time thumbnail backfill on Brian's real 473-recipe library. It is throttled and
  stands aside for anything in the foreground, but the first long scroll after this update
  will be doing extra work in the background.

## Outstanding
- Create both accounts, create the household, join from the second phone.
- Paste the Gemini key under More on each device and confirm the AI features.
- ~~8 leftover functions from the superseded design~~ Checked 2026-11-17: already gone. The
  database has exactly five `cardamom_` functions, all in use — `create_household` and
  `join_household` (authenticated only), `is_member` and `hid` (RLS helpers, not granted),
  and `touch` (a no-argument timestamp trigger). Nothing callable by `anon`.

## Deploying from here
Build, copy `dist/` over `docs/`, commit, push. Pages picks it up in about a minute.
`.env` holds the Supabase URL and publishable key and is gitignored — a build made without it
ships with sync switched off, which is how the credentials went missing before.
