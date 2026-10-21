/*
 * KPI ENGINE (shared)
 * ------------------------------------------------------------------
 * File ini dipakai di DUA tempat dengan isi yang SAMA PERSIS:
 *   - Aplikasi web  : js/kpi.js
 *   - Apps Script   : backend/Kpi.gs
 * Kalau mengubah rumus KPI, ubah di sini lalu salin juga ke Kpi.gs.
 *
 * Rumus:
 *   Hari dihitung     = hari kerja yang sudah lewat, DIKURANGI hari izin/sakit/cuti yang disetujui
 *   Target periode    = Σ (target harian channel × hari dihitung)
 *   Capaian output    = total jumlah di laporan ÷ target periode
 *   Disiplin laporan  = hari dihitung yang ada laporannya (laporan output ATAU laporan presensi pulang) ÷ hari dihitung
 *   Kehadiran         = (tepat waktu × 100% + terlambat × nilai terlambat + alpa × 0%) ÷ hari wajib hadir
 *   Skor KPI          = (min(capaian,100%) × bobot output + disiplin × bobot laporan + kehadiran × bobot kehadiran) ÷ total bobot
 *   Manager & Bos (kolom POSITION = MANAGER / BOSS) tidak masuk peringkat KPI (tetapi tetap ikut absensi, kecuali Bos).
 *
 *   Channel ber-KPI MODE = PROGRESS (video long-form, mis. Kemal):
 *     1 "unit kerja" = 1 hari kerja normal. Long-form = LONGFORM_DAYS unit per video (awal 3), paket shorts = SHORTS_DAYS unit (awal 1).
 *     Unit didapat = kenaikan progres (%) × unit proyek. Target = 1 unit per hari kerja SELAMA ada proyek aktif dari client.
 *     Capaian = unit didapat ÷ target. Hari tanpa proyek (tidak ada permintaan client) tidak dihitung.
 *   Data sebelum GO_LIVE_DATE (masa uji coba) tidak dihitung.
 *
 *   PEMBAGIAN TUGAS DI DALAM CHANNEL (1.8) — satu channel bisa dipegang beberapa orang dengan pekerjaan berbeda
 *   (mis. Ava = Shorts, Agista = AI Drama long-form). Tiap orang punya jenis video, cara hitung (COUNT / PROGRESS)
 *   dan target sendiri (sheet TIM CHANNEL). Tanpa pengaturan: semua ikut KPI MODE channel & TARGET dibagi rata.
 *   Orang ber-mode PROGRESS mendapat target 1 unit per hari kerja selama punya proyek aktif (dibagi rata
 *   bila ia punya proyek aktif di beberapa channel pada hari yang sama).
 *
 *   RIWAYAT PENUGASAN (1.10) — setiap baris pembagian tugas boleh punya MULAI / SELESAI. Target hanya dihitung pada hari
 *   di dalam rentang itu. Orang yang sudah dilepas dari channel (c.pastMembers) tetap diberi target sampai tanggal SELESAI,
 *   sehingga KPI hari-hari sebelum perubahan tidak ikut berubah.
 *
 *   TUGAS KHUSUS DI LUAR CHANNEL (1.9) — dibuat admin per karyawan (sheet TUGAS KARYAWAN), mis. riset:
 *     - Cara ukur PROGRESS: 100% dibagi rata ke hari kerja dari MULAI s/d DEADLINE. Capaian = kenaikan progres ÷ progres yang diharapkan.
 *     - Cara ukur COUNT   : target jumlah per hari kerja (mulai s/d deadline / selesai). Ikut dihitung seperti output channel.
 *     Tugas yang dihentikan / selesai tidak memberi target lagi sesudah tanggal berakhirnya.
 *
 *   KPI HASIL CHANNEL (outcome) — hanya untuk channel yang diberi TARGET VIEWS / BULAN dan/atau TARGET SUBS / BULAN:
 *     Pertumbuhan = selisih total views/subscriber channel (snapshot harian YouTube) selama periode.
 *     Target periode = target bulanan × jumlah hari yang tercakup ÷ jumlah hari dalam bulan.
 *     Capaian hasil = rata-rata (views ÷ target views, subscriber ÷ target subscriber), maks. 150% per channel.
 *     Skor KPI ditambah: min(capaian hasil,100%) × WEIGHT_OUTCOME. Karyawan tanpa channel bertarget tidak terpengaruh.
 */
