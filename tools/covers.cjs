/* Генеративные обложки «Переплёта».
   Одна функция — и в браузере, и в Node (tools/build.mjs).
   Обложка = SVG-символ 200×300: типографика + геометрия. */
(function (root) {
  'use strict';

  var FD = 'Unbounded, Arial Black, sans-serif';
  var FT = 'Literata, Georgia, serif';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Перенос строк по примерной ширине символа Unbounded */
  function wrap(text, size, width) {
    var max = Math.max(4, Math.floor(width / (size * 0.74)));
    var words = String(text).split(' ');
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (test.length > max && cur) { lines.push(cur); cur = w; } else { cur = test; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* Подбираем кегль, чтобы самая длинная строка влезла */
  function fit(text, width, from, to, maxLines) {
    for (var s = from; s >= to; s -= 1) {
      var lines = wrap(text, s, width);
      var longest = Math.max.apply(null, lines.map(function (l) { return l.length; }));
      if (lines.length <= maxLines && longest * s * 0.74 <= width) return { size: s, lines: lines };
    }
    return { size: to, lines: wrap(text, to, width) };
  }

  function title(t, x, y, opts) {
    var o = opts || {};
    var f = fit(t, o.width || 168, o.from || 22, o.to || 11, o.max || 4);
    var lh = f.size * 1.08;
    var anchor = o.anchor || 'start';
    var up = o.up ? -1 : 1;
    var startY = o.up ? y - (f.lines.length - 1) * lh : y;
    var out = '<text x="' + x + '" y="' + startY + '" font-family="' + FD + '" font-weight="' + (o.weight || 700) + '" font-size="' + f.size + '" fill="' + o.fill + '" text-anchor="' + anchor + '" letter-spacing="-0.4">';
    f.lines.forEach(function (l, i) {
      out += '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : lh) + '">' + esc(o.upper ? l.toUpperCase() : l) + '</tspan>';
    });
    void up;
    return out + '</text>';
  }

  function author(a, x, y, fill, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + FT + '" font-style="italic" font-size="11" fill="' + fill + '" text-anchor="' + (anchor || 'start') + '">' + esc(a) + '</text>';
  }

  function mark(b, fill) {
    /* маленький знак издательства на собственных книгах */
    if (!b.house) return '';
    return '<g transform="translate(176 22)"><circle r="11" fill="none" stroke="' + fill + '" stroke-width="1.2"/><text y="4" font-family="' + FD + '" font-size="10" font-weight="800" fill="' + fill + '" text-anchor="middle">П</text></g>';
  }

  function seed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  }

  var styles = [
    /* 0 — солнце: большой круг уходит за край */
    function (b, c, r) {
      var cx = 120 + Math.round(r() * 40), cy = 95 + Math.round(r() * 30);
      return '<circle cx="' + cx + '" cy="' + cy + '" r="78" fill="' + c.ac + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="78" fill="none" stroke="' + c.fg + '" stroke-width="1" transform="translate(-10 8)"/>' +
        title(b.title, 16, 268, { fill: c.fg, up: true, from: 22 }) +
        author(b.author, 16, 26, c.fg);
    },
    /* 1 — полосы через середину */
    function (b, c) {
      var s = '';
      for (var i = 0; i < 9; i++) s += '<rect x="0" y="' + (128 + i * 9) + '" width="200" height="' + (i % 2 ? 2 : 5) + '" fill="' + c.ac + '"/>';
      return s + title(b.title, 16, 40, { fill: c.fg, from: 20 }) + author(b.author, 16, 280, c.fg);
    },
    /* 2 — гигантская первая буква */
    function (b, c) {
      var L = esc(b.title.replace(/[«»"]/g, '').charAt(0));
      return '<text x="214" y="318" font-family="' + FD + '" font-weight="900" font-size="300" fill="' + c.ac + '" text-anchor="end" opacity="0.92">' + L + '</text>' +
        title(b.title, 16, 36, { fill: c.fg, from: 18, width: 150 }) + author(b.author, 16, 282, c.fg);
    },
    /* 3 — концентрические дуги из угла */
    function (b, c) {
      var s = '';
      for (var i = 0; i < 9; i++) {
        var rr = 30 + i * 22;
        s += '<path d="M0 ' + (300 - rr) + ' A' + rr + ' ' + rr + ' 0 0 1 ' + rr + ' 300" fill="none" stroke="' + (i % 3 === 0 ? c.ac : c.fg) + '" stroke-width="' + (i % 3 === 0 ? 7 : 1.5) + '"/>';
      }
      return s + title(b.title, 184, 40, { fill: c.fg, anchor: 'end', from: 19, width: 160 }) + author(b.author, 184, 112, c.fg, 'end');
    },
    /* 4 — блоки в духе наборной кассы */
    function (b, c) {
      return '<rect x="0" y="0" width="70" height="196" fill="' + c.ac + '"/>' +
        '<rect x="70" y="120" width="76" height="76" fill="' + c.fg + '"/>' +
        '<circle cx="108" cy="158" r="22" fill="' + c.bg + '"/>' +
        '<rect x="146" y="40" width="54" height="16" fill="' + c.fg + '"/>' +
        title(b.title, 16, 228, { fill: c.fg, from: 18 }) + author(b.author, 16, 284, c.fg);
    },
    /* 5 — волны */
    function (b, c, r) {
      var s = '', amp = 6 + Math.round(r() * 6);
      for (var i = 0; i < 11; i++) {
        var y = 120 + i * 13;
        s += '<path d="M-10 ' + y + ' Q 15 ' + (y - amp) + ' 40 ' + y + ' T 90 ' + y + ' T 140 ' + y + ' T 190 ' + y + ' T 240 ' + y + '" fill="none" stroke="' + (i === 4 ? c.ac : c.fg) + '" stroke-width="' + (i === 4 ? 4 : 1.2) + '"/>';
      }
      return s + title(b.title, 16, 40, { fill: c.fg, from: 20 }) + author(b.author, 16, 284, c.fg);
    },
    /* 6 — сетка точек с диагональю */
    function (b, c, r) {
      var s = '', off = Math.floor(r() * 4);
      for (var y = 0; y < 12; y++) for (var x = 0; x < 9; x++) {
        var on = (x + y + off) % 5 === 0;
        s += '<circle cx="' + (20 + x * 20) + '" cy="' + (110 + y * 15) + '" r="' + (on ? 6 : 2) + '" fill="' + (on ? c.ac : c.fg) + '"/>';
      }
      return '<rect x="0" y="0" width="200" height="96" fill="' + c.bg + '"/>' + s +
        title(b.title, 16, 38, { fill: c.fg, from: 19, max: 3 }) + author(b.author, 184, 292, c.fg, 'end');
    },
    /* 7 — огромные цифры года контуром */
    function (b, c) {
      var yy = String(b.year).slice(2);
      return '<text x="-6" y="250" font-family="' + FD + '" font-weight="900" font-size="190" fill="none" stroke="' + c.ac + '" stroke-width="2.5" letter-spacing="-10">' + yy + '</text>' +
        '<rect x="16" y="262" width="40" height="4" fill="' + c.ac + '"/>' +
        title(b.title, 16, 38, { fill: c.fg, from: 20 }) + author(b.author, 16, 284, c.fg);
    },
    /* 8 — классическая рамка */
    function (b, c) {
      return '<rect x="12" y="12" width="176" height="276" fill="none" stroke="' + c.fg + '" stroke-width="1.5"/>' +
        '<rect x="18" y="18" width="164" height="264" fill="none" stroke="' + c.fg + '" stroke-width="0.6"/>' +
        '<path d="M100 196 l10 10 -10 10 -10 -10z" fill="' + c.ac + '"/>' +
        '<path d="M48 206 H84 M116 206 H152" stroke="' + c.fg + '" stroke-width="1"/>' +
        title(b.title, 100, 92, { fill: c.fg, anchor: 'middle', from: 18, width: 140, weight: 600 }) +
        author(b.author, 100, 252, c.fg, 'middle');
    },
    /* 9 — диагональный раскол */
    function (b, c) {
      return '<path d="M0 300 L200 120 L200 300 Z" fill="' + c.ac + '"/>' +
        '<path d="M0 262 L200 82" stroke="' + c.fg + '" stroke-width="1.2"/>' +
        title(b.title, 16, 40, { fill: c.fg, from: 20, width: 168 }) + author(b.author, 184, 286, c.bg, 'end');
    }
  ];

  function symbol(b) {
    var c = b.cover;
    var r = seed(b.id);
    var body = styles[c.style % styles.length](b, c, r);
    return '<symbol id="c-' + b.id + '" viewBox="0 0 200 300">' +
      '<rect width="200" height="300" fill="' + c.bg + '"/>' + body + mark(b, c.style === 4 ? c.fg : c.fg) +
      '</symbol>';
  }

  function sprite(books) {
    return '<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">' + books.map(symbol).join('') + '</svg>';
  }

  var api = { symbol: symbol, sprite: sprite };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPCovers = api;
})(typeof self !== 'undefined' ? self : this);
