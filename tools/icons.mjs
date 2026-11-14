import { chromium } from 'playwright'
import fs from 'node:fs'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const p = await b.newPage()
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable.png', 512, 1]]) {
  await p.setViewportSize({ width: size, height: size })
  const inner = pad ? svg.replace('rx="112"', 'rx="0"').replace('<g transform="rotate(-38 256 256)">', '<g transform="rotate(-38 256 256) translate(51 51) scale(.8)">') : svg
  await p.setContent(`<body style="margin:0;background:transparent">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await p.screenshot({ path: 'public/' + name, omitBackground: true })
}
await b.close()
