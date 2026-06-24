// Полностраничный скриншот для ревью. Запуск: node tools/shot.mjs http://localhost:5173
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
})
await page.goto(process.argv[2] || 'http://localhost:5173', {
  waitUntil: 'networkidle',
  timeout: 60000,
})
await page.waitForTimeout(1200)
// прокрутка, чтобы триггернуть scroll-reveal анимации
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let y = 0
    const step = () => {
      window.scrollTo(0, y)
      y += Math.round(window.innerHeight * 0.8)
      if (y < document.body.scrollHeight + window.innerHeight) setTimeout(step, 130)
      else {
        window.scrollTo(0, 0)
        setTimeout(resolve, 400)
      }
    }
    step()
  })
})
await page.waitForTimeout(800)
await page.screenshot({ path: 'tools/shots/full.png', fullPage: true })
await browser.close()
console.log('ok')
