/* Снимки отдельных экранов: node tools/view.cjs url width height out y1,y2,...  */
const { chromium } = require('playwright');
(async () => {
  const [url, w, h, out, ys] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('height', total, errs.join(' | '));
  const list = [];
  for (const t of (ys || '0').split(',')) {
    if (/^[\d.]+$/.test(t)) list.push(+t);
    else list.push(await p.evaluate(sel => { const [s, off] = sel.split('@'); const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + scrollY + (+off || 0) : 0; }, t));
  }
  for (let i = 0; i < list.length; i++) {
    await p.evaluate(y => window.scrollTo(0, y), list[i]); await p.waitForTimeout(1600);
    await p.screenshot({ path: `${out}-${i}.png` });
  }
  await b.close();
})();
