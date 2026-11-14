// Single source for the in-app roadmap. `npm run roadmap` prints it.
export const VERSION = '1.1.0'
export const ROADMAP = [
  { n: 1, name: 'Recipe library and Paprika import', status: 'done', items: 'Library, search, categories, ratings, favorites, photos, editor, scaling and unit conversion, Paprika import and export' },
  { n: 2, name: 'Kitchen tools', status: 'done', items: 'Grocery list by aisle, pantry, weekly meal planner, menus, cook mode, timers, hands-free voice' },
  { n: 3, name: 'Smart importing', status: 'done', items: 'Links, shared links, clipboard text, photo scanning, social posts, barcodes, nutrition analysis, category suggestions' },
  { n: 4, name: 'Household sync and calendar feed', status: 'done', items: 'Sync live in the Cairn Supabase project, join by household code, live calendar feed, own page fetcher, permanent web address' },
  { n: 5, name: 'Polish from real kitchen use', status: 'next', items: 'Whatever a few weeks of cooking turns up: month view planner, multiple grocery lists, drag to reorder', needs: 'Opus 5, medium effort' },
  { n: 6, name: 'Alexa skill', status: 'later', items: 'Only if the voice mode is not enough; needs an Amazon developer account and a small server', needs: 'Opus 5.5, high effort' },
]
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('roadmap.js')) for (const p of ROADMAP) console.log(`${p.n}. [${p.status}] ${p.name}${p.needs ? ' (' + p.needs + ')' : ''}`)
