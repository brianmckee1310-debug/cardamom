# Cardamom roadmap

Personal Paprika-style recipe manager for Brian and his wife. Updated 2026-11-16, version 1.4.0.

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
| 8 | Paprika parity, the rest: subcategories, drag to reorder, custom aisles and meal types, a replacement for the in-app browser | Next | Opus 5 or Fable 5.2, medium effort |
| 9 | Hands-free beyond cook mode | Later | Opus 5, medium effort |

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

## Phase 8 — Paprika parity, the rest. Next. Opus 5 or Fable 5.2, medium effort.
Subcategories, drag to reorder, custom aisles and meal types, print layouts, a replacement for
Paprika's in-app browser, and a week and month view of the food log.

## Phase 9 — hands-free beyond cook mode. Later. Opus 5, medium effort.

This replaces the Alexa skill, which is dropped. A custom Alexa skill (or a Google Assistant
action) needs a developer account and a server to host the endpoint, which breaks the rule
that everything stays free. These three get most of the same result with what is already here
— the Web Speech API the cook mode voice control already uses, and the phone itself.

1. **Listening from any screen.** Lift the cook-mode voice listener up to the whole app, with
   a mic in the title bar and commands for the things you would want your hands free for:
   "add butter to the groceries", "log a bowl of oatmeal", "start a 12 minute timer", "open
   the short ribs". Free, no account, runs on the phone. The largest of the three.
   *Opus 5, medium effort.*
2. **Landing straight in hands-free.** Manifest shortcuts and deep links (`?cook=<recipe>`,
   `?add=groceries`, `?log=1`), so long-pressing the icon, a home-screen shortcut, or telling
   the phone to open Cardamom drops you on the right screen with the mic already live. No
   server, nothing to sign up for, and it is what makes option 1 worth having mid-recipe.
   *Opus 5, low effort.*
3. **Dictation into the fields that matter.** A mic beside the describe-what-you-ate box, the
   grocery add box and the recipe notes, so a sticky-handed entry is spoken rather than typed.
   Smallest of the three and useful on its own. *Opus 5, low effort.*

Worth scoping 2 and 3 together first: they are cheap and they are most of the day-to-day
benefit. 1 is the one to think about properly.

## Checked on 2026-11-15
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
- 8 leftover functions from the superseded design (`cardamom_create`, `cardamom_join`,
  `cardamom_feed`, `cardamom_pull`, `cardamom_push`, `cardamom_photo_get`,
  `cardamom_photo_ids`, `cardamom_photo_put`) are dead but still callable by `anon`. Drop them.

## Deploying from here
Build, copy `dist/` over `docs/`, commit, push. Pages picks it up in about a minute.
`.env` holds the Supabase URL and publishable key and is gitignored — a build made without it
ships with sync switched off, which is how the credentials went missing before.
