// Снимает с сайта реальные дизайн-токены (computed styles) + скриншоты.
// Запуск:  node tools/extract.mjs https://www.hashicorp.com/en
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'

const URL = process.argv[2] || 'https://www.hashicorp.com/en'
const OUT = 'tools/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${OUT}/hero.png` })

const tokens = await page.evaluate(() => {
  const cs = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      text: el.textContent.trim().slice(0, 40),
      top: Math.round(r.top),
      bg: s.backgroundColor,
      color: s.color,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      border: s.borderTopWidth + ' solid ' + s.borderTopColor,
      borderRadius: s.borderRadius,
      padding: s.padding,
      boxShadow: s.boxShadow.slice(0, 60),
      height: Math.round(r.height),
    }
  }
  // кнопко-подобные элементы: есть фон или рамка, компактный текст
  const buttons = [...document.querySelectorAll('a,button')]
    .map((el) => ({ el, r: el.getBoundingClientRect(), s: getComputedStyle(el) }))
    .filter(({ el, r, s }) => {
      const hasBg = !['rgba(0, 0, 0, 0)', 'transparent'].includes(s.backgroundColor)
      const hasBorder = parseFloat(s.borderTopWidth) > 0
      const t = el.textContent.trim()
      return t.length > 1 && t.length < 26 && r.width > 50 && r.height > 22 && r.height < 70 && (hasBg || hasBorder)
    })
    .sort((a, b) => a.r.top - b.r.top)
    .slice(0, 8)
    .map(({ el }) => cs(el))

  const h1 = document.querySelector('h1')
  return {
    body: cs(document.body),
    h1: cs(h1),
    h1_descendant_colors: [...(h1?.querySelectorAll('*') || [])]
      .slice(0, 6)
      .map((e) => ({ t: e.textContent.trim().slice(0, 20), color: getComputedStyle(e).color })),
    subtitle: cs(h1?.parentElement?.querySelector('p')),
    section_h2: [...document.querySelectorAll('h2')].slice(0, 3).map(cs),
    buttons,
  }
})

writeFileSync(`${OUT}/tokens.json`, JSON.stringify(tokens, null, 2))
console.log(JSON.stringify(tokens, null, 2))
await browser.close()
