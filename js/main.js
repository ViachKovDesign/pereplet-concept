/* ==========================================================================
   ПЕРЕПЛЁТ — интерактив
   Всё здесь — улучшение поверх готового HTML: без JS сайт читается целиком.
   ========================================================================== */
(function () {
  'use strict';

  var d = document;
  var html = d.documentElement;
  var page = d.body.getAttribute('data-page');
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var MOTION = !!(gsap && !RM);
  var VT = 'PageRevealEvent' in window; /* браузер умеет View Transitions между документами */
  var lenis = null;

  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  if (gsap && ST) gsap.registerPlugin(ST);
  if (gsap && window.Flip) gsap.registerPlugin(window.Flip);

  /* ---------- склонения и форматирование ---------- */
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }

  /* ---------- хранилище «отложено» (localStorage в try/catch) ---------- */
  var KEY = 'pereplet:reserved';
  var store = {
    get: function () {
      try {
        var v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
        var now = Date.now();
        return Array.isArray(v) ? v.filter(function (x) { return x && x.id && (!x.until || x.until > now); }) : [];
      } catch (e) { return []; }
    },
    set: function (v) { try { window.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* приватный режим — живём без памяти */ } },
    add: function (id, name) {
      var list = store.get();
      if (!list.some(function (x) { return x.id === id; })) list.push({ id: id, name: name, until: Date.now() + 3 * 864e5 });
      store.set(list);
      return list;
    },
    remove: function (id) { var l = store.get().filter(function (x) { return x.id !== id; }); store.set(l); return l; }
  };

  /* ---------- данные: books.json, а если fetch не вышел (file://) — js/data.js ---------- */
  var dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch('data/books.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.books.map(function (b) { return { id: b.id, title: b.title, author: b.author, price: b.price, genre: b.genre, color: b.cover.bg, ink: b.cover.fg }; }); })
      .catch(function () {
        return new Promise(function (resolve) {
          if (window.PEREPLET_DATA) return resolve(window.PEREPLET_DATA.books);
          var s = d.createElement('script');
          s.src = 'js/data.js';
          s.onload = function () { resolve((window.PEREPLET_DATA && window.PEREPLET_DATA.books) || []); };
          s.onerror = function () { resolve([]); };
          d.head.appendChild(s);
        });
      });
    return dataPromise;
  }

  /* ---------- счётчик в шапке + ящик ---------- */
  var countEl = $('[data-reserved-count]');
  var reservedBtn = $('[data-reserved-open]');
  function renderCount(bump) {
    var n = store.get().length;
    if (countEl) countEl.textContent = n;
    if (reservedBtn) reservedBtn.setAttribute('aria-label', 'Отложено: ' + n + ' ' + plural(n, 'книга', 'книги', 'книг') + '. Открыть список');
    if (bump && reservedBtn) {
      reservedBtn.classList.remove('is-bump');
      void reservedBtn.offsetWidth;
      reservedBtn.classList.add('is-bump');
    }
  }
  renderCount(false);
  window.addEventListener('storage', function (e) { if (e.key === KEY) renderCount(true); });

  var drawer = $('[data-drawer]');
  function renderDrawer() {
    var list = $('[data-drawer-list]');
    var empty = $('[data-drawer-empty]');
    var items = store.get();
    empty.hidden = items.length > 0;
    list.innerHTML = '';
    if (!items.length) return;
    loadData().then(function (books) {
      var map = {};
      books.forEach(function (b) { map[b.id] = b; });
      list.innerHTML = '';
      items.forEach(function (it) {
        var b = map[it.id];
        if (!b) return;
        var li = d.createElement('li');
        var until = new Date(it.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        li.innerHTML = '<span class="drawer__spine" aria-hidden="true"></span><div><a></a><small></small></div><button type="button">убрать</button>';
        var spine = li.firstChild;
        spine.style.background = b.color; spine.style.color = b.ink; spine.textContent = b.title.charAt(0);
        var a = li.querySelector('a'); a.href = 'book.html?id=' + b.id + '#' + b.id; a.textContent = b.title;
        li.querySelector('small').textContent = b.author + ' · держим до ' + until;
        var btn = li.querySelector('button');
        btn.setAttribute('aria-label', 'Убрать «' + b.title + '» из отложенного');
        btn.addEventListener('click', function () {
          store.remove(b.id); renderCount(true); renderDrawer();
          var f = $('[data-reserve-form][data-id="' + b.id + '"]');
          if (f) { var det = f.closest('[data-reserve]'); det.classList.remove('is-done'); $('[data-done]', det).textContent = ''; }
        });
        list.appendChild(li);
      });
    });
  }
  if (reservedBtn && drawer && drawer.showModal) {
    reservedBtn.addEventListener('click', function () {
      renderDrawer();
      drawer.showModal();
      if (lenis) lenis.stop();
    });
    $('[data-drawer-close]').addEventListener('click', function () { drawer.close(); });
    drawer.addEventListener('click', function (e) { if (e.target === drawer) drawer.close(); });
    drawer.addEventListener('close', function () { if (lenis) lenis.start(); });
  }

  /* ---------- плавный скролл ---------- */
  if (MOTION && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    if (ST) {
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.2 });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (id === 'main') return; /* ссылка «к содержанию» — пусть работает фокус */
    var el = id === 'top' ? d.body : d.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (id === 'top') { if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); return; }
    scrollToEl(el);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---------- шапка прячется при скролле вниз ---------- */
  var header = $('[data-header]');
  (function () {
    if (!header) return;
    var last = window.scrollY, ticking = false;
    function upd() {
      var y = window.scrollY;
      var open = (drawer && drawer.open);
      if (!open && y > 240 && y > last + 4) header.classList.add('is-hidden');
      else if (y < last - 4 || y < 240) header.classList.remove('is-hidden');
      last = y; ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  })();

  /* ---------- буквы заголовков собираются при появлении ---------- */
  function split(el) {
    if (el._chars) return el._chars;
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var chars = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(part)); return; }
            var w = d.createElement('span');
            w.className = 'split-word';
            Array.from(part).forEach(function (ch) {
              var c = d.createElement('span');
              c.className = 'split-char';
              c.textContent = ch;
              w.appendChild(c);
              chars.push(c);
            });
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    /* для скринридеров — целая строка, а не буквы */
    var sr = d.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = label;
    var wrap = d.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    while (el.firstChild) wrap.appendChild(el.firstChild);
    el.appendChild(sr);
    el.appendChild(wrap);
    el._chars = chars;
    return chars;
  }
  function assemble(chars, opts) {
    return gsap.fromTo(chars,
      { yPercent: 120, rotate: function () { return gsap.utils.random(-28, 28); }, opacity: 0 },
      Object.assign({ yPercent: 0, rotate: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: { each: 0.028, from: 'start' } }, opts || {}));
  }

  if (MOTION && ST) {
    $$('[data-split]').forEach(function (el) {
      var chars = split(el);
      assemble(chars, { scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });

    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, { y: 70, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    $$('[data-parallax]').forEach(function (el) {
      var k = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      gsap.to(el, { yPercent: k * 100, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top top', end: 'bottom top', scrub: true } });
    });

    /* счётчики */
    $$('[data-count]').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count'));
      var o = { v: 0 };
      el.textContent = '0';
      gsap.to(o, {
        v: to, duration: 1.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: function () { el.textContent = fmt(o.v); },
        onComplete: function () { el.textContent = fmt(to); }
      });
    });
  }

  /* ---------- магнитные ссылки (только мышь) ---------- */
  if (MOTION && FINE) {
    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });

    /* курсор-ярлык над обложками */
    var cur = d.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.textContent = 'Открыть';
    d.body.appendChild(cur);
    var cx = gsap.quickTo(cur, 'x', { duration: 0.45, ease: 'power3' });
    var cy = gsap.quickTo(cur, 'y', { duration: 0.45, ease: 'power3' });
    gsap.set(cur, { scale: 0 });
    window.addEventListener('pointermove', function (e) { cx(e.clientX); cy(e.clientY); }, { passive: true });
    d.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('[data-cover-link] .cover, .hero__cover');
      gsap.to(cur, { scale: t ? 1 : 0, duration: 0.4, ease: 'expo.out', overwrite: 'auto' });
    });
  }

  /* ==========================================================================
     ГЛАВНАЯ
     ========================================================================== */
  function initHome() {
    var mm = gsap && ST ? gsap.matchMedia() : null;
    var stackPanels = $$('[data-stack]');
    stackPanels.concat($$('.stack-wrap > .panel')).forEach(function (p, i) { p.style.zIndex = String(i + 1); });

    if (MOTION && ST) {
      /* 1. «Выбор недели» прилипает, лента новинок наезжает сверху */
      var week = $('.week');
      var ribbon = $('[data-ribbon]');
      if (week && ribbon) stackPanel(week, ribbon);

      /* 2. лента новинок: вертикальный скролл → горизонтальная прокрутка внутри блока */
      var track = $('[data-ribbon-track]');
      var vp = $('[data-ribbon-viewport]');
      var bar = $('[data-ribbon-progress]');
      if (ribbon && track && vp) {
        ribbon.classList.add('is-pinned');
        var dist = function () { return Math.max(0, track.scrollWidth - vp.clientWidth); };
        gsap.to(track, {
          x: function () { return -dist(); },
          ease: 'none',
          scrollTrigger: {
            trigger: ribbon,
            start: function () { return ribbon.offsetHeight > window.innerHeight ? 'bottom bottom' : 'top top'; },
            end: function () { return '+=' + dist(); },
            pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: function (self) { if (bar) bar.style.transform = 'scaleX(' + self.progress.toFixed(3) + ')'; }
          }
        });
        /* фокус с клавиатуры внутри ленты — докручиваем страницу до карточки */
        track.addEventListener('focusin', function (e) {
          var card = e.target.closest('.card, .ribbon__more');
          if (!card) return;
          var stt = ST.getAll().filter(function (s) { return s.pin === ribbon; })[0];
          if (!stt) return;
          var ratio = Math.min(1, card.offsetLeft / Math.max(1, track.scrollWidth - vp.clientWidth));
          var y = stt.start + (stt.end - stt.start) * ratio;
          if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
        });
      }

      /* 3. остальные панели — стопкой: следующая наезжает на предыдущую (на широких экранах) */
      mm.add('(min-width: 900px)', function () {
        var rest = $$('.moods, .agenda');
        rest.forEach(function (p) { var next = p.nextElementSibling; if (next) stackPanel(p, next); });
      });
    }

    /* «Что почитать, если…» */
    var moods = $('[data-moods]');
    if (moods) {
      moods.addEventListener('change', function (e) {
        if (!e.target.matches('.moods__radio')) return;
        var panel = $('.mood-panel[data-mood="' + e.target.value + '"]', moods);
        if (!panel || !MOTION) return;
        var word = $('.mood-panel__word', panel);
        gsap.fromTo($$('.mood-card', panel),
          { y: 80, opacity: 0, rotate: function () { return gsap.utils.random(-7, 7); } },
          { y: 0, opacity: 1, rotate: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, clearProps: 'transform,opacity' });
        gsap.fromTo($('.mood-panel__note', panel), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
        if (word) assemble(split(word), { duration: 0.9, stagger: 0.03 });
      });
    }

    /* подписка (демо) */
    var sub = $('[data-subscribe]');
    if (sub) {
      sub.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = sub.querySelector('input');
        var err = $('[data-error]', sub);
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
        input.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) { err.textContent = 'Кажется, в адресе опечатка. Проверьте, пожалуйста.'; input.focus(); return; }
        err.textContent = '';
        $('[data-done]', sub).textContent = 'Готово! Первое письмо придёт… никогда — это демо. Но спасибо, что хотели.';
        input.value = '';
        if (MOTION) gsap.fromTo($('[data-done]', sub), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
      });
    }
  }

  function stackPanel(p, next) {
    ST.create({
      trigger: p,
      start: function () { return p.offsetHeight > window.innerHeight ? 'bottom bottom' : 'top top'; },
      endTrigger: next,
      end: 'top top',
      pin: true, pinSpacing: false, invalidateOnRefresh: true
    });
    gsap.fromTo(p, { '--dim': 0 }, {
      '--dim': 0.5, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true }
    });
  }

  /* ==========================================================================
     КАТАЛОГ
     ========================================================================== */
  function initCatalog() {
    var grid = $('[data-catalog]');
    var form = $('[data-filters]');
    if (!grid || !form) return;
    var cards = $$('.card--cat', grid);
    var empty = $('[data-empty]');
    var label = $('[data-count-label]');
    var q = $('[data-q]');
    var sortSel = $('[data-sort]');
    var total = cards.length;
    var norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').trim(); };
    cards.forEach(function (c) { c._s = norm(c.getAttribute('data-search')); });

    var cmp = {
      'default': function (a, b) { return +a.dataset.order - +b.dataset.order; },
      'new': function (a, b) { return +b.dataset.year - +a.dataset.year || +a.dataset.order - +b.dataset.order; },
      cheap: function (a, b) { return +a.dataset.price - +b.dataset.price; },
      expensive: function (a, b) { return +b.dataset.price - +a.dataset.price; },
      thin: function (a, b) { return +a.dataset.pages - +b.dataset.pages; },
      title: function (a, b) { return a.dataset.title.localeCompare(b.dataset.title, 'ru'); }
    };
    function range(name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      if (!el || !el.value) return null;
      var p = el.value.split('-');
      return [+p[0], +p[1]];
    }
    function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

    /* фильтры из адреса: catalog.html?genre=Роман&q=… */
    var params = new URLSearchParams(location.search);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('genre')) {
      var g = form.querySelector('input[name="genre"][value="' + params.get('genre').replace(/"/g, '') + '"]');
      if (g) g.checked = true;
    }
    if (params.get('sort') && cmp[params.get('sort')]) sortSel.value = params.get('sort');

    function apply(animate) {
      var query = norm(q.value);
      var genre = val('genre');
      var pr = range('price');
      var pg = range('pages');
      var match = function (c) {
        var price = +c.dataset.price, pages = +c.dataset.pages;
        return (!query || c._s.indexOf(query) !== -1) &&
          (!genre || c.dataset.genre === genre) &&
          (!pr || (price >= pr[0] && price < pr[1])) &&
          (!pg || (pages >= pg[0] && pages < pg[1]));
      };
      var vis = cards.filter(match).sort(cmp[sortSel.value] || cmp['default']);
      var hid = cards.filter(function (c) { return !match(c); });
      var Flip = window.Flip;
      var state = (animate && MOTION && Flip) ? Flip.getState(cards, { props: 'opacity' }) : null;

      vis.forEach(function (c) { c.classList.remove('is-hidden'); grid.appendChild(c); });
      hid.forEach(function (c) { c.classList.add('is-hidden'); grid.appendChild(c); });
      empty.hidden = vis.length > 0;
      label.textContent = vis.length === total ? 'Показаны все ' + total + ' ' + plural(total, 'книга', 'книги', 'книг')
        : vis.length ? 'Нашли ' + vis.length + ' ' + plural(vis.length, 'книгу', 'книги', 'книг') + ' из ' + total
        : 'Ничего не нашли';

      if (state) {
        Flip.from(state, {
          duration: 0.75, ease: 'power3.inOut', absolute: true, stagger: 0.012, simple: true,
          onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.85, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.15 }); },
          onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.35 }); }
        });
        if (!vis.length) gsap.fromTo(empty, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
      }

      /* состояние — в адрес, чтобы им можно было поделиться */
      var p = new URLSearchParams();
      if (q.value.trim()) p.set('q', q.value.trim());
      if (genre) p.set('genre', genre);
      if (sortSel.value !== 'default') p.set('sort', sortSel.value);
      var s = p.toString();
      try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// */ }
      if (ST) ST.refresh();
    }

    var t;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { apply(true); }, 180); });
    form.addEventListener('change', function (e) { if (e.target !== q) apply(true); });
    form.addEventListener('submit', function (e) { e.preventDefault(); apply(true); });
    form.addEventListener('reset', function () { setTimeout(function () { apply(true); }, 0); });
    $$('[data-reset]').forEach(function (b) {
      if (b.type !== 'reset') b.addEventListener('click', function () { form.reset(); q.focus(); });
    });
    apply(false);

    if (MOTION) {
      gsap.from(cards.filter(function (c) { return !c.classList.contains('is-hidden'); }).slice(0, 6), {
        y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.15, clearProps: 'transform,opacity'
      });
    }
  }

  /* ==========================================================================
     КНИГА
     ========================================================================== */
  function initBook() {
    var params = new URLSearchParams(location.search);
    var id = params.get('id') || location.hash.slice(1);
    var art = id ? d.getElementById(id) : null;
    if (!art || !art.classList.contains('book')) art = $('.book');
    if (!art) return;
    $$('.book.is-active').forEach(function (b) { b.classList.remove('is-active'); });
    art.classList.add('is-active');
    var title = $('.book__title', art).textContent;
    var author = $('.book__author', art).textContent;
    d.title = '«' + title + '», ' + author + ' — Переплёт';
    var md = $('meta[name="description"]');
    if (md) md.setAttribute('content', $('.book__annotation', art).textContent.slice(0, 160));

    /* уже отложена? */
    if (store.get().some(function (x) { return x.id === art.dataset.book; })) {
      var det0 = $('[data-reserve]', art);
      det0.classList.add('is-done');
      $('[data-done]', det0).textContent = 'Эта книга уже отложена — ждём вас в магазине (демо).';
    }

    if (MOTION) {
      var tl = gsap.timeline({ delay: VT ? 0.5 : 0.1 });
      tl.from($('.book__letter', art), { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0)
        .from($$('.book__price, .book__text, .book__specs', art), { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.15)
        .from($('.book__why', art), { y: 80, rotate: 6, opacity: 0, duration: 1.2, ease: 'expo.out' }, 0.3);
      assemble(split($('.book__title span', art)), { duration: 0.9, stagger: 0.018 });
      if (ST) $$('.related__card', art).forEach(function (c, i) {
        gsap.from(c, { y: 90, opacity: 0, duration: 1.1, ease: 'expo.out', delay: i * 0.08, scrollTrigger: { trigger: c, start: 'top 92%', once: true } });
      });
    }
  }

  /* отложить (демо) — работает на любой странице, где есть форма */
  d.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches('[data-reserve-form]')) return;
    e.preventDefault();
    var name = f.elements.name, phone = f.elements.phone;
    var err = $('[data-error]', f);
    var digits = phone.value.replace(/\D/g, '');
    var bad = null;
    name.setAttribute('aria-invalid', 'false'); phone.setAttribute('aria-invalid', 'false');
    if (name.value.trim().length < 2) { bad = name; err.textContent = 'Напишите, как к вам обращаться — хотя бы пару букв.'; }
    else if (digits.length < 10 || digits.length > 12) { bad = phone; err.textContent = 'Телефон похож на неполный: нужно 10–11 цифр.'; }
    if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); return; }
    err.textContent = '';
    var id = f.getAttribute('data-id');
    var art = f.closest('.book');
    var bookTitle = art ? $('.book__title', art).textContent : '';
    store.add(id, name.value.trim());
    var det = f.closest('[data-reserve]');
    var until = new Date(Date.now() + 3 * 864e5).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    $('[data-done]', det).textContent = 'Отложили на 3 дня (демо). «' + bookTitle + '» ждёт вас до ' + until + ' — под кассой, с запиской «' + name.value.trim() + '».';
    det.classList.add('is-done');
    flyToCounter(art ? $('.book__cover', art) : null, function () { renderCount(true); });
  });

  function flyToCounter(from, done) {
    if (!MOTION || !from || !reservedBtn) { done(); return; }
    header && header.classList.remove('is-hidden');
    var a = from.getBoundingClientRect();
    var b = reservedBtn.getBoundingClientRect();
    var ghost = from.cloneNode(true);
    ghost.style.cssText = 'position:fixed;left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;margin:0;z-index:9500;pointer-events:none;view-transition-name:none';
    ghost.setAttribute('aria-hidden', 'true');
    d.body.appendChild(ghost);
    gsap.to(ghost, {
      x: b.left + b.width / 2 - (a.left + a.width / 2),
      y: b.top + b.height / 2 - (a.top + a.height / 2),
      scale: 24 / a.width, rotate: -25, duration: 1, ease: 'expo.inOut',
      onComplete: function () { ghost.remove(); done(); }
    });
  }

  /* ==========================================================================
     АФИША
     ========================================================================== */
  function initEvents() {
    var form = $('[data-signup-form]');
    var sel = $('[data-event-select]');
    var section = $('#signup');
    $$('[data-signup]').forEach(function (a) {
      a.addEventListener('click', function () {
        if (sel) sel.value = a.getAttribute('data-signup');
        if (section) section.classList.remove('is-done');
        if (form) {
          form.classList.remove('is-flash'); void form.offsetWidth; form.classList.add('is-flash');
          setTimeout(function () { var n = form.elements.name; if (n) n.focus({ preventScroll: true }); }, RM ? 0 : 900);
        }
      });
    });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name, phone = form.elements.phone;
      var err = $('[data-error]', form);
      var bad = null;
      name.setAttribute('aria-invalid', 'false'); phone.setAttribute('aria-invalid', 'false');
      if (name.value.trim().length < 2) { bad = name; err.textContent = 'Напишите имя — хотя бы пару букв.'; }
      else if (phone.value.replace(/\D/g, '').length < 10) { bad = phone; err.textContent = 'Нужен телефон из 10–11 цифр, чтобы напомнить за день.'; }
      if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); return; }
      err.textContent = '';
      var opt = sel.options[sel.selectedIndex];
      var g = +form.elements.guests.value;
      $('[data-done]').textContent = 'Записали вас' + (g > 1 ? ' и ещё ' + (g - 1) + ' ' + plural(g - 1, 'человека', 'человек', 'человек') : '') + ': ' + opt.textContent + ' (демо). Напомним за день — понарошку.';
      section.classList.add('is-done');
      if (MOTION) gsap.fromTo($('[data-done]'), { y: 30, opacity: 0, rotate: -2 }, { y: 0, opacity: 1, rotate: 0, duration: 0.9, ease: 'expo.out' });
    });
  }

  /* ==========================================================================
     ПЕРЕХОДЫ МЕЖДУ СТРАНИЦАМИ
     ========================================================================== */
  /* «перелёт» обложки: перед уходом даём нажатой обложке имя для View Transitions */
  d.addEventListener('click', function (e) {
    if (!VT || RM) return;
    var a = e.target.closest && e.target.closest('a[data-cover-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var cov = $('.cover', a);
    if (!cov) return;
    html.classList.add('vt-leaving');
    $$('.cover').forEach(function (c) { c.style.viewTransitionName = ''; });
    cov.style.viewTransitionName = 'book-cover';
  });
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    html.classList.remove('vt-leaving');
    $$('.cover').forEach(function (c) { c.style.viewTransitionName = ''; });
    var cur = $('.curtain');
    if (cur && gsap) gsap.set(cur, { xPercent: 101, visibility: 'hidden' });
    html.classList.remove('is-arriving');
  });

  /* фолбэк: шторка-лист на GSAP для браузеров без View Transitions между страницами */
  var curtain = $('.curtain');
  if (curtain && gsap && !RM) {
    if (html.classList.contains('is-arriving')) {
      try { sessionStorage.removeItem('pp-curtain'); } catch (e) { /* ничего */ }
      gsap.set(curtain, { xPercent: 0, visibility: 'visible' });
      html.classList.remove('is-arriving');
      gsap.to(curtain, { xPercent: -101, duration: 0.9, ease: 'expo.inOut', delay: 0.05, onComplete: function () { gsap.set(curtain, { visibility: 'hidden', xPercent: 101 }); } });
    }
    if (!VT) {
      d.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (a.target === '_blank' || a.hasAttribute('download')) return;
        var url = new URL(a.href, location.href);
        if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
        e.preventDefault();
        try { sessionStorage.setItem('pp-curtain', '1'); } catch (er) { /* ничего */ }
        gsap.set(curtain, { xPercent: 101, visibility: 'visible' });
        gsap.to(curtain, { xPercent: 0, duration: 0.65, ease: 'expo.inOut', onComplete: function () { location.href = url.href; } });
      });
    }
  } else {
    html.classList.remove('is-arriving');
  }

  /* ---------- запуск страниц ---------- */
  if (page === 'home') initHome();
  if (page === 'catalog') initCatalog();
  if (page === 'book') initBook();
  if (page === 'events') initEvents();

  /* после загрузки шрифтов размеры меняются — пересчитываем триггеры */
  if (ST) {
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });
  }
})();
