/* Генерирует img/og.png, img/favicon-32.png, img/apple-touch-icon.png */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8080/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' });
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.concept-bar,.site-header,.hero__issue,.hero__place,.hero__lead,.hero__cta,.hero__stats,.hero__sticker{display:none!important}.hero__cover--2{left:40px!important;top:62%!important}.hero{padding-top:34px}' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'img/og.png' });
  const svg = fs.readFileSync('img/favicon.svg', 'utf8');
  for (const [s, f] of [[32, 'img/favicon-32.png'], [180, 'img/apple-touch-icon.png']]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<style>html,body{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
    await p.screenshot({ path: f, omitBackground: true });
  }
  await b.close();
})();
