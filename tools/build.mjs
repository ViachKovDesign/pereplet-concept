/* Генератор контента «Переплёта».
   Это НЕ сборщик: HTML-файлы в корне — обычные, их можно править руками.
   Скрипт только перезаписывает куски между метками <!--gen:имя--> … <!--/gen:имя-->
   данными из data/books.json и пишет js/data.js (фолбэк для file://).
   Запуск: node tools/build.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const covers = require('./covers.cjs');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'data/books.json'), 'utf8'));
const { books, events, moods } = data;
const byId = Object.fromEntries(books.map(b => [b.id, b]));
const SITE = 'https://viachkovdesign.github.io/pereplet/';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rub = n => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
const href = b => `book.html?id=${b.id}#${b.id}`;
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const date = iso => new Date(iso + 'T12:00:00');
const dayNum = iso => String(date(iso).getDate()).padStart(2, '0');
const monthShort = iso => date(iso).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
const monthLong = iso => date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const weekday = iso => date(iso).toLocaleDateString('ru-RU', { weekday: 'long' });

/* ---------- компоненты ---------- */
const cover = (b, cls = '') =>
  `<div class="cover ${cls}" style="--spine:${b.cover.ac}"><span class="cover__pages" aria-hidden="true"></span><svg class="cover__front" viewBox="0 0 200 300" aria-hidden="true" focusable="false"><use href="#c-${b.id}"/></svg></div>`;

const coverImg = (b, cls = '') =>
  `<div class="cover ${cls}" style="--spine:${b.cover.ac}"><span class="cover__pages" aria-hidden="true"></span><svg class="cover__front" viewBox="0 0 200 300" role="img" aria-label="Обложка книги «${esc(b.title)}», автор ${esc(b.author)}" focusable="false"><use href="#c-${b.id}"/></svg></div>`;

const card = (b, { cls = '', extra = '', heading = 'h3' } = {}) => `
<article class="card ${cls}" data-id="${b.id}">
  <a class="card__link" href="${href(b)}" data-cover-link>
    ${cover(b)}
    <${heading} class="card__title">${esc(b.title)}</${heading}>
    <p class="card__author">${esc(b.author)}</p>
    <p class="card__meta"><span>${esc(b.genre)}</span><span>${rub(b.price)}</span></p>
  </a>${extra}
</article>`;

const catalogCard = (b, i) => `
<article class="card card--cat" data-id="${b.id}" data-genre="${esc(b.genre)}" data-price="${b.price}" data-pages="${b.pages}" data-year="${b.year}" data-order="${i}" data-search="${esc((b.title + ' ' + b.author).toLowerCase())}" data-title="${esc(b.title)}">
  <a class="card__link" href="${href(b)}" data-cover-link>
    ${cover(b)}
    <h2 class="card__title">${esc(b.title)}</h2>
    <p class="card__author">${esc(b.author)}</p>
    <p class="card__meta"><span>${esc(b.genre)} · ${b.pages}&nbsp;с.</span><span>${rub(b.price)}</span></p>
  </a>
  ${b.isNew ? '<span class="tag tag--new">новинка</span>' : ''}${b.house ? '<span class="tag tag--house">наше издание</span>' : ''}
</article>`;

/* ---------- блоки главной ---------- */
const weekBooks = books.filter(b => b.week);
const genWeek = () => weekBooks.map((b, i) => `
<article class="week__item week__item--${i + 1}" data-reveal>
  <span class="week__num" aria-hidden="true">0${i + 1}</span>
  <a class="card__link" href="${href(b)}" data-cover-link>
    ${cover(b)}
    <h3 class="week__title">${esc(b.title)}</h3>
  </a>
  <p class="week__author">${esc(b.author)} · ${esc(b.genre)} · ${rub(b.price)}</p>
  <blockquote class="week__quote"><p>«${esc(b.why)}»</p><footer>— ${esc(b.seller)}</footer></blockquote>
</article>`).join('');

const newBooks = books.filter(b => b.isNew).sort((a, b) => b.year - a.year);
const genNew = () => newBooks.map((b, i) => card(b, { cls: `ribbon__card ribbon__card--${i % 3}`, extra: `<span class="tag tag--new">${b.year}</span>` })).join('');

