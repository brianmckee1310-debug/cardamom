// Single source for the in-app roadmap. `npm run roadmap` prints it.
export const VERSION = '1.8.0'
export const ROADMAP = [
  { n: 1, name: 'Recipe library and Paprika import', status: 'done', items: 'Library, search, categories, ratings, favorites, photos, editor, scaling and unit conversion, Paprika import and export' },
  { n: 2, name: 'Kitchen tools', status: 'done', items: 'Grocery list by aisle, pantry, weekly meal planner, menus, cook mode, timers, hands-free voice' },
  { n: 3, name: 'Smart importing', status: 'done', items: 'Links, shared links, clipboard text, photo scanning, social posts, barcodes, nutrition analysis, category suggestions' },
  { n: 4, name: 'Household sync and calendar feed', status: 'done', items: 'Sync live in the Cairn Supabase project, join by household code, live calendar feed, own page fetcher, permanent web address' },
  { n: 5, name: 'Daily food log', status: 'done', items: 'Per-person log with its own targets, logging from a recipe, a scanned package, a description or typed numbers; macros and micronutrients against Daily Values; what is in the food, goodies and cautions' },
  { n: 6, name: 'Polish and the first shared build', status: 'done', items: 'Typable part-portions anywhere an amount is set, a faster recipe page (half the first load, a tenth of the image memory), the warm stone and olive theme, motion throughout, and a kinder first run' },
  { n: 7, name: 'Shopping and planning upgrade', status: 'done', items: 'Check-at-home flag by double tap, whole week to groceries grouped by recipe, duplicates combined, lists per store, month view, week at a glance for screenshots, what can I make, pinned recipes, recently deleted' },
  { n: 8, name: 'Paprika parity, the rest', status: 'done', items: 'Subcategories with Parent > Child names, drag to reorder, editable aisles and meal types, printable grocery list and week, a week and month view of the food log' },
  { n: 9, name: 'Hands-free', status: 'done', items: 'A microphone on every screen for adding to a list, timers, opening and cooking a recipe, logging food and asking what is for dinner; home-screen shortcuts; dictation into the grocery and food-log boxes; the screen never sleeps' },
  { n: 10, name: 'Less scrolling', status: 'done', items: 'Ingredients, Directions and More as tabs on a phone, sticky so they stay reachable; both columns still side by side on a wide screen and when printing' },
  { n: 11, name: 'Mobile only', status: 'done', items: 'Desktop layout dropped; every screen designed at phone width, every tap target at least 44px, and a big screen just centres the phone column' },
  { n: 12, name: 'Add to a list from Siri', status: 'next', items: 'A small endpoint so an iPhone Shortcut, or anything else that can make a web request, can drop an item on a list without opening the app', needs: 'Opus 5, medium effort' },
]
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('roadmap.js')) for (const p of ROADMAP) console.log(`${p.n}. [${p.status}] ${p.name}${p.needs ? ' (' + p.needs + ')' : ''}`)
