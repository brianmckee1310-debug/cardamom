// Browser walk-through against the built app. Usage: node tests/e2e.mjs [path to real Paprika export]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const EXPORT = process.argv[2] || process.env.PAPRIKA_EXPORT
const SHOTS = 'shots'; fs.mkdirSync(SHOTS, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', detached: true })
await new Promise((r) => setTimeout(r, 2500))
const results = []; let failed = 0
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++ }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 384, height: 824 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text()) && errors.push(m.text()))
const fit = async (label) => {
  const bad = await page.evaluate(() => { const w = document.documentElement.clientWidth; const top = [...document.querySelectorAll('.scrim,.page')].pop() || document.querySelector('.app'); const out = []; for (const el of top.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > w + 1 || r.left < -1) && !el.closest('.gallery-strip,.photo-strip')) out.push(String(el.className || el.tagName)) } return [...new Set(out)].slice(0, 5) })
  check(`fit ${label}`, bad.length === 0, bad.join(', '))
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` })
const tab = (n) => page.click(`.tabs button:has-text("${n}")`)
const total = async () => (await page.textContent('.top-title small')).trim()
try {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('.empty')
  check('empty state shown', await page.isVisible('text=No recipes yet'))
  await shot('01-empty')

  // --- Paprika import
  await page.click('text=Import from Paprika')
  const t0 = Date.now()
  if (EXPORT && fs.existsSync(EXPORT)) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Choose export file')])
    await chooser.setFiles(EXPORT)
    await page.waitForSelector('.done-card', { timeout: 300000 })
    const msg = await page.textContent('.done-card')
    check('real export imported', /473 recipes imported/.test(msg), msg + ` in ${Math.round((Date.now() - t0) / 1000)}s`)
    await shot('02-import-done')
    await page.click('.done-card >> text=Done')
  } else { check('real export available', false, 'no export path given'); await page.click('.sheet-head .iconbtn') }
  await page.waitForSelector('.recipe-row')
  check('library count', (await total()) === '473', await total())
  const stored = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('cardamom'); r.onsuccess = () => { const tx = r.result.transaction(['items', 'photos']); const a = tx.objectStore('items').count(), b = tx.objectStore('photos').count(); tx.oncomplete = () => res([a.result, b.result]) } }))
  check('stored recipes and photos', stored[0] === 473 && stored[1] >= 438, stored.join(' / '))
  await page.waitForSelector('.thumb img'); await page.waitForTimeout(600)
  await shot('03-library'); await fit('library 384')

  await page.reload(); await page.waitForSelector('.recipe-row')
  check('data survives reload', (await total()) === '473')

  // --- search + category
  await page.fill('input[type=search]', 'miso soup'); await page.waitForTimeout(200)
  check('search finds miso soup', await page.isVisible('text=15-Minute Miso Soup with Greens and Tofu'))
  await page.fill('input[type=search]', '')
  await page.click('.top-title'); await page.waitForSelector('.sheet'); await page.waitForTimeout(350); await shot('04-categories')
  await page.click('.sheet .row-main:has-text("Sourdough")'); await page.waitForTimeout(250)
  check('category filter', (await total()) === '10', await total())
  await page.click('.top-title'); await page.click('.sheet .row-main:has-text("All recipes")')

  // --- recipe view
  await page.fill('input[type=search]', 'miso soup'); await page.click('text=15-Minute Miso Soup with Greens and Tofu')
  await page.waitForSelector('.recipe-body .hero img'); await page.waitForTimeout(400)
  await shot('05-recipe'); await fit('recipe 384')
  check('ingredients shown', (await page.locator('.ings li').count()) >= 5)
  check('categories shown', await page.isVisible('.recipe-head .chip:has-text("Asian")'))
  await page.click('.pillbtn'); await page.click('.sheet .seg button:has-text("2×")'); await page.waitForTimeout(300); await shot('05b-scale'); await page.click('.sheet-head .iconbtn')
  const first = await page.textContent('.ings li:first-child')
  check('scaling doubles', first.startsWith('8 cups vegetable broth'), first)
  await page.locator('.ings li button').first().click()
  check('ingredient crosses off', await page.isVisible('.ings li.done'))
  if (await page.locator('.time-link').count()) { await page.locator('.time-link').first().click(); check('timer starts from step text', await page.isVisible('.timer')); await page.waitForTimeout(300); await shot('06-timer'); await page.click('.timer .iconbtn') } else check('timer link present', false)
  await page.click('.iconbtn[aria-label="Add to favorites"]'); check('favorite toggles', await page.waitForSelector('.iconbtn[aria-label="Remove from favorites"]', { timeout: 3000 }).then(() => true, () => false))

  await page.click('.actionbar >> text=Groceries'); await page.waitForSelector('.sheet .checks'); await page.waitForTimeout(350); await shot('07-add-groceries'); await fit('add groceries 384')
  await page.click('.sheet .btn.sticky'); await page.waitForTimeout(400)
  await page.click('.actionbar >> text=Plan'); await page.waitForSelector('.daychips'); await page.waitForTimeout(350); await shot('08-plan-sheet'); await fit('plan sheet 384')
  await page.click('text=Add to plan'); await page.waitForTimeout(400)
  await page.click('.actionbar >> text=Cook'); await page.waitForSelector('.cook-step'); await page.waitForTimeout(350); await shot('09-cook'); await fit('cook 384')
  await page.click('.cook-nav >> text=Next'); check('cook mode advances', (await page.textContent('.cook-n')).startsWith('Step 2'))
  await page.click('.cook .iconbtn[aria-label="Ingredients"]'); check('cook ingredients scaled', (await page.textContent('.cook .ings')).includes('8 cups'))
  await page.goBack(); await page.waitForTimeout(350)

  // --- edit
  await page.click('.iconbtn[aria-label="Edit"]'); await page.waitForSelector('.form'); await page.waitForTimeout(400); await shot('10-edit'); await fit('edit 384')
  check('editor shows existing photo', (await page.locator('.photo-tile').count()) === 1)
  await page.fill('.form input >> nth=0', '15-Minute Miso Soup (ours)'); await page.click('.bar .btn.primary'); await page.waitForTimeout(400)
  check('edit saved', (await page.textContent('.recipe-head h1')) === '15-Minute Miso Soup (ours)')
  await page.goBack(); await page.waitForTimeout(350); await page.fill('input[type=search]', '')

  // --- grocery tab
  await tab('Groceries'); await page.waitForSelector('.groups'); await shot('11-groceries'); await fit('groceries 384')
  const g = await page.locator('.groups .row').count(); check('grocery items from recipe', g >= 5, String(g))
  check('grocery aisles grouped', await page.isVisible('.group-h:has-text("Produce")') || await page.isVisible('.group-h:has-text("Pantry")'))
  await page.fill('.search.add input', '2 lb carrots'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  check('quick add parses amount', await page.isVisible('.row:has-text("carrots") small:has-text("2 lb")'))
  await page.click('.row:has-text("carrots") .row-main'); await page.click('text=/Clear 1 purchased/'); await page.click('text=Move to pantry'); await page.waitForTimeout(300)
  await tab('Pantry'); check('purchased item moved to pantry', await page.isVisible('.row:has-text("carrots")')); await shot('12-pantry'); await fit('pantry 384')

  // --- planner
  await tab('Planner'); await page.waitForSelector('.week'); check('planned meal shows', await page.isVisible('.meal:has-text("Miso Soup")')); await page.waitForTimeout(300); await shot('13-planner'); await fit('planner 384')
  await page.click('.top .iconbtn[aria-label="Week actions"]')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download calendar file')])
  const ics = fs.readFileSync(await dl.path(), 'utf8'); check('calendar file has the meal', /BEGIN:VEVENT[\s\S]*Miso Soup/.test(ics))

  // --- paste import without AI
  await tab('Recipes'); await page.click('.top .iconbtn[aria-label="Add recipe"]'); await page.waitForSelector('.menu.tiles'); await page.waitForTimeout(350); await shot('14-add-menu')
  await page.click('text=Paste text'); await page.fill('.sheet textarea', 'Test Toast\nServes 2\nIngredients\n2 slices sourdough bread\n1 tbsp butter\nDirections\nToast the bread for 3 minutes.\nSpread with butter.'); await page.click('text=Make recipe')
  await page.waitForSelector('.page.edit'); await page.waitForTimeout(300)
  check('paste makes a draft', (await page.inputValue('.form input >> nth=0')) === 'Test Toast')
  check('category suggested offline', await page.isVisible('.suggest .chip:has-text("Sourdough")')); await shot('15-draft')
  await page.click('.suggest .chip:has-text("Sourdough")'); await page.click('.bar .btn.primary'); await page.waitForSelector('.recipe-head')
  check('new recipe saved with category', await page.isVisible('.recipe-head .chip:has-text("Sourdough")'))
  await page.click('.iconbtn[aria-label="More actions"]'); await page.waitForTimeout(300); await shot('15b-recipe-menu'); await page.click('text=Delete recipe'); await page.waitForSelector('.toast:has-text("Deleted")')
  check('delete drops count', (await total()) === '473', await total())
  await page.click('.toast >> text=Undo'); await page.waitForTimeout(300); check('undo restores', (await total()) === '474', await total())

  // --- more, menus
  await tab('More'); await page.waitForSelector('text=Household and sync'); await shot('16-more'); await fit('more 384')
  await page.click('text=Menus'); await page.fill('.page .search.add input', 'Friendsgiving'); await page.keyboard.press('Enter'); await page.waitForSelector('text=Add recipes')
  await page.click('text=Add recipes'); await page.fill('.sheet input[type=search]', 'apple'); await page.locator('.sheet .recipe-row .row-main').first().click(); await page.locator('.sheet .recipe-row .row-main').nth(1).click(); await page.click('.sheet .btn.sticky'); await page.waitForTimeout(500)
  check('menu holds recipes', (await page.locator('.page .recipe-row').count()) === 2); await shot('17-menu'); await fit('menu 384')
  await page.goBack(); await page.waitForTimeout(300); await page.goBack(); await page.waitForTimeout(300)
  await page.click('text=Household and sync'); await page.waitForSelector('text=Sync is not switched on yet'); await shot('18-household'); await page.goBack(); await page.waitForTimeout(300)
  await page.click('text=Roadmap'); await page.waitForSelector('.roadmap'); await page.waitForTimeout(300); await shot('19-roadmap'); await page.goBack(); await page.waitForTimeout(300)

  await tab('Groceries'); await page.click('.iconbtn[aria-label="Scan a barcode"]'); await page.waitForSelector('.scanner'); await page.waitForTimeout(900); await shot('20-barcode'); await fit('barcode 384'); await page.click('.sheet-head .iconbtn'); await page.waitForTimeout(300)

  // --- export round trip
  await tab('More')
  const [ex] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('text=Export all recipes')])
  const size = fs.statSync(await ex.path()).size; check('export all produces a file', size > 1e6, `${Math.round(size / 1e6)} MB`)
  fs.copyFileSync(await ex.path(), 'shots/roundtrip.paprikarecipes')

  // --- other widths
  await tab('Recipes')
  for (const w of [320, 412]) { await page.setViewportSize({ width: w, height: 800 }); await page.waitForTimeout(200); await fit(`library ${w}`); await page.locator('.recipe-row .row-main').first().click(); await page.waitForSelector('.recipe-body'); await page.waitForTimeout(350); await fit(`recipe ${w}`); if (w === 320) await shot('21-recipe-320'); await page.goBack(); await page.waitForTimeout(350) }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400)
  await page.locator('.recipe-row .row-main').nth(3).click(); await page.waitForSelector('.recipe-body'); await page.waitForTimeout(700); await shot('22-laptop')
  await ctx.setOffline(true); await page.fill('input[type=search]', 'pizza'); await page.waitForTimeout(200); check('works offline once loaded', (await page.locator('.recipe-row').count()) > 3); await ctx.setOffline(false)
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) { check('walk-through completed', false, e.message.split('\n')[0]); await shot('zz-failure').catch(() => {}) }
await browser.close(); try { process.kill(-server.pid) } catch { /* gone */ }
console.log(results.join('\n')); console.log(`\n${results.length - failed} passed / ${failed} failed`)
process.exit(failed ? 1 : 0)