const MOOD_PICK = {
  tired: ['bergamot', 'pogoda', 'kit', 'sol'],
  road: ['tver', 'olhovka', 'iyul', 'morze'],
  cry: ['pisma', 'obvodny', 'dozhd', 'okna'],
  gift: ['vyveska', 'salfetka', 'enot', 'sever']
};
const genMoodsControls = () => moods.map((m, i) => `
<input class="moods__radio" type="radio" name="mood" id="mood-${m.id}" value="${m.id}"${i === 0 ? ' checked' : ''}>
<label class="moods__label" for="mood-${m.id}" data-magnetic>${esc(m.label)}</label>`).join('');
const genMoods = () => moods.map(m => `
<div class="mood-panel" data-mood="${m.id}" id="panel-${m.id}">
  <p class="mood-panel__word" aria-hidden="true">${esc(m.word)}</p>
  <h3 class="mood-panel__title visually-hidden">Если ${esc(m.label)}</h3>
  <p class="mood-panel__note">${esc(m.note)}</p>
  <div class="mood-panel__books">
    ${MOOD_PICK[m.id].map((id, i) => card(byId[id], { cls: `mood-card mood-card--${i + 1}`, heading: 'h4' })).join('')}
  </div>
</div>`).join('');

const genEventsShort = () => events.slice(0, 3).map(e => `
<li class="agenda__row" data-reveal>
  <a class="agenda__link" href="events.html#${e.id}">
    <span class="agenda__date"><b>${dayNum(e.date)}</b><span>${monthShort(e.date)}</span></span>
    <span class="agenda__type">${esc(e.type)}</span>
    <span class="agenda__title">${esc(e.title)}</span>
    <span class="agenda__time">${weekday(e.date)}, ${e.time}</span>
    <span class="agenda__arrow" aria-hidden="true">→</span>
  </a>
</li>`).join('');

/* ---------- каталог ---------- */
const genCatalog = () => books.map(catalogCard).join('');
const genGenres = () => ['Все', ...data.genres].map((g, i) => `
<label class="chip"><input type="radio" name="genre" value="${i === 0 ? '' : esc(g)}"${i === 0 ? ' checked' : ''}><span>${esc(g)}</span></label>`).join('');

