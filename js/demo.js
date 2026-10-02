/*
 * BACKEND DEMO — meniru backend Apps Script dengan data FIKTIF,
 * tersimpan di browser saja. Dipakai untuk mencoba tampilan sebelum
 * spreadsheet terhubung. Login demo: OWNER / 1234 (admin), RINA / 1111 (karyawan).
 */
var Demo = (function () {
  var KEY = 'demoDB_v4';
  var NAMES = { DEV: 'DEV CHANNEL', STAFF: 'STAFF CHANNEL', CLIENT: 'CLIENT CHANNEL' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function div(type) { var t = String(type).toUpperCase(); return /DEV/.test(t) ? 'DEV' : /STAFF/.test(t) ? 'STAFF' : /CLIENT/.test(t) ? 'CLIENT' : 'OTHER'; }

  function build() {
    var r = rng(7), t = today();
    var employees = [
      { name: 'OWNER', role: 'ADMIN', pin: '1234', active: true, notes: 'Manager (demo)', position: 'MANAGER' },
      { name: 'PAK BOS', role: 'EMPLOYEE', pin: '', active: true, notes: 'Bos (demo, tanpa akun)', position: 'BOSS' },
      { name: 'RINA', role: 'EMPLOYEE', pin: '1111', active: true, notes: '', position: 'STAFF' },
      { name: 'BAYU', role: 'EMPLOYEE', pin: '2222', active: true, notes: '' },
      { name: 'SARI', role: 'EMPLOYEE', pin: '3333', active: true, notes: '' },
      { name: 'DIMAS', role: 'EMPLOYEE', pin: '4444', active: true, notes: '' },
      { name: 'LUTFI', role: 'EMPLOYEE', pin: '5555', active: true, notes: '' },
      { name: 'MAYA', role: 'EMPLOYEE', pin: '6666', active: true, notes: '' }
    ];
    var rows = [
      ['@kuliner.nusantara', 'DEV CHANNEL', 'https://youtube.com/@kuliner.nusantara', 2, 'RINA', 'Rp 3.000.000 (Probation)', '10th every month', 'Target 10 video/orang/hari, dibagi ke channel yang dipegang.'],
      ['@lofi.senja', 'DEV CHANNEL', 'https://youtube.com/@lofi.senja', 2, 'RINA', 'Rp 3.000.000 (Probation)', '10th every month', 'Playlist musik, durasi minimal 60 menit.'],
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
        notes: x[7], employees: [x[4]], salary: x[5], salaryDate: x[6], minDuration: x[0] === '@lofi.senja' ? 60 : 0
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
      employees: employees, channels: channels, reports: reports, attendance: demoAttendance(employees, r, t), permissions: demoPermissions(t),
      config: {
        COMPANY_NAME: 'Studio Demo', TIMEZONE: 'Asia/Jakarta', WORK_DAYS: '1,2,3,4,5', TARGET_PERIOD: 'DAILY',
        WEIGHT_OUTPUT: '80', WEIGHT_DISCIPLINE: '20', SYNC_CURRENT_RESULT: 'TRUE', EMPLOYEE_SEE_ALL: 'TRUE',
        BACKDATE_DAYS: '3', REPORT_DAYS_LOADED: '120', YT_SYNC_HOURS: '3', YT_MAX_VIDEOS: '50',
        REMINDER_DAYS_BEFORE: '5', REMINDER_EMAILS: '', REMINDER_HOUR: '8',
        WORK_START: '09:00', WORK_END: '17:00', LATE_GRACE_MIN: '0', LATE_FINE: '10000', ATTENDANCE_LATE_SCORE: '50', WEIGHT_ATTENDANCE: '20',
        ATTENDANCE_START: KPI.addDays(t, -30)
      },
      lastSync: Date.now() - 42 * 60 * 1000,
      payroll: [
        { name: 'OWNER', category: 'GAJI', amount: 10000000, day: 10, active: true, notes: 'Gaji Manager (demo)' },
        { name: 'Sewa ruang kerja', category: 'BIAYA', amount: 5000000, day: 10, active: true, notes: 'Dibayar setiap bulan' }
      ]
    };
  }

  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0') + ':00'; }
  function demoAttendance(emps, r, t) {
    var out = [], habit = { OWNER: 520, RINA: 530, BAYU: 548, SARI: 528, DIMAS: 552, LUTFI: 525, MAYA: 535 };
    for (var k = 30; k >= 1; k--) {
      var d = KPI.addDays(t, -k);
      if (KPI.dow(d) > 5) continue;
      emps.forEach(function (e) {
        if (!e.pin || e.position === 'BOSS') return;
        if (r() < 0.05) return; // bolos sesekali
        var inMin = (habit[e.name] || 530) + Math.round((r() - 0.5) * 30);
        var outMin = 1020 + Math.round(r() * 40) - 10;
        var ot = r() < 0.12 ? 60 + Math.round(r() * 120) : 0;
        out.push({ date: d, name: e.name, in: hhmm(inMin), out: hhmm(outMin + ot), lateMin: Math.max(0, inMin - 540), otMin: ot,
          otFor: ot ? 'Kejar target upload' : '', otBy: ot ? 'OWNER' : '', early: outMin < 1020 ? 'Urusan keluarga' : '', notes: '', updatedBy: e.name });
      });
    }
    return out;
  }
  function demoPermissions(t) {
    return [
      { id: 'DP1', created: new Date().toISOString(), name: 'SARI', type: 'SAKIT', from: KPI.addDays(t, -6), to: KPI.addDays(t, -5), time: '', reason: 'Demam, sudah ke dokter', hasAttachment: false, status: 'APPROVED', reviewedBy: 'OWNER', reviewNote: 'Cepat sembuh', reviewedAt: new Date().toISOString() },
      { id: 'DP2', created: new Date().toISOString(), name: 'BAYU', type: 'TERLAMBAT', from: t, to: t, time: '10:00', reason: 'Ban motor bocor', hasAttachment: false, status: 'PENDING', reviewedBy: '', reviewNote: '', reviewedAt: '' }
    ];
  }
  function nowJkt() {
    var s2 = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    return { date: s2.slice(0, 10), time: s2.slice(11, 19), min: (+s2.slice(11, 13)) * 60 + (+s2.slice(14, 16)) };
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
      user: { name: u.name, role: u.role, position: u.position || 'STAFF' }, today: t, serverTime: new Date().toISOString(), backendVersion: 'demo',
      config: d.config, channels: d.channels.map(function (c) { return strip(c, admin); }),
      employees: d.employees.filter(function (e) { return seeAll || e.name === u.name || e.role === 'ADMIN' || e.position; }).map(function (e) { return { name: e.name, role: e.role, active: e.active, position: e.position || 'STAFF', login: !!e.pin }; }),
      reports: d.reports.filter(function (r) { return seeAll || r.employee === u.name; }),
      attendance: (d.attendance || []).filter(function (a) { return seeAll || a.name === u.name; }),
      permissions: (d.permissions || []).filter(function (p) { return admin || p.name === u.name || (seeAll && p.status === 'APPROVED'); }).map(function (p) {
        if (admin || p.name === u.name) { var c = Object.assign({}, p); delete c._att; return c; }
        return { id: p.id, name: p.name, type: p.type, from: p.from, to: p.to, status: p.status };
      }),
      ytLastSync: d.lastSync
    };
    if (admin) out.admin = { employees: d.employees.map(function (e) { return Object.assign({}, e, { position: e.position || 'STAFF', login: !!e.pin }); }), spreadsheetUrl: '', configRaw: d.config, payroll: payrollItems(), reminderTo: ['owner@contoh.com'] };
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
    publicInfo: function () { var d = load(); return { company: d.config.COMPANY_NAME, backendVersion: 'demo', employees: d.employees.filter(function (e) { return e.active && e.pin; }).map(function (e) { return e.name; }).sort(), managers: d.employees.filter(function (e) { return e.active && e.position === 'MANAGER'; }).map(function (e) { return e.name; }) }; },
    login: function (b) {
      var e = load().employees.filter(function (x) { return x.name === String(b.name || '').toUpperCase() && x.active; })[0];
      if (!e || !e.pin || e.pin !== String(b.pin)) throw new Error('Nama atau PIN salah.');
      return { token: 'demo.' + e.name, user: { name: e.name, role: e.role, position: e.position || 'STAFF' } };
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
    checkIn: function (b, u) {
      if (u.position === 'BOSS') throw new Error('Akun ini tidak memakai absensi.');
      var d = load(), n = nowJkt(), list = d.attendance = d.attendance || [];
      var ex = list.filter(function (a) { return a.name === u.name && a.date === n.date; })[0];
      var work = KPI.dow(n.date) <= 5;
      if (!ex) { ex = { date: n.date, name: u.name, in: n.time, out: '', lateMin: work ? Math.max(0, n.min - 540) : 0, otMin: 0, otFor: '', otBy: '', early: '', notes: '', updatedBy: u.name }; list.push(ex); save(); }
      var lm = work ? Math.max(0, KPI.toMin(ex.in) - 540) : 0;
      var lp = (d.permissions || []).filter(function (p) { return p.name === u.name && p.type === 'TERLAMBAT' && p.from === n.date && p.status !== 'REJECTED'; })[0];
      return { already: false, record: ex, workday: work, late: lm > 0, lateMin: lm, fine: lm > 0 && !(lp && lp.status === 'APPROVED') ? 10000 : 0, latePermission: lp ? lp.status : null, serverTime: new Date().toISOString() };
    },
    checkOut: function (b, u) {
      var d = load(), n = nowJkt();
      var ex = (d.attendance || []).filter(function (a) { return a.name === u.name && a.date === n.date; })[0];
      if (!ex) throw new Error('Kamu belum presensi masuk hari ini.');
      if (ex.out) return { already: true, record: ex };
      ex.out = n.time;
      if (b.overtime && b.overtime.reason) { ex.otMin = Math.max(0, n.min - Math.max(1020, KPI.toMin(ex.in))); ex.otFor = b.overtime.reason; ex.otBy = b.overtime.by; }
      if (KPI.dow(n.date) <= 5 && n.min < 1020) ex.early = b.earlyNote || '(tanpa keterangan)';
      save(); return { record: ex, overtimeMin: ex.otMin, early: !!ex.early };
    },
    submitPermission: function (b, u) {
      var d = load(), p = b.permission || {};
      if (String(p.reason || '').trim().length < 3) throw new Error('Tuliskan alasan/keterangan izin.');
      var name = u.role === 'ADMIN' && p.name ? p.name : u.name, auto = name !== u.name;
      var rec = { id: 'DP' + Date.now().toString(36), created: new Date().toISOString(), name: name, type: p.type, from: p.from, to: p.to || p.from, time: p.time || '', reason: p.reason,
        hasAttachment: !!(p.attachment && p.attachment.data), _att: p.attachment || null, status: auto ? 'APPROVED' : 'PENDING', reviewedBy: auto ? u.name : '', reviewNote: auto ? 'Diinput oleh admin' : '', reviewedAt: auto ? new Date().toISOString() : '' };
      (d.permissions = d.permissions || []).push(rec);
      try { save(); } catch (e) { }
      var pub = Object.assign({}, rec); delete pub._att;
      return { permission: pub };
    },
    cancelPermission: function (b, u) {
      var d = load(); d.permissions = (d.permissions || []).filter(function (x) { return !(x.id === b.id && (x.name === u.name || u.role === 'ADMIN')); }); save(); return { ok: true };
    },
    getAttachment: function (b) {
      var p = (load().permissions || []).filter(function (x) { return x.id === b.id; })[0];
      if (!p || !p._att) throw new Error('Lampiran tidak ditemukan (demo).');
      return { mime: p._att.mime, name: 'surat.jpg', data: p._att.data };
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
        else if (k === 'minDuration') c.minDuration = Number(f[k]) || 0;
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
      var pin = e.login === false ? '' : String(e.pin || (f && f.pin) || Math.floor(100000 + Math.random() * 900000));
      if (f) { f.role = e.role; f.active = e.active !== false; f.pin = pin; f.position = e.position || 'STAFF'; if (e.notes != null) f.notes = e.notes; }
      else d.employees.push({ name: name, role: e.role || 'EMPLOYEE', pin: pin, active: e.active !== false, notes: e.notes || '', position: e.position || 'STAFF' });
      save(); return { employees: d.employees.map(function (x) { return Object.assign({}, x, { position: x.position || 'STAFF', login: !!x.pin }); }) };
    },
    saveConfig: function (b) { var d = load(); Object.assign(d.config, b.config || {}); save(); return { config: d.config }; },
    syncYouTube: function () { load().lastSync = Date.now(); save(); return ytAll(); },
    savePayrollItem: function (b) {
      var d = load(), it = b.item || {};
      if (!String(it.name || '').trim()) throw new Error('Nama / keterangan wajib diisi.');
      var row = { name: it.category === 'BIAYA' ? String(it.name).trim() : String(it.name).trim().toUpperCase(), category: it.category === 'BIAYA' ? 'BIAYA' : 'GAJI', amount: Number(it.amount) || 0, day: Number(it.day) || 0, active: it.active !== false, notes: it.notes || '' };
      var i = Number(it.row) - 2;
      if (i >= 0 && d.payroll[i]) d.payroll[i] = row; else d.payroll.push(row);
      save(); return { payroll: payrollItems() };
    },
    reviewPermission: function (b, u) {
      var p = (load().permissions || []).filter(function (x) { return x.id === b.id; })[0];
      if (!p) throw new Error('Pengajuan tidak ditemukan.');
      if (p.name === u.name) throw new Error('Izin milikmu sendiri harus disetujui manager lain.');
      p.status = b.status; p.reviewedBy = u.name; p.reviewNote = b.note || ''; p.reviewedAt = new Date().toISOString();
      save(); return { permission: p };
    },
    setAttendance: function (b, u) {
      var d = load(), r = b.record || {}, list = d.attendance = d.attendance || [];
      var i = list.findIndex(function (a) { return a.name === r.name && a.date === r.date; });
      if (r.remove) { if (i >= 0) list.splice(i, 1); save(); return { ok: true }; }
      var rec = { date: r.date, name: r.name, in: (r.in || '') + ':00', out: r.out ? r.out + ':00' : '', lateMin: Math.max(0, KPI.toMin(r.in) - 540), otMin: r.otFor && r.out ? Math.max(0, KPI.toMin(r.out) - 1020) : 0, otFor: r.otFor || '', otBy: r.otBy || '', early: '', notes: r.notes || 'Dikoreksi oleh ' + u.name, updatedBy: u.name };
      if (i >= 0) list[i] = rec; else list.push(rec);
      save(); return { ok: true, record: rec };
    },
    deletePayrollItem: function (b) { var d = load(); d.payroll.splice(Number(b.row) - 2, 1); save(); return { payroll: payrollItems() }; },
    sendReminderTest: function () { return { to: ['owner@contoh.com'], date: '', total: 0, items: 0 }; }
  };
  function payrollItems() {
    var d = load(), people = {}, order = [];
    if (!d.payroll) d.payroll = [];
    var inPay = {};
    d.payroll.forEach(function (x) { if (x.category === 'GAJI') inPay[x.name] = 1; });
    d.channels.forEach(function (c) {
      c.employees.forEach(function (n) {
        if (inPay[n]) return;
        if (!people[n]) { people[n] = { s: [], dt: [] }; order.push(n); }
        if (c.salary && people[n].s.indexOf(c.salary) < 0) people[n].s.push(c.salary);
        if (c.salaryDate && people[n].dt.indexOf(c.salaryDate) < 0) people[n].dt.push(c.salaryDate);
      });
    });
    var out = order.filter(function (n) { return people[n].s.length; }).map(function (n) {
      var m = String(people[n].dt[0] || '').match(/(\d{1,2})/);
      return { source: 'CHANNEL', name: n, category: 'GAJI', amount: Number(String(people[n].s[0]).replace(/\D/g, '')) || 0, label: people[n].s.join(' / '), day: m ? +m[1] : 0, schedule: people[n].dt.join(' / '), active: true, notes: '' };
    });
    d.payroll.forEach(function (x, i) { out.push(Object.assign({ source: 'PAYROLL', row: i + 2, label: '', schedule: 'Tanggal ' + x.day + ' setiap bulan' }, x)); });
    return out;
  }
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
