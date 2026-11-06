/* Скриншоты и проверки: node tools/shoot.cjs [папка] [ширины через запятую]
   Нужен локальный сервер: python3 -m http.server 8080 */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = process.argv[2] || 'screenshots';
const WIDTHS = (process.argv[3] || '375,768,1280,1920').split(',').map(Number);
const PAGES = (process.env.PAGES || 'index,catalog,book,events,about').split(',');
const H = { 375: 812, 768: 1024, 1280: 800, 1920: 1080 };

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 600));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: H[w] || 900 }, deviceScaleFactor: 1, reducedMotion: process.env.RM ? 'reduce' : 'no-preference', javaScriptEnabled: !process.env.NOJS });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('requestfailed', r => errors.push('failed: ' + r.url()));
      const url = BASE + p + '.html' + (p === 'book' ? '?id=olhovka#olhovka' : '');
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await scrollThrough(page);
      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        document.querySelectorAll('body *').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.sprite,.curtain,.marquee,.ribbon__track,dialog,[popover],.cursor')) return;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > vw + 1 || r.left < -1)) {
            /* учитываем обрезку предками с overflow: clip/hidden */
            let a = el.parentElement, clipped = false;
            while (a && a !== document.body) { const o = getComputedStyle(a); if (/(clip|hidden)/.test(o.overflowX) || /(clip|hidden)/.test(o.overflow)) { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1 && ar.left >= -1) { clipped = true; break; } } a = a.parentElement; }
            if (!clipped) bad.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
          }
        });
        return { scrollW: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 8) };
      });
      const file = `${OUT}/${p}-${w}.png`;
      await page.screenshot({ path: file, fullPage: true });
      report.push({ page: p, w, errors, overflow });
      console.log(p, w, 'errors:', errors.length, errors.slice(0, 3).join(' | '), 'scrollW', overflow.scrollW, '/', overflow.vw, overflow.bad.length ? 'OVER: ' + overflow.bad.join('; ') : '');
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
})();
