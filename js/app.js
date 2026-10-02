/* =========================================================
   KPI TRACKER — aplikasi utama
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- STATE ---------------- */
  var S = {
    token: Store.get('token'),
    user: Store.getJSON('user'),
    data: Store.getJSON('cache_data'),
    yt: Store.getJSON('cache_yt'),
    hist: {},
    vidByCh: {},
    publicInfo: Store.getJSON('cache_public'),
    form: null,
    editId: null,
    dirty: false,
    kpi: { period: 'month', from: '', to: '', division: 'ALL' },
    rep: { who: null, range: 'last7' },
    ch: { division: 'ALL', q: '', sort: 'views', mine: false },
    vid: { sort: 'new', kind: 'ALL' },
    adminTab: 'employees',
    update: null,
    installEvt: null,
    loading: false,
    syncing: false
  };

  /* ---------------- UTIL ---------------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var NF = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  var NC = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  function fmtN(n) { return n == null || !isFinite(n) ? '—' : NF.format(n); }
  function fmtC(n) { return n == null || !isFinite(n) ? '—' : Math.abs(n) < 10000 ? NF.format(n) : NC.format(n); }
  function fmtPct(x) { return x == null || !isFinite(x) ? '—' : Math.round(x * 100) + '%'; }
  function signed(n, compact) { if (n == null) return '—'; return (n > 0 ? '+' : '') + (compact ? fmtC(n) : fmtN(n)); }
  function fmtDate(d, opt) {
    if (!d) return '';
    var p = d.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('id-ID', Object.assign({ timeZone: 'UTC', day: 'numeric', month: 'short' }, opt || {}));
  }
  function fmtDay(d) { return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function relTime(ts) {
    if (!ts) return 'belum pernah';
    var s = (Date.now() - new Date(ts).getTime()) / 1000;
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' hari lalu';
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dur(sec) { sec = sec || 0; var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
  function initials(name) {
    var n = String(name || '?').replace(/^@/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    var parts = n.split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : (parts[0] || '').slice(1, 2))).toUpperCase();
  }
  function cap(s) { return String(s || '').toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }); }

  var DIV = {
    DEV: { label: 'Channel Development', short: 'Development', color: '--dev' },
    STAFF: { label: 'Staff Channel / Internal Production', short: 'Staff / Internal', color: '--staff' },
    CLIENT: { label: 'Client Channel', short: 'Client', color: '--client' },
    OTHER: { label: 'Lainnya', short: 'Lainnya', color: '--other' }
  };
  function divBadge(d) { d = DIV[d] ? d : 'OTHER'; return '<span class="badge div-' + d + '">' + esc(DIV[d].short) + '</span>'; }

  /* Jabatan: BOSS / MANAGER / STAFF (kolom POSITION di sheet EMPLOYEES) */
  var POS = { BOSS: 'Bos', MANAGER: 'Manager', STAFF: 'Staff' };
  function posOf(x) { var p = String((x && x.position) || '').toUpperCase(); return POS[p] ? p : 'STAFF'; }
  function posBadge(x) {
    var p = posOf(x);
    if (p === 'STAFF') return '<span class="badge st-none">Staff</span>';
    return '<span class="badge pos-' + p + '">' + icon(p === 'BOSS' ? 'crown' : 'admin') + POS[p] + '</span>';
  }
  function roleLabel(u) {
    if (!u) return '';
    var p = posOf(u);
    if (p !== 'STAFF') return POS[p] + (u.role === 'ADMIN' ? ' · Admin' : '');
    return u.role === 'ADMIN' ? 'Admin' : 'Staff';
  }
  function leaders(pos) { return D().employees.filter(function (e) { return e.active && posOf(e) === pos; }); }
  function managerNames() {
    var m = S.data ? leaders('MANAGER').map(function (e) { return e.name; }) : ((S.publicInfo && S.publicInfo.managers) || []);
    return m.map(cap).join(' / ');
  }

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    report: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
    kpi: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    yt: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
    admin: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    logo: '<path d="M5 19v-6M11 19V5M17 19v-9"/><path d="M3 21h18"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    subs: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    crown: '<path d="M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  function icon(n, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

  function statusBadge(g) {
    var ic = g.status === 'good' ? 'check' : g.status === 'none' ? '' : 'alert';
    return '<span class="badge st-' + g.status + '">' + (ic ? icon(ic) : '') + esc(g.label) + '</span>';
  }
  function barClass(p) { return p == null ? '' : p >= 0.9 ? 'good' : p >= 0.6 ? 'warning' : 'critical'; }
  function bar(p, thin) { var w = p == null ? 0 : Math.max(0, Math.min(1, p)) * 100; return '<div class="bar ' + (thin ? 'thin ' : '') + barClass(p) + '"><span style="width:' + w + '%"></span></div>'; }

  /* ---------------- TOAST & MODAL ---------------- */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    $('#toast-host').appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, type === 'error' ? 4200 : 2600);
    setTimeout(function () { el.remove(); }, type === 'error' ? 4600 : 3000);
  }
  var modalClose = null;
  function openModal(o) {
    closeModal();
    var host = $('#modal-host');
    host.innerHTML = '<div class="modal-backdrop"><div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2 class="ellipsis">' + o.title + '</h2><button class="btn ghost icon" data-act="modal-close" aria-label="Tutup">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + o.body + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div></div>';
    var bd = $('.modal-backdrop', host);
    bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeModal(); });
    modalClose = o.onClose || null;
    if (o.mount) o.mount($('.modal', host));
    var f = $('input:not([type=hidden]):not([readonly]),select,textarea', host);
    if (f && window.innerWidth > 700) setTimeout(function () { f.focus(); }, 50);
  }
  function closeModal() {
    var host = $('#modal-host');
    if (host && host.innerHTML) { host.innerHTML = ''; if (modalClose) { var f = modalClose; modalClose = null; f(); } }
  }
  function confirmBox(title, msg, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      openModal({
        title: esc(title), body: '<p class="text-2">' + msg + '</p>',
        foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn ' + (danger ? 'danger' : '') + '" id="confirm-ok">' + esc(okLabel || 'Ya') + '</button>',
        mount: function (m) { $('#confirm-ok', m).onclick = function () { done = true; closeModal(); resolve(true); }; },
        onClose: function () { if (!done) resolve(false); }
      });
    });
  }

  /* ---------------- DATA HELPERS ---------------- */
  function D() { return S.data || { channels: [], employees: [], reports: [], config: {} }; }
  function cfg() { return D().config || {}; }
  function isAdmin() { return !!S.user && S.user.role === 'ADMIN'; }
  function seeAll() { return isAdmin() || /^true$/i.test(String(cfg().EMPLOYEE_SEE_ALL)); }
  var tzFmt = {};
  function dateInTz(date) {
    var tz = cfg().TIMEZONE || 'Asia/Jakarta';
    try {
      if (!tzFmt[tz]) tzFmt[tz] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      return tzFmt[tz].format(date);
    } catch (e) { return date.toISOString().slice(0, 10); }
  }
  function today() { return dateInTz(new Date()); }
  function myChannels() { var me = S.user && S.user.name; return D().channels.filter(function (c) { return c.employees.indexOf(me) >= 0; }); }
  function channelByKey(k) { return D().channels.filter(function (c) { return c.key === k; })[0]; }
  function ytOf(c) { return c && S.yt && S.yt.channels ? S.yt.channels[c.key] : null; }
  function chTitle(c) { var y = ytOf(c); return (y && y.title) || c.name; }
  function indexYT() {
    S.vidByCh = {};
    ((S.yt && S.yt.videos) || []).forEach(function (v) { (S.vidByCh[v.ch] = S.vidByCh[v.ch] || []).push(v); });
  }
  function videosOf(c) { var y = ytOf(c); return y && y.id ? (S.vidByCh[y.id] || []) : []; }
  function minSec(c) { return (Number(c && c.minDuration) || 0) * 60; }
  function videoValid(c, v) { return !minSec(c) || (v.d || 0) >= minSec(c); }
  function uploadsIn(c, from, to) {
    return videosOf(c).filter(function (v) { var d = dateInTz(new Date(v.p)); return d >= from && d <= to && videoValid(c, v); }).length;
  }
  function kpiRange(from, to) {
    var d = D();
    return KPI.compute({ channels: d.channels, reports: d.reports, employees: d.employees, attendance: d.attendance, permissions: d.permissions, from: from, to: to, today: today(), config: d.config });
  }
  function kpiPeriod(kind) { var r = KPI.periodRange(kind, today()); return kpiRange(r.from, r.to); }
  function channelActual(key, from, to) {
    return D().reports.filter(function (r) { return r.channel === key && r.date >= from && r.date <= to; }).reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
  }
  function channelTargetToday(c) { var t = today(); var k = KPI.normalizeConfig(cfg()); return KPI.isWorkday(t, k) ? KPI.dailyTarget(c.target, t, k) : 0; }
  function avatar(c, cls) {
    var y = ytOf(c);
    var d = c.division || 'OTHER';
    if (y && y.thumb) return '<div class="avatar ' + (cls || '') + '"><img src="' + esc(y.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></div>';
    return '<div class="avatar div-' + d + ' ' + (cls || '') + '">' + esc(initials(chTitle(c))) + '</div>';
  }
  function personAvatar(name, cls) { return '<div class="avatar ' + (cls || '') + '">' + esc(initials(name)) + '</div>'; }
  function parseMoney(s) { var m = String(s || '').match(/\d[\d.,]*/); if (!m) return 0; return Number(m[0].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(/[.,]\d{1,2}$/, '').replace(/\D/g, '')) || 0; }
  function nextPayday(s) {
    var m = String(s || '').match(/(\d{1,2})/);
    if (!m) return null;
    var day = Math.min(31, Math.max(1, +m[1]));
    var t = today(), y = +t.slice(0, 4), mo = +t.slice(5, 7);
    function mk(yy, mm) { var last = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); return yy + '-' + String(mm).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0'); }
    var d = mk(y, mo);
    if (d < t) d = mo === 12 ? mk(y + 1, 1) : mk(y, mo + 1);
    return d;
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

  /* ---------------- LOADING ---------------- */
  function handleErr(e) {
    if (e && e.code === 'AUTH') { logout(true); toast(e.message, 'error'); return; }
    toast((e && e.message) || 'Terjadi kesalahan.', 'error');
  }
  function canRerender() {
    if ($('#modal-host').innerHTML) return false;
    if (S.dirty && (route().name === 'report' || route().name === 'attendance')) return false;
    if (document.querySelector('.comic-backdrop')) return false;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return false;
    return true;
  }
  function loadData(silent) {
    if (!S.token) return Promise.resolve();
    if (!silent) S.loading = true;
    return API.call('getData').then(function (d) {
      S.data = d; S.user = d.user; S.loading = false;
      syncClock(d.serverTime);
      Store.setJSON('user', d.user); Store.setJSON('cache_data', d);
      try { maybeNotifyPayroll(); } catch (e) { }
      if (!silent || canRerender()) render();
    }).catch(function (e) { S.loading = false; if (!silent || e.code === 'AUTH') handleErr(e); });
  }
  function loadYT(silent) {
    if (!S.token) return Promise.resolve();
    return API.call('getYouTube').then(function (y) {
      S.yt = y; S.hist = {}; Store.setJSON('cache_yt', y); indexYT();
      if (!silent || canRerender()) render();
    }).catch(function (e) { if (!silent) handleErr(e); });
  }
  function loadHistory(channelId) {
    if (!channelId || S.hist[channelId]) return;
    S.hist[channelId] = 'loading';
    API.call('getHistory', { channelId: channelId, days: 30 }).then(function (h) {
      S.hist[channelId] = h;
      if (canRerender()) render();
    }).catch(function (e) { S.hist[channelId] = null; handleErr(e); });
  }

  /* ---------------- AUTH ---------------- */
  function logout(silent) {
    ['token', 'user', 'cache_data', 'cache_yt'].forEach(function (k) { Store.set(k, null); });
    S.token = null; S.user = null; S.data = null; S.yt = null; S.form = null; S.editId = null;
    closeModal();
    location.hash = '';
    render();
    if (!silent) toast('Kamu sudah keluar.');
  }

  /* ---------------- THEME ---------------- */
  function theme() { return Store.get('theme') || 'system'; }
  function setTheme(t) {
    Store.set('theme', t);
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    render();
  }
  function effectiveDark() { var t = theme(); return t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }

  /* ---------------- UPDATER ---------------- */
  var Updater = {
    reg: null, waiting: null,
    init: function () {
      if (!('serviceWorker' in navigator) || /[?&]nosw/.test(location.search)) return;
      var self = this, refreshing = false;
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        self.reg = reg;
        if (reg.waiting && navigator.serviceWorker.controller) self.found(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) self.found(w);
          });
        });
        setInterval(function () { reg.update().catch(function () { }); }, 30 * 60 * 1000);
      }).catch(function () { });
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return; refreshing = true; location.reload();
      });
    },
    found: function (worker) {
      this.waiting = worker;
      fetch('version.js?nocache=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (txt) {
        S.update = parseVersion(txt);
      }).catch(function () { S.update = { v: 'baru', notes: [] }; }).then(function () { renderUpdateSlot(); });
    },
    apply: function () {
      if (this.waiting) { this.waiting.postMessage('SKIP_WAITING'); toast('Memasang pembaruan…'); setTimeout(function () { location.reload(); }, 4000); }
      else location.reload();
    },
    check: function () {
      var self = this;
      if (!this.reg) return Promise.resolve('nosw');
      return this.reg.update().then(function () {
        return new Promise(function (res) { setTimeout(function () { res(self.waiting || self.reg.waiting || self.reg.installing ? 'found' : 'latest'); }, 1500); });
      });
    }
  };
  function parseVersion(txt) {
    var v = (txt.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '?';
    var date = (txt.match(/APP_RELEASE_DATE\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '';
    var block = (txt.match(/APP_RELEASE_NOTES\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
    var notes = [], re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g, m;
    while ((m = re.exec(block))) notes.push((m[1] != null ? m[1] : m[2]).replace(/\\(.)/g, '$1'));
    return { v: v, date: date, notes: notes };
  }
  function updateBanner() {
    if (!S.update) return '';
    return '<div class="update-banner">' + icon('download') + '<div class="grow"><div>Versi baru <b>' + esc(S.update.v) + '</b> tersedia</div>' +
      (S.update.notes.length ? '<div class="xs" style="opacity:.85">' + esc(S.update.notes[0]) + (S.update.notes.length > 1 ? ' (+' + (S.update.notes.length - 1) + ' lainnya)' : '') + '</div>' : '') +
      '</div><button class="btn sm" data-act="apply-update">Perbarui sekarang</button></div>';
  }
  function renderUpdateSlot() { var s = $('#update-slot'); if (s) s.innerHTML = updateBanner(); else render(); }

  /* ---------------- ROUTER ---------------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'home';
    var arg = parts.slice(1).join('/');
    try { arg = decodeURIComponent(arg); } catch (e) { }
    if (name === 'admin' && !isAdmin()) name = 'home';
    return { name: name, arg: arg };
  }
  function go(path) { location.hash = '#/' + path; }

  var NAV = [
    { id: 'home', label: 'Beranda', icon: 'home' },
    { id: 'attendance', label: 'Absensi', icon: 'clock' },
    { id: 'report', label: 'Laporan', icon: 'report' },
    { id: 'kpi', label: 'KPI', icon: 'kpi' },
    { id: 'channels', label: 'Channel', icon: 'yt' },
    { id: 'team', label: 'Struktur Tim', icon: 'users' },
    { id: 'admin', label: 'Admin', icon: 'admin', admin: true },
    { id: 'settings', label: 'Pengaturan', icon: 'settings' }
  ];

  /* ---------------- RENDER ROOT ---------------- */
  var mounts = [];
  function onMount(fn) { mounts.push(fn); }

  function render() {
    var app = $('#app');
    mounts = [];
    if (!S.token) { app.innerHTML = loginView(); runMounts(); return; }
    var r = route();
    var page = '';
    if (!S.data) page = loadingView();
    else if (r.name === 'report') page = reportView();
    else if (r.name === 'kpi') page = kpiView();
    else if (r.name === 'channels') page = channelsView();
    else if (r.name === 'channel') page = channelDetailView(r.arg);
    else if (r.name === 'admin') page = adminView();
    else if (r.name === 'team') page = teamView();
    else if (r.name === 'attendance') page = attendanceView();
    else if (r.name === 'settings') page = settingsView();
    else page = homeView();
    var active = r.name === 'channel' ? 'channels' : r.name;
    var y = window.scrollY;
    var same = app.dataset.route === location.hash;
    app.innerHTML = shellView(active, page);
    app.dataset.route = location.hash;
    if (same) window.scrollTo(0, y);
    runMounts();
  }
  function runMounts() { var m = mounts; mounts = []; m.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  function shellView(active, page) {
    var u = S.user || {};
    var company = cfg().COMPANY_NAME || (S.publicInfo && S.publicInfo.company) || 'KPI Tracker';
    var navItems = NAV.filter(function (n) { return !n.admin || isAdmin(); });
    var side = '<aside class="sidebar"><div class="brand"><div class="brand-logo">' + icon('logo') + '</div><div class="col"><div class="brand-name">' + esc(company) + '</div><div class="brand-sub">KPI & Channel Tracker</div></div></div>' +
      navItems.map(function (n) { return '<a class="nav-item ' + (active === n.id ? 'active' : '') + '" href="#/' + n.id + '">' + icon(n.icon) + n.label + (n.id === 'admin' && activeReminder() ? '<span class="nav-dot" title="Pengingat gajian"></span>' : '') + (n.id === 'attendance' && isAdmin() && attEnabled() && pendingPerms().length ? '<span class="nav-dot" title="Izin menunggu persetujuan"></span>' : '') + '</a>'; }).join('') +
      '<div class="nav-spacer"></div>' +
      (isStandalone() ? '' : '<div class="mb">' + installButton('block sm', 'Pasang di PC') + '</div>') +
      (API.isDemo() ? '<div class="notice warn xs mb">Mode demo — data fiktif</div>' : '') +
      '<div class="user-card">' + personAvatar(u.name) + '<div class="col grow"><div class="bold ellipsis">' + esc(cap(u.name)) + '</div><div class="xs muted">' + esc(roleLabel(u)) + '</div></div>' +
      '<button class="btn ghost icon sm" data-act="cycle-theme" title="Ganti tema">' + icon(effectiveDark() ? 'moon' : 'sun') + '</button></div></aside>';
    var bottomIds = isAdmin() ? ['home', 'attendance', 'report', 'kpi', 'admin'] : ['home', 'attendance', 'report', 'kpi', 'settings'];
    var bottom = '<nav class="bottom-nav">' + bottomIds.map(function (id) {
      var n = NAV.filter(function (x) { return x.id === id; })[0];
      return '<a class="nav-item ' + (active === id ? 'active' : '') + '" href="#/' + id + '">' + icon(n.icon) + (id === 'settings' ? 'Akun' : n.label) + (id === 'admin' && activeReminder() ? '<span class="nav-dot"></span>' : '') + (id === 'attendance' && isAdmin() && attEnabled() && pendingPerms().length ? '<span class="nav-dot"></span>' : '') + '</a>';
    }).join('') + '</nav>';
    var top = '<header class="topbar"><div class="brand-logo" style="width:32px;height:32px;border-radius:10px">' + icon('logo') + '</div><div class="grow bold ellipsis">' + esc(company) + '</div>' +
      '<a class="btn ghost icon sm" href="#/channels" aria-label="Channel YouTube" title="Channel YouTube">' + icon('yt') + '</a>' +
      '<a class="btn ghost icon sm' + (active === 'team' ? ' active' : '') + '" href="#/team" aria-label="Struktur tim" title="Struktur tim">' + icon('users') + '</a>' +
      '<button class="btn ghost icon sm" data-act="cycle-theme" aria-label="Ganti tema">' + icon(effectiveDark() ? 'moon' : 'sun') + '</button>' +
      '<a href="#/settings" aria-label="Akun">' + personAvatar(u.name, 'sm') + '</a></header>';
    return '<div class="shell">' + side + '<div class="main">' + top + '<main class="content"><div id="update-slot">' + updateBanner() + '</div>' + page + '</main></div>' + bottom + '</div>';
  }

  function loadingView() {
    return '<div class="grid grid-4">' + [1, 2, 3, 4].map(function () { return '<div class="card"><div class="skeleton" style="height:16px;width:50%"></div><div class="skeleton mt-sm" style="height:30px;width:70%"></div></div>'; }).join('') +
      '</div><div class="card mt"><div class="skeleton" style="height:220px"></div></div>';
  }

  function pageHead(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="row wrap">' + actions + '</div>' : '') + '</div>';
  }

  /* =========================================================
     LOGIN
     ========================================================= */
  function loginView() {
    var demo = API.isDemo();
    var hasServer = !!API.url();
    var info = S.publicInfo;
    var body;
    if (!hasServer && !demo) {
      body = '<h2 class="center">Hubungkan server</h2><p class="center muted small mt-sm mb">Aplikasi belum terhubung ke Google Spreadsheet. Admin: tempel URL Web App (berakhiran <span class="kbd">/exec</span>).</p>' +
        '<form data-form="server"><div class="field"><label>URL Web App</label><input class="input" name="url" placeholder="https://script.google.com/macros/s/…/exec" required></div>' +
        '<button class="btn block">Simpan & lanjut</button></form>' +
        '<div class="divider"></div><button class="btn ghost block" data-act="demo-on">' + icon('eye') + 'Coba mode demo</button>';
    } else {
      var names = (info && info.employees) || [];
      body = '<h2 class="center">Masuk</h2><p class="center muted small mt-sm mb">' + esc((info && info.company) || 'KPI & Channel Tracker') + '</p>' +
        '<form data-form="login">' +
        '<div class="field"><label>Nama</label>' + (names.length
          ? '<select class="input" name="name" required><option value="">Pilih namamu…</option>' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>'
          : S._infoFailed
            ? '<input class="input" name="name" placeholder="Nama sesuai sheet" autocomplete="username" required>'
            : '<select class="input" name="name" required disabled><option value="">Memuat daftar nama…</option></select>') + '</div>' +
        '<div class="field"><label>PIN</label><div class="pin-wrap"><input class="input pin" id="pin-input" name="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="current-password" required placeholder="••••">' +
        '<button type="button" class="pin-eye" data-act="toggle-pin" aria-label="Tampilkan PIN" title="Tampilkan / sembunyikan PIN">' + icon('eye') + '</button></div></div>' +
        '<div id="login-error" class="notice warn small mb hidden" role="alert"></div>' +
        '<button class="btn block" id="login-btn">Masuk</button></form>' +
        (demo ? '<div class="notice warn mt small">Mode demo (data fiktif). Coba <b>OWNER / 1234</b> (admin) atau <b>RINA / 1111</b> (karyawan).</div>' +
          '<button class="btn ghost block mt-sm" data-act="demo-off">Keluar dari mode demo</button>' :
          '<p class="xs muted center mt">PIN diberikan oleh manager. Lupa PIN? Hubungi ' + (managerNames() ? 'Manager: <b>' + esc(managerNames()) + '</b>' : 'manager') + '.</p>');
    }
    onMount(function () {
      if ((hasServer || demo) && !S._infoLoading) {
        S._infoLoading = true;
        API.call('publicInfo').then(function (i) {
          var changed = JSON.stringify(i) !== JSON.stringify(S.publicInfo);
          S.publicInfo = i; Store.setJSON('cache_public', i);
          S._infoLoading = false; S._infoFailed = false;
          if (changed && !S.token) render();
        }).catch(function (e) { S._infoLoading = false; S._infoFailed = true; if (!S.token) render(); toast(e.message, 'error'); });
      }
    });
    return '<div class="login-wrap"><div class="card login-card"><div class="login-logo">' + icon('logo') + '</div>' + body +
      (isStandalone() ? '' : '<div class="mt-sm">' + installButton('block sm', isDesktop() ? 'Pasang aplikasi di PC ini' : 'Pasang aplikasi di perangkat ini') + '</div>') +
      '<div class="row between mt"><span class="xs muted">v' + esc(APP_VERSION) + '</span>' +
      '<div class="seg">' + themeSeg() + '</div></div></div></div>';
  }
  function themeSeg() {
    var t = theme();
    return [['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap'], ['system', 'monitor', 'Sistem']].map(function (x) {
      return '<button class="' + (t === x[0] ? 'active' : '') + '" data-act="theme" data-v="' + x[0] + '" title="' + x[2] + '" aria-label="' + x[2] + '"><span class="row" style="gap:6px">' + icon(x[1]).replace('<svg ', '<svg width="15" height="15" ') + '<span class="theme-label">' + x[2] + '</span></span></button>';
    }).join('');
  }

  /* =========================================================
     HOME
     ========================================================= */
  function greet() {
    var h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: cfg().TIMEZONE || 'Asia/Jakarta' }).format(new Date());
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  }

  function ytTotals(chs) {
    var t = { views: 0, dViews: 0, subs: 0, dSubs: 0, tracked: 0, hasDelta: false };
    var seen = {};
    chs.forEach(function (c) {
      var y = ytOf(c);
      if (!y || y.status !== 'OK' || seen[y.id]) return;
      seen[y.id] = 1; t.tracked++;
      t.views += y.views; t.subs += y.subs;
      if (y.dViews != null) { t.dViews += y.dViews; t.hasDelta = true; }
      if (y.dSubs != null) t.dSubs += y.dSubs;
    });
    return t;
  }

  function statTile(label, value, delta, ic, deltaLabel) {
    var dcls = delta == null ? 'muted' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'muted';
    return '<div class="card stat"><div class="label"><span class="stat-icon">' + icon(ic) + '</span>' + label + '</div><div class="value num">' + value + '</div>' +
      '<div class="delta ' + dcls + '">' + (delta == null ? (deltaLabel || '&nbsp;') : signed(delta, true) + ' ' + (deltaLabel || 'vs kemarin')) + '</div></div>';
  }

  function topVideos(chs, n) {
    var list = [];
    chs.forEach(function (c) { videosOf(c).forEach(function (v) { list.push({ v: v, c: c }); }); });
    var seen = {};
    list = list.filter(function (x) { if (seen[x.v.id]) return false; seen[x.v.id] = 1; return true; });
    list.sort(function (a, b) { return (b.v.dv || 0) - (a.v.dv || 0) || b.v.v - a.v.v; });
    return list.slice(0, n);
  }
  function videoRow(x, showCh) {
    var v = x.v;
    return '<a class="list-item clickable" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
      (v.th ? '<img class="video-thumb" src="' + esc(v.th) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="video-thumb" style="display:grid;place-items:center;color:var(--muted)">' + icon('video').replace('<svg ', '<svg width="22" height="22" ') + '</div>') +
      '<div class="col grow"><div class="video-title">' + esc(v.t) + '</div><div class="xs muted ellipsis">' + (showCh ? esc(chTitle(x.c)) + ' · ' : '') + relTime(v.p) + '</div></div>' +
      '<div class="col right nowrap"><div class="bold num">' + fmtC(v.v) + '</div><div class="xs ' + (v.dv > 0 ? 'up' : 'muted') + ' num">' + (v.dv == null ? 'views' : signed(v.dv, true)) + '</div></div></a>';
  }

  function homeView() {
    return isAdmin() ? homeAdmin() : homeEmployee();
  }

  function homeEmployee() {
    var u = S.user, t = today(), kcfg = KPI.normalizeConfig(cfg());
    var mine = myChannels();
    var todayK = kpiRange(t, t).list.filter(function (e) { return e.name === u.name; })[0];
    var monthK = kpiPeriod('month').list.filter(function (e) { return e.name === u.name; })[0];
    var reportedToday = D().reports.some(function (r) { return r.employee === u.name && r.date === t; });
    var workday = KPI.isWorkday(t, kcfg);
    var score = monthK ? monthK.score : null;
    var yt = ytTotals(mine);
    var uploadsToday = mine.reduce(function (s, c) { return s + uploadsIn(c, t, t); }, 0);

    var hero = '<div class="hero"><div class="hero-grid"><div class="ring-wrap">' + Charts.ring(score == null ? 0 : score / 100, { size: 132, stroke: 12, color: effectiveDark() ? getCss('--accent') : '#ffffff', track: effectiveDark() ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.25)' }) +
      '<div class="ring-label"><div class="v num">' + (score == null ? '—' : score) + '</div><div class="l">Skor KPI</div></div></div>' +
      '<div><div class="sub small">' + esc(fmtDay(t)) + '</div><h1 style="margin:4px 0 2px">' + greet() + ', ' + esc(cap(u.name)) + '</h1>' +
      '<div class="sub">' + (monthK ? 'Bulan ini: ' + esc(monthK.grade.label) + ' · ' + fmtN(monthK.actual) + ' dari ' + fmtN(monthK.target) + ' target' : 'Belum ada channel yang ditugaskan.') + '</div>' +
      '<div class="hero-stats"><div class="hero-stat"><div class="v num">' + (todayK ? fmtN(todayK.actual) + '/' + fmtN(todayK.target) : '—') + '</div><div class="l">Output hari ini</div></div>' +
      '<div class="hero-stat"><div class="v num">' + fmtPct(monthK && monthK.discipline) + '</div><div class="l">Disiplin lapor</div></div>' +
      '<div class="hero-stat"><div class="v num">' + mine.length + '</div><div class="l">Channel</div></div></div>' +
      '<div class="row wrap mt">' + (reportedToday
        ? '<a class="btn on-hero" href="#/report">' + icon('check') + 'Sudah lapor hari ini · Tambah lagi</a>'
        : '<a class="btn on-hero" href="#/report">' + icon('plus') + (workday ? 'Isi laporan hari ini' : 'Isi laporan') + '</a>') + '</div>' +
      '</div></div></div>';

    var tiles = '<div class="grid grid-4 mt">' +
      statTile('Total views', fmtC(yt.views), yt.hasDelta ? yt.dViews : null, 'eye') +
      statTile('Views 24 jam', yt.hasDelta ? signed(yt.dViews, true) : '—', null, 'trend', yt.hasDelta ? 'semua channel saya' : 'menunggu data kemarin') +
      statTile('Subscriber', fmtC(yt.subs), yt.hasDelta ? yt.dSubs : null, 'subs') +
      statTile('Upload hari ini', fmtN(uploadsToday), null, 'video', 'terdeteksi di YouTube') + '</div>';

    var chList = mine.length ? mine.map(function (c) {
      var target = channelTargetToday(c), actual = channelActual(c.key, t, t), y = ytOf(c);
      return '<a class="list-item clickable" href="#/channel/' + encodeURIComponent(c.key) + '" style="color:inherit;text-decoration:none">' + avatar(c) +
        '<div class="col grow"><div class="row"><span class="bold ellipsis">' + esc(chTitle(c)) + '</span>' + divBadge(c.division) + '</div>' +
        '<div class="row small" style="gap:8px"><div class="grow">' + bar(target ? actual / target : null, true) + '</div><span class="num nowrap text-2">' + fmtN(actual) + '/' + fmtN(target) + '</span></div></div>' +
        '<div class="col right nowrap"><div class="bold num">' + (y && y.status === 'OK' ? fmtC(y.views) : '—') + '</div><div class="xs num ' + (y && y.dViews > 0 ? 'up' : 'muted') + '">' + (y && y.dViews != null ? signed(y.dViews, true) : 'views') + '</div></div></a>';
    }).join('') : '<div class="empty">' + icon('yt') + '<div>Kamu belum terdaftar di channel manapun.</div></div>';

    var tv = topVideos(mine, 5);
    var myReports = D().reports.filter(function (r) { return r.employee === u.name; }).sort(sortReports).slice(0, 5);

    return presenceCard() + hero + tiles +
      '<div class="grid grid-main mt"><div class="card"><div class="card-head"><h2>Channel saya hari ini</h2><a class="small" href="#/channels">Lihat semua</a></div><div class="list">' + chList + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Video naik (24 jam)</h2></div><div class="list">' + (tv.length ? tv.map(function (x) { return videoRow(x, true); }).join('') : emptyYT()) + '</div></div></div>' +
      '<div class="card mt"><div class="card-head"><h2>Laporan terakhir</h2><a class="small" href="#/report">Buka laporan</a></div>' + reportList(myReports, false) + '</div>' +
      teamStrip() + installHint();
  }

  function emptyYT() {
    return '<div class="empty">' + icon('yt') + '<div>Belum ada data YouTube.</div><div class="xs">Data views diperbarui otomatis setiap ' + esc(cfg().YT_SYNC_HOURS || 3) + ' jam.</div></div>';
  }

  function homeAdmin() {
    var t = today(), kcfg = KPI.normalizeConfig(cfg());
    var d = D();
    var todayK = kpiRange(t, t), monthK = kpiPeriod('month');
    var staff = d.employees.filter(function (e) { return e.active && e.role !== 'ADMIN' && !KPI.isLeader(e); });
    var assigned = staff.filter(function (e) { return d.channels.some(function (c) { return c.employees.indexOf(e.name) >= 0; }); });
    var reported = {};
    d.reports.forEach(function (r) { if (r.date === t) reported[r.employee] = 1; });
    var notYet = assigned.filter(function (e) { return !reported[e.name]; });
    var yt = ytTotals(d.channels);
    var workday = KPI.isWorkday(t, kcfg);
    var tAch = todayK.summary.achievement;

    var hero = '<div class="hero"><div class="hero-grid"><div class="ring-wrap">' + Charts.ring(tAch == null ? 0 : Math.min(1, tAch), { size: 132, stroke: 12, color: effectiveDark() ? getCss('--accent') : '#ffffff', track: effectiveDark() ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.25)' }) +
      '<div class="ring-label"><div class="v num">' + (tAch == null ? '—' : Math.round(tAch * 100) + '%') + '</div><div class="l">Output tim hari ini</div></div></div>' +
      '<div><div class="sub small">' + esc(fmtDay(t)) + (workday ? '' : ' · hari libur') + '</div><h1 style="margin:4px 0 2px">' + greet() + ', ' + esc(cap(S.user.name)) + '</h1>' +
      '<div class="sub">Ringkasan tim secara real-time dari laporan harian.</div>' +
      '<div class="hero-stats"><div class="hero-stat"><div class="v num">' + (assigned.length - notYet.length) + '/' + assigned.length + '</div><div class="l">Sudah lapor</div></div>' +
      '<div class="hero-stat"><div class="v num">' + (monthK.summary.avgScore == null ? '—' : monthK.summary.avgScore) + '</div><div class="l">Rata-rata KPI bulan ini</div></div>' +
      '<div class="hero-stat"><div class="v num">' + fmtN(todayK.summary.actual) + '/' + fmtN(todayK.summary.target) + '</div><div class="l">Output hari ini</div></div></div>' +
      '</div></div></div>';

    var tiles = '<div class="grid grid-4 mt">' +
      statTile('Total views', fmtC(yt.views), yt.hasDelta ? yt.dViews : null, 'eye') +
      statTile('Subscriber', fmtC(yt.subs), yt.hasDelta ? yt.dSubs : null, 'subs') +
      statTile('Channel dipantau', yt.tracked + '<span class="muted" style="font-size:16px"> / ' + d.channels.length + '</span>', null, 'yt', 'punya link YouTube') +
      statTile('Upload hari ini', fmtN(d.channels.reduce(function (s, c) { return s + uploadsIn(c, t, t); }, 0)), null, 'video', 'terdeteksi di YouTube') + '</div>';

    // KPI per divisi
    var divs = ['DEV', 'STAFF', 'CLIENT'].map(function (k) {
      var l = monthK.list.filter(function (e) { return e.divisions.indexOf(k) >= 0 && e.score != null; });
      var avg = l.length ? Math.round(l.reduce(function (s, e) { return s + e.score; }, 0) / l.length) : null;
      var tt = 0, aa = 0;
      monthK.list.forEach(function (e) { e.channels.forEach(function (c) { if (c.division === k) { tt += c.target; aa += c.actual; } }); });
      return '<div class="list-item"><span class="chip" style="cursor:default"><span class="dot" style="background:var(' + DIV[k].color + ')"></span>' + esc(DIV[k].label) + '</span><div class="grow"></div>' +
        '<div class="col right" style="min-width:140px"><div class="row" style="justify-content:flex-end"><span class="bold num">' + (avg == null ? '—' : avg) + '</span><span class="xs muted">skor · ' + l.length + ' org</span></div>' + bar(tt ? aa / tt : null, true) + '<div class="xs muted num">' + fmtN(aa) + ' / ' + fmtN(tt) + ' output</div></div></div>';
    }).join('');

    var notYetHtml = !workday ? '<div class="empty">' + icon('calendar') + '<div>Hari ini bukan hari kerja.</div></div>' :
      notYet.length ? '<div class="chips">' + notYet.map(function (e) { return '<span class="chip" style="cursor:default">' + personAvatar(e.name, 'sm').replace('avatar sm', 'avatar sm" style="width:20px;height:20px;font-size:9px') + esc(cap(e.name)) + '</span>'; }).join('') + '</div>'
        : '<div class="empty">' + icon('check') + '<div>Semua karyawan sudah melapor hari ini.</div></div>';

    var top = monthK.list.filter(function (e) { return e.score != null; }).slice(0, 5).map(function (e, i) {
      return '<div class="list-item"><span class="bold muted num" style="width:18px">' + (i + 1) + '</span>' + personAvatar(e.name) + '<div class="col grow"><div class="bold">' + esc(cap(e.name)) + '</div><div class="xs muted">' + fmtPct(e.achievement) + ' output · ' + fmtPct(e.discipline) + ' disiplin</div></div>' +
        '<div class="grade st-' + e.grade.status + '">' + e.score + '</div></div>';
    }).join('') || '<div class="empty">Belum ada data KPI.</div>';

    // jadwal gaji (admin)
    var rd = reminderDays();
    var payHtml = payrollBatches(3).map(function (b) {
      var soon = b.daysLeft <= rd;
      var nG = b.items.filter(function (x) { return x.category !== 'BIAYA'; }).length, nB = b.items.length - nG;
      return '<div class="list-item"><div class="stat-icon"' + (soon ? ' style="background:var(--warning-soft);color:var(--warning-text)"' : '') + '>' + icon(soon ? 'bell' : 'calendar') + '</div><div class="col grow"><div class="bold">' + esc(fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'long' })) + '</div>' +
        '<div class="xs muted">' + nG + ' gaji' + (nB ? ' + ' + nB + ' biaya' : '') + ' · ' + (b.daysLeft === 0 ? 'hari ini' : b.daysLeft + ' hari lagi') + '</div></div><div class="bold num">Rp ' + fmtN(b.total) + '</div></div>';
    }).join('') || '<div class="empty">Belum ada data gaji.</div>';

    var tv = topVideos(d.channels, 6);
    return reminderBanner() + presenceCard() + hero + tiles + attTodayCard() +
      '<div class="grid grid-main mt"><div class="card"><div class="card-head"><h2>Belum lapor hari ini</h2><span class="sub">' + notYet.length + ' orang</span></div>' + notYetHtml +
      '<div class="divider"></div><div class="card-head" style="margin-bottom:4px"><h2>KPI per divisi</h2><span class="sub">bulan ini</span></div><div class="list">' + divs + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Top performer</h2><a class="small" href="#/kpi">Lihat KPI</a></div><div class="list">' + top + '</div></div></div>' +
      '<div class="grid grid-main mt"><div class="card"><div class="card-head"><h2>Video naik (24 jam)</h2><a class="small" href="#/channels">Semua channel</a></div><div class="list">' + (tv.length ? tv.map(function (x) { return videoRow(x, true); }).join('') : emptyYT()) + '</div></div>' +
      '<div class="card"><div class="card-head"><h2 class="row">' + icon('lock').replace('<svg ', '<svg width="16" height="16" ') + 'Jadwal gajian</h2><a class="small" href="#/admin" data-act="admin-tab" data-v="payroll">Detail</a></div><div class="list">' + payHtml + '</div><div class="xs muted mt-sm">Hanya terlihat oleh admin.</div></div></div>' +
      teamStrip() + installHint();
  }

  /* =========================================================
     STRUKTUR TIM
     ========================================================= */
  function teamStrip() {
    var boss = leaders('BOSS'), mgr = leaders('MANAGER');
    if (!boss.length && !mgr.length) return '';
    return '<div class="card mt row wrap" style="gap:14px"><div class="stat-icon">' + icon('users') + '</div><div class="col grow">' +
      '<div class="bold">Struktur tim</div><div class="small text-2">' +
      (boss.length ? 'Bos: <b>' + esc(boss.map(function (e) { return cap(e.name); }).join(', ')) + '</b>' : '') + (boss.length && mgr.length ? ' · ' : '') +
      (mgr.length ? 'Manager: <b>' + esc(mgr.map(function (e) { return cap(e.name); }).join(', ')) + '</b>' : '') + '</div></div>' +
      '<a class="btn ghost sm" href="#/team">Lihat struktur tim ' + icon('chev') + '</a></div>';
  }

  function teamView() {
    var d = D(), company = cfg().COMPANY_NAME || 'Tim';
    var boss = leaders('BOSS'), mgr = leaders('MANAGER');
    var leaderSet = {};
    boss.concat(mgr).forEach(function (e) { leaderSet[e.name] = posOf(e); });
    var me = S.user && S.user.name;
    var MGR_DESC = 'Mengelola target, channel, PIN, koreksi laporan & penggajian.';
    function person(e, big) {
      var p = posOf(e);
      return '<div class="card row" style="gap:14px;align-items:center">' +
        '<div class="avatar ' + (big ? 'lg ' : '') + 'pos-' + p + '">' + (p === 'BOSS' ? icon('crown').replace('<svg ', '<svg width="24" height="24" ') : esc(initials(e.name))) + '</div>' +
        '<div class="col grow"><div class="row wrap" style="gap:8px"><span class="bold" style="font-size:16px">' + esc(cap(e.name)) + '</span>' + posBadge(e) + (e.name === me ? '<span class="xs muted">(kamu)</span>' : '') + '</div>' +
        '<div class="xs muted">' + (p === 'BOSS' ? 'Pimpinan tertinggi ' + esc(company) + '.' : MGR_DESC) + '</div></div></div>';
    }
    var top = (boss.length ? '<div class="xs muted bold mb" style="text-transform:uppercase;letter-spacing:.05em">Bos</div><div class="grid grid-2 mb">' + boss.map(function (e) { return person(e, true); }).join('') + '</div>' : '') +
      (mgr.length ? '<div class="xs muted bold mb" style="text-transform:uppercase;letter-spacing:.05em">Manager</div><div class="grid grid-2">' + mgr.map(function (e) { return person(e, true); }).join('') + '</div>' : '');
    var contact = mgr.length ? '<div class="notice mt">' + icon('alert').replace('<svg ', '<svg width="14" height="14" style="vertical-align:-2px" ') +
      ' Lupa PIN, ganti target, channel baru, atau koreksi laporan lebih dari ' + esc(cfg().BACKDATE_DAYS || 3) + ' hari → hubungi Manager: <b>' + esc(mgr.map(function (e) { return cap(e.name); }).join(' atau ')) + '</b>.</div>' : '';

    var assigned = {};
    var divCards = ['DEV', 'STAFF', 'CLIENT'].map(function (k) {
      var chs = d.channels.filter(function (c) { return c.division === k; });
      var members = {}, order = [];
      chs.forEach(function (c) {
        c.employees.forEach(function (n) {
          assigned[n] = true;
          if (!members[n]) { members[n] = []; order.push(n); }
          members[n].push(c);
        });
      });
      order.sort(function (a, b) { return (leaderSet[a] ? 1 : 0) - (leaderSet[b] ? 1 : 0) || a.localeCompare(b); });
      var rows = order.map(function (n) {
        var list = members[n];
        return '<div class="list-item" style="align-items:flex-start">' + personAvatar(n, 'sm') + '<div class="col grow">' +
          '<div class="row wrap" style="gap:6px"><span class="bold">' + esc(cap(n)) + '</span>' + (leaderSet[n] ? posBadge({ position: leaderSet[n] }) : '') + (n === me ? '<span class="xs muted">(kamu)</span>' : '') + '</div>' +
          '<div class="xs text-2">' + list.length + ' channel: ' + list.map(function (c) { return '<a href="#/channel/' + encodeURIComponent(c.key) + '">' + esc(chTitle(c)) + '</a>'; }).join(', ') + '</div></div></div>';
      }).join('') || '<div class="empty">Belum ada anggota.</div>';
      var staffCount = order.filter(function (n) { return !leaderSet[n]; }).length;
      return '<div class="card"><div class="card-head"><h2 class="row"><span class="dot" style="width:10px;height:10px;border-radius:50%;display:inline-block;background:var(' + DIV[k].color + ')"></span>' + esc(DIV[k].label) + '</h2>' +
        '<span class="sub">' + staffCount + ' staff · ' + chs.length + ' channel</span></div><div class="list">' + rows + '</div></div>';
    }).join('');

    var idle = d.employees.filter(function (e) { return e.active && !leaderSet[e.name] && e.role !== 'ADMIN' && !assigned[e.name]; });
    var idleCard = idle.length ? '<div class="card mt"><div class="card-head"><h2>Belum memegang channel</h2><span class="sub">' + idle.length + ' orang</span></div><div class="chips">' +
      idle.map(function (e) { return '<span class="chip" style="cursor:default">' + esc(cap(e.name)) + '</span>'; }).join('') + '</div></div>' : '';

    return pageHead('Struktur tim', 'Siapa mengerjakan apa di <b>' + esc(company) + '</b>, supaya tidak ada miskomunikasi.') +
      top + contact + '<h2 class="mt mb" style="margin-top:28px">Divisi & channel</h2><div class="grid grid-3">' + divCards + '</div>' + idleCard;
  }

  function isStandalone() {
    return !!((window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches)) || navigator.standalone);
  }
  function platform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh/i.test(ua)) return 'mac';
    return 'other';
  }
  function isDesktop() { var p = platform(); return p === 'windows' || p === 'mac' || p === 'other'; }
  function browserName() {
    var ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'edge';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Chrome\//.test(ua)) return 'chrome';
    if (/Safari\//.test(ua)) return 'safari';
    return 'other';
  }
  function installGuide() {
    var p = platform(), b = browserName();
    var steps = {
      pc: '<li><b>Google Chrome</b>: klik ikon <b>Install</b> (gambar monitor dengan panah ke bawah) di ujung kanan kolom alamat. Atau menu <b>⋮ → Cast, save, and share → Install page as app</b>.</li>' +
        '<li><b>Microsoft Edge</b>: menu <b>⋯ → Apps → Install this site as an app</b>.</li>' +
        '<li>Setelah terpasang, aplikasi muncul di <b>Start Menu</b> dan bisa di-<b>pin ke taskbar</b> (klik kanan ikon → Pin to taskbar).</li>' +
        (b === 'firefox' || b === 'safari' ? '<li class="down">Browser ini belum mendukung pemasangan aplikasi. Buka link ini di Chrome atau Edge.</li>' : ''),
      mac: '<li><b>Chrome</b>: ikon <b>Install</b> di kolom alamat, atau menu <b>⋮ → Cast, save, and share → Install page as app</b>.</li>' +
        '<li><b>Safari</b> (macOS Sonoma ke atas): menu <b>File → Add to Dock</b>.</li>',
      android: '<li><b>Chrome</b>: menu <b>⋮ → Install app</b> / <b>Tambahkan ke layar utama</b>.</li>',
      ios: '<li><b>Safari</b>: tombol <b>Share</b> (kotak dengan panah ke atas) → <b>Add to Home Screen</b> → <b>Add</b>.</li>'
    };
    var key = p === 'windows' || p === 'other' ? 'pc' : p;
    return '<ol class="small text-2" style="margin:0;padding-left:20px;line-height:1.8">' + steps[key] + '</ol>';
  }
  function openInstallGuide() {
    openModal({
      title: isDesktop() ? 'Pasang aplikasi di PC / laptop' : 'Pasang aplikasi di HP',
      body: installGuide() + '<div class="notice mt small">Aplikasi yang terpasang terbuka di jendela sendiri (tanpa tab browser) dan otomatis menawarkan pembaruan saat ada versi baru.</div>',
      foot: '<button class="btn" data-act="modal-close">Mengerti</button>'
    });
  }
  function installButton(cls, label) {
    if (isStandalone()) return '';
    return '<button class="btn ghost ' + (cls || '') + '" data-act="install">' + icon('download') + esc(label || 'Pasang aplikasi') + '</button>';
  }

  function installHint() {
    if (!S.installEvt || Store.get('hideInstall')) return '';
    return '<div class="card mt row wrap"><div class="stat-icon">' + icon('download') + '</div><div class="col grow"><div class="bold">Pasang aplikasi di perangkat ini</div><div class="xs muted">Buka lebih cepat dari layar utama & dapat notifikasi update.</div></div>' +
      '<button class="btn ghost sm" data-act="hide-install">Nanti</button><button class="btn sm" data-act="install">Pasang</button></div>';
  }

  function getCss(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* =========================================================
     REPORTS
     ========================================================= */
  var TASKS = ['PRODUCTION', 'PLAYLIST', 'UPLOAD', 'EDITING', 'THUMBNAIL', 'SCRIPT', 'RISET', 'LAINNYA'];
  function sortReports(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || '').localeCompare(a.ts || ''); }
  function canEdit(r) {
    if (isAdmin()) return true;
    var back = Number(cfg().BACKDATE_DAYS) || 3;
    return r.employee === S.user.name && r.date >= KPI.addDays(today(), -back);
  }

  function defaultForm() {
    var mine = myChannels();
    var emp = isAdmin() ? '' : S.user.name;
    return { employee: emp, channel: mine.length === 1 ? mine[0].key : '', date: today(), task: '', qty: 1, links: '', notes: '' };
  }

  function reportForm() {
    var f = S.form || (S.form = defaultForm());
    var d = D(), admin = isAdmin();
    var emp = admin ? f.employee : S.user.name;
    var back = Number(cfg().BACKDATE_DAYS) || 3;
    var empChannels = d.channels.filter(function (c) { return c.employees.indexOf(emp) >= 0; });
    var others = admin ? d.channels.filter(function (c) { return empChannels.indexOf(c) < 0; }) : [];
    var editing = !!S.editId;
    function opt(c) { return '<option value="' + esc(c.key) + '"' + (f.channel === c.key ? ' selected' : '') + '>' + esc(chTitle(c)) + (chTitle(c) !== c.name ? ' (' + esc(c.name) + ')' : '') + ' · target ' + fmtN(c.target) + '</option>'; }
    var chOptions = '<option value="">Pilih channel…</option>';
    ['DEV', 'STAFF', 'CLIENT', 'OTHER'].forEach(function (k) {
      var l = empChannels.filter(function (c) { return c.division === k; });
      if (l.length) chOptions += '<optgroup label="' + esc(DIV[k].label) + '">' + l.map(opt).join('') + '</optgroup>';
    });
    if (others.length) chOptions += '<optgroup label="Channel lain">' + others.map(opt).join('') + '</optgroup>';
    var selCh = channelByKey(f.channel);
    var empOptions = admin ? '<div class="field"><label>Karyawan</label><select class="input" data-f="employee" required><option value="">Pilih karyawan…</option>' +
      d.employees.filter(function (e) { return e.active && e.login !== false; }).map(function (e) { return '<option' + (f.employee === e.name ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select></div>' : '';
    var noChannel = !admin && !empChannels.length;
    return '<div class="card"><div class="card-head"><h2>' + (editing ? 'Ubah laporan' : 'Isi laporan') + '</h2>' + (editing ? '<span class="badge st-warning">' + icon('edit') + 'Mode edit</span>' : '') + '</div>' +
      (noChannel ? '<div class="notice warn">Kamu belum terdaftar di channel manapun. Hubungi admin.</div>' :
        '<form data-form="report">' + empOptions +
        '<div class="form-row"><div class="field"><label>Tanggal</label><input class="input" type="date" data-f="date" value="' + esc(f.date) + '" max="' + today() + '"' + (admin ? '' : ' min="' + KPI.addDays(today(), -back) + '"') + ' required></div>' +
        '<div class="field"><label>Jenis tugas</label><input class="input" data-f="task" list="task-list" value="' + esc(f.task) + '" placeholder="' + esc(selCh ? selCh.indicator : 'PRODUCTION') + '"><datalist id="task-list">' + TASKS.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></div></div>' +
        '<div class="field"><label>Channel</label><select class="input" data-f="channel" required>' + chOptions + '</select>' +
        (selCh ? '<div class="hint">Target ' + esc(String(cfg().TARGET_PERIOD || 'DAILY').toLowerCase() === 'daily' ? 'harian' : String(cfg().TARGET_PERIOD).toLowerCase()) + ': <b>' + fmtN(selCh.target) + '</b> · sudah dilaporkan tanggal ini: <b>' + fmtN(channelActual(selCh.key, f.date, f.date)) + '</b>' + (selCh.minDuration ? ' · <b>durasi minimal ' + fmtN(selCh.minDuration) + ' menit per video</b>' : '') + (selCh.notes ? ' · ' + esc(selCh.notes) : '') + '</div>' : '') + '</div>' +
        '<div class="field"><label>Jumlah selesai</label><div class="stepper"><button type="button" data-act="qty" data-v="-1" aria-label="Kurangi">−</button><input type="number" inputmode="decimal" min="0" step="1" data-f="qty" value="' + esc(f.qty) + '" required><button type="button" data-act="qty" data-v="1" aria-label="Tambah">+</button></div></div>' +
        '<div class="field"><label>Link video / hasil kerja</label><textarea class="input" data-f="links" rows="3" placeholder="Satu link per baris">' + esc(f.links) + '</textarea></div>' +
        '<div class="field"><label>Catatan <span class="muted">(opsional)</span></label><textarea class="input" data-f="notes" rows="2" placeholder="Kendala, info tambahan…">' + esc(f.notes) + '</textarea></div>' +
        '<div class="row"><button class="btn grow" id="report-submit">' + icon(editing ? 'check' : 'plus') + (editing ? 'Simpan perubahan' : 'Kirim laporan') + '</button>' +
        (editing ? '<button type="button" class="btn ghost" data-act="cancel-edit">Batal</button>' : '') + '</div></form>') + '</div>';
  }

  function reportList(list, showEmp) {
    if (!list.length) return '<div class="empty">' + icon('report') + '<div>Belum ada laporan.</div></div>';
    var byDate = {};
    list.forEach(function (r) { (byDate[r.date] = byDate[r.date] || []).push(r); });
    return Object.keys(byDate).sort().reverse().map(function (date) {
      var items = byDate[date];
      var total = items.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
      return '<div class="mt-sm"><div class="row between xs muted bold" style="text-transform:uppercase;letter-spacing:.04em;padding:6px 0"><span>' + esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</span><span>' + fmtN(total) + ' output</span></div>' +
        '<div class="list">' + items.map(function (r) {
          var c = channelByKey(r.channel);
          var links = String(r.links || '').split(/\s+/).filter(function (x) { return /^https?:\/\//.test(x); });
          return '<div class="list-item top" style="align-items:flex-start">' + (c ? avatar(c, 'sm') : personAvatar(r.channel, 'sm')) +
            '<div class="col grow"><div class="row wrap" style="gap:6px"><span class="bold ellipsis">' + esc(c ? chTitle(c) : r.channel) + '</span>' + divBadge(c ? c.division : r.division) + '<span class="badge st-none">' + esc(r.task || 'PRODUCTION') + '</span></div>' +
            (showEmp ? '<div class="xs muted">oleh <b>' + esc(cap(r.employee)) + '</b>' + (r.updatedBy && r.updatedBy !== r.employee ? ' · diubah ' + esc(cap(r.updatedBy)) : '') + '</div>' : '') +
            (r.notes ? '<div class="small text-2">' + esc(r.notes) + '</div>' : '') +
            (links.length ? '<div class="link-list">' + links.slice(0, 3).map(function (l) { return '<a href="' + esc(l) + '" target="_blank" rel="noopener">' + esc(l.replace(/^https?:\/\/(www\.)?/, '')) + '</a>'; }).join('') + (links.length > 3 ? '<span class="xs muted">+' + (links.length - 3) + ' link lainnya</span>' : '') + '</div>' : '') +
            '</div><div class="col right"><div class="bold num" style="font-size:18px">' + fmtN(r.qty) + '</div>' +
            (canEdit(r) ? '<div class="row" style="gap:2px"><button class="btn ghost icon sm" data-act="edit-report" data-id="' + esc(r.id) + '" aria-label="Ubah">' + icon('edit').replace('<svg ', '<svg width="15" height="15" ') + '</button><button class="btn ghost icon sm" data-act="del-report" data-id="' + esc(r.id) + '" aria-label="Hapus">' + icon('trash').replace('<svg ', '<svg width="15" height="15" ') + '</button></div>' : '') +
            '</div></div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function reportView() {
    var all = seeAll();
    var who = S.rep.who || (isAdmin() ? 'ALL' : 'ME');
    var range = KPI.periodRange(S.rep.range, today());
    var list = D().reports.filter(function (r) {
      if (r.date < range.from || r.date > range.to) return false;
      if (who === 'ME') return r.employee === S.user.name;
      if (who === 'ALL') return true;
      return r.employee === who;
    }).sort(sortReports);
    var whoOpts = [['ME', 'Laporan saya']];
    if (all) { whoOpts.push(['ALL', 'Semua karyawan']); D().employees.forEach(function (e) { if (e.name !== S.user.name) whoOpts.push([e.name, cap(e.name)]); }); }
    var filters = '<div class="row wrap">' + (whoOpts.length > 1 ? '<select class="input" style="width:auto" data-change="rep-who">' + whoOpts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (who === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' : '') +
      '<div class="seg">' + [['today', 'Hari ini'], ['last7', '7 hari'], ['month', 'Bulan ini'], ['last30', '30 hari']].map(function (x) { return '<button class="' + (S.rep.range === x[0] ? 'active' : '') + '" data-act="rep-range" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    var total = list.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
    return pageHead('Laporan harian', 'Isi hasil kerja harianmu — KPI langsung terhitung otomatis.') +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)" id="report-grid">' + reportForm() +
      '<div class="card"><div class="card-head"><h2>Riwayat</h2><span class="sub">' + list.length + ' laporan · ' + fmtN(total) + ' output</span></div>' + filters + '<div class="mt-sm">' + reportList(list, who !== 'ME') + '</div></div></div>' +
      '<style>@media(max-width:900px){#report-grid{grid-template-columns:minmax(0,1fr)!important}}</style>';
  }

  function submitReport(form) {
    var f = S.form;
    var btn = $('#report-submit');
    if (!f.channel) return toast('Pilih channel dulu.', 'error');
    if (isAdmin() && !f.employee) return toast('Pilih karyawan dulu.', 'error');
    var payload = { id: S.editId, date: f.date, employee: isAdmin() ? f.employee : S.user.name, channel: f.channel, task: f.task || (channelByKey(f.channel) || {}).indicator, qty: Number(f.qty) || 0, links: f.links, notes: f.notes };
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mengirim…';
    var action = S.editId ? 'updateReport' : 'submitReport';
    API.call(action, { report: payload }).then(function (res) {
      toast(S.editId ? 'Laporan diperbarui ✓' : 'Laporan terkirim ✓ KPI sudah diperbarui');
      if (!S.editId && res && res.report) D().reports.push(res.report);
      if (S.editId) { var r = D().reports.filter(function (x) { return x.id === S.editId; })[0]; if (r) Object.assign(r, payload, { employee: payload.employee }); }
      var keep = { employee: f.employee, channel: f.channel, date: f.date };
      S.form = Object.assign(defaultForm(), keep, { qty: 1 });
      S.editId = null; S.dirty = false;
      render();
      loadData(true);
    }).catch(function (e) { btn.disabled = false; btn.innerHTML = 'Coba lagi'; handleErr(e); });
  }

  /* =========================================================
     KPI
     ========================================================= */
  function kpiCurrent() {
    var k = S.kpi, t = today();
    var r = k.period === 'custom' && k.from && k.to ? { from: k.from, to: k.to } : KPI.periodRange(k.period === 'custom' ? 'month' : k.period, t);
    return kpiRange(r.from, r.to);
  }

  function kpiView() {
    var res = kpiCurrent();
    var k = S.kpi;
    var list = res.list.filter(function (e) { return (k.division === 'ALL' || e.divisions.indexOf(k.division) >= 0) && (seeAll() || e.name === S.user.name); });
    var scored = list.filter(function (e) { return e.score != null; });
    var tT = 0, tA = 0;
    list.forEach(function (e) { tT += e.target; tA += e.actual; });
    var avg = scored.length ? Math.round(scored.reduce(function (s, e) { return s + e.score; }, 0) / scored.length) : null;
    var disc = scored.length ? scored.reduce(function (s, e) { return s + (e.discipline || 0); }, 0) / scored.length : null;
    var periods = [['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu'], ['last30', '30 hari'], ['custom', 'Kustom']];
    var counts = { ALL: res.list.length };
    res.list.forEach(function (e) { e.divisions.forEach(function (d) { counts[d] = (counts[d] || 0) + 1; }); });

    var controls = '<div class="scroll-x"><div class="seg">' + periods.map(function (p) { return '<button class="' + (k.period === p[0] ? 'active' : '') + '" data-act="kpi-period" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      (k.period === 'custom' ? '<div class="row wrap mt-sm"><input class="input" style="width:auto" type="date" data-change="kpi-from" value="' + esc(res.from) + '"><span class="muted">s/d</span><input class="input" style="width:auto" type="date" data-change="kpi-to" value="' + esc(res.to) + '"></div>' : '') +
      '<div class="chips mt-sm">' + ['ALL', 'DEV', 'STAFF', 'CLIENT'].map(function (d) {
        return '<button class="chip ' + (k.division === d ? 'active' : '') + '" data-act="kpi-div" data-v="' + d + '">' + (d !== 'ALL' ? '<span class="dot" style="background:var(' + DIV[d].color + ')"></span>' : '') + (d === 'ALL' ? 'Semua divisi' : DIV[d].short) + ' <span class="muted">' + (counts[d] || 0) + '</span></button>';
      }).join('') + '</div>';

    var tiles = '<div class="grid grid-4 mt">' +
      '<div class="card stat"><div class="label">Rata-rata skor KPI</div><div class="value num">' + (avg == null ? '—' : avg) + '</div><div class="delta">' + (avg == null ? '&nbsp;' : statusBadge(KPI.grade(avg))) + '</div></div>' +
      '<div class="card stat"><div class="label">Capaian output</div><div class="value num">' + fmtPct(tT ? tA / tT : null) + '</div><div class="delta muted num">' + fmtN(tA) + ' dari ' + fmtN(tT) + '</div></div>' +
      '<div class="card stat"><div class="label">Disiplin laporan</div><div class="value num">' + fmtPct(disc) + '</div><div class="delta muted">rata-rata hari terisi</div></div>' +
      (res.config.weightAttendance > 0 && attEnabled()
        ? '<div class="card stat"><div class="label">Kehadiran rata-rata</div><div class="value num">' + fmtPct((function () { var a = list.filter(function (e) { return e.attendance != null; }); return a.length ? a.reduce(function (s, e) { return s + e.attendance; }, 0) / a.length : null; })()) + '</div><div class="delta muted">' + res.summary.workdays + ' hari kerja · ' + esc(fmtDate(res.from)) + ' – ' + esc(fmtDate(res.effTo < res.from ? res.from : res.effTo)) + '</div></div></div>'
        : '<div class="card stat"><div class="label">Hari kerja dihitung</div><div class="value num">' + res.summary.workdays + '</div><div class="delta muted">' + esc(fmtDate(res.from)) + ' – ' + esc(fmtDate(res.effTo < res.from ? res.from : res.effTo)) + '</div></div></div>');

    var me = S.user.name;
    var showAtt = res.config.weightAttendance > 0 && attEnabled();
    var rows = list.map(function (e, i) {
      return '<tr class="clickable" data-act="kpi-detail" data-name="' + esc(e.name) + '"' + (e.name === me ? ' style="background:var(--accent-soft)"' : '') + '>' +
        '<td class="muted bold num">' + (e.score == null ? '–' : i + 1) + '</td>' +
        '<td><div class="row">' + personAvatar(e.name, 'sm') + '<div class="col"><span class="bold">' + esc(cap(e.name)) + (e.name === me ? ' <span class="xs muted">(kamu)</span>' : '') + '</span><span class="row" style="gap:4px">' + e.divisions.map(divBadge).join('') + '</span></div></div></td>' +
        '<td class="num">' + fmtN(e.target) + '</td><td class="num bold">' + fmtN(e.actual) + '</td>' +
        '<td style="min-width:150px"><div class="row" style="gap:8px"><div class="grow">' + bar(e.achievement) + '</div><span class="num small bold" style="width:44px;text-align:right">' + fmtPct(e.achievement) + '</span></div></td>' +
        '<td class="num">' + fmtPct(e.discipline) + '<div class="xs muted">' + e.reportedDays + '/' + e.workdays + ' hari</div></td>' +
        (showAtt ? '<td class="num">' + fmtPct(e.attendance) + '<div class="xs muted">' + (e.att ? (e.att.late ? e.att.late + '× telat' : '') + (e.att.late && e.att.alpa ? ' · ' : '') + (e.att.alpa ? e.att.alpa + '× alpa' : '') || 'aman' : '') + '</div></td>' : '') +
        '<td class="num"><span class="bold" style="font-size:18px">' + (e.score == null ? '—' : e.score) + '</span></td>' +
        '<td>' + statusBadge(e.grade) + '</td></tr>';
    }).join('');
    var table = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Karyawan</th><th class="num">Target</th><th class="num">Aktual</th><th>Capaian</th><th class="num">Disiplin</th>' + (showAtt ? '<th class="num">Kehadiran</th>' : '') + '<th class="num">Skor</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty">' + icon('kpi') + '<div>Tidak ada data KPI untuk filter ini.</div></div>';

    var c = res.config;
    var how = '<details class="card mt"><summary class="bold" style="cursor:pointer">Cara menghitung KPI</summary><div class="small text-2 mt-sm" style="line-height:1.7">' +
      '<b>Target periode</b> = target per channel (kolom TARGET, dianggap <b>' + (c.targetPeriod === 'WEEKLY' ? 'per minggu' : c.targetPeriod === 'MONTHLY' ? 'per bulan' : 'per hari') + '</b>) × hari kerja yang sudah berjalan.<br>' +
      '<b>Capaian output</b> = total jumlah di laporan ÷ target periode.<br>' +
      '<b>Disiplin laporan</b> = hari kerja yang ada laporannya ÷ hari kerja yang sudah berjalan.<br>' +
      (showAtt ? '<b>Kehadiran</b> = tepat waktu 100% · terlambat ' + Math.round(c.lateScore * 100) + '% · tanpa keterangan 0%. Izin terlambat yang disetujui = tepat waktu.<br>' +
        '<b>Izin/sakit/cuti yang disetujui</b> tidak dihitung: target output & laporan hari itu dihapus, jadi tidak merugikan.<br>' +
        '<b>Skor KPI</b> = capaian (maks. 100%) × ' + c.weightOutput + '% + disiplin laporan × ' + c.weightDiscipline + '% + kehadiran × ' + c.weightAttendance + '%.<br>'
        : '<b>Skor KPI</b> = capaian (maks. 100%) × ' + c.weightOutput + '% + disiplin × ' + c.weightDiscipline + '%.<br>') +
      'Hari kerja: ' + c.workDays.map(function (d) { return ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][d - 1]; }).join(', ') + '. Status: ≥90 Sangat baik · ≥75 Baik · ≥60 Cukup · &lt;60 Perlu perhatian.<br>' +
      '<b>Manager & bos tidak masuk peringkat KPI</b>, tetapi channel yang mereka pegang tetap dipantau views-nya.' +
      (isAdmin() ? '<br><span class="muted">Ubah bobot, hari kerja & arti target di Admin → Pengaturan.</span>' : '') + '</div></details>';

    return pageHead('KPI karyawan', 'Dihitung real-time dari laporan harian. Manager & bos tidak masuk peringkat.', '') + controls + tiles +
      '<div class="card pad-0 mt">' + table + '</div>' + how;
  }

  function kpiDetail(name) {
    var res = kpiCurrent();
    var e = res.list.filter(function (x) { return x.name === name; })[0];
    if (!e) return;
    var days = [];
    if (res.from <= res.effTo) KPI.eachDay(res.from, res.effTo, function (d) { days.push(d); });
    if (days.length > 62) days = days.slice(-62);
    var chRows = e.channels.map(function (c) {
      var ch = channelByKey(c.key);
      var up = ch ? uploadsIn(ch, res.from, res.effTo) : 0;
      return '<tr><td><div class="row">' + (ch ? avatar(ch, 'sm') : '') + '<div class="col"><span class="bold ellipsis" style="max-width:220px">' + esc(ch ? chTitle(ch) : c.name) + '</span>' + divBadge(c.division) + '</div></div></td>' +
        '<td class="num">' + fmtN(c.target) + '</td><td class="num bold">' + fmtN(c.actual) + '</td><td class="num">' + fmtPct(c.achievement) + '</td>' +
        '<td class="num">' + (ch && ytOf(ch) && ytOf(ch).status === 'OK' ? fmtN(up) : '<span class="muted">—</span>') + '</td></tr>';
    }).join('');
    openModal({
      title: esc(cap(e.name)) + ' · KPI <span class="small muted">' + esc(fmtDate(res.from)) + ' – ' + esc(fmtDate(res.to)) + '</span>', wide: true,
      body: '<div class="grid grid-4">' +
        '<div class="stat"><div class="label">Skor</div><div class="value num">' + (e.score == null ? '—' : e.score) + '</div><div>' + statusBadge(e.grade) + '</div></div>' +
        '<div class="stat"><div class="label">Capaian</div><div class="value num">' + fmtPct(e.achievement) + '</div><div class="xs muted num">' + fmtN(e.actual) + ' / ' + fmtN(e.target) + '</div></div>' +
        '<div class="stat"><div class="label">Disiplin</div><div class="value num">' + fmtPct(e.discipline) + '</div><div class="xs muted">' + e.reportedDays + ' dari ' + e.workdays + ' hari kerja</div></div>' +
        (e.att ? '<div class="stat"><div class="label">Kehadiran</div><div class="value num">' + fmtPct(e.attendance) + '</div><div class="xs muted">' + e.att.onTime + ' tepat · ' + e.att.late + ' telat · ' + e.att.alpa + ' alpa · denda Rp ' + fmtN(e.att.fines) + '</div></div>'
          : '<div class="stat"><div class="label">Periode</div><div class="bold">' + esc(fmtDate(res.from)) + ' – ' + esc(fmtDate(res.to)) + '</div></div>') + '</div>' +
        (e.excusedDays ? '<div class="notice small mt">' + e.excusedDays + ' hari izin/sakit/cuti yang disetujui tidak dihitung dalam target periode ini.</div>' : '') +
        '<div class="card-head mt"><h3>Output harian</h3><div class="legend"><span><i style="background:var(--accent)"></i>Aktual</span><span><i class="dash"></i>Target</span></div></div><div id="kpi-chart"></div>' +
        '<h3 class="mt mb">Per channel</h3><div class="table-wrap"><table class="table"><thead><tr><th>Channel</th><th class="num">Target</th><th class="num">Aktual</th><th class="num">Capaian</th><th class="num" title="Video yang terdeteksi terbit di YouTube pada periode ini (yang memenuhi durasi minimal channel)">Upload YT</th></tr></thead><tbody>' + chRows + '</tbody></table></div>',
      mount: function () {
        Charts.bars($('#kpi-chart'), {
          labels: days, values: days.map(function (d) { return e.daily[d] ? e.daily[d].a : 0; }),
          target: days.map(function (d) { return e.daily[d] && e.daily[d].t ? Math.round(e.daily[d].t * 100) / 100 : null; }),
          color: '--accent', name: 'Aktual', targetName: 'Target', height: 200,
          fmtX: function (d) { return fmtDate(d); }, fmtTip: function (d) { return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }); }, fmtY: function (v) { return fmtN(v); }
        });
      }
    });
  }

  /* =========================================================
     CHANNELS
     ========================================================= */
  function channelsView() {
    var d = D(), st = S.ch, t = today();
    var list = d.channels.slice();
    if (st.mine) list = list.filter(function (c) { return c.employees.indexOf(S.user.name) >= 0; });
    var counts = { ALL: list.length };
    list.forEach(function (c) { counts[c.division] = (counts[c.division] || 0) + 1; });
    if (st.division !== 'ALL') list = list.filter(function (c) { return c.division === st.division; });
    if (st.q) { var q = st.q.toLowerCase(); list = list.filter(function (c) { return (chTitle(c) + ' ' + c.name + ' ' + c.employees.join(' ')).toLowerCase().indexOf(q) >= 0; }); }
    function val(c, k) { var y = ytOf(c); if (k === 'name') return chTitle(c).toLowerCase(); if (!y || y.status !== 'OK') return -1; return k === 'views' ? y.views : k === 'growth' ? (y.dViews || 0) : y.subs; }
    list.sort(function (a, b) { if (st.sort === 'name') return val(a, 'name').localeCompare(val(b, 'name')); return val(b, st.sort) - val(a, st.sort); });
    var last = S.yt && S.yt.lastSync;
    var actions = (isAdmin() ? '<button class="btn ghost" data-act="sync-yt"' + (S.syncing ? ' disabled' : '') + '>' + (S.syncing ? '<span class="spinner"></span>' : icon('refresh')) + 'Sinkron sekarang</button>' : '') +
      '<button class="btn ghost" data-act="reload-yt">' + icon('refresh') + 'Muat ulang</button>';
    var controls = '<div class="row wrap between"><div class="chips">' + ['ALL', 'DEV', 'STAFF', 'CLIENT'].map(function (k) {
      return '<button class="chip ' + (st.division === k ? 'active' : '') + '" data-act="ch-div" data-v="' + k + '">' + (k !== 'ALL' ? '<span class="dot" style="background:var(' + DIV[k].color + ')"></span>' : '') + (k === 'ALL' ? 'Semua' : DIV[k].short) + ' <span class="muted">' + (counts[k] || 0) + '</span></button>';
    }).join('') + (isAdmin() ? '' : '<button class="chip ' + (st.mine ? 'active' : '') + '" data-act="ch-mine">Channel saya</button>') + '</div>' +
      '<div class="row wrap"><div style="position:relative"><input class="input" style="width:200px;padding-left:36px" placeholder="Cari channel…" data-change="ch-q" value="' + esc(st.q) + '"><span style="position:absolute;left:11px;top:11px;color:var(--muted)">' + icon('search').replace('<svg ', '<svg width="17" height="17" ') + '</span></div>' +
      '<select class="input" style="width:auto" data-change="ch-sort">' + [['views', 'Urut: Total views'], ['growth', 'Urut: Naik 24 jam'], ['subs', 'Urut: Subscriber'], ['name', 'Urut: Nama']].map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>';

    var cards = list.map(function (c) {
      var y = ytOf(c), ok = y && y.status === 'OK';
      var target = channelTargetToday(c), actual = channelActual(c.key, t, t);
      return '<a class="card ch-card" href="#/channel/' + encodeURIComponent(c.key) + '" style="color:inherit;text-decoration:none">' +
        '<div class="ch-top">' + avatar(c, 'lg') + '<div class="col grow"><div class="bold ellipsis" style="font-size:15px">' + esc(chTitle(c)) + '</div>' +
        '<div class="xs muted ellipsis">' + esc(chTitle(c) !== c.name ? c.name : (y && y.handle) || c.type) + '</div><div class="row" style="gap:6px;margin-top:2px">' + divBadge(c.division) + (c.minDuration ? '<span class="badge st-none">' + icon('clock') + '≥' + fmtN(c.minDuration) + 'm</span>' : '') + '<span class="xs text-2 ellipsis">' + esc(c.employees.map(cap).join(', ') || '—') + '</span></div></div></div>' +
        (ok ? '<div class="ch-stats"><div><div class="v num">' + fmtC(y.views) + '</div><div class="l">Views</div></div><div><div class="v num ' + (y.dViews > 0 ? 'up' : '') + '">' + (y.dViews == null ? '—' : signed(y.dViews, true)) + '</div><div class="l">24 jam</div></div><div><div class="v num">' + fmtC(y.subs) + '</div><div class="l">Subscriber</div></div></div>'
          : '<div class="notice small">' + icon('alert').replace('<svg ', '<svg width="14" height="14" style="vertical-align:-2px" ') + ' ' + (y && y.status === 'NOT_FOUND' ? 'Channel tidak ditemukan dari link.' : c.link ? 'Menunggu sinkron YouTube.' : esc(c.linkNote || 'Link channel belum tersedia.')) + '</div>') +
        '<div><div class="row between xs muted" style="margin-bottom:4px"><span>Output hari ini</span><span class="num">' + fmtN(actual) + ' / ' + fmtN(target) + '</span></div>' + bar(target ? actual / target : null, true) + '</div></a>';
    }).join('');

    return pageHead('Channel YouTube', 'Pantau views setiap channel & video tanpa YouTube Studio. Sinkron terakhir: <b>' + relTime(last) + '</b>.', actions) +
      controls + (list.length ? '<div class="grid grid-3 mt">' + cards + '</div>' : '<div class="card mt"><div class="empty">' + icon('search') + '<div>Tidak ada channel yang cocok.</div></div></div>');
  }

  function channelDetailView(key) {
    var c = channelByKey(key);
    if (!c) return pageHead('Channel tidak ditemukan') + '<a class="btn ghost" href="#/channels">' + icon('back') + 'Kembali</a>';
    var y = ytOf(c), ok = y && y.status === 'OK', t = today();
    var h = ok ? S.hist[y.id] : null;
    if (ok && !h) loadHistory(y.id);
    var target = channelTargetToday(c), actual = channelActual(c.key, t, t);

    var head = '<a class="btn ghost sm mb" href="#/channels">' + icon('back') + 'Semua channel</a>' +
      '<div class="card"><div class="row wrap gap-lg"><div class="row grow" style="min-width:240px">' + avatar(c, 'lg') + '<div class="col grow"><h1 class="ellipsis" style="font-size:22px">' + esc(chTitle(c)) + '</h1>' +
      '<div class="small muted ellipsis">' + esc(c.name) + (y && y.handle ? ' · ' + esc(y.handle) : '') + '</div><div class="row wrap" style="gap:6px;margin-top:4px">' + divBadge(c.division) +
      c.employees.map(function (n) { return '<span class="badge st-none">' + icon('users') + esc(cap(n)) + '</span>'; }).join('') +
      (c.minDuration ? '<span class="badge st-warning">' + icon('clock') + 'Min. ' + fmtN(c.minDuration) + ' menit / video</span>' : '') + '</div></div></div>' +
      '<div class="row wrap">' + (c.link ? '<a class="btn ghost" href="' + esc(c.link) + '" target="_blank" rel="noopener">' + icon('ext') + 'Buka di YouTube</a>' : '') +
      (isAdmin() ? '<button class="btn ghost" data-act="edit-channel" data-key="' + esc(c.key) + '">' + icon('edit') + 'Ubah</button>' : '') + '</div></div>' +
      (c.notes ? '<div class="notice mt">' + esc(c.notes) + '</div>' : '') + '</div>';

    var tiles = '<div class="grid grid-4 mt">' +
      statTile('Total views', ok ? fmtC(y.views) : '—', ok ? y.dViews : null, 'eye') +
      statTile('Subscriber', ok ? fmtC(y.subs) : '—', ok ? y.dSubs : null, 'subs') +
      statTile('Jumlah video', ok ? fmtN(y.videos) : '—', null, 'video', 'Upload hari ini: ' + (ok ? uploadsIn(c, t, t) : '—')) +
      '<div class="card stat"><div class="label"><span class="stat-icon">' + icon('kpi') + '</span>Output hari ini</div><div class="value num">' + fmtN(actual) + '<span class="muted" style="font-size:16px"> / ' + fmtN(target) + '</span></div>' + bar(target ? actual / target : null) + '</div></div>';

    if (!ok) {
      return head + tiles + '<div class="card mt"><div class="empty">' + icon('yt') + '<div>' + (c.link ? (y && y.status === 'NOT_FOUND' ? 'Channel tidak ditemukan dari link ini. Periksa link di spreadsheet.' : 'Data YouTube belum tersedia. Tunggu sinkron berikutnya.') : esc(c.linkNote || 'Link channel belum diisi di spreadsheet.')) + '</div></div></div>' + channelReports(c);
    }

    var charts = '<div class="grid grid-2 mt"><div class="card"><div class="card-head"><h2>Views bertambah per hari</h2><span class="sub">30 hari</span></div><div id="ch-gain">' + (h && h !== 'loading' ? '' : '<div class="skeleton" style="height:200px"></div>') + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Total views</h2><span class="sub">30 hari</span></div><div id="ch-total">' + (h && h !== 'loading' ? '' : '<div class="skeleton" style="height:200px"></div>') + '</div></div></div>';
    if (h && h !== 'loading') {
      onMount(function () {
        var pts = h.channel;
        if (pts.length < 2) {
          $('#ch-gain').innerHTML = '<div class="empty">Grafik muncul setelah data terkumpul minimal 2 hari.</div>';
          $('#ch-total').innerHTML = '<div class="empty">Grafik muncul setelah data terkumpul minimal 2 hari.</div>';
          return;
        }
        var labels = pts.map(function (p) { return p.d; });
        var gains = pts.map(function (p, i) { return i ? Math.max(0, p.views - pts[i - 1].views) : null; });
        Charts.bars($('#ch-gain'), { labels: labels.slice(1), values: gains.slice(1), color: '--accent', name: 'Views baru', height: 210, fmtX: function (d) { return fmtDate(d); }, fmtY: function (v, ax) { return ax ? fmtC(v) : fmtN(v); } });
        Charts.line($('#ch-total'), { labels: labels, series: [{ name: 'Total views', color: '--dev', values: pts.map(function (p) { return p.views; }) }], zero: false, area: true, height: 210, fmtX: function (d) { return fmtDate(d); }, fmtY: function (v, ax) { return ax ? fmtC(v) : fmtN(v); } });
      });
    }

    // daftar video
    var vids = videosOf(c).slice();
    var vs = S.vid;
    if (vs.kind === 'SHORT') vids = vids.filter(function (v) { return v.d && v.d <= 180; });
    if (vs.kind === 'LONG') vids = vids.filter(function (v) { return v.d > 180; });
    vids.sort(function (a, b) { return vs.sort === 'views' ? b.v - a.v : vs.sort === 'growth' ? (b.dv || 0) - (a.dv || 0) : (b.p > a.p ? 1 : -1); });
    var vh = h && h !== 'loading' ? h.videos : {};
    var rows = vids.map(function (v) {
      var series = (vh[v.id] || []).slice(-14).map(function (x) { return x[1]; });
      return '<tr><td><a class="row" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;min-width:260px">' +
        (v.th ? '<img class="video-thumb" src="' + esc(v.th) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="video-thumb" style="display:grid;place-items:center;color:var(--muted)">' + icon('video').replace('<svg ', '<svg width="20" height="20" ') + '</div>') +
        '<div class="col"><span class="video-title">' + esc(v.t) + '</span><span class="xs muted">' + relTime(v.p) + ' · ' + (v.d <= 180 ? 'Shorts' : 'Video') + ' ' + dur(v.d) + '</span>' +
        (minSec(c) && !videoValid(c, v) ? '<span class="badge st-critical" style="align-self:flex-start;margin-top:2px">' + icon('alert') + 'Di bawah ' + fmtN(c.minDuration) + ' menit</span>' : '') + '</div></a></td>' +
        '<td class="num bold">' + fmtN(v.v) + '</td><td class="num ' + (v.dv > 0 ? 'up' : 'muted') + '">' + (v.dv == null ? '—' : signed(v.dv)) + '</td>' +
        '<td class="num">' + fmtC(v.l) + '</td><td class="num">' + fmtC(v.c) + '</td><td>' + Charts.spark(series, '--accent', 90, 28) + '</td></tr>';
    }).join('');
    var vidCard = '<div class="card pad-0 mt"><div style="padding:18px 20px 6px"><div class="card-head"><h2>Video (' + vids.length + ')</h2><div class="row wrap">' +
      '<div class="seg">' + [['ALL', 'Semua'], ['SHORT', 'Shorts'], ['LONG', 'Long-form']].map(function (x) { return '<button class="' + (vs.kind === x[0] ? 'active' : '') + '" data-act="vid-kind" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="seg">' + [['new', 'Terbaru'], ['views', 'Views'], ['growth', 'Naik 24j']].map(function (x) { return '<button class="' + (vs.sort === x[0] ? 'active' : '') + '" data-act="vid-sort" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div></div></div>' +
      (vids.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Video</th><th class="num">Views</th><th class="num">24 jam</th><th class="num">Likes</th><th class="num">Komentar</th><th>Tren 14 hari</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">Belum ada video.</div>') +
      '<div class="xs muted" style="padding:10px 20px 16px">Memantau ' + esc(cfg().YT_MAX_VIDEOS || 50) + ' video terbaru · pertumbuhan dibanding snapshot ' + esc(S.yt && S.yt.prevDate ? fmtDate(S.yt.prevDate) : 'sebelumnya') + '.</div></div>';

    return head + tiles + charts + vidCard + channelReports(c);
  }

  function channelReports(c) {
    var list = D().reports.filter(function (r) { return r.channel === c.key; }).sort(sortReports).slice(0, 10);
    return '<div class="card mt"><div class="card-head"><h2>Laporan terbaru channel ini</h2></div>' + reportList(list, true) + '</div>';
  }

  /* =========================================================
     ABSENSI / PRESENSI
     ========================================================= */
  var PERM = {
    TERLAMBAT: { label: 'Izin terlambat' },
    TIDAK_MASUK: { label: 'Izin tidak masuk' },
    SAKIT: { label: 'Sakit' },
    CUTI: { label: 'Cuti' },
    PULANG_AWAL: { label: 'Izin pulang awal' }
  };
  var PERM_STATUS = { PENDING: ['st-warning', 'Menunggu'], APPROVED: ['st-good', 'Disetujui'], REJECTED: ['st-critical', 'Ditolak'] };
  var EXCUSE = ['TIDAK_MASUK', 'SAKIT', 'CUTI'];
  var LATE_QUOTES = ['Jam 9 itu jadwal, bukan saran! 😤', 'Alarm kamu juga perlu di-KPI nih ⏰', 'Kopi boleh telat, kamu jangan! ☕',
    'Macet? Berangkat lebih pagi dong 🚗💨', 'Kasur memang nyaman, tapi target menunggu! 🛏️', 'Dompet kamu bilang: "aduh…" 💸',
    'Ayam aja bangun lebih pagi 🐓', 'Besok coba pasang 3 alarm ya ⏰⏰⏰'];

  function permBadge(st) { var s = PERM_STATUS[st] || PERM_STATUS.PENDING; return '<span class="badge ' + s[0] + '">' + icon(st === 'APPROVED' ? 'check' : st === 'REJECTED' ? 'x' : 'clock') + s[1] + '</span>'; }
  function attCfg() { return KPI.normalizeConfig(cfg()); }
  function attEnabled() { return !!S.data && D().attendance !== undefined && !!cfg().WORK_START; }
  function syncClock(iso) { var t = Date.parse(iso || ''); if (t) S.clockOffset = t - Date.now(); }
  function serverNow() { return new Date(Date.now() + (S.clockOffset || 0)); }
  var tzTimeFmt = {};
  function timeInTz(date) {
    var tz = cfg().TIMEZONE || 'Asia/Jakarta';
    try {
      if (!tzTimeFmt[tz]) tzTimeFmt[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return tzTimeFmt[tz].format(date).replace(/^24/, '00');
    } catch (e) { return date.toTimeString().slice(0, 8); }
  }
  function tzLabel() { var tz = cfg().TIMEZONE || 'Asia/Jakarta'; return { 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }[tz] || ''; }
  function nowMin() { var t = timeInTz(serverNow()); return (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)); }
  function hm(min) { min = Math.max(0, Math.round(min)); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function durTxt(min) { min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return (h ? h + ' jam' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' menit' : ''); }
  function t5(s) { return String(s || '').slice(0, 5); }
  function iMustAttend() { return !!S.user && posOf(S.user) !== 'BOSS'; }
  function attOf(name, date) { return (D().attendance || []).filter(function (a) { return a.name === name && a.date === date; })[0] || null; }
  function permsOf(name) { return (D().permissions || []).filter(function (p) { return p.name === name; }); }
  function permFor(name, date, type) { return permsOf(name).filter(function (p) { return p.type === type && p.from <= date && (p.to || p.from) >= date && p.status !== 'REJECTED'; })[0] || null; }
  function excuseFor(name, date) { return permsOf(name).filter(function (p) { return p.status === 'APPROVED' && EXCUSE.indexOf(p.type) >= 0 && p.from <= date && (p.to || p.from) >= date; })[0] || null; }
  function upsertAtt(rec) {
    var list = D().attendance = D().attendance || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === rec.name && list[i].date === rec.date) { list[i] = rec; return; }
    list.push(rec);
  }
  function attPeople() { return D().employees.filter(KPI.mustAttend); }
  function pendingPerms() { return (D().permissions || []).filter(function (p) { return p.status === 'PENDING'; }); }
  function dateRangeTxt(p) { return p.to && p.to !== p.from ? fmtDate(p.from) + ' – ' + fmtDate(p.to, { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate(p.from, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }

  function dayStatus(name, date) {
    var c = attCfg(), rec = attOf(name, date), ex = excuseFor(name, date), work = KPI.isWorkday(date, c);
    if (ex && work) return { code: ex.type, label: PERM[ex.type].label, cls: 'st-none' };
    if (rec && rec.in) {
      if (!work) return { code: 'LIBUR_MASUK', label: 'Masuk hari libur', cls: 'st-none' };
      var lm = KPI.lateMinutes(rec, c);
      if (lm > c.lateGrace) {
        var p = permFor(name, date, 'TERLAMBAT');
        if (p && p.status === 'APPROVED') return { code: 'TERLAMBAT_IZIN', label: 'Terlambat (izin)', cls: 'st-warning', lateMin: lm };
        return { code: 'TERLAMBAT', label: 'Terlambat ' + durTxt(lm), cls: 'st-critical', lateMin: lm };
      }
      return { code: 'TEPAT', label: 'Tepat waktu', cls: 'st-good' };
    }
    if (!work) return { code: 'LIBUR', label: 'Libur', cls: 'st-none' };
    if (c.attendanceStart && date < c.attendanceStart) return { code: 'NA', label: 'Belum berlaku', cls: 'st-none' };
    if (date < today()) return { code: 'ALPA', label: 'Tanpa keterangan', cls: 'st-critical' };
    return { code: 'BELUM', label: 'Belum presensi', cls: 'st-warning' };
  }
  function statusBadgeAtt(s) { return '<span class="badge ' + s.cls + '">' + esc(s.label) + '</span>'; }

  /** Kartu presensi di Beranda & halaman Absensi. */
  function presenceCard() {
    if (!attEnabled() || !iMustAttend()) return '';
    var c = attCfg(), t = today(), me = S.user.name, rec = attOf(me, t), work = KPI.isWorkday(t, c), nm = nowMin();
    var ex = excuseFor(me, t), state, btn = '';
    if (rec && rec.in && rec.out) {
      state = '<div class="bold">Presensi hari ini selesai ' + icon('check').replace('<svg ', '<svg width="16" height="16" style="vertical-align:-3px;color:var(--good)" ') + '</div>' +
        '<div class="small text-2">Masuk ' + t5(rec.in) + ' · Pulang ' + t5(rec.out) + (rec.otMin ? ' · Lembur ' + durTxt(rec.otMin) : '') + '</div>';
    } else if (rec && rec.in) {
      var st = dayStatus(me, t);
      state = '<div class="bold row wrap" style="gap:8px">Masuk ' + t5(rec.in) + ' ' + statusBadgeAtt(st) + '</div><div class="small text-2">Jam pulang ' + hm(c.workEnd) + ' ' + tzLabel() + '. Jangan lupa presensi pulang.</div>';
      btn = '<button class="btn" data-act="check-out">' + icon('logout') + 'Presensi pulang</button>';
    } else {
      var lateNow = work && !ex && nm > c.workStart + c.lateGrace;
      state = '<div class="bold">' + (ex ? esc(PERM[ex.type].label) + ' (disetujui)' : 'Belum presensi masuk') + '</div>' +
        '<div class="small ' + (lateNow ? 'down bold' : 'text-2') + '">' + (!work ? 'Hari libur. Presensi tetap bisa untuk lembur.' : lateNow ? 'Sudah lewat jam ' + hm(c.workStart) + '. Kamu terlambat ' + durTxt(nm - c.workStart) + '!' : 'Jam masuk ' + hm(c.workStart) + ' ' + tzLabel()) + '</div>';
      btn = '<button class="btn" data-act="check-in">' + icon('check') + 'Presensi masuk</button>';
    }
    return '<div class="card presence mb' + (!rec && work && nm > c.workStart + c.lateGrace && !ex ? ' presence-late' : '') + '">' +
      '<div class="presence-clock"><div class="xs muted">' + esc(fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })) + '</div><div class="clock num" data-clock>' + timeInTz(serverNow()) + '</div><div class="xs muted">' + tzLabel() + '</div></div>' +
      '<div class="col grow" style="min-width:180px">' + state + '</div><div class="row wrap">' + btn +
      '<a class="btn ghost" href="#/attendance" data-act="att-tab" data-v="perm">' + icon('report') + 'Ajukan izin</a></div></div>';
  }

  function starburst(cx, cy, r1, r2, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) { var r = i % 2 ? r2 : r1, a = Math.PI * i / n - Math.PI / 2; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    return pts.join(' ');
  }
  /** Popup ala komik saat terlambat. */
  function comicPopup(o) {
    var excused = o.permission === 'APPROVED', pending = o.permission === 'PENDING';
    var q = LATE_QUOTES[Math.floor(Math.random() * LATE_QUOTES.length)];
    var host = document.createElement('div');
    host.className = 'comic-backdrop';
    host.setAttribute('role', 'alertdialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', excused ? 'Terlambat dengan izin' : 'Terlambat, denda Rp ' + fmtN(o.fine));
    host.innerHTML = '<div class="comic' + (excused ? ' ok' : '') + '">' +
      '<div class="comic-sfx s1">' + (excused ? 'PHEW!' : 'BOOM!') + '</div><div class="comic-sfx s2">' + (excused ? 'AMAN!' : 'KRIIING!') + '</div>' +
      '<div class="comic-burst"><svg viewBox="0 0 200 200" aria-hidden="true"><polygon points="' + starburst(100, 100, 98, 72, 14) + '"/></svg><span>TELAT!</span></div>' +
      '<div class="comic-bubble">' + (excused
        ? '<div class="comic-fine">IZIN<br>DISETUJUI</div><div class="comic-note">Kali ini tanpa denda ✓</div>'
        : '<div class="comic-fine">DENDA<br>Rp ' + fmtN(o.fine) + '</div><div class="comic-note">' + (pending ? 'Izin terlambatmu masih menunggu persetujuan. Denda batal kalau disetujui manager.' : esc(q)) + '</div>') + '</div>' +
      '<div class="comic-sub">Masuk ' + esc(t5(o.inTime)) + ' · terlambat ' + esc(durTxt(o.lateMin)) + '</div>' +
      '<button class="comic-btn" type="button">' + (excused ? 'Oke, lanjut kerja! 💪' : 'Siap, besok lebih pagi! 🙏') + '</button></div>';
    document.body.appendChild(host);
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { document.removeEventListener('keydown', onKey); host.classList.add('out'); setTimeout(function () { host.remove(); }, 220); }
    host.querySelector('.comic-btn').onclick = close;
    host.addEventListener('click', function (e) { if (e.target === host) close(); });
    document.addEventListener('keydown', onKey);
    setTimeout(function () { var b = host.querySelector('.comic-btn'); if (b) b.focus(); }, 60);
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 160]); } catch (e) { }
  }

  function doCheckIn(btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mencatat…'; }
    API.call('checkIn', {}).then(function (r) {
      upsertAtt(r.record); syncClock(r.serverTime); render();
      if (r.already) return toast('Kamu sudah presensi masuk jam ' + t5(r.record.in) + '.');
      if (r.late) comicPopup({ lateMin: r.lateMin, inTime: r.record.in, fine: r.fine || attCfg().lateFine, permission: r.latePermission });
      else toast(r.workday ? 'Presensi masuk ' + t5(r.record.in) + ' · Tepat waktu 👍' : 'Presensi masuk ' + t5(r.record.in) + ' (hari libur)');
    }).catch(function (e) { render(); handleErr(e); });
  }
  function doCheckOut(payload, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mencatat…'; }
    API.call('checkOut', payload).then(function (r) {
      upsertAtt(r.record); closeModal(); render();
      toast(r.already ? 'Kamu sudah presensi pulang jam ' + t5(r.record.out) + '.' : 'Presensi pulang ' + t5(r.record.out) + (r.overtimeMin ? ' · lembur ' + durTxt(r.overtimeMin) + ' tercatat' : '') + ' ✓');
    }).catch(function (e) { if (btn) { btn.disabled = false; btn.textContent = 'Coba lagi'; } handleErr(e); });
  }
  function checkOutFlow() {
    var c = attCfg(), t = today(), work = KPI.isWorkday(t, c), nm = nowMin();
    if (work && nm < c.workEnd) {
      openModal({
        title: 'Pulang lebih awal?',
        body: '<p class="text-2 mb">Sekarang ' + hm(nm) + ', jam pulang ' + hm(c.workEnd) + ' ' + tzLabel() + '. Tulis alasan singkat. Kalau sudah dapat izin, ajukan juga lewat menu <b>Izin</b>.</p>' +
          '<div class="field"><label>Alasan pulang lebih awal</label><textarea class="input" id="early-note" rows="2" placeholder="Misal: ke dokter, urusan keluarga…"></textarea></div>',
        foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" id="co-early">' + icon('logout') + 'Presensi pulang</button>',
        mount: function (m) { $('#co-early', m).onclick = function () { doCheckOut({ earlyNote: $('#early-note', m).value }, this); }; }
      });
      return;
    }
    if (!work || nm > c.workEnd) {
      var opts = leaders('MANAGER').map(function (e) { return [e.name, 'Manager ' + cap(e.name)]; })
        .concat(leaders('BOSS').map(function (e) { return [e.name, 'Bos ' + cap(e.name)]; }))
        .concat([['Inisiatif sendiri', 'Inisiatif sendiri'], ['LAINNYA', 'Lainnya…']]);
      openModal({
        title: 'Kamu lembur hari ini?',
        body: '<p class="text-2 mb">' + (work ? 'Sudah lewat jam pulang (' + hm(c.workEnd) + '), sekarang ' + hm(nm) + '.' : 'Hari ini hari libur.') + ' Kalau kamu lembur, isi keterangannya supaya tercatat.</p>' +
          '<div class="seg mb" role="radiogroup"><button class="active" data-ot="0" type="button">Tidak, pulang biasa</button><button data-ot="1" type="button">Ya, saya lembur</button></div>' +
          '<div id="ot-fields" class="hidden"><div class="field"><label>Lembur untuk apa?</label><textarea class="input" id="ot-reason" rows="3" placeholder="Misal: render 5 video, revisi thumbnail klien…"></textarea></div>' +
          '<div class="field"><label>Atas perintah siapa?</label><select class="input" id="ot-by">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
          '<input class="input mt-sm hidden" id="ot-by-other" placeholder="Tulis nama yang memerintahkan"></div></div>',
        foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" id="co-ot">' + icon('logout') + 'Presensi pulang</button>',
        mount: function (m) {
          var isOt = false;
          $$('[data-ot]', m).forEach(function (b) {
            b.onclick = function () {
              isOt = this.dataset.ot === '1';
              var self = this;
              $$('[data-ot]', m).forEach(function (x) { x.classList.toggle('active', x === self); });
              $('#ot-fields', m).classList.toggle('hidden', !isOt);
              if (isOt) $('#ot-reason', m).focus();
            };
          });
          $('#ot-by', m).onchange = function () { $('#ot-by-other', m).classList.toggle('hidden', this.value !== 'LAINNYA'); };
          $('#co-ot', m).onclick = function () {
            if (!isOt) return doCheckOut({}, this);
            var reason = $('#ot-reason', m).value.trim(), by = $('#ot-by', m).value;
            if (by === 'LAINNYA') by = $('#ot-by-other', m).value.trim();
            if (reason.length < 3) return toast('Tulis lembur untuk apa.', 'error');
            if (!by) return toast('Isi atas perintah siapa.', 'error');
            doCheckOut({ overtime: { reason: reason, by: by } }, this);
          };
        }
      });
      return;
    }
    confirmBox('Presensi pulang?', 'Jam pulang dicatat sekarang (' + hm(nm) + ').', 'Presensi pulang').then(function (ok) { if (ok) doCheckOut({}); });
  }

  function monthOptions() {
    var t = today(), out = [], m = KPI.monthStart(t);
    for (var i = 0; i < 4; i++) { out.push(m.slice(0, 7)); m = KPI.monthStart(KPI.addDays(m, -1)); }
    return out;
  }
  function monthLabel(ym) { return new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' }); }
  function recapFor(ym, names) {
    var from = ym + '-01', to = KPI.monthEnd(from);
    return KPI.attendanceRecap({ attendance: D().attendance || [], permissions: D().permissions || [], employees: D().employees, from: from, to: to, today: today(), config: cfg(), names: names });
  }
  function monthSelect(cur, act) {
    return '<select class="input" style="width:auto" data-change="' + act + '">' + monthOptions().map(function (m) { return '<option value="' + m + '"' + (m === cur ? ' selected' : '') + '>' + esc(monthLabel(m)) + '</option>'; }).join('') + '</select>';
  }
  function miniStat(label, value, sub, cls) {
    return '<div class="card stat"><div class="label">' + label + '</div><div class="value num ' + (cls || '') + '" style="font-size:24px">' + value + '</div><div class="delta muted">' + (sub || '&nbsp;') + '</div></div>';
  }

  function attendanceView() {
    if (!attEnabled()) return pageHead('Absensi') + '<div class="card"><div class="empty">' + icon('clock') + '<div>Fitur absensi aktif setelah backend 1.3.0 dipasang.</div></div></div>';
    var c = attCfg();
    var tabs = [];
    if (iMustAttend()) tabs.push(['me', 'Presensi saya']);
    tabs.push(['perm', 'Izin']);
    if (isAdmin()) {
      var pend = pendingPerms().length;
      tabs.push(['team', 'Tim hari ini'], ['approve', 'Persetujuan' + (pend ? ' <span class="count-badge">' + pend + '</span>' : '')], ['recap', 'Rekap bulanan']);
    }
    var ids = tabs.map(function (x) { return x[0]; });
    var tab = ids.indexOf(S.attTab) >= 0 ? S.attTab : ids[0];
    var body = tab === 'perm' ? attPermView() : tab === 'team' ? attTeamView() : tab === 'approve' ? attApproveView() : tab === 'recap' ? attRecapView() : attMeView();
    return pageHead('Absensi', 'Jam kerja ' + hm(c.workStart) + '–' + hm(c.workEnd) + ' ' + tzLabel() + ' · terlambat = denda Rp ' + fmtN(c.lateFine) + ' · jam presensi memakai jam server.') +
      '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (tab === x[0] ? 'active' : '') + '" data-act="att-tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' + body;
  }

  function attMeView() {
    var me = S.user.name, ym = S.attMonth || today().slice(0, 7);
    var r = recapFor(ym, [me]).map[me];
    var from = ym + '-01', to = KPI.monthEnd(from), t = today(), c = attCfg();
    if (to > t) to = t;
    var rows = [];
    if (from <= to) KPI.eachDay(from, to, function (d) { rows.unshift(d); });
    var tr = rows.map(function (d) {
      var s = dayStatus(me, d), rec = attOf(me, d);
      if (s.code === 'LIBUR' || s.code === 'NA') return '';
      var notes = [];
      if (rec && rec.otMin) notes.push('Lembur ' + durTxt(rec.otMin) + ': ' + rec.otFor + ' (perintah ' + rec.otBy + ')');
      if (rec && rec.early) notes.push('Pulang awal: ' + rec.early);
      if (rec && rec.notes && rec.updatedBy && rec.updatedBy !== me) notes.push(rec.notes);
      return '<tr><td class="nowrap">' + esc(fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })) + '</td><td>' + statusBadgeAtt(s) + '</td>' +
        '<td class="num">' + (rec ? t5(rec.in) : '—') + '</td><td class="num">' + (rec && rec.out ? t5(rec.out) : '—') + '</td><td class="small text-2">' + esc(notes.join(' · ')) + '</td></tr>';
    }).join('');
    return presenceCard() +
      '<div class="row between wrap mb"><h2>Rekap ' + esc(monthLabel(ym)) + '</h2>' + monthSelect(ym, 'att-month') + '</div>' +
      (r ? '<div class="grid grid-4 mb">' +
        miniStat('Skor kehadiran', fmtPct(r.rate), 'dipakai di KPI') +
        miniStat('Tepat waktu', r.onTime, r.excusedLate ? '+' + r.excusedLate + ' terlambat (izin)' : 'hari') +
        miniStat('Terlambat', r.late, r.late ? 'total ' + durTxt(r.lateMin) : 'hari', r.late ? 'down' : '') +
        miniStat('Denda', 'Rp ' + fmtN(r.fines), r.late + ' × Rp ' + fmtN(c.lateFine), r.fines ? 'down' : '') +
        miniStat('Tanpa keterangan', r.alpa, 'hari', r.alpa ? 'down' : '') +
        miniStat('Izin / sakit / cuti', r.izin + ' / ' + r.sakit + ' / ' + r.cuti, 'disetujui manager') +
        miniStat('Lembur', durTxt(r.overtimeMin), r.overtimeDays + ' hari') +
        miniStat('Pulang awal', r.early, r.noCheckout ? r.noCheckout + '× lupa presensi pulang' : 'hari') + '</div>' : '') +
      '<div class="card pad-0">' + (tr ? '<div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Status</th><th class="num">Masuk</th><th class="num">Pulang</th><th>Keterangan</th></tr></thead><tbody>' + tr + '</tbody></table></div>'
        : '<div class="empty">' + icon('calendar') + '<div>Belum ada data absensi bulan ini.</div></div>') + '</div>';
  }

  function attPermView() {
    var me = S.user.name, admin = isAdmin(), t = today();
    var f = S.pf || (S.pf = { type: 'TERLAMBAT', from: t, to: t, time: '', reason: '', name: '', attachment: null });
    var types = Object.keys(PERM);
    var multi = f.type === 'TIDAK_MASUK' || f.type === 'SAKIT' || f.type === 'CUTI';
    var forOthers = admin ? '<div class="field"><label>Untuk</label><select class="input" data-pf="name"><option value="">Saya sendiri</option>' +
      attPeople().filter(function (e) { return e.name !== me; }).map(function (e) { return '<option value="' + esc(e.name) + '"' + (f.name === e.name ? ' selected' : '') + '>' + esc(cap(e.name)) + '</option>'; }).join('') +
      '</select><div class="hint">Izin yang diinput manager untuk orang lain langsung berstatus disetujui.</div></div>' : '';
    var form = '<div class="card"><h2 class="mb">Ajukan izin</h2><form data-form="perm">' + forOthers +
      '<div class="field"><label>Jenis izin</label><div class="chips">' + types.map(function (k) { return '<button type="button" class="chip ' + (f.type === k ? 'active' : '') + '" data-act="pf-type" data-v="' + k + '">' + esc(PERM[k].label) + '</button>'; }).join('') + '</div></div>' +
      '<div class="form-row"><div class="field"><label>' + (multi ? 'Dari tanggal' : 'Tanggal') + '</label><input class="input" type="date" data-pf="from" value="' + esc(f.from) + '" required></div>' +
      (multi ? '<div class="field"><label>Sampai tanggal</label><input class="input" type="date" data-pf="to" value="' + esc(f.to < f.from ? f.from : f.to) + '" min="' + esc(f.from) + '"></div>'
        : f.type === 'TERLAMBAT' ? '<div class="field"><label>Perkiraan jam tiba</label><input class="input" type="time" data-pf="time" value="' + esc(f.time) + '"></div>'
          : f.type === 'PULANG_AWAL' ? '<div class="field"><label>Rencana jam pulang</label><input class="input" type="time" data-pf="time" value="' + esc(f.time) + '"></div>' : '') + '</div>' +
      '<div class="field"><label>Alasan / keterangan</label><textarea class="input" data-pf="reason" rows="3" required placeholder="' + (f.type === 'SAKIT' ? 'Misal: demam, sudah ke dokter' : f.type === 'TERLAMBAT' ? 'Misal: ban bocor, antar keluarga ke RS' : 'Tulis alasannya') + '">' + esc(f.reason) + '</textarea></div>' +
      (f.type === 'SAKIT' ? '<div class="field"><label>Foto surat dokter / surat keterangan sakit <span class="muted">(opsional)</span></label>' +
        (f.attachment ? '<div class="attach-preview"><img src="' + f.attachment.preview + '" alt="Pratinjau surat dokter"><button type="button" class="btn ghost sm" data-act="pf-remove-file">' + icon('trash') + 'Hapus foto</button></div>'
          : '<label class="upload-box"><input type="file" id="pf-file" accept="image/*"><span>' + icon('download') + '<b>Pilih / foto surat dokter</b><span class="xs muted">JPG/PNG · otomatis dikecilkan</span></span></label>') + '</div>' : '') +
      '<div class="notice small mb">' + (f.type === 'TERLAMBAT' ? 'Kalau izin terlambat disetujui manager, denda hari itu dibatalkan.' : multi ? 'Hari izin/sakit/cuti yang disetujui tidak dihitung bolos dan target output hari itu dihapus dari KPI.' : 'Izin pulang awal dicatat sebagai keterangan.') + '</div>' +
      '<button class="btn block" id="pf-submit">' + icon('check') + 'Kirim pengajuan</button></form></div>';

    var mine = permsOf(me).slice().sort(function (a, b) { return (b.created || b.from).localeCompare(a.created || a.from); });
    var list = mine.length ? mine.map(function (p) { return permItem(p, false); }).join('') : '<div class="empty">' + icon('report') + '<div>Belum ada pengajuan izin.</div></div>';
    return '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)" id="perm-grid">' + form +
      '<div class="card"><h2 class="mb">Pengajuan saya</h2><div class="list">' + list + '</div></div></div>' +
      '<style>@media(max-width:900px){#perm-grid{grid-template-columns:minmax(0,1fr)!important}}</style>';
  }

  function permItem(p, forReview) {
    var me = S.user.name;
    var actions = '';
    if (p.hasAttachment) actions += '<button class="btn ghost sm" data-act="view-att" data-id="' + esc(p.id) + '">' + icon('eye') + 'Lihat surat</button>';
    if (forReview && p.status === 'PENDING') {
      actions += p.name === me ? '<span class="xs muted">Menunggu manager lain</span>'
        : '<button class="btn danger sm" data-act="review-perm" data-id="' + esc(p.id) + '" data-v="REJECTED">' + icon('x') + 'Tolak</button><button class="btn sm" data-act="review-perm" data-id="' + esc(p.id) + '" data-v="APPROVED">' + icon('check') + 'Setujui</button>';
    }
    if (!forReview && p.status === 'PENDING' && p.name === me) actions += '<button class="btn ghost sm" data-act="cancel-perm" data-id="' + esc(p.id) + '">' + icon('trash') + 'Batalkan</button>';
    return '<div class="list-item" style="align-items:flex-start">' + (forReview ? personAvatar(p.name, 'sm') : '<div class="stat-icon">' + icon(p.type === 'SAKIT' ? 'alert' : p.type === 'TERLAMBAT' ? 'clock' : 'calendar') + '</div>') +
      '<div class="col grow"><div class="row wrap" style="gap:6px">' + (forReview ? '<span class="bold">' + esc(cap(p.name)) + '</span>' : '') + '<span class="bold">' + esc((PERM[p.type] || { label: p.type }).label) + '</span>' + permBadge(p.status) + '</div>' +
      '<div class="small text-2">' + esc(dateRangeTxt(p)) + (p.time ? ' · jam ' + esc(p.time) : '') + '</div>' +
      (p.reason ? '<div class="small">' + esc(p.reason) + '</div>' : '') +
      (p.reviewedBy ? '<div class="xs muted">' + (p.status === 'APPROVED' ? 'Disetujui' : 'Ditolak') + ' oleh ' + esc(cap(p.reviewedBy)) + (p.reviewNote ? ': "' + esc(p.reviewNote) + '"' : '') + '</div>' : '') +
      (actions ? '<div class="row wrap mt-sm" style="gap:6px">' + actions + '</div>' : '') + '</div></div>';
  }

  function attTeamView() {
    var d = S.attDate || today(), c = attCfg();
    var ppl = attPeople().slice().sort(function (a, b) { return (KPI.isLeader(a) ? 1 : 0) - (KPI.isLeader(b) ? 1 : 0) || a.name.localeCompare(b.name); });
    var cnt = { TEPAT: 0, TERLAMBAT: 0, IZIN: 0, BELUM: 0 };
    var rows = ppl.map(function (e) {
      var s = dayStatus(e.name, d), rec = attOf(e.name, d);
      if (s.code === 'TEPAT' || s.code === 'LIBUR_MASUK') cnt.TEPAT++;
      else if (s.code === 'TERLAMBAT' || s.code === 'TERLAMBAT_IZIN') cnt.TERLAMBAT++;
      else if (EXCUSE.indexOf(s.code) >= 0) cnt.IZIN++;
      else if (s.code === 'BELUM' || s.code === 'ALPA') cnt.BELUM++;
      var info = [];
      if (rec && rec.otMin) info.push('Lembur ' + durTxt(rec.otMin) + ' · ' + rec.otFor + ' · perintah ' + rec.otBy);
      if (rec && rec.early) info.push('Pulang awal: ' + rec.early);
      if (rec && rec.notes && rec.updatedBy !== e.name) info.push(rec.notes);
      return '<tr><td><div class="row">' + personAvatar(e.name, 'sm') + '<div class="col"><span class="bold">' + esc(cap(e.name)) + '</span>' + (KPI.isLeader(e) ? posBadge(e) : '') + '</div></div></td>' +
        '<td>' + statusBadgeAtt(s) + '</td><td class="num">' + (rec ? t5(rec.in) : '—') + '</td><td class="num">' + (rec && rec.out ? t5(rec.out) : '—') + '</td>' +
        '<td class="small text-2">' + esc(info.join(' · ')) + '</td><td class="right"><button class="btn ghost sm" data-act="edit-att" data-name="' + esc(e.name) + '">' + icon('edit') + 'Koreksi</button></td></tr>';
    }).join('');
    return '<div class="row between wrap mb"><div class="row wrap"><input class="input" style="width:auto" type="date" data-change="att-date" value="' + esc(d) + '" max="' + today() + '">' +
      (KPI.isWorkday(d, c) ? '' : '<span class="badge st-none">Hari libur</span>') + '</div>' +
      '<button class="btn ghost" data-act="edit-att" data-name="">' + icon('plus') + 'Input presensi manual</button></div>' +
      '<div class="grid grid-4 mb">' + miniStat('Tepat waktu', cnt.TEPAT, 'orang') + miniStat('Terlambat', cnt.TERLAMBAT, 'orang', cnt.TERLAMBAT ? 'down' : '') +
      miniStat('Izin / sakit / cuti', cnt.IZIN, 'orang') + miniStat(d === today() ? 'Belum presensi' : 'Tanpa keterangan', cnt.BELUM, 'orang', cnt.BELUM ? 'down' : '') + '</div>' +
      '<div class="card pad-0"><div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Status</th><th class="num">Masuk</th><th class="num">Pulang</th><th>Keterangan</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function attEditModal(name) {
    var d = S.attDate || today(), rec = name ? attOf(name, d) : null;
    openModal({
      title: name ? 'Koreksi presensi ' + esc(cap(name)) : 'Input presensi manual',
      body: '<form id="att-form"><div class="form-row"><div class="field"><label>Nama</label><select class="input" name="name"' + (name ? ' disabled' : '') + '>' +
        attPeople().map(function (e) { return '<option value="' + esc(e.name) + '"' + (e.name === name ? ' selected' : '') + '>' + esc(cap(e.name)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Tanggal</label><input class="input" type="date" name="date" value="' + esc(d) + '" max="' + today() + '"></div></div>' +
        '<div class="form-row"><div class="field"><label>Jam masuk</label><input class="input" type="time" name="in" value="' + esc(rec ? t5(rec.in) : '') + '" required></div>' +
        '<div class="field"><label>Jam pulang</label><input class="input" type="time" name="out" value="' + esc(rec ? t5(rec.out) : '') + '"></div></div>' +
        '<div class="form-row"><div class="field"><label>Lembur untuk apa <span class="muted">(opsional)</span></label><input class="input" name="otFor" value="' + esc(rec ? rec.otFor : '') + '"></div>' +
        '<div class="field"><label>Atas perintah</label><input class="input" name="otBy" value="' + esc(rec ? rec.otBy : '') + '"></div></div>' +
        '<div class="field"><label>Catatan koreksi</label><input class="input" name="notes" value="' + esc(rec && rec.notes ? rec.notes : '') + '" placeholder="Misal: lupa presensi, sudah dikonfirmasi"></div></form>',
      foot: (rec ? '<button class="btn danger" data-act="del-att" data-name="' + esc(name) + '">' + icon('trash') + 'Hapus</button><span class="grow"></span>' : '') +
        '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" data-act="save-att" data-name="' + esc(name || '') + '">Simpan</button>'
    });
  }

  function attApproveView() {
    var all = (D().permissions || []).slice();
    var pend = all.filter(function (p) { return p.status === 'PENDING'; }).sort(function (a, b) { return a.from.localeCompare(b.from); });
    var done = all.filter(function (p) { return p.status !== 'PENDING'; }).sort(function (a, b) { return (b.reviewedAt || '').localeCompare(a.reviewedAt || ''); }).slice(0, 25);
    return '<div class="grid grid-2"><div class="card"><div class="card-head"><h2>Menunggu persetujuan</h2><span class="sub">' + pend.length + ' pengajuan</span></div><div class="list">' +
      (pend.length ? pend.map(function (p) { return permItem(p, true); }).join('') : '<div class="empty">' + icon('check') + '<div>Tidak ada pengajuan yang menunggu.</div></div>') + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Riwayat</h2><span class="sub">25 terakhir</span></div><div class="list">' +
      (done.length ? done.map(function (p) { return permItem(p, true); }).join('') : '<div class="empty">Belum ada.</div>') + '</div></div></div>';
  }

  function attRecapView() {
    var ym = S.recapMonth || today().slice(0, 7), c = attCfg();
    var rec = recapFor(ym);
    var pos = {};
    D().employees.forEach(function (e) { pos[e.name] = e; });
    var list = rec.list.slice().sort(function (a, b) { return b.late - a.late || b.alpa - a.alpa || a.name.localeCompare(b.name); });
    var totFine = 0, totLate = 0, totOt = 0;
    var rows = list.map(function (r) {
      totFine += r.fines; totLate += r.late; totOt += r.overtimeMin;
      var warn = r.late >= 3 || r.alpa >= 2;
      return '<tr' + (warn ? ' style="background:var(--critical-soft)"' : '') + '><td><div class="row">' + personAvatar(r.name, 'sm') + '<div class="col"><span class="bold">' + esc(cap(r.name)) + '</span>' +
        (KPI.isLeader(pos[r.name]) ? posBadge(pos[r.name]) : '') + (warn ? '<span class="badge st-critical">' + icon('alert') + 'Perlu evaluasi</span>' : '') + '</div></div></td>' +
        '<td class="num bold">' + fmtPct(r.rate) + '</td><td class="num">' + r.present + '</td><td class="num">' + r.onTime + '</td>' +
        '<td class="num' + (r.late ? ' down bold' : '') + '">' + r.late + (r.late ? '<div class="xs muted">' + durTxt(r.lateMin) + '</div>' : '') + '</td>' +
        '<td class="num">' + r.izin + ' / ' + r.sakit + ' / ' + r.cuti + '</td><td class="num' + (r.alpa ? ' down bold' : '') + '">' + r.alpa + '</td>' +
        '<td class="num">' + (r.overtimeMin ? durTxt(r.overtimeMin) : '—') + '</td><td class="num">' + r.early + '</td>' +
        '<td class="num bold' + (r.fines ? ' down' : '') + '">Rp ' + fmtN(r.fines) + '</td></tr>';
    }).join('');
    return '<div class="row between wrap mb"><div class="small muted grow">Bahan evaluasi bulanan. Juga tersimpan otomatis di sheet <b>REKAP ABSENSI</b>.</div>' + monthSelect(ym, 'recap-month') + '</div>' +
      '<div class="grid grid-4 mb">' + miniStat('Total denda', 'Rp ' + fmtN(totFine), totLate + ' kali terlambat', totFine ? 'down' : '') +
      miniStat('Rata-rata kehadiran', fmtPct(list.filter(function (r) { return r.rate != null; }).reduce(function (s, r, i, a) { return s + r.rate / a.length; }, 0) || null), list.length + ' orang') +
      miniStat('Total lembur', durTxt(totOt), 'bulan ini') + miniStat('Perlu evaluasi', list.filter(function (r) { return r.late >= 3 || r.alpa >= 2; }).length, '≥3× terlambat / ≥2× alpa') + '</div>' +
      '<div class="card pad-0"><div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th class="num">Skor</th><th class="num">Hadir</th><th class="num">Tepat</th><th class="num">Terlambat</th><th class="num">Izin/Sakit/Cuti</th><th class="num">Alpa</th><th class="num">Lembur</th><th class="num">Pulang awal</th><th class="num">Denda</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<p class="xs muted mt-sm">Terlambat = presensi masuk lewat jam ' + hm(c.workStart) + (c.lateGrace ? ' + toleransi ' + c.lateGrace + ' menit' : '') + '. Denda Rp ' + fmtN(c.lateFine) + ' per keterlambatan (batal bila izin terlambat disetujui). Alpa = hari kerja tanpa presensi & tanpa izin yang disetujui.</p>';
  }

  function attTodayCard() {
    if (!attEnabled()) return '';
    var t = today(), c = attCfg(), cnt = { ok: 0, late: 0, izin: 0, belum: 0 }, belum = [], late = [];
    attPeople().forEach(function (e) {
      var s = dayStatus(e.name, t);
      if (s.code === 'TEPAT' || s.code === 'LIBUR_MASUK') cnt.ok++;
      else if (s.code === 'TERLAMBAT' || s.code === 'TERLAMBAT_IZIN') { cnt.late++; late.push(e.name); }
      else if (EXCUSE.indexOf(s.code) >= 0) cnt.izin++;
      else if (s.code === 'BELUM') { cnt.belum++; belum.push(e.name); }
    });
    var pend = pendingPerms().length;
    var chip = function (n) { return '<span class="chip" style="cursor:default">' + esc(cap(n)) + '</span>'; };
    return '<div class="card mt"><div class="card-head"><h2 class="row">' + icon('clock') + 'Kehadiran hari ini</h2><a class="small" href="#/attendance" data-act="att-tab" data-v="team">Detail</a></div>' +
      (!KPI.isWorkday(t, c) ? '<div class="empty">Hari ini bukan hari kerja.</div>' :
        '<div class="grid grid-4">' + miniStat('Tepat waktu', cnt.ok, 'orang') + miniStat('Terlambat', cnt.late, late.map(cap).join(', ') || 'orang', cnt.late ? 'down' : '') +
        miniStat('Izin / sakit', cnt.izin, 'orang') + miniStat('Belum presensi', cnt.belum, 'orang', cnt.belum ? 'down' : '') + '</div>' +
        (belum.length ? '<div class="mt-sm small text-2 mb">Belum presensi:</div><div class="chips">' + belum.map(chip).join('') + '</div>' : '')) +
      (pend ? '<a class="remind-banner mt" href="#/attendance" data-act="att-tab" data-v="approve" style="margin-bottom:0">' + icon('bell') + '<div class="grow"><b>' + pend + ' pengajuan izin</b> menunggu persetujuanmu</div><span class="btn sm">Tinjau</span></a>' : '') + '</div>';
  }

  /** Kecilkan foto (maks 1600px, JPEG) sebelum diunggah. */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Tidak ada file.'));
      if (!/^image\//.test(file.type || 'image/')) return reject(new Error('File harus berupa gambar (JPG/PNG).'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var dataUrl = cv.toDataURL('image/jpeg', 0.82);
        resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl, name: file.name });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        if (file.size > 5 * 1024 * 1024) return reject(new Error('Gambar tidak bisa dibaca atau terlalu besar (maks 5 MB). Coba foto ulang dalam format JPG.'));
        var fr = new FileReader();
        fr.onload = function () { resolve({ mime: file.type || 'image/jpeg', data: String(fr.result).split(',')[1], preview: fr.result, name: file.name }); };
        fr.onerror = function () { reject(new Error('Gagal membaca file.')); };
        fr.readAsDataURL(file);
      };
      img.src = url;
    });
  }

  /* =========================================================
     ADMIN
     ========================================================= */
  /* ---------- Gaji & biaya rutin (hanya admin) ---------- */
  function payrollAll() {
    var a = D().admin;
    if (a && a.payroll) return a.payroll;
    // cadangan untuk backend lama: hanya dari kolom SALARY
    var out = {}, order = [];
    D().channels.forEach(function (c) {
      c.employees.forEach(function (n) {
        if (!out[n]) { out[n] = { salaries: [], dates: [] }; order.push(n); }
        if (c.salary && out[n].salaries.indexOf(c.salary) < 0) out[n].salaries.push(c.salary);
        if (c.salaryDate && out[n].dates.indexOf(c.salaryDate) < 0) out[n].dates.push(c.salaryDate);
      });
    });
    return order.filter(function (n) { return out[n].salaries.length; }).map(function (n) {
      var m = String(out[n].dates[0] || '').match(/(\d{1,2})/);
      return { source: 'CHANNEL', name: n, category: 'GAJI', amount: parseMoney(out[n].salaries[0]), label: out[n].salaries.join(' / '), day: m ? +m[1] : 0, schedule: out[n].dates.join(' / '), active: true };
    });
  }
  function payrollActive() { return payrollAll().filter(function (x) { return x.active !== false && x.amount && x.day; }); }
  function dueInMonth(day, anyDate) { return anyDate.slice(0, 8) + String(Math.min(day, +KPI.monthEnd(anyDate).slice(8))).padStart(2, '0'); }
  function nextDue(day, t) {
    var d = dueInMonth(day, t);
    if (d < t) d = dueInMonth(day, KPI.addDays(KPI.monthEnd(t), 1));
    return d;
  }
  function payrollBatches(limit) {
    var t = today(), map = {};
    payrollActive().forEach(function (x) { var d = nextDue(x.day, t); (map[d] = map[d] || []).push(x); });
    return Object.keys(map).sort().slice(0, limit || 4).map(function (d) {
      var items = map[d].slice().sort(function (a, b) { return (a.category === 'BIAYA') - (b.category === 'BIAYA') || b.amount - a.amount; });
      return { date: d, items: items, daysLeft: daysBetween(t, d), total: items.reduce(function (s, x) { return s + x.amount; }, 0) };
    });
  }
  function reminderDays() {
    var raw = D().admin && D().admin.configRaw;
    var n = parseInt(raw && raw.REMINDER_DAYS_BEFORE, 10);
    return n >= 0 ? n : 5;
  }
  function activeReminder() {
    if (!isAdmin() || !S.data) return null;
    var b = payrollBatches(1)[0];
    return b && b.daysLeft <= reminderDays() ? b : null;
  }
  function reminderBanner() {
    var b = activeReminder();
    if (!b) return '';
    return '<a class="remind-banner" href="#/admin" data-act="admin-tab" data-v="payroll">' + icon('bell') +
      '<div class="grow"><div><b>Gajian ' + esc(fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</b> · ' + (b.daysLeft === 0 ? 'hari ini' : b.daysLeft + ' hari lagi') + '</div>' +
      '<div class="xs">' + b.items.length + ' item · total <b>Rp ' + fmtN(b.total) + '</b></div></div><span class="btn sm">Lihat rincian</span></a>';
  }
  function notifSupported() { return 'Notification' in window; }
  function showDeviceNotification(title, body, tag) {
    var opts = { body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: tag, data: { url: './index.html#/admin' } };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.showNotification(title, opts); else new Notification(title, opts); })
          .catch(function () { try { new Notification(title, opts); } catch (e) { } });
      } else new Notification(title, opts);
    } catch (e) { }
  }
  /** Notifikasi perangkat (admin) saat aplikasi dibuka pada masa H-N. */
  function maybeNotifyPayroll() {
    var b = activeReminder();
    if (!b || !notifSupported() || Notification.permission !== 'granted') return;
    var key = 'notified_' + b.date + '_' + today();
    if (Store.get(key)) return;
    Store.set(key, '1');
    showDeviceNotification('🔔 Gajian ' + fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' }) + (b.daysLeft === 0 ? ' (hari ini)' : ' (H-' + b.daysLeft + ')'),
      b.items.length + ' item · total Rp ' + fmtN(b.total), 'payroll-' + b.date);
  }

  function adminView() {
    var tabs = [['employees', 'Karyawan'], ['channels', 'Channel'], ['payroll', 'Gaji'], ['config', 'Pengaturan']];
    var body = S.adminTab === 'channels' ? adminChannels() : S.adminTab === 'payroll' ? adminPayroll() : S.adminTab === 'config' ? adminConfig() : adminEmployees();
    var url = D().admin && D().admin.spreadsheetUrl;
    return pageHead('Admin', 'Kelola karyawan, channel, gaji & pengaturan. Perubahan langsung tersimpan ke spreadsheet.', url ? '<a class="btn ghost" href="' + esc(url) + '" target="_blank" rel="noopener">' + icon('sheet') + 'Buka spreadsheet</a>' : '') +
      '<div class="tabs">' + tabs.map(function (t) { return '<button class="' + (S.adminTab === t[0] ? 'active' : '') + '" data-act="admin-tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
  }

  function adminEmployees() {
    var d = D(), emps = (d.admin && d.admin.employees) || [];
    var rows = emps.map(function (e) {
      var chs = d.channels.filter(function (c) { return c.employees.indexOf(e.name) >= 0; });
      var divs = {};
      chs.forEach(function (c) { divs[c.division] = 1; });
      return '<tr><td><div class="row">' + personAvatar(e.name, 'sm') + '<div class="col"><span class="bold">' + esc(cap(e.name)) + '</span>' + (e.notes ? '<span class="xs muted ellipsis" style="max-width:220px">' + esc(e.notes) + '</span>' : '') + '</div></div></td>' +
        '<td>' + posBadge(e) + '</td>' +
        '<td>' + (e.role === 'ADMIN' ? '<span class="badge st-warning">' + icon('lock') + 'Admin + gaji</span>' : '<span class="badge st-none">Staff</span>') + '</td>' +
        '<td>' + (e.active ? '<span class="badge st-good">' + icon('check') + 'Aktif</span>' : '<span class="badge st-critical">' + icon('x') + 'Nonaktif</span>') + '</td>' +
        '<td><span class="row" style="gap:4px">' + Object.keys(divs).map(divBadge).join('') + '</span></td><td class="num">' + chs.length + '</td>' +
        '<td>' + (e.pin ? '<button class="btn ghost sm" data-act="show-pin" data-pin="' + esc(e.pin) + '"><span class="num">••••••</span></button>' : '<span class="badge st-none">Tanpa akun</span>') + '</td>' +
        '<td class="right"><button class="btn ghost sm" data-act="edit-emp" data-name="' + esc(e.name) + '">' + icon('edit') + 'Ubah</button></td></tr>';
    }).join('');
    return '<div class="row between mb wrap"><p class="small muted grow">Karyawan baru dari kolom <b>RELEVANT EMPLOYEES</b> otomatis ditambahkan dengan PIN acak. Bagikan PIN ke masing-masing karyawan.</p>' +
      '<button class="btn" data-act="edit-emp" data-name="">' + icon('plus') + 'Tambah</button></div>' +
      '<div class="card pad-0"><div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Jabatan</th><th>Akses</th><th>Status</th><th>Divisi</th><th class="num">Channel</th><th>PIN</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function empModal(name) {
    var emps = (D().admin && D().admin.employees) || [];
    var e = emps.filter(function (x) { return x.name === name; })[0] || { name: '', role: 'EMPLOYEE', pin: '', active: true, notes: '', position: 'STAFF', login: true };
    var pos = posOf(e), canLogin = e.login !== false && (!!e.pin || !e.name);
    var isNew = !e.name;
    openModal({
      title: isNew ? 'Tambah karyawan' : 'Ubah ' + esc(cap(e.name)),
      body: '<form data-form="emp" id="emp-form"><div class="field"><label>Nama</label><input class="input" name="name" value="' + esc(e.name) + '"' + (isNew ? ' required' : ' readonly') + ' placeholder="Sesuai kolom RELEVANT EMPLOYEES">' + (isNew ? '' : '<div class="hint">Untuk mengganti nama, ubah langsung di sheet EMPLOYEES & CHANNEL REPORT.</div>') + '</div>' +
        '<div class="form-row"><div class="field"><label>Jabatan</label><select class="input" name="position">' + [['STAFF', 'Staff'], ['MANAGER', 'Manager'], ['BOSS', 'Bos']].map(function (o) { return '<option value="' + o[0] + '"' + (pos === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><div class="hint">Manager & bos tidak masuk peringkat KPI.</div></div>' +
        '<div class="field"><label>Akses aplikasi</label><select class="input" name="role"><option value="EMPLOYEE"' + (e.role !== 'ADMIN' ? ' selected' : '') + '>Staff (tanpa gaji)</option><option value="ADMIN"' + (e.role === 'ADMIN' ? ' selected' : '') + '>Admin (akses penuh + gaji)</option></select></div></div>' +
        '<div class="field"><label class="row between"><span>Bisa login ke aplikasi</span><span class="switch"><input type="checkbox" name="login"' + (canLogin ? ' checked' : '') + '><span></span></span></label><div class="hint">Matikan untuk orang yang hanya tercantum di struktur tim (misalnya bos).</div></div>' +
        '<div class="field"><label>PIN ' + (isNew || !e.pin ? '' : '<span class="muted">(kosongkan = tetap)</span>') + '</label><input class="input" name="pin" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" placeholder="' + (isNew || !e.pin ? 'acak jika kosong' : '••••••') + '"></div>' +
        '<div class="field"><label class="row between"><span>Aktif (tampil di tim & dihitung KPI)</span><span class="switch"><input type="checkbox" name="active"' + (e.active ? ' checked' : '') + '><span></span></span></label></div>' +
        '<div class="field"><label>Catatan</label><input class="input" name="notes" value="' + esc(e.notes) + '"></div></form>',
      foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" data-act="save-emp">Simpan</button>'
    });
  }

  function adminChannels() {
    var d = D();
    var rows = d.channels.map(function (c) {
      var y = ytOf(c);
      return '<tr><td><div class="row">' + avatar(c, 'sm') + '<div class="col"><span class="bold ellipsis" style="max-width:240px">' + esc(chTitle(c)) + '</span><span class="xs muted ellipsis" style="max-width:240px">' + esc(c.name) + '</span></div></div></td>' +
        '<td>' + divBadge(c.division) + '</td><td>' + esc(c.employees.map(cap).join(', ') || '—') + '</td><td class="num">' + fmtN(c.target) + '</td>' +
        '<td>' + (y && y.status === 'OK' ? '<span class="badge st-good">' + icon('check') + 'Terpantau</span>' : c.link ? '<span class="badge st-warning">' + icon('alert') + (y && y.status === 'NOT_FOUND' ? 'Tidak ditemukan' : 'Menunggu') + '</span>' : '<span class="badge st-none">Tanpa link</span>') + '</td>' +
        '<td class="nowrap">' + esc(c.salary || '—') + '</td>' +
        '<td class="right"><button class="btn ghost sm" data-act="edit-channel" data-key="' + esc(c.key) + '">' + icon('edit') + 'Ubah</button></td></tr>';
    }).join('');
    return '<div class="row between mb wrap"><p class="small muted grow">Sama dengan sheet <b>CHANNEL REPORT</b>. Ubah di sini atau langsung di spreadsheet — keduanya tersinkron.</p>' +
      '<button class="btn" data-act="edit-channel" data-key="">' + icon('plus') + 'Tambah channel</button></div>' +
      '<div class="card pad-0"><div class="table-wrap"><table class="table"><thead><tr><th>Channel</th><th>Divisi</th><th>Karyawan</th><th class="num">Target</th><th>YouTube</th><th>Gaji</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function channelModal(key) {
    var c = key ? channelByKey(key) : null;
    var isNew = !c;
    c = c || { name: '', type: 'DEV CHANNEL', link: '', indicator: 'PRODUCTION', target: 2, notes: '', employees: [], salary: '', salaryDate: '' };
    var types = ['DEV CHANNEL', 'STAFF CHANNEL', 'CLIENT CHANNEL'];
    if (c.type && types.indexOf(c.type) < 0) types.push(c.type);
    var names = ((D().admin && D().admin.employees) || []).map(function (e) { return e.name; });
    openModal({
      title: isNew ? 'Tambah channel' : 'Ubah channel', wide: true,
      body: '<form id="ch-form"><div class="form-row"><div class="field"><label>Nama channel (kolom CHANNEL NAME)</label><input class="input" name="name" value="' + esc(c.name) + '" required>' + (isNew ? '' : '<div class="hint">Aman diganti: laporan lama ikut pindah ke nama baru.</div>') + '</div>' +
        '<div class="field"><label>Tipe / divisi</label><select class="input" name="type">' + types.map(function (t) { return '<option' + (c.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label>Link channel YouTube</label><input class="input" name="link" value="' + esc(c.link || '') + '" placeholder="https://youtube.com/@namachannel">' + (c.linkNote ? '<div class="hint">Isi sheet saat ini: ' + esc(c.linkNote) + '</div>' : '') + '</div>' +
        '<div class="form-row"><div class="field"><label>Indikator tugas</label><input class="input" name="indicator" value="' + esc(c.indicator) + '" list="task-list2"><datalist id="task-list2">' + TASKS.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label>Target (' + esc(String(cfg().TARGET_PERIOD || 'DAILY')) + ')</label><input class="input" name="target" type="number" min="0" step="0.5" value="' + esc(c.target) + '"></div></div>' +
        '<div class="field"><label>Karyawan (pisahkan dengan koma)</label><input class="input" name="employees" value="' + esc(c.employees.join(', ')) + '" list="emp-list"><datalist id="emp-list">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><div class="hint">Nama baru otomatis dibuatkan akun dengan PIN acak.</div></div>' +
        '<div class="form-row"><div class="field"><label>Durasi minimal per video (menit)</label><input class="input" name="minDuration" type="number" min="0" step="1" value="' + esc(c.minDuration || '') + '" placeholder="kosong = tanpa batas"><div class="hint">Video di bawah durasi ini ditandai & tidak dihitung sebagai "Upload YT".</div></div><div></div></div>' +
        '<div class="field"><label>Catatan</label><textarea class="input" name="notes" rows="2">' + esc(c.notes) + '</textarea></div>' +
        '<div class="notice mb">' + icon('lock').replace('<svg ', '<svg width="14" height="14" style="vertical-align:-2px" ') + ' Data gaji hanya terlihat oleh admin.</div>' +
        '<div class="form-row"><div class="field"><label>Gaji (kolom SALARY)</label><input class="input" name="salary" value="' + esc(c.salary || '') + '" placeholder="Rp 2.800.000"></div>' +
        '<div class="field"><label>Tanggal gajian</label><input class="input" name="salaryDate" value="' + esc(c.salaryDate || '') + '" placeholder="10th every month"></div></div></form>',
      foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" data-act="save-channel" data-key="' + esc(key || '') + '">Simpan ke spreadsheet</button>'
    });
  }

  function adminPayroll() {
    var all = payrollAll(), act = payrollActive(), a = D().admin || {};
    var hasSheet = !!a.payroll;
    var monthly = act.reduce(function (s, x) { return s + x.amount; }, 0);
    var staffTotal = act.filter(function (x) { return x.source === 'CHANNEL'; }).reduce(function (s, x) { return s + x.amount; }, 0);
    var extraTotal = monthly - staffTotal;
    var batches = payrollBatches(2), rd = reminderDays();
    var lock = icon('lock').replace('<svg ', '<svg width="14" height="14" style="vertical-align:-2px" ');
    function catBadge(x) { return x.category === 'BIAYA' ? '<span class="badge div-STAFF">Biaya</span>' : '<span class="badge div-DEV">Gaji</span>'; }
    var batchCards = batches.map(function (b) {
      var soon = b.daysLeft <= rd;
      return '<div class="card"><div class="card-head"><div class="col"><h2>' + esc(fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h2><span class="sub">Batch tanggal ' + (+b.date.slice(8)) + '</span></div>' +
        '<span class="badge ' + (soon ? 'st-warning' : 'st-none') + '">' + icon(soon ? 'bell' : 'calendar') + (b.daysLeft === 0 ? 'Hari ini' : b.daysLeft + ' hari lagi') + '</span></div><div class="list">' +
        b.items.map(function (x) {
          return '<div class="list-item">' + (x.category === 'BIAYA' ? '<div class="stat-icon">' + icon('wallet') + '</div>' : personAvatar(x.name, 'sm')) + '<div class="col grow"><span class="bold">' + esc(x.category === 'BIAYA' ? x.name : cap(x.name)) + '</span><span class="row" style="gap:6px">' + catBadge(x) + (x.source === 'PAYROLL' && x.category === 'GAJI' ? '<span class="xs muted">sheet PAYROLL</span>' : '') + '</span></div><div class="bold num nowrap">Rp ' + fmtN(x.amount) + '</div></div>';
        }).join('') + '<div class="list-item"><div class="grow bold">Total</div><div class="bold num" style="font-size:18px">Rp ' + fmtN(b.total) + '</div></div></div></div>';
    }).join('');
    var extraRows = all.filter(function (x) { return x.source === 'PAYROLL'; }).map(function (x) {
      return '<tr><td class="bold">' + esc(x.category === 'BIAYA' ? x.name : cap(x.name)) + (x.notes ? '<div class="xs muted">' + esc(x.notes) + '</div>' : '') + '</td><td>' + catBadge(x) + '</td><td class="num bold">Rp ' + fmtN(x.amount) + '</td><td>Tgl ' + esc(x.day) + '</td>' +
        '<td>' + (x.active !== false ? '<span class="badge st-good">' + icon('check') + 'Aktif</span>' : '<span class="badge st-none">Nonaktif</span>') + '</td>' +
        '<td class="right nowrap"><button class="btn ghost sm" data-act="edit-pay" data-row="' + x.row + '">' + icon('edit') + 'Ubah</button> <button class="btn ghost icon sm" data-act="del-pay" data-row="' + x.row + '" aria-label="Hapus">' + icon('trash') + '</button></td></tr>';
    }).join('');
    var staffRows = all.filter(function (x) { return x.source === 'CHANNEL'; }).sort(function (p, q) { return p.name.localeCompare(q.name); }).map(function (x) {
      return '<tr><td><div class="row">' + personAvatar(x.name, 'sm') + '<span class="bold">' + esc(cap(x.name)) + '</span></div></td><td class="nowrap">' + esc(x.label || ('Rp ' + fmtN(x.amount))) + '</td><td>' + esc(x.schedule || '—') + '</td><td>' + (x.day ? esc(fmtDate(nextDue(x.day, today()), { weekday: 'short', day: 'numeric', month: 'short' })) : '—') + '</td></tr>';
    }).join('');
    var notifState = !notifSupported() ? '<span class="badge st-none">Tidak didukung browser ini</span>' : Notification.permission === 'granted' ? '<span class="badge st-good">' + icon('check') + 'Aktif di perangkat ini</span>' : Notification.permission === 'denied' ? '<span class="badge st-critical">Diblokir. Izinkan lewat pengaturan browser</span>' : '<button class="btn ghost sm" data-act="enable-notif">' + icon('bell') + 'Aktifkan notifikasi di perangkat ini</button>';
    return '<div class="notice mb">' + lock + ' Halaman ini hanya untuk admin (Arya & Zul). Data gaji tidak pernah dikirim ke perangkat staff.</div>' +
      '<div class="grid grid-4 mb">' +
      '<div class="card stat"><div class="label">Total pengeluaran rutin / bulan</div><div class="value num" style="font-size:24px">Rp ' + fmtN(monthly) + '</div><div class="delta muted">gaji + biaya tetap</div></div>' +
      '<div class="card stat"><div class="label">Gaji staff</div><div class="value num" style="font-size:24px">Rp ' + fmtN(staffTotal) + '</div><div class="delta muted">kolom SALARY (CHANNEL REPORT)</div></div>' +
      '<div class="card stat"><div class="label">Gaji manager & biaya</div><div class="value num" style="font-size:24px">Rp ' + fmtN(extraTotal) + '</div><div class="delta muted">sheet PAYROLL</div></div>' +
      '<div class="card stat"><div class="label">Gajian berikutnya</div><div class="value num" style="font-size:24px">' + (batches[0] ? esc(fmtDate(batches[0].date, { day: 'numeric', month: 'short' })) : '—') + '</div><div class="delta muted">' + (batches[0] ? (batches[0].daysLeft === 0 ? 'hari ini' : batches[0].daysLeft + ' hari lagi') : '&nbsp;') + '</div></div></div>' +
      (batchCards ? '<div class="grid grid-2 mb">' + batchCards + '</div>' : '') +
      '<div class="card mb"><div class="card-head"><h2 class="row">' + icon('bell') + 'Pengingat otomatis</h2></div>' +
      '<div class="list"><div class="list-item"><div class="col grow"><div class="bold">Email H-' + rd + ' sebelum setiap tanggal gajian</div><div class="xs muted">Dikirim ke: ' + esc((a.reminderTo || []).join(', ') || '(email pemilik spreadsheet)') + '. Ubah penerima di tab Pengaturan.</div></div>' +
      (hasSheet ? '<button class="btn ghost sm" data-act="test-reminder">' + icon('bell') + 'Kirim email tes</button>' : '<span class="xs muted">Perlu backend 1.2.0</span>') + '</div>' +
      '<div class="list-item"><div class="col grow"><div class="bold">Notifikasi di HP / PC ini</div><div class="xs muted">Muncul saat aplikasi dibuka pada H-' + rd + ' sampai hari-H. Email tetap jadi pengingat utama karena terkirim walau aplikasi tidak dibuka.</div></div>' + notifState + '</div></div></div>' +
      '<div class="card pad-0 mb"><div style="padding:18px 20px 6px"><div class="card-head"><div class="col"><h2>Gaji manager & biaya tetap</h2><span class="sub">Sheet PAYROLL. Bisa diubah di sini atau langsung di spreadsheet.</span></div>' +
      (hasSheet ? '<button class="btn sm" data-act="edit-pay" data-row="">' + icon('plus') + 'Tambah</button>' : '') + '</div></div>' +
      (extraRows ? '<div class="table-wrap"><table class="table"><thead><tr><th>Nama / keterangan</th><th>Jenis</th><th class="num">Nominal</th><th>Jatuh tempo</th><th>Status</th><th></th></tr></thead><tbody>' + extraRows + '</tbody></table></div>' : '<div class="empty">' + (hasSheet ? 'Belum ada data.' : 'Pasang backend 1.2.0 untuk mengaktifkan sheet PAYROLL.') + '</div>') + '</div>' +
      '<div class="card pad-0"><div style="padding:18px 20px 6px"><div class="card-head"><div class="col"><h2>Gaji staff</h2><span class="sub">Dari kolom SALARY & DATE OF SALARY di CHANNEL REPORT. Ubah lewat tab Channel.</span></div></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Karyawan</th><th>Gaji</th><th>Jadwal</th><th>Gajian berikutnya</th></tr></thead><tbody>' + staffRows + '</tbody></table></div></div>';
  }

  function payModal(row) {
    var x = payrollAll().filter(function (p) { return p.source === 'PAYROLL' && String(p.row) === String(row); })[0] || { name: '', category: 'GAJI', amount: '', day: 10, active: true, notes: '' };
    var isNew = !x.row;
    openModal({
      title: isNew ? 'Tambah gaji / biaya' : 'Ubah ' + esc(x.category === 'BIAYA' ? x.name : cap(x.name)),
      body: '<form id="pay-form"><input type="hidden" name="row" value="' + esc(x.row || '') + '">' +
        '<div class="form-row"><div class="field"><label>Jenis</label><select class="input" name="category"><option value="GAJI"' + (x.category !== 'BIAYA' ? ' selected' : '') + '>Gaji (nama orang)</option><option value="BIAYA"' + (x.category === 'BIAYA' ? ' selected' : '') + '>Biaya (sewa, langganan, dll.)</option></select></div>' +
        '<div class="field"><label>Nama / keterangan</label><input class="input" name="name" value="' + esc(x.name) + '" placeholder="ZUL atau Sewa ruang kerja" required></div></div>' +
        '<div class="form-row"><div class="field"><label>Nominal (Rp)</label><input class="input" name="amount" inputmode="numeric" value="' + esc(x.amount ? fmtN(x.amount) : '') + '" placeholder="10.000.000" required></div>' +
        '<div class="field"><label>Tanggal jatuh tempo (1–31)</label><input class="input" name="day" type="number" min="1" max="31" value="' + esc(x.day || '') + '" required><div class="hint">Setiap bulan. Pengingat email H-' + reminderDays() + '.</div></div></div>' +
        '<div class="field"><label class="row between"><span>Aktif (dihitung & diingatkan)</span><span class="switch"><input type="checkbox" name="active"' + (x.active !== false ? ' checked' : '') + '><span></span></span></label></div>' +
        '<div class="field"><label>Catatan</label><input class="input" name="notes" value="' + esc(x.notes || '') + '"></div></form>',
      foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn" data-act="save-pay">Simpan ke spreadsheet</button>'
    });
  }

  function adminConfig() {
    var c = cfg();
    var wd = String(c.WORK_DAYS || '1,2,3,4,5').split(/[,\s]+/).map(Number);
    var dn = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    function sw(name, label, hint) { return '<div class="field"><label class="row between"><span>' + label + '</span><span class="switch"><input type="checkbox" name="' + name + '"' + (/^true$/i.test(String(c[name])) ? ' checked' : '') + '><span></span></span></label>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
    return '<form id="cfg-form" class="grid grid-2"><div class="card"><h2 class="mb">Umum & KPI</h2>' +
      '<div class="field"><label>Nama tim / perusahaan</label><input class="input" name="COMPANY_NAME" value="' + esc(c.COMPANY_NAME || '') + '"></div>' +
      '<div class="field"><label>Hari kerja</label><div class="daycheck">' + dn.map(function (n, i) { return '<label><input type="checkbox" name="wd" value="' + (i + 1) + '"' + (wd.indexOf(i + 1) >= 0 ? ' checked' : '') + '><span>' + n + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="field"><label>Arti kolom TARGET</label><select class="input" name="TARGET_PERIOD">' + [['DAILY', 'Target per hari'], ['WEEKLY', 'Target per minggu'], ['MONTHLY', 'Target per bulan']].map(function (o) { return '<option value="' + o[0] + '"' + (String(c.TARGET_PERIOD).toUpperCase() === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-row"><div class="field"><label>Bobot output (%)</label><input class="input" type="number" min="0" max="100" name="WEIGHT_OUTPUT" value="' + esc(c.WEIGHT_OUTPUT) + '"></div>' +
      '<div class="field"><label>Bobot disiplin (%)</label><input class="input" type="number" min="0" max="100" name="WEIGHT_DISCIPLINE" value="' + esc(c.WEIGHT_DISCIPLINE) + '"></div></div>' +
      '<div class="field"><label>Batas isi/ubah laporan mundur (hari)</label><input class="input" type="number" min="0" max="60" name="BACKDATE_DAYS" value="' + esc(c.BACKDATE_DAYS) + '"></div>' +
      sw('EMPLOYEE_SEE_ALL', 'Karyawan bisa melihat KPI & laporan rekan', 'Gaji tetap tersembunyi.') +
      sw('SYNC_CURRENT_RESULT', 'Isi otomatis kolom CURRENT RESULT di sheet', 'Diisi dari total laporan pada periode target berjalan.') +
      '</div><div class="card"><h2 class="mb">YouTube</h2>' +
      '<div class="field"><label>Sinkron views setiap (jam)</label><input class="input" type="number" min="1" max="24" name="YT_SYNC_HOURS" value="' + esc(c.YT_SYNC_HOURS) + '"><div class="hint">Kuota gratis YouTube API cukup untuk sinkron tiap jam.</div></div>' +
      '<div class="field"><label>Video terbaru yang dipantau per channel</label><input class="input" type="number" min="5" max="500" name="YT_MAX_VIDEOS" value="' + esc(c.YT_MAX_VIDEOS) + '"></div>' +
      '<div class="field"><label>Zona waktu</label><input class="input" name="TIMEZONE" value="' + esc(c.TIMEZONE || 'Asia/Jakarta') + '"></div>' +
      '<div class="row wrap"><button type="button" class="btn ghost" data-act="sync-yt"' + (S.syncing ? ' disabled' : '') + '>' + icon('refresh') + 'Sinkron YouTube sekarang</button></div>' +
      '<div class="divider"></div><div class="small text-2">Versi backend: <b>' + esc(D().backendVersion || '-') + '</b> · Aplikasi: <b>' + esc(APP_VERSION) + '</b></div>' +
      '</div>' + (function () {
        var raw = (D().admin && D().admin.configRaw) || {};
        if (raw.REMINDER_DAYS_BEFORE == null) return '';
        return '<div class="card" style="grid-column:1/-1"><h2 class="mb row">' + icon('bell') + 'Pengingat gajian (khusus admin)</h2><div class="form-row">' +
          '<div class="field"><label>Email penerima (pisahkan koma)</label><input class="input" name="REMINDER_EMAILS" value="' + esc(raw.REMINDER_EMAILS || '') + '" placeholder="arya@gmail.com, zul@gmail.com"><div class="hint">Kosong = email pemilik spreadsheet' + ((D().admin.reminderTo || []).length ? ' (' + esc(D().admin.reminderTo.join(', ')) + ')' : '') + '.</div></div>' +
          '<div class="form-row"><div class="field"><label>Kirim H-berapa</label><input class="input" type="number" min="0" max="27" name="REMINDER_DAYS_BEFORE" value="' + esc(raw.REMINDER_DAYS_BEFORE) + '"></div>' +
          '<div class="field"><label>Jam kirim (0–23)</label><input class="input" type="number" min="0" max="23" name="REMINDER_HOUR" value="' + esc(raw.REMINDER_HOUR || 8) + '"></div></div></div></div>';
      })() + (function () {
        var c2 = cfg();
        if (!c2.WORK_START) return '';
        return '<div class="card" style="grid-column:1/-1"><h2 class="mb row">' + icon('clock') + 'Absensi & denda</h2><div class="grid grid-3" style="gap:0 16px">' +
          '<div class="field"><label>Jam masuk</label><input class="input" type="time" name="WORK_START" value="' + esc(c2.WORK_START) + '"></div>' +
          '<div class="field"><label>Jam pulang</label><input class="input" type="time" name="WORK_END" value="' + esc(c2.WORK_END) + '"></div>' +
          '<div class="field"><label>Toleransi terlambat (menit)</label><input class="input" type="number" min="0" max="120" name="LATE_GRACE_MIN" value="' + esc(c2.LATE_GRACE_MIN) + '"></div>' +
          '<div class="field"><label>Denda per keterlambatan (Rp)</label><input class="input" type="number" min="0" step="1000" name="LATE_FINE" value="' + esc(c2.LATE_FINE) + '"></div>' +
          '<div class="field"><label>Nilai kehadiran saat terlambat (%)</label><input class="input" type="number" min="0" max="100" name="ATTENDANCE_LATE_SCORE" value="' + esc(c2.ATTENDANCE_LATE_SCORE) + '"></div>' +
          '<div class="field"><label>Bobot kehadiran di KPI (%)</label><input class="input" type="number" min="0" max="100" name="WEIGHT_ATTENDANCE" value="' + esc(c2.WEIGHT_ATTENDANCE) + '"></div>' +
          '<div class="field"><label>Absensi mulai dihitung</label><input class="input" type="date" name="ATTENDANCE_START" value="' + esc(c2.ATTENDANCE_START) + '"><div class="hint">Hari sebelum tanggal ini tidak dianggap bolos.</div></div></div></div>';
      })() + '<div style="grid-column:1/-1" class="row"><button type="button" class="btn" data-act="save-config">' + icon('check') + 'Simpan pengaturan</button></div></form>';
  }

  /* =========================================================
     SETTINGS
     ========================================================= */
  function settingsView() {
    var u = S.user;
    var standalone = isStandalone();
    return pageHead('Pengaturan', 'Tema, akun, dan pembaruan aplikasi.') +
      '<div class="grid grid-2"><div class="col" style="gap:16px">' +
      '<div class="card"><h2 class="mb">Tampilan</h2><div class="seg">' + themeSeg() + '</div><p class="xs muted mt-sm">Terang: cerah & ceria. Gelap: minimalis-elegan.</p></div>' +
      '<div class="card"><h2 class="mb">Akun</h2><div class="row mb">' + personAvatar(u.name, 'lg') + '<div class="col"><div class="bold">' + esc(cap(u.name)) + '</div><div class="small muted">' + esc(roleLabel(u)) + '</div></div></div>' +
      '<form data-form="pin"><div class="form-row"><div class="field"><label>PIN lama</label><input class="input" name="old" type="password" inputmode="numeric" maxlength="8" required></div>' +
      '<div class="field"><label>PIN baru (4–8 angka)</label><input class="input" name="new" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required></div></div>' +
      '<button class="btn ghost">Ganti PIN</button></form><div class="divider"></div>' +
      '<button class="btn danger" data-act="logout">' + icon('logout') + 'Keluar</button></div></div>' +
      '<div class="col" style="gap:16px"><div class="card"><h2 class="mb">Aplikasi</h2>' +
      '<div class="list"><div class="list-item"><div class="grow">Versi terpasang</div><b class="num">' + esc(APP_VERSION) + '</b></div>' +
      '<div class="list-item"><div class="grow">Rilis</div><span>' + esc(typeof APP_RELEASE_DATE !== 'undefined' ? fmtDate(APP_RELEASE_DATE, { day: 'numeric', month: 'long', year: 'numeric' }) : '-') + '</span></div>' +
      '<div class="list-item"><div class="grow">Mode</div><span>' + (standalone ? 'Terpasang di perangkat' : 'Browser') + (API.isDemo() ? ' · Demo' : '') + '</span></div></div>' +
      '<div class="row wrap mt">' + (S.update ? '<button class="btn" data-act="apply-update">' + icon('download') + 'Perbarui ke ' + esc(S.update.v) + '</button>' : '<button class="btn ghost" data-act="check-update">' + icon('refresh') + 'Cek pembaruan</button>') +
      installButton() + '</div>' +
      (!standalone ? '<div class="mt"><div class="small bold" style="margin-bottom:6px">Cara memasang di perangkat ini</div>' + installGuide() + '</div>' : '') +
      '<div class="divider"></div><h3 class="mb">Catatan rilis ' + esc(APP_VERSION) + '</h3><ul class="small text-2" style="margin:0;padding-left:18px">' + (APP_RELEASE_NOTES || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' +
      (isAdmin() || API.isDemo() ? '<div class="card"><h2 class="mb">Server</h2>' + (API.isDemo() ? '<p class="small text-2 mb">Sedang memakai data demo (fiktif).</p><button class="btn ghost" data-act="demo-off">Keluar dari mode demo</button>' :
        '<form data-form="server"><div class="field"><label>URL Web App</label><input class="input" name="url" value="' + esc(API.url()) + '"><div class="hint">Hanya untuk perangkat ini. Untuk semua karyawan, ubah API_URL di config.js.</div></div><button class="btn ghost">Simpan</button></form>') + '</div>' : '') +
      '</div></div>';
  }

  /* =========================================================
     EVENTS
     ========================================================= */
  function formData(form) {
    var o = {};
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') { if (el.name === 'wd') { (o.wd = o.wd || []); if (el.checked) o.wd.push(el.value); } else o[el.name] = el.checked; }
      else o[el.name] = el.value;
    });
    return o;
  }

  var ACT = {
    'modal-close': function () { closeModal(); },
    'cycle-theme': function () { var t = theme(); setTheme(t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'); toast('Tema: ' + { light: 'Terang', dark: 'Gelap', system: 'Ikuti sistem' }[theme()]); },
    theme: function (el) { setTheme(el.dataset.v); },
    'demo-on': function () { Store.set('demo', '1'); S.publicInfo = null; render(); },
    'demo-off': function () { Store.set('demo', null); Demo.reset(); S.publicInfo = null; Store.set('cache_public', null); logout(true); },
    logout: function () { confirmBox('Keluar?', 'Kamu perlu login lagi dengan PIN.', 'Keluar').then(function (ok) { if (ok) logout(); }); },
    'apply-update': function () { Updater.apply(); },
    'check-update': function (el) {
      el.disabled = true; el.innerHTML = '<span class="spinner"></span> Memeriksa…';
      Updater.check().then(function (r) {
        if (r === 'found') toast('Pembaruan ditemukan, mengunduh…');
        else if (r === 'nosw') toast('Browser ini tidak mendukung pembaruan otomatis. Muat ulang halaman.');
        else toast('Kamu sudah memakai versi terbaru ✓');
        setTimeout(render, 1600);
      }).catch(function () { toast('Gagal memeriksa pembaruan.', 'error'); render(); });
    },
    install: function () {
      if (!S.installEvt) { openInstallGuide(); return; }
      var evt = S.installEvt;
      try { evt.prompt(); } catch (e) { openInstallGuide(); return; }
      evt.userChoice.then(function (c) { if (c && c.outcome === 'accepted') S.installEvt = null; render(); }).catch(function () { });
    },
    'hide-install': function () { Store.set('hideInstall', '1'); render(); },
    qty: function (el) {
      var f = S.form; f.qty = Math.max(0, (Number(f.qty) || 0) + Number(el.dataset.v));
      var inp = $('[data-f="qty"]'); if (inp) inp.value = f.qty;
      S.dirty = true;
    },
    'edit-report': function (el) {
      var r = D().reports.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!r) return;
      S.editId = r.id;
      S.form = { employee: r.employee, channel: r.channel, date: r.date, task: r.task, qty: r.qty, links: r.links, notes: r.notes };
      S.dirty = true;
      if (route().name !== 'report') go('report'); else render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    'cancel-edit': function () { S.editId = null; S.form = null; S.dirty = false; render(); },
    'del-report': function (el) {
      confirmBox('Hapus laporan?', 'Laporan ini akan dihapus dari spreadsheet. KPI akan dihitung ulang.', 'Hapus', true).then(function (ok) {
        if (!ok) return;
        API.call('deleteReport', { id: el.dataset.id }).then(function () {
          D().reports = D().reports.filter(function (x) { return x.id !== el.dataset.id; });
          if (S.editId === el.dataset.id) { S.editId = null; S.form = null; S.dirty = false; }
          toast('Laporan dihapus.'); render(); loadData(true);
        }).catch(handleErr);
      });
    },
    'rep-range': function (el) { S.rep.range = el.dataset.v; render(); },
    'kpi-period': function (el) { S.kpi.period = el.dataset.v; render(); },
    'kpi-div': function (el) { S.kpi.division = el.dataset.v; render(); },
    'kpi-detail': function (el) { kpiDetail(el.dataset.name); },
    'ch-div': function (el) { S.ch.division = el.dataset.v; render(); },
    'ch-mine': function () { S.ch.mine = !S.ch.mine; render(); },
    'vid-sort': function (el) { S.vid.sort = el.dataset.v; render(); },
    'vid-kind': function (el) { S.vid.kind = el.dataset.v; render(); },
    'reload-yt': function () { toast('Memuat data YouTube…'); loadYT(); },
    'sync-yt': function () {
      S.syncing = true; render(); toast('Sinkron YouTube berjalan, bisa 1–2 menit…');
      API.call('syncYouTube').then(function (y) {
        S.syncing = false; S.yt = y; S.hist = {}; Store.setJSON('cache_yt', y); indexYT(); toast('Sinkron YouTube selesai ✓'); render();
      }).catch(function (e) { S.syncing = false; render(); handleErr(e); });
    },
    'admin-tab': function (el, ev) { if (ev) ev.preventDefault(); S.adminTab = el.dataset.v; if (route().name !== 'admin') go('admin'); else render(); },
    'show-pin': function (el) { var s = $('span', el); s.textContent = s.textContent.indexOf('•') >= 0 ? el.dataset.pin : '••••••'; },
    'edit-emp': function (el) { empModal(el.dataset.name); },
    'save-emp': function (el) {
      var f = formData($('#emp-form'));
      if (!f.name) return toast('Nama wajib diisi.', 'error');
      if (f.pin && !/^\d{4,8}$/.test(f.pin)) return toast('PIN harus 4–8 digit angka.', 'error');
      el.disabled = true;
      API.call('saveEmployee', { employee: { name: f.name, role: f.role, position: f.position, login: f.login, pin: f.login ? f.pin : '', active: f.active, notes: f.notes } }).then(function (res) {
        if (D().admin) D().admin.employees = res.employees;
        closeModal(); toast('Karyawan disimpan ✓'); render(); loadData(true);
      }).catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'edit-channel': function (el) { channelModal(el.dataset.key); },
    'check-in': function (el) { doCheckIn(el); },
    'check-out': function () { checkOutFlow(); },
    'att-tab': function (el, ev) { if (ev) ev.preventDefault(); S.attTab = el.dataset.v; if (route().name !== 'attendance') go('attendance'); else render(); },
    'pf-type': function (el) { S.pf.type = el.dataset.v; if (S.pf.type !== 'SAKIT') S.pf.attachment = null; render(); },
    'pf-remove-file': function () { S.pf.attachment = null; render(); },
    'view-att': function (el) {
      el.disabled = true;
      API.call('getAttachment', { id: el.dataset.id }).then(function (r) {
        el.disabled = false;
        openModal({ title: 'Surat keterangan', wide: true, body: '<img class="attach-full" src="data:' + esc(r.mime) + ';base64,' + r.data + '" alt="Lampiran surat keterangan">' });
      }).catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'review-perm': function (el) {
      var id = el.dataset.id, st = el.dataset.v;
      var p = (D().permissions || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      openModal({
        title: (st === 'APPROVED' ? 'Setujui' : 'Tolak') + ' ' + esc((PERM[p.type] || {}).label || p.type) + ' · ' + esc(cap(p.name)),
        body: '<p class="text-2 mb">' + esc(dateRangeTxt(p)) + (p.reason ? ' · ' + esc(p.reason) : '') + '</p><div class="field"><label>Catatan untuk ' + esc(cap(p.name)) + ' <span class="muted">(opsional)</span></label><input class="input" id="rv-note"></div>',
        foot: '<button class="btn ghost" data-act="modal-close">Batal</button><button class="btn ' + (st === 'APPROVED' ? '' : 'danger') + '" id="rv-ok">' + (st === 'APPROVED' ? 'Setujui' : 'Tolak') + '</button>',
        mount: function (m) {
          $('#rv-ok', m).onclick = function () {
            var b = this; b.disabled = true;
            API.call('reviewPermission', { id: id, status: st, note: $('#rv-note', m).value }).then(function (r) {
              var list = D().permissions;
              for (var i = 0; i < list.length; i++) if (list[i].id === id) list[i] = r.permission;
              closeModal(); toast(st === 'APPROVED' ? 'Izin disetujui ✓' : 'Izin ditolak'); render();
            }).catch(function (e) { b.disabled = false; handleErr(e); });
          };
        }
      });
    },
    'cancel-perm': function (el) {
      confirmBox('Batalkan pengajuan?', 'Pengajuan izin ini akan dihapus.', 'Batalkan', true).then(function (ok) {
        if (!ok) return;
        API.call('cancelPermission', { id: el.dataset.id }).then(function () {
          D().permissions = (D().permissions || []).filter(function (x) { return x.id !== el.dataset.id; });
          toast('Pengajuan dibatalkan.'); render();
        }).catch(handleErr);
      });
    },
    'edit-att': function (el) { attEditModal(el.dataset.name); },
    'save-att': function (el) {
      var f = formData($('#att-form'));
      var name = el.dataset.name || f.name;
      if (!f.in) return toast('Jam masuk wajib diisi.', 'error');
      if (f.out && f.out < f.in) return toast('Jam pulang tidak boleh sebelum jam masuk.', 'error');
      if (f.otFor && !f.otBy) return toast('Isi lembur atas perintah siapa.', 'error');
      el.disabled = true;
      API.call('setAttendance', { record: { name: name, date: f.date, in: f.in, out: f.out, otFor: f.otFor, otBy: f.otBy, notes: f.notes } }).then(function (r) {
        upsertAtt(r.record); closeModal(); toast('Presensi disimpan ✓'); render();
      }).catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'del-att': function (el) {
      var f = formData($('#att-form'));
      confirmBox('Hapus presensi?', 'Data presensi ' + esc(cap(el.dataset.name)) + ' tanggal ' + esc(fmtDate(f.date)) + ' akan dihapus.', 'Hapus', true).then(function (ok) {
        if (!ok) return;
        API.call('setAttendance', { record: { name: el.dataset.name, date: f.date, remove: true } }).then(function () {
          D().attendance = (D().attendance || []).filter(function (a) { return !(a.name === el.dataset.name && a.date === f.date); });
          toast('Presensi dihapus.'); render();
        }).catch(handleErr);
      });
    },
    'toggle-pin': function (el) {
      var i = $('#pin-input'); if (!i) return;
      i.type = i.type === 'password' ? 'text' : 'password';
      el.setAttribute('aria-label', i.type === 'password' ? 'Tampilkan PIN' : 'Sembunyikan PIN');
      i.focus();
    },
    'edit-pay': function (el) { payModal(el.dataset.row); },
    'save-pay': function (el) {
      var f = formData($('#pay-form'));
      if (!String(f.name || '').trim()) return toast('Nama / keterangan wajib diisi.', 'error');
      if (!parseMoney(f.amount)) return toast('Nominal wajib diisi.', 'error');
      if (!(+f.day >= 1 && +f.day <= 31)) return toast('Tanggal harus 1–31.', 'error');
      el.disabled = true;
      API.call('savePayrollItem', { item: { row: f.row, name: f.name, category: f.category, amount: parseMoney(f.amount), day: +f.day, active: f.active, notes: f.notes } }).then(function (res) {
        if (D().admin) D().admin.payroll = res.payroll;
        closeModal(); toast('Tersimpan ke sheet PAYROLL ✓'); render();
      }).catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'del-pay': function (el) {
      var x = payrollAll().filter(function (p) { return p.source === 'PAYROLL' && String(p.row) === el.dataset.row; })[0];
      if (!x) return;
      confirmBox('Hapus ' + (x.category === 'BIAYA' ? x.name : cap(x.name)) + '?', 'Baris ini akan dihapus dari sheet PAYROLL dan tidak lagi diingatkan.', 'Hapus', true).then(function (ok) {
        if (!ok) return;
        API.call('deletePayrollItem', { row: x.row, name: x.name }).then(function (res) {
          if (D().admin) D().admin.payroll = res.payroll;
          toast('Dihapus.'); render();
        }).catch(handleErr);
      });
    },
    'test-reminder': function (el) {
      el.disabled = true;
      API.call('sendReminderTest').then(function (r) { el.disabled = false; toast('Email tes terkirim ke ' + r.to.join(', ') + ' ✓'); })
        .catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'enable-notif': function () {
      if (!notifSupported()) return toast('Browser ini tidak mendukung notifikasi.', 'error');
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          showDeviceNotification('Notifikasi aktif ✓', 'Kamu akan diingatkan H-' + reminderDays() + ' sebelum setiap tanggal gajian saat membuka aplikasi.', 'notif-test');
          toast('Notifikasi aktif di perangkat ini ✓');
        } else toast('Izin notifikasi tidak diberikan.', 'error');
        render();
      });
    },
    'save-channel': function (el) {
      var f = formData($('#ch-form'));
      if (!String(f.name || '').trim()) return toast('Nama channel wajib diisi.', 'error');
      var key = el.dataset.key;
      el.disabled = true;
      var p;
      if (key) {
        var c = channelByKey(key);
        p = API.call('updateChannel', { channel: { row: c.row, key: c.key, fields: f } });
      } else p = API.call('addChannel', { channel: f });
      p.then(function () {
        closeModal(); toast('Tersimpan ke spreadsheet ✓');
        if (key && f.name.trim() !== key) go('channels');
        loadData();
      }).catch(function (e) { el.disabled = false; handleErr(e); });
    },
    'save-config': function (el) {
      var f = formData($('#cfg-form'));
      if (!f.wd || !f.wd.length) return toast('Pilih minimal 1 hari kerja.', 'error');
      var conf = {
        COMPANY_NAME: f.COMPANY_NAME, WORK_DAYS: f.wd.join(','), TARGET_PERIOD: f.TARGET_PERIOD, WEIGHT_OUTPUT: f.WEIGHT_OUTPUT,
        WEIGHT_DISCIPLINE: f.WEIGHT_DISCIPLINE, BACKDATE_DAYS: f.BACKDATE_DAYS, EMPLOYEE_SEE_ALL: f.EMPLOYEE_SEE_ALL ? 'TRUE' : 'FALSE',
        SYNC_CURRENT_RESULT: f.SYNC_CURRENT_RESULT ? 'TRUE' : 'FALSE', YT_SYNC_HOURS: f.YT_SYNC_HOURS, YT_MAX_VIDEOS: f.YT_MAX_VIDEOS, TIMEZONE: f.TIMEZONE
      };
      if (f.WORK_START !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(f.WORK_START) || !/^\d{2}:\d{2}$/.test(f.WORK_END) || f.WORK_END <= f.WORK_START) return toast('Jam masuk/pulang tidak valid.', 'error');
        conf.WORK_START = f.WORK_START; conf.WORK_END = f.WORK_END; conf.LATE_GRACE_MIN = f.LATE_GRACE_MIN; conf.LATE_FINE = f.LATE_FINE;
        conf.ATTENDANCE_LATE_SCORE = f.ATTENDANCE_LATE_SCORE; conf.WEIGHT_ATTENDANCE = f.WEIGHT_ATTENDANCE; conf.ATTENDANCE_START = f.ATTENDANCE_START;
      }
      if (f.REMINDER_DAYS_BEFORE !== undefined) {
        var bad = String(f.REMINDER_EMAILS || '').split(/[,;\s]+/).filter(function (x) { return x && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
        if (bad.length) return toast('Email tidak valid: ' + bad.join(', '), 'error');
        conf.REMINDER_EMAILS = f.REMINDER_EMAILS; conf.REMINDER_DAYS_BEFORE = f.REMINDER_DAYS_BEFORE; conf.REMINDER_HOUR = f.REMINDER_HOUR;
      }
      el.disabled = true;
      API.call('saveConfig', { config: conf }).then(function () { toast('Pengaturan disimpan ✓'); loadData(); })
        .catch(function (e) { el.disabled = false; handleErr(e); });
    }
  };

  var CHANGE = {
    'rep-who': function (el) { S.rep.who = el.value; render(); },
    'kpi-from': function (el) { S.kpi.from = el.value; if (!S.kpi.to) S.kpi.to = today(); render(); },
    'kpi-to': function (el) { S.kpi.to = el.value; if (!S.kpi.from) S.kpi.from = KPI.monthStart(today()); render(); },
    'ch-sort': function (el) { S.ch.sort = el.value; render(); },
    'att-month': function (el) { S.attMonth = el.value; render(); },
    'recap-month': function (el) { S.recapMonth = el.value; render(); },
    'att-date': function (el) { S.attDate = el.value || today(); render(); },
    'ch-q': function (el) { S.ch.q = el.value; var pos = el.selectionStart; render(); var i = $('[data-change="ch-q"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { } } }
  };

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var fn = ACT[el.dataset.act];
      if (fn) { if (el.tagName === 'BUTTON' || el.dataset.act === 'admin-tab') e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset.f && S.form) { S.form[el.dataset.f] = el.value; S.dirty = true; }
      if (el.dataset.pf && S.pf) { S.pf[el.dataset.pf] = el.value; S.dirty = true; }
      if (el.dataset.change === 'ch-q') { clearTimeout(S._qT); S._qT = setTimeout(function () { CHANGE['ch-q'](el); }, 250); }
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset.f && S.form) {
        S.form[el.dataset.f] = el.value; S.dirty = true;
        if (el.dataset.f === 'employee') { S.form.channel = ''; render(); }
        if (el.dataset.f === 'channel' || el.dataset.f === 'date') render();
      }
      if (el.dataset.pf && S.pf) {
        S.pf[el.dataset.pf] = el.value; S.dirty = true;
        if (el.dataset.pf === 'from' && S.pf.to < S.pf.from) { S.pf.to = S.pf.from; render(); }
        if (el.dataset.pf === 'name') render();
      }
      if (el.id === 'pf-file' && el.files && el.files[0]) {
        toast('Memproses foto…');
        compressImage(el.files[0]).then(function (a) { S.pf.attachment = a; S.dirty = true; render(); })
          .catch(function (e) { toast(e.message, 'error'); el.value = ''; });
      }
      if (el.dataset.change && el.dataset.change !== 'ch-q' && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
    });
    document.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      var kind = form.dataset.form;
      var f = formData(form);
      if (kind === 'login') {
        var btn = $('#login-btn'), errBox = $('#login-error');
        var pin = String(f.pin || '');
        try { pin = pin.normalize('NFKC'); } catch (e2) { }
        pin = pin.replace(/[^0-9]/g, '');
        if (errBox) errBox.classList.add('hidden');
        if (!pin) { if (errBox) { errBox.textContent = 'PIN hanya berisi angka.'; errBox.classList.remove('hidden'); } return; }
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Masuk…';
        API.call('login', { name: String(f.name || '').trim(), pin: pin }).then(function (res) {
          S.token = res.token; S.user = res.user;
          Store.set('token', res.token); Store.setJSON('user', res.user);
          S.data = null; S.form = null;
          location.hash = '#/home';
          render(); loadData(); loadYT(true);
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = 'Masuk';
          if (errBox) { errBox.textContent = e.message; errBox.classList.remove('hidden'); } else toast(e.message, 'error');
        });
      } else if (kind === 'report') {
        submitReport(form);
      } else if (kind === 'perm') {
        var pf = S.pf, sb = $('#pf-submit');
        if (!pf.from) return toast('Isi tanggal.', 'error');
        if (String(pf.reason || '').trim().length < 3) return toast('Tulis alasan/keterangan izin.', 'error');
        sb.disabled = true; sb.innerHTML = '<span class="spinner"></span> Mengirim…';
        var multi = pf.type === 'TIDAK_MASUK' || pf.type === 'SAKIT' || pf.type === 'CUTI';
        API.call('submitPermission', { permission: {
          name: pf.name || '', type: pf.type, from: pf.from, to: multi ? (pf.to || pf.from) : pf.from, time: multi ? '' : pf.time, reason: pf.reason,
          attachment: pf.type === 'SAKIT' && pf.attachment ? { mime: pf.attachment.mime, data: pf.attachment.data } : null
        } }).then(function (r) {
          (D().permissions = D().permissions || []).push(r.permission);
          S.pf = null; S.dirty = false;
          toast(r.permission.status === 'APPROVED' ? 'Izin tercatat & disetujui ✓' : 'Pengajuan terkirim ✓ Menunggu persetujuan manager');
          render();
        }).catch(function (e) { sb.disabled = false; sb.textContent = 'Coba lagi'; handleErr(e); });
      } else if (kind === 'pin') {
        API.call('changePin', { oldPin: f.old, newPin: f.new }).then(function (res) {
          S.token = res.token; Store.set('token', res.token); form.reset(); toast('PIN berhasil diganti ✓');
        }).catch(handleErr);
      } else if (kind === 'server') {
        var u = String(f.url || '').trim();
        if (u && !/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return toast('URL harus dari script.google.com', 'error');
        Store.set('apiUrl', u || null); Store.set('demo', null); S.publicInfo = null;
        toast('Server disimpan.');
        if (S.token) logout(true); else render();
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('hashchange', function () { closeModal(); render(); window.scrollTo(0, 0); });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; if (canRerender()) render(); });
    window.addEventListener('appinstalled', function () { S.installEvt = null; closeModal(); toast('Aplikasi terpasang ✓ Cari "KPI Tracker" di Start Menu / layar utama.'); render(); });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (theme() === 'system' && canRerender()) render(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && S.token && Date.now() - (S._lastPoll || 0) > 20000) { S._lastPoll = Date.now(); loadData(true); }
    });
  }

  /* ---------------- START ---------------- */
  function start() {
    setInterval(function () {
      var els = document.querySelectorAll('[data-clock]');
      if (!els.length || !S.data) return;
      var t = timeInTz(serverNow());
      for (var i = 0; i < els.length; i++) els[i].textContent = t;
      if (t.slice(3) === '00:00' && canRerender()) render();
    }, 1000);
    indexYT();
    bindEvents();
    render();
    Updater.init();
    if (S.token) { loadData(!!S.data); loadYT(true); }
    var every = Math.max(20, Number((window.APP_CONFIG || {}).REFRESH_SECONDS) || 60) * 1000;
    setInterval(function () {
      if (document.visibilityState !== 'visible' || !S.token) return;
      S._lastPoll = Date.now();
      loadData(true);
    }, every);
    setInterval(function () { if (document.visibilityState === 'visible' && S.token) loadYT(true); }, 10 * 60 * 1000);
  }
  start();
})();