/* ---------- книга ---------- */
function related(b) {
  const score = x => (x.genre === b.genre ? 1 : 0) + x.moods.filter(m => b.moods.includes(m)).length * 2;
  return books.filter(x => x.id !== b.id).map(x => [x, score(x)]).sort((p, q) => q[1] - p[1] || p[0].price - q[0].price).slice(0, 3).map(p => p[0]);
}
const genBooks = () => books.map((b, i) => {
  const letter = b.title.replace(/[«»"]/g, '').charAt(0);
  return `
<article class="book" id="${b.id}" data-book="${b.id}" data-title="${esc(b.title)}" data-author="${esc(b.author)}" aria-labelledby="t-${b.id}">
  <div class="book__hero grid">
    <nav class="book__crumbs" aria-label="Хлебные крошки"><a href="catalog.html">Каталог</a> <span aria-hidden="true">/</span> <a href="catalog.html?genre=${encodeURIComponent(b.genre)}">${esc(b.genre)}</a></nav>
    <span class="book__letter" aria-hidden="true">${esc(letter)}</span>
    ${coverImg(b, 'cover--xl book__cover')}
    <div class="book__head">
      ${b.house ? '<p class="tag tag--house">Издательство «Переплёт»</p>' : ''}
      <h1 class="book__title" id="t-${b.id}"><span>${esc(b.title)}</span></h1>
      <p class="book__author">${esc(b.author)}</p>
    </div>
    <p class="book__price"><span class="visually-hidden">Цена: </span>${rub(b.price)}</p>
    <div class="book__text">
      <p class="book__annotation">${esc(b.annotation)}</p>
      <details class="reserve" data-reserve>
        <summary class="btn btn--accent"><span class="btn__label" data-text="Отложить в магазине">Отложить в магазине</span></summary>
        <form class="form reserve__form" data-reserve-form data-id="${b.id}" novalidate>
          <p class="form__lead">Держим книгу 3 дня. Заберёте на кассе — оплата на месте.</p>
          <div class="field"><label for="rn-${b.id}">Имя</label><input id="rn-${b.id}" name="name" autocomplete="given-name" required minlength="2" placeholder="Как к вам обращаться"></div>
          <div class="field"><label for="rp-${b.id}">Телефон</label><input id="rp-${b.id}" name="phone" type="tel" autocomplete="tel" required inputmode="tel" placeholder="+7 900 000-00-00"></div>
          <p class="form__error" role="alert" data-error></p>
          <button class="btn btn--ink" type="submit"><span class="btn__label" data-text="Отложить">Отложить</span></button>
          <noscript><p class="form__lead">Демо-форма работает при включённом JavaScript.</p></noscript>
        </form>
        <p class="reserve__done" role="status" data-done></p>
      </details>
    </div>
    <blockquote class="book__why">
      <p class="book__why-label">Почему советуем</p>
      <p>«${esc(b.why)}»</p>
      <footer>— ${esc(b.seller)}</footer>
    </blockquote>
    <dl class="book__specs">
      <div><dt>Жанр</dt><dd>${esc(b.genre)}</dd></div>
      <div><dt>Год</dt><dd>${b.year}</dd></div>
      <div><dt>Страниц</dt><dd>${b.pages}</dd></div>
      <div><dt>Переплёт</dt><dd>${esc(b.binding)}</dd></div>
      <div><dt>Артикул</dt><dd>ПП-${String(i + 1).padStart(4, '0')}</dd></div>
    </dl>
  </div>
  <section class="related" aria-labelledby="rel-${b.id}">
    <h2 class="related__title" id="rel-${b.id}">С этим берут</h2>
    <div class="related__list">${related(b).map((r, k) => card(r, { cls: `related__card related__card--${k + 1}` })).join('')}</div>
  </section>
</article>`;
}).join('');

/* ---------- афиша ---------- */
const genEvents = () => events.map((e, i) => {
  const b = e.book ? byId[e.book] : null;
  return `
<article class="event event--${i + 1}" id="${e.id}" data-reveal>
  <p class="event__date"><b>${dayNum(e.date)}</b><span>${monthShort(e.date)}</span></p>
  <div class="event__body">
    <p class="event__type">${esc(e.type)} · ${weekday(e.date)}, ${e.time}</p>
    <h2 class="event__title">${esc(e.title)}</h2>
    <p class="event__text">${esc(e.text)}</p>
    <p class="event__meta"><span>${esc(e.price)}</span><span>${e.seats} ${plural(e.seats, 'место', 'места', 'мест')}</span>${b ? `<a href="${href(b)}">Книга: «${esc(b.title)}»</a>` : ''}</p>
    <a class="btn btn--line" href="#signup" data-signup="${e.id}"><span class="btn__label" data-text="Записаться">Записаться</span></a>
  </div>
  ${b ? `<a class="event__cover" href="${href(b)}" tabindex="-1" aria-hidden="true" data-cover-link>${cover(b, 'cover--sm')}</a>` : '<span class="event__cover event__cover--gift" aria-hidden="true">?</span>'}
</article>`;
}).join('');
const genEventOptions = () => events.map(e => `<option value="${e.id}">${monthLong(e.date)} — ${esc(e.title)}</option>`).join('');

/* ---------- о нас ---------- */
const genHouse = () => books.filter(b => b.house).map((b, i) => `
<article class="house__item house__item--${i + 1}" data-reveal>
  <a class="house__cover" href="${href(b)}" data-cover-link aria-label="«${esc(b.title)}» — открыть книгу">${cover(b, 'cover--lg')}</a>
  <div class="house__text">
    <p class="house__num" aria-hidden="true">№${i + 1}</p>
    <h3 class="house__title">${esc(b.title)}</h3>
    <p class="house__author">${esc(b.author)} · ${b.year} · ${rub(b.price)}</p>
    <p>${esc(b.houseStory)}</p>
  </div>
</article>`).join('');

const genHours = () => `<dl class="hours">${data.shop.hours.map(([d, h]) => `<div><dt>${esc(d)}</dt><dd>${esc(h)}</dd></div>`).join('')}</dl>`;

/* ---------- общие части ---------- */
const PAGES = {
  'index.html': { nav: '', title: 'Переплёт — книги, которые мы прочитали сами', desc: 'Независимый книжный магазин и маленькое издательство в Москве. Концепт-проект: 24 книги, афиша читок и подборки «Что почитать, если…».' },
  'catalog.html': { nav: 'catalog', title: 'Каталог — Переплёт', desc: 'Все книги «Переплёта»: фильтры по жанру, цене и объёму, поиск по названию и автору.' },
  'book.html': { nav: 'catalog', title: 'Книга — Переплёт', desc: 'Книга из «Переплёта»: аннотация, почему советуем и отложить в магазине.' },
  'events.html': { nav: 'events', title: 'Афиша — Переплёт', desc: 'Читки, встречи с авторами и книжный клуб в «Переплёте» на ближайшие два месяца.' },
  'about.html': { nav: 'about', title: 'О магазине и издательстве — Переплёт', desc: 'Как устроен «Переплёт»: магазин, маленькое издательство, адрес и часы работы.' }
};

const head = (file) => {
  const p = PAGES[file];
  return `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<meta name="theme-color" content="#EEEDE8">
<meta name="color-scheme" content="light">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="Переплёт">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:image" content="${SITE}img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<link rel="preload" href="vendor/fonts/unbounded-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="vendor/fonts/literata-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/style.css">
<script>document.documentElement.classList.add('js');try{if(sessionStorage.getItem('pp-curtain'))document.documentElement.classList.add('is-arriving')}catch(e){}</script>
`;
};

const navItems = [['catalog', 'catalog.html', 'Каталог'], ['events', 'events.html', 'Афиша'], ['about', 'about.html', 'О нас']];
const header = (file) => {
  const cur = PAGES[file].nav;
  const links = navItems.map(([k, h, t]) => `<li><a href="${h}"${k === cur ? ' aria-current="page"' : ''} data-magnetic>${t}</a></li>`).join('');
  return `
<a class="skip" href="#main">К содержанию</a>
<p class="concept-bar"><a href="https://viachkovdesign.github.io" target="_blank" rel="noopener">Концепт-проект. Бренд вымышленный. Дизайн и разработка — ViachKovDesign<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (откроется в новой вкладке)</span></a></p>
<header class="site-header" data-header>
  <a class="logo" href="index.html" data-magnetic><span class="logo__mark" aria-hidden="true">П</span><span class="logo__word">Переплёт</span><span class="visually-hidden"> — на главную</span></a>
  <nav class="nav" aria-label="Основное меню"><ul>${links}</ul></nav>
  <button class="reserved-btn" type="button" data-reserved-open aria-haspopup="dialog"><span class="reserved-btn__label">отложено:</span> <b data-reserved-count>0</b></button>
  <button class="menu-btn" type="button" popovertarget="menu" aria-label="Открыть меню"><span></span><span></span></button>
</header>
<div class="menu" id="menu" popover>
  <button class="menu__close" type="button" popovertarget="menu" popovertargetaction="hide">Закрыть</button>
  <nav aria-label="Мобильное меню"><ul>${navItems.map(([k, h, t]) => `<li><a href="${h}"${k === cur ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}<li><a href="index.html">Главная</a></li></ul></nav>
  <p class="menu__note">Переплётный пер., 7 · каждый день с 10–11 утра</p>
</div>
<dialog class="drawer" data-drawer aria-labelledby="drawer-title">
  <div class="drawer__inner">
    <div class="drawer__head"><h2 id="drawer-title">Отложено</h2><button class="drawer__close" type="button" data-drawer-close>Закрыть</button></div>
    <ul class="drawer__list" data-drawer-list></ul>
    <p class="drawer__empty" data-drawer-empty>Пока пусто. Откройте любую книгу и нажмите «Отложить в магазине».</p>
    <p class="drawer__note">Держим книги 3 дня. Это демо: на самом деле никто ничего не держит, но приятно же.</p>
  </div>
</dialog>
<div class="curtain" aria-hidden="true"><span class="curtain__spine"></span><span class="curtain__word">Переплёт</span></div>
`;
};

const footer = () => `
<footer class="site-footer">
  <div class="footer__grid">
    <p class="footer__claim">Мы продаём только то, что дочитали до последней страницы. Остальное — вежливо возвращаем поставщику.</p>
    <div class="footer__col">
      <p class="label">Адрес</p>
      <p>${esc(data.shop.address)}</p>
      <p class="muted">${esc(data.shop.addressNote)}</p>
    </div>
    <div class="footer__col">
      <p class="label">Часы</p>
      ${genHours()}
    </div>
    <nav class="footer__col" aria-label="Ссылки в подвале">
      <p class="label">Разделы</p>
      <ul><li><a href="catalog.html">Каталог</a></li><li><a href="events.html">Афиша</a></li><li><a href="about.html">О магазине</a></li><li><a href="about.html#house">Издательство</a></li></ul>
    </nav>
    <a class="concept-plaque" href="https://viachkovdesign.github.io" target="_blank" rel="noopener" data-magnetic>
      <span class="concept-plaque__k">Концепт</span>
      <span>Концепт-проект. Бренд вымышленный. Дизайн и разработка — ViachKovDesign<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (откроется в новой вкладке)</span></span>
    </a>
  </div>
  <p class="footer__word" aria-hidden="true">Переплёт</p>
  <p class="footer__copy"><span>© 2026 «Переплёт» — вымышленный книжный. Все книги, авторы и цитаты придуманы.</span><a href="#top" data-to-top>Наверх ↑</a></p>
</footer>
`;

const scripts = (file) => `
<script src="vendor/gsap.min.js" defer></script>
<script src="vendor/ScrollTrigger.min.js" defer></script>
${file === 'catalog.html' ? '<script src="vendor/Flip.min.js" defer></script>\n' : ''}<script src="vendor/lenis.min.js" defer></script>
<script src="js/main.js" defer></script>
`;

/* ---------- запись ---------- */
const blocks = {
  sprite: () => covers.sprite(books),
  week: genWeek, ribbon: genNew, 'moods-controls': genMoodsControls, moods: genMoods,
  agenda: genEventsShort, catalog: genCatalog, genres: genGenres, books: genBooks,
  events: genEvents, 'event-options': genEventOptions, house: genHouse, hours: genHours,
  'count-books': () => String(books.length), 'count-events': () => String(events.length)
};

for (const file of Object.keys(PAGES)) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf8');
  const all = { ...blocks, head: () => head(file), header: () => header(file), footer, scripts: () => scripts(file) };
  html = html.replace(/<!--gen:([\w-]+)-->[\s\S]*?<!--\/gen:\1-->/g, (m, name) => {
    if (!all[name]) throw new Error(`Нет блока ${name} в ${file}`);
    return name === 'sprite' ? m : `<!--gen:${name}-->${all[name]()}<!--/gen:${name}-->`;
  });
  /* в спрайт страницы кладём только те обложки, что на ней используются */
  const sprite = html.match(/<!--gen:sprite-->[\s\S]*?<!--\/gen:sprite-->/);
  const rest = sprite ? html.replace(sprite[0], '') : html;
  const used = new Set([...rest.matchAll(/href="#c-([\w-]+)"/g)].map(m => m[1]));
  html = html.replace(/<!--gen:sprite-->[\s\S]*?<!--\/gen:sprite-->/, () => `<!--gen:sprite-->${covers.sprite(books.filter(b => used.has(b.id)))}<!--/gen:sprite-->`);
  writeFileSync(path, html);
  console.log('✓', file);
}

/* Фолбэк данных: подключается, только если fetch('data/books.json') не сработал (например, file://) */
const slim = { books: books.map(({ id, title, author, price, genre, cover }) => ({ id, title, author, price, genre, color: cover.bg, ink: cover.fg })) };
writeFileSync(join(ROOT, 'js/data.js'), `/* Сгенерировано tools/build.mjs из data/books.json — фолбэк для file:// */\nwindow.PEREPLET_DATA=${JSON.stringify(slim)};\n`);
console.log('✓ js/data.js');
