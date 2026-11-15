// Single source for the in-app roadmap. `npm run roadmap` prints it.
export const VERSION = '1.3.0'
export const ROADMAP = [
  { n: 1, name: 'Recipe library and Paprika import', status: 'done', items: 'Library, search, categories, ratings, favorites, photos, editor, scaling and unit conversion, Paprika import and export' },
  { n: 2, name: 'Kitchen tools', status: 'done', items: 'Grocery list by aisle, pantry, weekly meal planner, menus, cook mode, timers, hands-free voice' },
  { n: 3, name: 'Smart importing', status: 'done', items: 'Links, shared links, clipboard text, photo scanning, social posts, barcodes, nutrition analysis, category suggestions' },
  { n: 4, name: 'Household sync and calendar feed', status: 'done', items: 'Sync live in the Cairn Supabase project, join by household code, live calendar feed, own page fetcher, permanent web address' },
  { n: 5, name: 'Daily food log', status: 'done', items: 'Per-person log with its own targets, logging from a recipe, a scanned package, a description or typed numbers; macros and micronutrients against Daily Values; what is in the food, goodies and cautions' },
  { n: 6, name: 'Polish and the first shared build', status: 'done', items: 'Typable part-portions anywhere an amount is set, a faster recipe page (half the first load, a tenth of the image memory), the warm stone and olive theme, motion throughout, and a kinder first run' },
  { n: 7, name: 'What real kitchen use turns up', status: 'next', items: 'Month view on the planner, more than one grocery list, drag to reorder, a week and month view of the log', needs: 'Opus 5, medium effort' },
  { n: 8, name: 'Hands-free beyond cook mode', status: 'later', items: 'Listening from any screen, launching straight into hands-free, and dictation into the fields that matter. Replaces the Alexa skill, which needed a developer account and a server to host it', needs: 'Opus 5, medium effort' },
]
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('roadmap.js')) for (const p of ROADMAP) console.log(`${p.n}. [${p.status}] ${p.name}${p.needs ? ' (' + p.needs + ')' : ''}`)
