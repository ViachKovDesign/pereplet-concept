/* Автотест сценария и снимки состояний.
   node tools/test.cjs   (нужен сервер: python3 -m http.server 8080) */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = process.argv[2] || 'screenshots/states';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78, ...opts });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = p => {
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  };

  /* ---------- 1. Сценарий: поиск → фильтр → книга → отложить → счётчик +1 ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); watch(page);
  await page.goto(BASE + 'catalog.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const before = Number(await page.textContent('[data-reserved-count]'));
  ok(before === 0, 'счётчик в шапке стартует с 0');

  await page.fill('[data-q]', 'север');
  await page.waitForTimeout(1200);
  let visible = await page.$$eval('.card--cat:not(.is-hidden)', els => els.map(e => e.dataset.id));
  ok(visible.length >= 1 && visible.includes('sever'), `поиск «север» нашёл: ${visible.join(', ')}`);

  await page.click('.chip:has(input[value="Поэзия"])');
  await page.waitForTimeout(1200);
  visible = await page.$$eval('.card--cat:not(.is-hidden)', els => els.map(e => e.dataset.id));
  ok(visible.length === 1 && visible[0] === 'sever', `фильтр «Поэзия» оставил: ${visible.join(', ')}`);
  ok((await page.textContent('[data-count-label]')).includes('1 книгу'), 'подпись: ' + await page.textContent('[data-count-label]'));
  await shot(page, 'catalog-search-filter');

  /* пустое состояние */
  await page.fill('[data-q]', 'зззз');
  await page.waitForTimeout(1200);
  ok(await page.isVisible('[data-empty]'), 'пустое состояние показано');
  await page.evaluate(() => document.querySelector('[data-empty]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await shot(page, 'catalog-empty');
  await page.fill('[data-q]', 'север');
  await page.waitForTimeout(1200);

  /* переход в книгу: снимок посередине «перелёта» */
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.card--cat:not(.is-hidden)').getBoundingClientRect().top + scrollY - 120));
  await page.waitForTimeout(800);
  await Promise.all([
    page.waitForURL(/book\.html\?id=sever/),
    page.click('.card--cat:not(.is-hidden) .card__link')
  ]);
  await page.waitForTimeout(350);
  await shot(page, 'transition-mid');
  await page.waitForTimeout(1600);
  ok(await page.isVisible('#sever .book__title'), 'открылась страница книги «Карманный север»');
  ok((await page.title()).includes('Карманный север'), 'заголовок вкладки: ' + await page.title());
  await shot(page, 'book-opened');

  /* отложить */
  await page.click('#sever .reserve summary');
  await page.waitForTimeout(500);
  await page.click('#sever [data-reserve-form] button[type=submit]');
  await page.waitForTimeout(300);
  ok((await page.textContent('#sever [data-error]')).length > 0, 'валидация: пустая форма показывает ошибку');
  await page.fill('#rn-sever', 'Слава');
  await page.fill('#rp-sever', '+7 900 123-45-67');
  await shot(page, 'book-reserve-form');
  await page.click('#sever [data-reserve-form] button[type=submit]');
  await page.waitForTimeout(1600);
  const after = Number(await page.textContent('[data-reserved-count]'));
  ok(after === before + 1, `счётчик в шапке: ${before} → ${after}`);
  ok((await page.textContent('#sever [data-done]')).includes('Отложили на 3 дня (демо)'), 'сообщение «Отложили на 3 дня (демо)»');
  await shot(page, 'book-reserved');
  await page.click('[data-reserved-open]');
  await page.waitForTimeout(900);
  ok(await page.isVisible('.drawer__list li'), 'в ящике «Отложено» есть книга');
  await shot(page, 'drawer');
  await page.click('[data-drawer-close]');

  /* счётчик переживает переход на другую страницу */
  await page.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  ok(Number(await page.textContent('[data-reserved-count]')) === after, 'счётчик сохранился на главной (localStorage)');

  /* ---------- 2. Главная: настроения ---------- */
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.moods').getBoundingClientRect().top + scrollY + 150));
  await page.waitForTimeout(1500);
  await shot(page, 'mood-tired');
  await page.click('label[for="mood-cry"]');
  await page.waitForTimeout(1500);
  const cryVisible = await page.isVisible('.mood-panel[data-mood="cry"]');
  const tiredHidden = !(await page.isVisible('.mood-panel[data-mood="tired"]'));
  ok(cryVisible && tiredHidden, '«Что почитать, если…»: переключилось на «хочу поплакать»');
  await shot(page, 'mood-cry');
  await page.click('label[for="mood-gift"]');
  await page.waitForTimeout(1500);
  await shot(page, 'mood-gift');

  /* подписка */
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.subscribe').getBoundingClientRect().top + scrollY));
  await page.waitForTimeout(1200);
  await page.fill('#sub-email', 'kniga@example.com');
  await page.click('.subscribe__form button');
  await page.waitForTimeout(900);
  ok((await page.textContent('.subscribe [data-done]')).includes('Готово'), 'подписка (демо) отвечает');
  await shot(page, 'subscribe-done');

  /* наведение на обложку */
  await page.goto(BASE + 'catalog.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const card = await page.$('.card--cat .card__link');
  await card.hover();
  await page.waitForTimeout(900);
  const box = await card.boundingBox();
  await shot(page, 'cover-hover', { clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: box.width + 120, height: Math.min(700, box.height + 80) } });

  /* ---------- 3. Афиша: запись ---------- */
  await page.goto(BASE + 'events.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.click('[data-signup="velesov"]');
  await page.waitForTimeout(1600);
  ok(await page.$eval('[data-event-select]', s => s.value) === 'velesov', 'кнопка «Записаться» выбрала нужное мероприятие');
  await page.fill('#ev-name', 'Слава');
  await page.fill('#ev-phone', '89001234567');
  await page.selectOption('#ev-guests', '2');
  await page.click('.signup__form button[type=submit]');
  await page.waitForTimeout(1200);
  ok((await page.textContent('.signup [data-done]')).includes('Записали'), 'запись на мероприятие (демо)');
  await shot(page, 'events-signup-done');
  await ctx.close();

  /* ---------- 4. Мобильные состояния ---------- */
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); watch(mp);
  await mp.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1200);
  await mp.click('.menu-btn');
  await mp.waitForTimeout(800);
  ok(await mp.isVisible('#menu'), 'мобильное меню открывается (popover)');
  await shot(mp, 'mobile-menu');
  await mp.click('.menu__close');
  await mp.goto(BASE + 'catalog.html?genre=%D0%94%D0%B5%D1%82%D1%8F%D0%BC', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1200);
  const kids = await mp.$$eval('.card--cat:not(.is-hidden)', els => els.length);
  ok(kids === 4, `фильтр из адреса (?genre=Детям): ${kids} книги`);
  await mp.evaluate(() => window.scrollTo(0, document.querySelector('.catalog').getBoundingClientRect().top + scrollY - 60));
  await mp.waitForTimeout(800);
  await shot(mp, 'mobile-catalog-filtered');
  await m.close();

  /* ---------- 5. Без анимаций и без JS ---------- */
  for (const [name, opts] of [['reduced-motion', { reducedMotion: 'reduce' }], ['no-js', { javaScriptEnabled: false }]]) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
    const p = await c.newPage(); watch(p);
    for (const pg of ['index', 'catalog', 'book']) {
      await p.goto(BASE + pg + '.html' + (pg === 'book' ? '?id=kit#kit' : ''), { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${OUT}/${name}-${pg}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
    }
    if (name === 'no-js') {
      await p.goto(BASE + 'catalog.html', { waitUntil: 'networkidle' });
      ok((await p.$$('.card--cat')).length === 24 && await p.isVisible('.card--cat:last-child'), 'без JS: все 24 книги видны в каталоге');
      await p.goto(BASE + 'book.html?id=kit#kit', { waitUntil: 'networkidle' });
      ok(await p.isVisible('#kit .book__title') && !(await p.isVisible('#sol .book__title')), 'без JS: book.html#kit показывает нужную книгу (:target)');
      await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
      await p.click('label[for="mood-road"]');
      ok(await p.isVisible('.mood-panel[data-mood="road"]'), 'без JS: «Что почитать, если…» переключается (radio + :has)');
    } else {
      await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
      const op = await p.$$eval('.split-char, [data-reveal]', els => els.filter(e => getComputedStyle(e).opacity !== '1').length);
      ok(op === 0, 'reduced-motion: нет скрытых анимацией элементов');
    }
    await c.close();
  }

  ok(errors.length === 0, 'ошибок в консоли и 404: ' + (errors.length ? errors.join(' | ') : 'нет'));
  await browser.close();
  console.log(fails ? `\nПровалено: ${fails}` : '\nВсе проверки пройдены');
  process.exit(fails ? 1 : 0);
})();
