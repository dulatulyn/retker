import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const OUT = '/Users/nurasyl/coding/hackathons/retker/tools/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' })

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.fill('input[name=username]', 'demo')
await page.fill('input[name=password]', 'demo12345')
await page.click('button[type=submit]')
await page.waitForTimeout(3000)
await page.screenshot({ path: `${OUT}/app_real.png`, fullPage: true })

// AI-аналитик
try {
  await page.click('text=AI-аналитик'); await page.waitForTimeout(700)
  await page.click('text=Сколько у нас инцидентов?'); await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/app_chat.png` })
} catch (e) { console.log('chat', e.message) }

// События + accordion
try {
  await page.click('text=События'); await page.waitForTimeout(1000)
  await page.click('tbody tr td:nth-child(4)'); await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/app_events.png`, fullPage: true })
} catch (e) { console.log('events', e.message) }

await browser.close()
console.log('ok', page.url())