var KPI = (function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(d) { var p = String(d).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmt(dt) { return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()); }
  function addDays(d, n) { var x = parse(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); }
  /** 1 = Senin ... 7 = Minggu */
  function dow(d) { var w = parse(d).getUTCDay(); return w === 0 ? 7 : w; }
  function eachDay(from, to, fn) { for (var d = from; d <= to; d = addDays(d, 1)) fn(d); }
  function monthStart(d) { return d.slice(0, 8) + '01'; }
  function monthEnd(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return fmt(new Date(Date.UTC(y, m, 0))); }
  /** '09:05' / '9.05' / '09:05:33' → menit sejak 00:00 */
  function toMin(t) { var m = String(t == null ? '' : t).match(/(\d{1,2})[:.](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function up(s) { return String(s || '').trim().toUpperCase(); }
  function num(v, def) { var n = Number(v); return v === '' || v == null || !isFinite(n) ? def : n; }
  function pick(c, a, b, def) { return c[a] != null ? c[a] : (c[b] != null ? c[b] : def); }

  function normalizeConfig(c) {
    c = c || {};
    if (c._normalized) return c;
    var wd = c.workDays || c.WORK_DAYS || '1,2,3,4,5';
    if (typeof wd === 'string') wd = wd.split(/[,\s]+/).map(Number).filter(function (x) { return x >= 1 && x <= 7; });
    return {
      _normalized: true,
      workDays: wd.length ? wd : [1, 2, 3, 4, 5],
      targetPeriod: String(c.targetPeriod || c.TARGET_PERIOD || 'DAILY').toUpperCase(),
      weightOutput: num(pick(c, 'weightOutput', 'WEIGHT_OUTPUT'), 80),
      weightDiscipline: num(pick(c, 'weightDiscipline', 'WEIGHT_DISCIPLINE'), 20),
      weightAttendance: num(pick(c, 'weightAttendance', 'WEIGHT_ATTENDANCE'), 0),
      workStart: toMin(pick(c, 'workStart', 'WORK_START', '09:00')) != null ? toMin(pick(c, 'workStart', 'WORK_START', '09:00')) : 540,
      workEnd: toMin(pick(c, 'workEnd', 'WORK_END', '17:00')) != null ? toMin(pick(c, 'workEnd', 'WORK_END', '17:00')) : 1020,
      lateGrace: num(pick(c, 'lateGrace', 'LATE_GRACE_MIN'), 0),
      lateScore: num(pick(c, 'lateScore', 'ATTENDANCE_LATE_SCORE'), 50) / 100,
      lateFine: num(pick(c, 'lateFine', 'LATE_FINE'), 10000),
      attendanceStart: String(pick(c, 'attendanceStart', 'ATTENDANCE_START', '') || '').slice(0, 10),
      goLive: String(pick(c, 'goLive', 'GO_LIVE_DATE', '') || '').slice(0, 10),
      longformDays: num(pick(c, 'longformDays', 'LONGFORM_DAYS'), 3),
      shortsDays: num(pick(c, 'shortsDays', 'SHORTS_DAYS'), 1),
      weightOutcome: num(pick(c, 'weightOutcome', 'WEIGHT_OUTCOME'), 0)
    };
  }

  function isWorkday(d, cfg) { return cfg.workDays.indexOf(dow(d)) >= 0; }
  function workdays(from, to, cfg) { var n = 0; if (from > to) return 0; eachDay(from, to, function (d) { if (isWorkday(d, cfg)) n++; }); return n; }

  /** Target kolom TARGET di sheet diubah menjadi target per hari kerja. */
  function dailyTarget(target, date, cfg) {
    target = Number(target) || 0;
    if (!target) return 0;
    if (cfg.targetPeriod === 'WEEKLY') return target / Math.max(1, cfg.workDays.length);
    if (cfg.targetPeriod === 'MONTHLY') return target / Math.max(1, workdays(monthStart(date), monthEnd(date), cfg));
    return target;
  }

  /**
   * Anggota channel + pembagian tugasnya: [{ name, label, mode: 'COUNT'|'PROGRESS', target (mode COUNT, per TARGET_PERIOD) }]
   * c.members (dari sheet TIM CHANNEL) boleh sebagian / kosong. Yang tidak diatur → ikut KPI MODE channel,
   * dan sisa TARGET channel dibagi rata ke anggota COUNT yang targetnya tidak diatur.
   */
  function channelMembers(c) {
    if (!c) return [];
    var given = {};
    (c.members || []).forEach(function (m) { if (m && up(m.name)) given[up(m.name)] = m; });
    var chMode = up(c.kpiMode) === 'PROGRESS' ? 'PROGRESS' : 'COUNT', seen = {};
    var list = (c.employees || []).map(up).filter(function (n) { if (!n || seen[n]) return false; seen[n] = 1; return true; }).map(function (n) {
      var g = given[n] || {}, gm = up(g.mode);
      var mode = gm === 'PROGRESS' || gm === 'COUNT' ? gm : chMode;
      var t = g.target === '' || g.target == null || !isFinite(Number(g.target)) ? null : Math.max(0, Number(g.target));
      return { name: n, label: String(g.label || '').trim(), mode: mode, target: mode === 'COUNT' ? t : null, notes: String(g.notes || ''), custom: !!given[n],
        from: String(g.from || '').slice(0, 10), to: String(g.to || '').slice(0, 10) };
    });
    var cnt = list.filter(function (m) { return m.mode === 'COUNT'; });
    var free = cnt.filter(function (m) { return m.target == null; });
    var rest = Math.max(0, (Number(c.target) || 0) - cnt.reduce(function (s, m) { return s + (m.target || 0); }, 0));
    free.forEach(function (m) { m.target = rest / free.length; });
    return list;
  }

  function periodRange(kind, today) {
    switch (kind) {
      case 'today': return { from: today, to: today };
      case 'yesterday': var y = addDays(today, -1); return { from: y, to: y };
      case 'week': return { from: addDays(today, 1 - dow(today)), to: today };
      case 'last7': return { from: addDays(today, -6), to: today };
      case 'last30': return { from: addDays(today, -29), to: today };
      case 'lastmonth': var lp = addDays(monthStart(today), -1); return { from: monthStart(lp), to: lp };
      default: return { from: monthStart(today), to: today }; // 'month'
    }
  }

  function grade(score) {
    if (score == null) return { code: '-', label: 'Belum ada target', status: 'none' };
    if (score >= 90) return { code: 'A', label: 'Sangat baik', status: 'good' };
    if (score >= 75) return { code: 'B', label: 'Baik', status: 'good' };
    if (score >= 60) return { code: 'C', label: 'Cukup', status: 'warning' };
    return { code: 'D', label: 'Perlu perhatian', status: 'critical' };
  }

  /** Jabatan pimpinan (kolom POSITION di sheet EMPLOYEES). */
  var LEADER_POSITIONS = ['BOSS', 'MANAGER'];
  function isLeader(e) { return !!e && LEADER_POSITIONS.indexOf(up(e.position)) >= 0; }
  /** Wajib absensi: aktif, punya akun login, dan bukan Bos. */
  function mustAttend(e) {
    if (!e || e.active === false || up(e.position) === 'BOSS') return false;
    if (e.login === false) return false;
    if (e.pin !== undefined && !String(e.pin)) return false;
    return true;
  }

  /* ------------------------- ABSENSI ------------------------- */
  var EXCUSE_TYPES = ['TIDAK_MASUK', 'SAKIT', 'CUTI'];
  /** Izin yang DISETUJUI → { NAMA: { excused: {tgl: tipe}, lateOk: {tgl: true} } } */
  function permIndex(perms) {
    var idx = {};
    (perms || []).forEach(function (p) {
      if (up(p.status) !== 'APPROVED' || !p.from) return;
      var n = up(p.name), t = up(p.type);
      var o = idx[n] = idx[n] || { excused: {}, lateOk: {} };
      var to = p.to && p.to >= p.from ? p.to : p.from;
      if (to > addDays(p.from, 62)) to = addDays(p.from, 62);
      eachDay(p.from, to, function (d) {
        if (EXCUSE_TYPES.indexOf(t) >= 0) o.excused[d] = t;
        else if (t === 'TERLAMBAT') o.lateOk[d] = true;
      });
    });
    return idx;
  }
  function attIndex(att) {
    var idx = {};
    (att || []).forEach(function (r) { if (r.date && r.name) (idx[up(r.name)] = idx[up(r.name)] || {})[r.date] = r; });
    return idx;
  }
  function lateMinutes(rec, cfg) { var m = toMin(rec && rec.in); return m == null ? 0 : Math.max(0, m - cfg.workStart); }

  /**
   * Rekap absensi per orang.
   * opts = { attendance:[{date,name,in,out,otMin,early}], permissions:[{name,type,from,to,status}], employees, from, to, today, config, names? }
   */
  function attendanceRecap(opts) {
    var cfg = normalizeConfig(opts.config);
    var today = opts.today || opts.to;
    var from = opts.from, to = opts.to > today ? today : opts.to;
    if (cfg.attendanceStart && from < cfg.attendanceStart) from = cfg.attendanceStart;
    if (cfg.goLive && from < cfg.goLive) from = cfg.goLive;
    var A = attIndex(opts.attendance), P = permIndex(opts.permissions);
    var people = opts.names ? opts.names.map(up) : (opts.employees || []).filter(mustAttend).map(function (e) { return up(e.name); });
    var out = {};
    people.forEach(function (n) {
      var r = { name: n, workdays: 0, present: 0, onTime: 0, late: 0, excusedLate: 0, lateMin: 0, izin: 0, sakit: 0, cuti: 0,
        alpa: 0, overtimeMin: 0, overtimeDays: 0, early: 0, noCheckout: 0, fines: 0, rate: null, days: {},
        reports: 0, completionSum: 0, completion: null };
      var a = A[n] || {}, p = P[n] || { excused: {}, lateOk: {} };
      if (from <= to) eachDay(from, to, function (d) {
        var work = isWorkday(d, cfg), rec = a[d], ex = p.excused[d];
        if (rec && (Number(rec.otMin) || 0) > 0) { r.overtimeMin += Number(rec.otMin) || 0; r.overtimeDays++; }
        if (rec && rec.completion !== '' && rec.completion != null && isFinite(Number(rec.completion))) { r.reports++; r.completionSum += Number(rec.completion); }
        if (!work) { if (rec && rec.in) r.days[d] = 'LIBUR_MASUK'; return; }
        if (ex) { r.days[d] = ex; if (ex === 'SAKIT') r.sakit++; else if (ex === 'CUTI') r.cuti++; else r.izin++; return; }
        if (rec && rec.in) {
          r.workdays++; r.present++;
          var lm = lateMinutes(rec, cfg);
          if (lm > cfg.lateGrace) {
            if (p.lateOk[d]) { r.excusedLate++; r.days[d] = 'TERLAMBAT_IZIN'; }
            else { r.late++; r.lateMin += lm; r.fines += cfg.lateFine; r.days[d] = 'TERLAMBAT'; }
          } else { r.onTime++; r.days[d] = 'TEPAT'; }
          if (rec.early) r.early++;
          if (!rec.out && d < today) r.noCheckout++;
        } else if (d < today) { r.workdays++; r.alpa++; r.days[d] = 'ALPA'; }
      });
      var n2 = r.onTime + r.excusedLate + r.late + r.alpa;
      r.rate = n2 ? (r.onTime + r.excusedLate + r.late * cfg.lateScore) / n2 : null;
      r.completion = r.reports ? r.completionSum / r.reports / 100 : null;
      out[n] = r;
    });
    return { from: from, to: to, config: cfg, map: out, list: people.map(function (n) { return out[n]; }) };
  }

  /* ------------------------- HASIL CHANNEL ------------------------- */
  /**
   * Pertumbuhan channel dari snapshot harian. list = [[tanggal, totalViews, subscriber], ...]
   * Snapshot tanggal X = angka terakhir hari X. Untuk periode yang memuat hari-hari sebelum hari ini,
   * hari ini (yang belum selesai) tidak dipakai sebagai titik akhir.
   */
  function channelGrowth(list, from, to, today) {
    if (!list || list.length < 2) return null;
    var rows = list.slice().sort(function (a, b) { return String(a[0]) < String(b[0]) ? -1 : 1; });
    var endCut = to >= today && from < today ? addDays(today, -1) : to;
    var base = null, first = null, end = null, endAny = null;
    rows.forEach(function (r) {
      var d = String(r[0]).slice(0, 10);
      if (d < from) base = r; else if (!first) first = r;
      if (d <= endCut) end = r;
      if (d <= to) endAny = r;
    });
    if (!base) base = first;
    if (!end || (base && String(end[0]) <= String(base[0]))) end = endAny;
    if (!base || !end || String(end[0]) <= String(base[0])) return null;
    var days = Math.round((parse(String(end[0]).slice(0, 10)) - parse(String(base[0]).slice(0, 10))) / 864e5);
    if (days < 1) return null;
    return { views: (Number(end[1]) || 0) - (Number(base[1]) || 0), subs: (Number(end[2]) || 0) - (Number(base[2]) || 0), days: days,
      from: String(base[0]).slice(0, 10), to: String(end[0]).slice(0, 10) };
  }
  /** Capaian hasil 1 channel pada periode. null = channel tanpa target hasil. */
  function channelOutcome(c, stats, from, to, today) {
    if (!c) return null;
    var tv = Number(c.targetViews) || 0, ts = Number(c.targetSubs) || 0;
    if (!(tv > 0 || ts > 0)) return null;
    var g = channelGrowth(stats, from, to, today);
    var o = { key: c.key, monthlyViews: tv, monthlySubs: ts, views: null, subs: null, targetViews: null, targetSubs: null, days: 0, achievement: null };
    if (!g) return o;
    var dim = Number(monthEnd(g.to).slice(8)) || 30;
    var parts = [];
    o.views = g.views; o.subs = g.subs; o.days = g.days; o.from = g.from; o.to = g.to;
    if (tv > 0) { o.targetViews = Math.round(tv * g.days / dim); parts.push(Math.max(0, Math.min(g.views / Math.max(1, tv * g.days / dim), 1.5))); }
    if (ts > 0) { o.targetSubs = Math.round(ts * g.days / dim * 10) / 10; parts.push(Math.max(0, Math.min(g.subs / Math.max(0.1, ts * g.days / dim), 1.5))); }
    o.achievement = parts.reduce(function (s, x) { return s + x; }, 0) / parts.length;
    return o;
  }

  /* ------------------------- KPI ------------------------- */
  /**
   * opts = { channels, reports, employees, attendance, permissions, from, to, today, config }
   *  channels : [{ key, name, division, target, employees:[NAMA] }]
   *  reports  : [{ date:'yyyy-mm-dd', employee, channel(key), qty }]
   */
  function compute(opts) {
    var cfg = normalizeConfig(opts.config);
    var from = opts.from, to = opts.to, today = opts.today || to;
    if (cfg.goLive && from < cfg.goLive) from = cfg.goLive;
    var effTo = to > today ? today : to;
    var days = [];
    if (from <= effTo) eachDay(from, effTo, function (d) { if (isWorkday(d, cfg)) days.push(d); });
    var P = permIndex(opts.permissions);
    var useAtt = cfg.weightAttendance > 0 && !!opts.attendance;
    var att = useAtt ? attendanceRecap({ attendance: opts.attendance, permissions: opts.permissions, employees: opts.employees, from: from, to: to, today: today, config: cfg, names: [] }) : null;

    var emps = {}, order = [];
    var chByKey = {};
    (opts.channels || []).forEach(function (c) { chByKey[c.key] = c; });

    // Manager & bos tidak masuk peringkat KPI
    var excluded = {};
    (opts.employees || []).forEach(function (e) { if (isLeader(e) || e.active === false) excluded[up(e.name)] = true; });

    // Proyek video (KPI MODE = PROGRESS): hari aktif per orang
    var proj = {};
    (opts.projects || []).forEach(function (p) {
      var n = up(p.employee); if (!n || !p.created) return;
      (proj[n] = proj[n] || []).push({ start: String(p.created).slice(0, 10), end: p.end ? String(p.end).slice(0, 10) : '9999-12-31', channel: String(p.channel || '') });
    });
    function hasActiveProject(n, d, key) { return (proj[n] || []).some(function (x) { return x.start <= d && x.end >= d && (key == null || x.channel === key); }); }
    function isProg(c) { return !!c && up(c.kpiMode) === 'PROGRESS'; }

    // Pembagian tugas per orang di dalam channel (+ riwayat penugasan 1.10)
    var memMode = {}, progKeys = {}, assignments = [];
    (opts.channels || []).forEach(function (c) {
      var chMode = up(c.kpiMode) === 'PROGRESS' ? 'PROGRESS' : 'COUNT';
      channelMembers(c).forEach(function (m) { assignments.push({ c: c, m: m, from: m.from || '', to: m.to || '', past: false }); });
      (c.pastMembers || []).forEach(function (p) {
        var n = up(p && p.name), to = String((p && p.to) || '').slice(0, 10);
        if (!n || !to) return;
        var pm = up(p.mode), mode = pm === 'PROGRESS' || pm === 'COUNT' ? pm : chMode;
        var t = Number(p.target);
        assignments.push({ c: c, m: { name: n, label: String(p.label || '').trim(), mode: mode, target: mode === 'COUNT' ? (isFinite(t) && t > 0 ? t : 0) : null },
          from: String(p.from || '').slice(0, 10), to: to, past: true });
      });
    });
    function inRange(a, d) { return (!a.from || d >= a.from) && (!a.to || d <= a.to); }
    assignments.forEach(function (a) {
      var x = memMode[a.m.name] = memMode[a.m.name] || {};
      if (!a.past || !(a.c.key in x)) x[a.c.key] = a.m.mode; // penugasan sekarang menang atas riwayat
      if (a.m.mode === 'PROGRESS') (progKeys[a.m.name] = progKeys[a.m.name] || []).push(a);
    });
    function isProgFor(name, key) { var x = memMode[up(name)]; return x && x[key] ? x[key] === 'PROGRESS' : isProg(chByKey[key]); }
    /** Channel PROGRESS milik orang ini yang punya proyek aktif pada hari d. */
    function activeProgKeys(n, d) {
      var keys = [];
      (progKeys[n] || []).forEach(function (a) { if (inRange(a, d) && keys.indexOf(a.c.key) < 0) keys.push(a.c.key); });
      var act = keys.filter(function (k) { return hasActiveProject(n, d, k); });
      if (!act.length && keys.length && hasActiveProject(n, d)) act = [keys[0]];
      return act;
    }

    function emp(name) {
      var k = up(name);
      if (!k || excluded[k]) return null;
      if (!emps[k]) {
        var ex = (P[k] || {}).excused || {};
        emps[k] = { name: k, channels: {}, target: 0, actual: 0, progTarget: 0, progActual: 0, taskTarget: 0, taskActual: 0, nCount: 0, nProg: 0, nTask: 0, reportDays: {}, daily: {}, divisions: {}, days: days.filter(function (d) { return !ex[d]; }), excused: days.length - days.filter(function (d) { return !ex[d]; }).length };
        order.push(k);
      }
      return emps[k];
    }
    function chRow(e, key) {
      if (!e.channels[key]) {
        var c = chByKey[key] || { key: key, name: key, division: 'OTHER' };
        e.channels[key] = { key: key, name: c.name, division: c.division, target: 0, actual: 0, assigned: false, mode: isProgFor(e.name, key) ? 'PROGRESS' : 'COUNT', label: '' };
      }
      return e.channels[key];
    }

    (opts.employees || []).forEach(function (e) {
      if (e.active === false || up(e.role) === 'ADMIN') return;
      emp(e.name);
    });

    assignments.forEach(function (a) {
      var c = a.c, m = a.m;
      // penugasan yang seluruhnya di luar periode tidak dihitung
      if ((a.to && a.to < from) || (a.from && a.from > effTo)) return;
      var e = emp(m.name); if (!e) return;
      var row = chRow(e, c.key);
      row.assigned = true;
      if (!a.past) { row.mode = m.mode; row.label = m.label; row.current = true; delete row.until; }
      else if (!row.current) { row.mode = m.mode; row.label = row.label || m.label; row.until = row.until && row.until > a.to ? row.until : a.to; }
      e.divisions[c.division] = true;
      if (m.mode === 'PROGRESS') {
        e.nProg++;
        e.days.forEach(function (d) {
          if (!inRange(a, d)) return;
          var act = activeProgKeys(e.name, d);
          if (act.indexOf(c.key) < 0) return;
          var t = 1 / act.length;
          row.target += t; e.progTarget += t;
          if (!e.daily[d]) e.daily[d] = { t: 0, a: 0 };
          e.daily[d].t += t;
        });
        return;
      }
      e.nCount++;
      e.days.forEach(function (d) {
        if (!inRange(a, d)) return;
        var t = dailyTarget(m.target, d, cfg);
        row.target += t; e.target += t;
        if (!e.daily[d]) e.daily[d] = { t: 0, a: 0 };
        e.daily[d].t += t;
      });
    });

    // Tugas khusus di luar channel (1.9)
    var taskRow = {};
    (opts.tasks || []).forEach(function (t) {
      if (!t || !t.id || !t.start) return;
      var e = emp(t.employee); if (!e) return;
      var start = String(t.start).slice(0, 10), end = t.end ? String(t.end).slice(0, 10) : '9999-12-31', dl = t.deadline ? String(t.deadline).slice(0, 10) : '';
      if (start > effTo || end < from) return;
      var count = up(t.mode) === 'COUNT', key = 'TASK:' + t.id;
      var row = e.channels[key] = { key: key, name: String(t.title || ''), division: 'TASK', target: 0, actual: 0, assigned: true, mode: count ? 'COUNT' : 'TASK', label: 'Tugas khusus', task: true };
      taskRow[t.id] = { e: e, row: row };
      var span = !count && dl ? Math.max(1, workdays(start, dl, cfg)) : 0;
      if (count) e.nCount++; else e.nTask++;
      e.days.forEach(function (d) {
        if (d < start || d > end || (dl && d > dl)) return;
        var tt = count ? Math.max(0, Number(t.target) || 0) : (span ? 1 / span : 0);
        if (!tt) return;
        row.target += tt;
        if (count) e.target += tt; else e.taskTarget += tt;
        if (!e.daily[d]) e.daily[d] = { t: 0, a: 0 };
        e.daily[d].t += tt;
      });
    });
    (opts.taskLog || []).forEach(function (l) {
      if (!l.date || l.date < from || l.date > effTo) return;
      var e = emp(l.employee); if (!e) return;
      e.reportDays[l.date] = true;
      var x = taskRow[l.taskId]; if (!x || x.e !== e) return;
      var v = x.row.mode === 'COUNT' ? Number(l.qty) || 0 : ((Number(l.to) || 0) - (Number(l.from) || 0)) / 100;
      x.row.actual += v;
      if (x.row.mode === 'COUNT') e.actual += v; else e.taskActual += v;
      if (!e.daily[l.date]) e.daily[l.date] = { t: 0, a: 0 };
      e.daily[l.date].a += v;
    });

    (opts.reports || []).forEach(function (r) {
      if (!r.date || r.date < from || r.date > effTo) return;
      var e = emp(r.employee); if (!e) return;
      var q = Number(r.qty) || 0;
      e.reportDays[r.date] = true;
      if (isProgFor(e.name, r.channel)) return; // pekerjaan long-form dinilai dari progres proyek, bukan jumlah
      e.actual += q;
      chRow(e, r.channel).actual += q;
      if (!e.daily[r.date]) e.daily[r.date] = { t: 0, a: 0 };
      e.daily[r.date].a += q;
    });

    (opts.progressLog || []).forEach(function (l) {
      if (!l.date || l.date < from || l.date > effTo) return;
      var e = emp(l.employee); if (!e) return;
      e.reportDays[l.date] = true;
      if (l.channel && !isProgFor(e.name, l.channel)) return; // tugasnya di channel ini sudah bukan mode progres
      var u = Number(l.units) || 0;
      e.progActual += u;
      if (l.channel) chRow(e, l.channel).actual += u;
      if (!e.daily[l.date]) e.daily[l.date] = { t: 0, a: 0 };
      e.daily[l.date].a += u;
    });

    (opts.attendance || []).forEach(function (a) {
      if (!a.date || a.date < from || a.date > effTo || a.completion === '' || a.completion == null) return;
      var e = emps[up(a.name)]; if (!e) return;
      e.reportDays[a.date] = true;
    });

    var stats = opts.channelStats || {}, outMemo = {};
    function outcomeOf(key) {
      if (!(key in outMemo)) outMemo[key] = channelOutcome(chByKey[key], stats[key], from, effTo, today);
      return outMemo[key];
    }

    var list = order.map(function (k) {
      var e = emps[k];
      var reported = e.days.filter(function (d) { return e.reportDays[d]; }).length;
      var discipline = e.days.length ? reported / e.days.length : null;
      var countAch = e.target > 0 ? e.actual / e.target : null;
      var progAch = e.progTarget > 0 ? e.progActual / e.progTarget : null;
      var taskAch = e.taskTarget > 0 ? e.taskActual / e.taskTarget : null;
      // gabungan: rata-rata berbobot (jumlah tugas per jenis), maks. 150% per jenis; satu jenis saja = apa adanya
      var parts = [];
      if (countAch != null) parts.push([countAch, e.nCount]);
      if (progAch != null) parts.push([progAch, e.nProg]);
      if (taskAch != null) parts.push([taskAch, e.nTask]);
      var achievement = parts.length > 1 ? parts.reduce(function (s2, p) { return s2 + Math.min(p[0], 1.5) * p[1]; }, 0) / parts.reduce(function (s2, p) { return s2 + p[1]; }, 0)
        : parts.length ? parts[0][0] : null;
      var pctMode = countAch == null && progAch == null && taskAch != null;
      var unitMode = !pctMode && countAch == null && (progAch != null || (e.nProg > 0 && e.nCount === 0));
      var a = null;
      if (att) {
        a = attendanceRecap({ attendance: opts.attendance, permissions: opts.permissions, from: from, to: to, today: today, config: cfg, names: [k] }).map[k];
      }
      var attendance = a ? a.rate : null;
      var chans = Object.keys(e.channels).map(function (key) {
        var c = e.channels[key];
        if (c.mode === 'TASK') {
          // tugas progres: ditampilkan dalam persen (progres yang diharapkan vs dicapai)
          c.achievement = c.target > 0 ? c.actual / c.target : null;
          c.target = Math.round(c.target * 1000) / 10; c.actual = Math.round(c.actual * 1000) / 10;
          c.outcome = null;
          return c;
        }
        c.target = Math.round(c.target * 100) / 100;
        c.achievement = c.target > 0 ? c.actual / c.target : null;
        c.outcome = c.assigned && !c.task && !c.until ? outcomeOf(key) : null;
        return c;
      });
      var oc = chans.filter(function (c) { return c.outcome && c.outcome.achievement != null; });
      var outcome = oc.length ? oc.reduce(function (s2, c) { return s2 + c.outcome.achievement; }, 0) / oc.length : null;
      var score = null;
      if (achievement != null) {
        var w = cfg.weightOutput + cfg.weightDiscipline, s = Math.min(achievement, 1) * cfg.weightOutput + (discipline || 0) * cfg.weightDiscipline;
        if (attendance != null) { w += cfg.weightAttendance; s += attendance * cfg.weightAttendance; }
        if (outcome != null && cfg.weightOutcome > 0) { w += cfg.weightOutcome; s += Math.min(outcome, 1) * cfg.weightOutcome; }
        score = Math.round(s / (w || 1) * 100);
      }
      return {
        name: e.name,
        divisions: Object.keys(e.divisions),
        target: unitMode ? Math.round(e.progTarget * 100) / 100 : pctMode ? Math.round(e.taskTarget * 1000) / 10 : Math.round(e.target * 100) / 100,
        actual: unitMode ? Math.round(e.progActual * 100) / 100 : pctMode ? Math.round(e.taskActual * 1000) / 10 : e.actual,
        unit: unitMode ? 'unit' : pctMode ? '%' : '',
        progress: e.nProg ? { target: Math.round(e.progTarget * 100) / 100, actual: Math.round(e.progActual * 100) / 100, achievement: progAch } : null,
        task: e.nTask ? { target: Math.round(e.taskTarget * 1000) / 10, actual: Math.round(e.taskActual * 1000) / 10, achievement: taskAch } : null,
        achievement: achievement,
        workdays: e.days.length,
        excusedDays: e.excused,
        reportedDays: reported,
        discipline: discipline,
        attendance: attendance,
        att: a,
        outcome: outcome,
        score: score,
        grade: grade(score),
        channels: chans,
        daily: e.daily
      };
    }).filter(function (e) { return e.channels.length || e.actual; });
    list.forEach(function (e) { e.channels.forEach(function (c) { if (c.mode === 'PROGRESS') c.actual = Math.round(c.actual * 100) / 100; }); });

    list.sort(function (a, b) {
      var sa = a.score == null ? -1 : a.score, sb = b.score == null ? -1 : b.score;
      return sb - sa || (b.achievement || 0) - (a.achievement || 0) || a.name.localeCompare(b.name);
    });

    var scored = list.filter(function (e) { return e.score != null; });
    var withAtt = list.filter(function (e) { return e.attendance != null; });
    var withOut = list.filter(function (e) { return e.outcome != null; });
    var tT = 0, tA = 0;
    list.forEach(function (e) { if (e.unit) return; tT += e.target; tA += e.actual; });
    var summary = {
      employees: list.length,
      avgScore: scored.length ? Math.round(scored.reduce(function (s, e) { return s + e.score; }, 0) / scored.length) : null,
      target: Math.round(tT * 100) / 100,
      actual: tA,
      achievement: tT > 0 ? tA / tT : null,
      avgDiscipline: scored.length ? scored.reduce(function (s, e) { return s + (e.discipline || 0); }, 0) / scored.length : null,
      avgAttendance: withAtt.length ? withAtt.reduce(function (s, e) { return s + e.attendance; }, 0) / withAtt.length : null,
      avgOutcome: withOut.length ? withOut.reduce(function (s, e) { return s + e.outcome; }, 0) / withOut.length : null,
      workdays: days.length,
      days: days
    };
    return { from: from, to: to, effTo: effTo, config: cfg, list: list, summary: summary };
  }

  return {
    compute: compute, attendanceRecap: attendanceRecap, periodRange: periodRange, grade: grade, dailyTarget: dailyTarget,
    isLeader: isLeader, mustAttend: mustAttend, toMin: toMin, lateMinutes: lateMinutes, permIndex: permIndex,
    normalizeConfig: normalizeConfig, addDays: addDays, dow: dow, workdays: workdays, channelGrowth: channelGrowth, channelOutcome: channelOutcome, channelMembers: channelMembers,
    isWorkday: isWorkday, monthStart: monthStart, monthEnd: monthEnd, eachDay: eachDay
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KPI;
