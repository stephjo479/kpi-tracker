/*
 * BACKEND DEMO — meniru backend Apps Script dengan data FIKTIF,
 * tersimpan di browser saja. Dipakai untuk mencoba tampilan sebelum
 * spreadsheet terhubung. Login demo: OWNER / 1234 (admin), RINA / 1111 (karyawan).
 */
var Demo = (function () {
  var KEY = 'demoDB_v1';
  var NAMES = { DEV: 'DEV CHANNEL', STAFF: 'STAFF CHANNEL', CLIENT: 'CLIENT CHANNEL' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function div(type) { var t = String(type).toUpperCase(); return /DEV/.test(t) ? 'DEV' : /STAFF/.test(t) ? 'STAFF' : /CLIENT/.test(t) ? 'CLIENT' : 'OTHER'; }

  function build() {
    var r = rng(7), t = today();
    var employees = [
      { name: 'OWNER', role: 'ADMIN', pin: '1234', active: true, notes: 'Akun pemilik (demo)' },
      { name: 'RINA', role: 'EMPLOYEE', pin: '1111', active: true, notes: '' },
      { name: 'BAYU', role: 'EMPLOYEE', pin: '2222', active: true, notes: '' },
      { name: 'SARI', role: 'EMPLOYEE', pin: '3333', active: true, notes: '' },
      { name: 'DIMAS', role: 'EMPLOYEE', pin: '4444', active: true, notes: '' },
      { name: 'LUTFI', role: 'EMPLOYEE', pin: '5555', active: true, notes: '' },
      { name: 'MAYA', role: 'EMPLOYEE', pin: '6666', active: true, notes: '' }
    ];
    var rows = [
      ['@kuliner.nusantara', 'DEV CHANNEL', 'https://youtube.com/@kuliner.nusantara', 2, 'RINA', 'Rp 3.000.000 (Probation)', '10th every month', 'Target 10 video/orang/hari, dibagi ke channel yang dipegang.'],
      ['@lofi.senja', 'DEV CHANNEL', 'https://youtube.com/@lofi.senja', 2, 'RINA', 'Rp 3.000.000 (Probation)', '10th every month', ''],
      ['@data.banding', 'DEV CHANNEL', 'https://youtube.com/@data.banding', 2, 'BAYU', 'Rp 3.000.000 (Probation)', '10th every month', ''],
      ['@jalan.jalan.id', 'DEV CHANNEL', 'https://youtube.com/@jalan.jalan.id', 2, 'BAYU', 'Rp 3.000.000 (Probation)', '10th every month', ''],
      ['vlog.harian@contoh.com', 'STAFF CHANNEL', 'https://youtube.com/@vlog.harian', 10, 'SARI', 'Rp 3.200.000', '23rd every month', ''],
      ['film.pendek@contoh.com', 'STAFF CHANNEL', 'https://youtube.com/@film.pendek', 10, 'DIMAS', 'Rp 3.200.000', '23rd every month', ''],
      ['shorts.lucu@contoh.com', 'STAFF CHANNEL', 'https://youtube.com/@shorts.lucu', 10, 'LUTFI', 'Rp 3.200.000', '10th every month', ''],
      ['@golf.daily (Client)', 'CLIENT CHANNEL', 'https://youtube.com/@golf.daily', 2, 'MAYA', 'Rp 3.500.000', '10th every month', '2 item: 1 video long-form, 1 thumbnail.'],
      ['Drama Recap (Client)', 'CLIENT CHANNEL', '', 5, 'MAYA', 'Rp 3.500.000', '10th every month', ''],
      ['Variety Show (Client)', 'CLIENT CHANNEL', '', 5, 'MAYA', 'Rp 3.500.000', '10th every month', '']
    ];
    var channels = rows.map(function (x, i) {
      return {
        row: i + 3, key: x[0], name: x[0], type: x[1], division: div(x[1]), link: x[2],
        linkNote: x[2] ? '' : '(Klien belum membagikan link channel)', indicator: 'PRODUCTION', target: x[3], current: 0,
        notes: x[7], employees: [x[4]], salary: x[5], salaryDate: x[6]
      };
    });
    var reports = [];
    var skill = { RINA: 0.98, BAYU: 0.82, SARI: 0.9, DIMAS: 0.7, LUTFI: 1.02, MAYA: 0.93 };
    for (var k = 45; k >= 0; k--) {
      var d = KPI.addDays(t, -k);
      if (KPI.dow(d) > 5) continue;
      channels.forEach(function (c) {
        var e = c.employees[0];
        if (k === 0 && r() < 0.45) return;
        if (r() > 0.9 * Math.min(1, skill[e] + 0.05)) return;
        var q = Math.max(0, Math.round(c.target * (skill[e] - 0.15 + r() * 0.3)));
        reports.push({
          id: 'D' + reports.length, ts: d + 'T10:00:00Z', date: d, employee: e, channel: c.key, division: c.division,
          task: c.indicator, qty: q, links: q ? 'https://youtube.com/shorts/demo' + reports.length : '', notes: '', updatedBy: e
        });
      });
    }
    return {
      employees: employees, channels: channels, reports: reports,
      config: {
        COMPANY_NAME: 'Studio Demo', TIMEZONE: 'Asia/Jakarta', WORK_DAYS: '1,2,3,4,5', TARGET_PERIOD: 'DAILY',
        WEIGHT_OUTPUT: '80', WEIGHT_DISCIPLINE: '20', SYNC_CURRENT_RESULT: 'TRUE', EMPLOYEE_SEE_ALL: 'TRUE',
        BACKDATE_DAYS: '3', REPORT_DAYS_LOADED: '120', YT_SYNC_HOURS: '3', YT_MAX_VIDEOS: '50'
      },
      lastSync: Date.now() - 42 * 60 * 1000
    };
  }

  var db = null;
  function load() {
    if (db) return db;
    db = Store.getJSON(KEY);
    if (!db || db.builtFor !== today()) {
      var fresh = build();
      if (db && db.employees) { fresh.employees = db.employees; fresh.config = db.config; }
      db = fresh;
      db.builtFor = today();
      save();
    }
    return db;
  }
  function save() { Store.setJSON(KEY, db); }
  function reset() { Store.set(KEY, null); db = null; }

  function userFrom(token) {
    var name = String(token || '').replace(/^demo\./, '');
    return load().employees.filter(function (e) { return e.name === name && e.active; })[0] || null;
  }

  /* ---------- YouTube palsu tapi konsisten ---------- */
  var TITLES = ['Perbandingan Gedung Tertinggi di Dunia', 'Resep Rendang 3 Jam', 'Lofi Hujan Sore untuk Belajar', 'Negara Terkaya 2026',
    'Jalan-jalan ke Labuan Bajo', 'Vlog Pagi di Pasar', 'Film Pendek: Pulang', 'Kucing vs Timun', 'Tips Golf untuk Pemula',
    'Top 10 Kota Terpadat', 'Musik Santai Malam', 'Street Food Bandung', 'Tutorial Ayunan Golf', 'Shorts: Prank Kantor',
    'Sejarah Uang Rupiah', 'Ranking Bandara Terbaik', 'Ngopi di Kaki Gunung', 'Behind the Scene Syuting'];
  function ytFor(c, idx) {
    if (!c.link) return null;
    var r = rng(hash(c.key));
    var id = 'UCdemo' + (1000 + idx);
    var vids = [];
    var nv = 18 + Math.floor(r() * 10);
    var size = 0.4 + r() * 3;
    for (var i = 0; i < nv; i++) {
      var age = Math.floor(r() * 75);
      var final = Math.round((800 + r() * r() * 90000) * size);
      vids.push({ id: 'v' + idx + '_' + i, ch: id, t: TITLES[Math.floor(r() * TITLES.length)] + (r() > 0.5 ? ' #shorts' : ''), age: age, final: final, tau: 2 + r() * 10, d: r() > 0.5 ? 40 + Math.floor(r() * 20) : 300 + Math.floor(r() * 900), lr: 0.02 + r() * 0.05 });
    }
    // video terbaru hari ini/kemarin agar terlihat "video baru"
    vids.push({ id: 'v' + idx + '_new', ch: id, t: TITLES[idx % TITLES.length] + ' (baru)', age: 0, final: Math.round(5000 * size), tau: 3, d: 55, lr: 0.05 });
    return { id: id, size: size, vids: vids, title: c.name.replace(/^@/, '').replace(/@.*$/, '').replace(/[._]/g, ' ').replace(/\(Client\)/, '').trim().replace(/\b\w/g, function (m) { return m.toUpperCase(); }), subsBase: Math.round(500 + r() * 40000 * size) };
  }
  function viewsAt(v, dayOffset) {
    var age = v.age - dayOffset; // umur video pada hari tsb
    if (age < 0) return null;
    return Math.round(v.final * (1 - Math.exp(-(age + 0.35) / v.tau)));
  }
  function ytAll() {
    var d = load(), t = today();
    var out = { lastSync: d.lastSync, prevDate: KPI.addDays(t, -1), channels: {}, videos: [] };
    d.channels.forEach(function (c, i) {
      var y = ytFor(c, i);
      if (!y) { out.channels[c.key] = { id: '', status: 'NO_LINK' }; return; }
      var tot = 0, totPrev = 0;
      y.vids.forEach(function (v) {
        var now = viewsAt(v, 0), prev = viewsAt(v, 1);
        tot += now || 0; totPrev += prev || 0;
        out.videos.push({
          id: v.id, ch: y.id, t: v.t, p: new Date(Date.now() - v.age * 864e5 - 3 * 3600e3).toISOString(), th: '',
          d: v.d, v: now, l: Math.round(now * v.lr), c: Math.round(now * v.lr / 8), dv: prev == null ? now : now - prev
        });
      });
      var subs = y.subsBase + Math.round(tot / 400), subsPrev = y.subsBase + Math.round(totPrev / 400);
      out.channels[c.key] = {
        id: y.id, title: y.title, handle: '@' + y.title.toLowerCase().replace(/\s+/g, ''), thumb: '', subs: subs, views: tot,
        videos: y.vids.length, updated: new Date(d.lastSync).toISOString(), status: 'OK', dSubs: subs - subsPrev, dViews: tot - totPrev
      };
    });
    return out;
  }
  function history(channelId, days) {
    var d = load(), out = { channelId: channelId, channel: [], videos: {} }, t = today();
    d.channels.forEach(function (c, i) {
      var y = ytFor(c, i);
      if (!y || y.id !== channelId) return;
      for (var k = days - 1; k >= 0; k--) {
        var date = KPI.addDays(t, -k), tot = 0, n = 0;
        y.vids.forEach(function (v) {
          var x = viewsAt(v, k);
          if (x != null) { tot += x; n++; (out.videos[v.id] = out.videos[v.id] || []).push([date, x]); }
        });
        out.channel.push({ d: date, subs: y.subsBase + Math.round(tot / 400), views: tot, videos: n });
      }
    });
    return out;
  }

  /* ---------- aksi ---------- */
  function strip(c, admin) {
    var o = JSON.parse(JSON.stringify(c));
    if (!admin) { delete o.salary; delete o.salaryDate; }
    return o;
  }
  function getData(u) {
    var d = load(), admin = u.role === 'ADMIN';
    var seeAll = admin || /true/i.test(d.config.EMPLOYEE_SEE_ALL);
    var t = today();
    d.channels.forEach(function (c) {
      c.current = d.reports.filter(function (r) { return r.channel === c.key && r.date === t; }).reduce(function (s, r) { return s + r.qty; }, 0);
    });
    var out = {
      user: { name: u.name, role: u.role }, today: t, serverTime: new Date().toISOString(), backendVersion: 'demo',
      config: d.config, channels: d.channels.map(function (c) { return strip(c, admin); }),
      employees: d.employees.filter(function (e) { return seeAll || e.name === u.name || e.role === 'ADMIN'; }).map(function (e) { return { name: e.name, role: e.role, active: e.active }; }),
      reports: d.reports.filter(function (r) { return seeAll || r.employee === u.name; }),
      ytLastSync: d.lastSync
    };
    if (admin) out.admin = { employees: JSON.parse(JSON.stringify(d.employees)), spreadsheetUrl: '', configRaw: d.config };
    return out;
  }
  function clean(r, u) {
    var d = load(), t = today(), admin = u.role === 'ADMIN';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) throw new Error('Tanggal tidak valid.');
    if (r.date > t) throw new Error('Tidak bisa melapor untuk tanggal yang akan datang.');
    var back = Number(d.config.BACKDATE_DAYS) || 3;
    if (!admin && r.date < KPI.addDays(t, -back)) throw new Error('Laporan hanya bisa diisi/diubah maksimal ' + back + ' hari ke belakang. Hubungi admin.');
    var emp = admin && r.employee ? r.employee : u.name;
    var c = d.channels.filter(function (x) { return x.key === r.channel; })[0];
    if (!c) throw new Error('Channel tidak ditemukan.');
    if (!admin && c.employees.indexOf(emp) < 0) throw new Error('Kamu tidak terdaftar di channel ini.');
    var q = Number(r.qty);
    if (!isFinite(q) || q < 0) throw new Error('Jumlah tidak valid.');
    return { date: r.date, employee: emp, channel: c.key, division: c.division, task: r.task || c.indicator, qty: q, links: r.links || '', notes: r.notes || '' };
  }
  function canEdit(rep, u) {
    if (u.role === 'ADMIN') return;
    if (rep.employee !== u.name) throw new Error('Kamu hanya bisa mengubah laporanmu sendiri.');
    var back = Number(load().config.BACKDATE_DAYS) || 3;
    if (rep.date < KPI.addDays(today(), -back)) throw new Error('Laporan lebih dari ' + back + ' hari tidak bisa diubah. Hubungi admin.');
  }

  var A = {
    ping: function () { return { backendVersion: 'demo' }; },
    publicInfo: function () { var d = load(); return { company: d.config.COMPANY_NAME, backendVersion: 'demo', employees: d.employees.filter(function (e) { return e.active; }).map(function (e) { return e.name; }).sort() }; },
    login: function (b) {
      var e = load().employees.filter(function (x) { return x.name === String(b.name || '').toUpperCase() && x.active; })[0];
      if (!e || e.pin !== String(b.pin)) throw new Error('Nama atau PIN salah.');
      return { token: 'demo.' + e.name, user: { name: e.name, role: e.role } };
    }
  };
  var AUTH = {
    getData: function (b, u) { return getData(u); },
    getYouTube: function () { return ytAll(); },
    getHistory: function (b) { return history(b.channelId, Number(b.days) || 30); },
    submitReport: function (b, u) {
      var x = clean(b.report || {}, u);
      x.id = 'D' + Date.now().toString(36); x.ts = new Date().toISOString(); x.updatedBy = u.name;
      load().reports.push(x); save(); return { id: x.id, report: x };
    },
    updateReport: function (b, u) {
      var d = load(), rep = d.reports.filter(function (x) { return x.id === b.report.id; })[0];
      if (!rep) throw new Error('Laporan tidak ditemukan.');
      canEdit(rep, u);
      if (u.role !== 'ADMIN') b.report.employee = rep.employee;
      Object.assign(rep, clean(b.report, u), { updatedBy: u.name }); save(); return { ok: true };
    },
    deleteReport: function (b, u) {
      var d = load(), i = d.reports.findIndex(function (x) { return x.id === b.id; });
      if (i < 0) throw new Error('Laporan tidak ditemukan.');
      canEdit(d.reports[i], u);
      d.reports.splice(i, 1); save(); return { ok: true };
    },
    changePin: function (b, u) {
      if (String(b.oldPin) !== u.pin) throw new Error('PIN lama salah.');
      if (!/^\d{4,8}$/.test(String(b.newPin))) throw new Error('PIN baru harus 4–8 digit angka.');
      u.pin = String(b.newPin); save(); return { token: 'demo.' + u.name };
    }
  };
  var ADMIN = {
    updateChannel: function (b) {
      var d = load(), c = d.channels.filter(function (x) { return x.row === b.channel.row && x.key === b.channel.key; })[0];
      if (!c) throw new Error('Channel tidak ditemukan.');
      var f = b.channel.fields || {};
      Object.keys(f).forEach(function (k) {
        if (k === 'employees') c.employees = (Array.isArray(f[k]) ? f[k] : String(f[k]).split(/[,&]/)).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
        else if (k === 'target') c.target = Number(f[k]) || 0;
        else c[k] = f[k];
      });
      if (f.name) { var old = c.key; c.key = c.name = f.name.trim(); d.reports.forEach(function (r) { if (r.channel === old) r.channel = c.key; }); }
      if (f.type) c.division = div(f.type);
      if (f.link !== undefined) { c.linkNote = c.link ? '' : c.linkNote; }
      ensureEmployees(); save(); return { ok: true };
    },
    addChannel: function (b) {
      var d = load(), c = b.channel;
      if (!String(c.name || '').trim()) throw new Error('Nama channel wajib diisi.');
      d.channels.push({
        row: d.channels.length + 3, key: c.name.trim(), name: c.name.trim(), type: c.type, division: div(c.type), link: c.link || '', linkNote: '',
        indicator: c.indicator || 'PRODUCTION', target: Number(c.target) || 0, current: 0, notes: c.notes || '',
        employees: String(c.employees || '').split(/[,&]/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean),
        salary: c.salary || '', salaryDate: c.salaryDate || ''
      });
      ensureEmployees(); save(); return { ok: true };
    },
    saveEmployee: function (b) {
      var d = load(), e = b.employee, name = String(e.name || '').trim().toUpperCase();
      if (!name) throw new Error('Nama wajib diisi.');
      var f = d.employees.filter(function (x) { return x.name === name; })[0];
      if (f) { f.role = e.role; f.active = e.active !== false; if (e.pin) f.pin = String(e.pin); if (e.notes != null) f.notes = e.notes; }
      else d.employees.push({ name: name, role: e.role || 'EMPLOYEE', pin: String(e.pin || Math.floor(100000 + Math.random() * 900000)), active: e.active !== false, notes: e.notes || '' });
      save(); return { employees: JSON.parse(JSON.stringify(d.employees)) };
    },
    saveConfig: function (b) { var d = load(); Object.assign(d.config, b.config || {}); save(); return { config: d.config }; },
    syncYouTube: function () { load().lastSync = Date.now(); save(); return ytAll(); }
  };
  function ensureEmployees() {
    var d = load(), have = {};
    d.employees.forEach(function (e) { have[e.name] = 1; });
    d.channels.forEach(function (c) { c.employees.forEach(function (n) { if (!have[n]) { have[n] = 1; d.employees.push({ name: n, role: 'EMPLOYEE', pin: String(Math.floor(100000 + Math.random() * 900000)), active: true, notes: 'Ditambahkan otomatis' }); } }); });
  }

  function handle(body) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          var a = body.action;
          if (A[a]) return resolve(A[a](body));
          var u = userFrom(body.token);
          if (!u) { var e = new Error('Sesi berakhir, silakan login lagi.'); e.code = 'AUTH'; throw e; }
          if (ADMIN[a]) { if (u.role !== 'ADMIN') throw new Error('Hanya admin.'); return resolve(ADMIN[a](body, u)); }
          if (AUTH[a]) return resolve(AUTH[a](body, u));
          throw new Error('Aksi tidak dikenal: ' + a);
        } catch (err) { reject(err); }
      }, 180 + Math.random() * 220);
    });
  }

  return { handle: handle, reset: reset };
})();
