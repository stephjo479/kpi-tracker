/*
 * BAHASA (i18n) — Indonesia (asli) · English · 한국어
 * ------------------------------------------------------------------
 * Aplikasi ditulis dalam Bahasa Indonesia. File ini menerjemahkan teks
 * yang tampil di layar secara otomatis (kamus di js/i18n-dict.js):
 *   1. cocok persis  → 'Simpan' = Save / 저장
 *   2. pola          → 'Masuk {0}' = In {0} / 출근 {0}   ({0} = teks apa saja, {#0} = angka saja;
 *                      isi {0} ikut diterjemahkan bila ada di kamus)
 *   3. teks yang dipisah " · " atau ", " diterjemahkan per bagian.
 * Teks yang tidak ada di kamus tetap tampil apa adanya (tidak error).
 * Elemen dengan atribut translate="no" tidak diterjemahkan (nama bahasa, dll).
 */
var I18N = (function () {
  var LANGS = [['id', 'Indonesia', 'ID'], ['en', 'English', 'EN'], ['ko', '한국어', 'KO']];
  var LOCALE = { id: 'id-ID', en: 'en-US', ko: 'ko-KR' };
  function valid(l) { return l === 'id' || l === 'en' || l === 'ko'; }
  function detect() {
    var s = null;
    try { s = localStorage.getItem('lang'); } catch (e) { }
    if (valid(s)) return s;
    var n = String((navigator.languages && navigator.languages[0]) || navigator.language || 'id').toLowerCase();
    return n.indexOf('ko') === 0 ? 'ko' : n.indexOf('en') === 0 ? 'en' : 'id';
  }
  var lang = detect();
  var IDX = { en: 0, ko: 1 };
  var DICT = Object.create(null);
  var PATTERNS = [];
  var LETTER = /[A-Za-zÀ-ɏ]/;
  var NUM = '([-+−]?\\d[\\d.,:]*%?)';
  var ANY = '([\\s\\S]+?)';

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function add(obj) { Object.keys(obj).forEach(function (k) { DICT[norm(k)] = obj[k]; }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** list = [['Masuk {0}', 'In {0}', '출근 {0}'], ...] */
  function patterns(list) {
    list.forEach(function (p) {
      var src = norm(p[0]);
      var holes = src.match(/\{#?\d\}/g) || [];
      var parts = src.split(/\{#?\d\}/);
      var lits = parts.filter(Boolean).sort(function (a, b) { return b.length - a.length; });
      var re = '^';
      parts.forEach(function (x, i) { re += escRe(x); if (i < holes.length) re += holes[i].charAt(1) === '#' ? NUM : ANY; });
      re += '$';
      PATTERNS.push({ re: new RegExp(re), order: holes.map(function (x) { return +x.replace(/\D/g, ''); }), t: [p[1], p[2]], anchor: lits[0] || '', weight: parts.join('').length });
    });
    PATTERNS.sort(function (a, b) { return b.weight - a.weight; });
  }

  function core(s, depth) {
    if (!s || !LETTER.test(s)) return null;
    var hit = DICT[s];
    if (hit) return hit[IDX[lang]];
    if (depth > 4) return null;
    var lead = s.match(/^([·•–—:]\s+)([\s\S]+)$/);
    if (lead) { var r1 = core(lead[2], depth + 1); return r1 == null ? null : lead[1] + r1; }
    var trail = s.match(/^([\s\S]+?)(\s+[·•–—])$/);
    if (trail) { var r2 = core(trail[1], depth + 1); return r2 == null ? null : r2 + trail[2]; }
    if (s.indexOf(' · ') > 0) {
      var changed = false;
      var out = s.split(' · ').map(function (p) { var x = core(p, depth + 1); if (x != null) { changed = true; return x; } return p; });
      if (changed) return out.join(' · ');
    }
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      if (p.anchor && s.indexOf(p.anchor) < 0) continue;
      var m = s.match(p.re);
      if (!m) continue;
      var vals = {};
      for (var j = 0; j < p.order.length; j++) { var v = m[j + 1], x = core(v, depth + 1); vals[p.order[j]] = x != null ? x : v; }
      return p.t[IDX[lang]].replace(/\{#?(\d)\}/g, function (a, n) { return vals[n] != null ? vals[n] : a; });
    }
    if (s.indexOf(', ') > 0) {
      var any = false;
      var parts = s.split(', ').map(function (q) { var y = DICT[q]; if (y) { any = true; return y[IDX[lang]]; } return q; });
      if (any) return parts.join(', ');
    }
    return null;
  }
  /** Terjemahkan satu teks (spasi di awal/akhir dipertahankan). */
  function tr(src) {
    if (lang === 'id' || src == null) return src;
    src = String(src);
    var m = src.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var x = core(norm(m[2]), 0);
    return x == null ? src : m[1] + x + m[3];
  }

  /* ---------- terjemahan DOM otomatis ---------- */
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'label'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
  function skipEl(el) { return SKIP[el.nodeName] || (el.getAttribute && el.getAttribute('translate') === 'no'); }
  function doText(n) { var v = n.nodeValue; if (!v || !LETTER.test(v)) return; var x = tr(v); if (x !== v) n.nodeValue = x; }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (el.hasAttribute(a)) { var v = el.getAttribute(a), x = tr(v); if (x !== v) el.setAttribute(a, x); }
    }
  }
  function walk(node) {
    if (node.nodeType === 3) {
      var p = node.parentNode;
      if (p && p.nodeType === 1 && (SKIP[p.nodeName] || (p.closest && p.closest('[translate="no"]')))) return;
      doText(node); return;
    }
    if (node.nodeType !== 1) return;
    if (node.nodeName === 'TEXTAREA') { doAttrs(node); return; } // placeholder diterjemahkan, isi ketikan tidak
    if (skipEl(node)) return;
    if (node.parentElement && node.parentElement.closest && node.parentElement.closest('[translate="no"]')) return;
    doAttrs(node);
    var w = document.createTreeWalker(node, 5 /* ELEMENT | TEXT */, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && n.nodeName === 'TEXTAREA' && n.getAttribute('translate') !== 'no') { doAttrs(n); return 2; }
        return n.nodeType === 1 && skipEl(n) ? 2 /* REJECT */ : 1;
      }
    });
    var n, texts = [], els = [];
    while ((n = w.nextNode())) { if (n.nodeType === 3) texts.push(n); else els.push(n); }
    for (var i = 0; i < els.length; i++) doAttrs(els[i]);
    for (var j = 0; j < texts.length; j++) doText(texts[j]);
  }
  var observer = null;
  function start() {
    document.documentElement.setAttribute('lang', lang);
    if (lang === 'id' || observer || !window.MutationObserver) return;
    document.title = tr(document.title);
    walk(document.body);
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var a = muts[i].addedNodes;
        for (var j = 0; j < a.length; j++) walk(a[j]);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function set(l) { if (!valid(l)) return; lang = l; try { localStorage.setItem('lang', l); } catch (e) { } }

  return {
    LANGS: LANGS, add: add, patterns: patterns, tr: tr, start: start, set: set,
    lang: function () { return lang; }, locale: function () { return LOCALE[lang]; },
    _core: core, _dict: DICT
  };
})();
