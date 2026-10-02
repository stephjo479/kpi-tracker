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
 *   Disiplin laporan  = hari dihitung yang ada laporannya ÷ hari dihitung
 *   Kehadiran         = (tepat waktu × 100% + terlambat × nilai terlambat + alpa × 0%) ÷ hari wajib hadir
 *   Skor KPI          = (min(capaian,100%) × bobot output + disiplin × bobot laporan + kehadiran × bobot kehadiran) ÷ total bobot
 *   Manager & Bos (kolom POSITION = MANAGER / BOSS) tidak masuk peringkat KPI (tetapi tetap ikut absensi, kecuali Bos).
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
      attendanceStart: String(pick(c, 'attendanceStart', 'ATTENDANCE_START', '') || '').slice(0, 10)
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
    var A = attIndex(opts.attendance), P = permIndex(opts.permissions);
    var people = opts.names ? opts.names.map(up) : (opts.employees || []).filter(mustAttend).map(function (e) { return up(e.name); });
    var out = {};
    people.forEach(function (n) {
      var r = { name: n, workdays: 0, present: 0, onTime: 0, late: 0, excusedLate: 0, lateMin: 0, izin: 0, sakit: 0, cuti: 0,
        alpa: 0, overtimeMin: 0, overtimeDays: 0, early: 0, noCheckout: 0, fines: 0, rate: null, days: {} };
      var a = A[n] || {}, p = P[n] || { excused: {}, lateOk: {} };
      if (from <= to) eachDay(from, to, function (d) {
        var work = isWorkday(d, cfg), rec = a[d], ex = p.excused[d];
        if (rec && (Number(rec.otMin) || 0) > 0) { r.overtimeMin += Number(rec.otMin) || 0; r.overtimeDays++; }
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
      out[n] = r;
    });
    return { from: from, to: to, config: cfg, map: out, list: people.map(function (n) { return out[n]; }) };
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
    (opts.employees || []).forEach(function (e) { if (isLeader(e)) excluded[up(e.name)] = true; });

    function emp(name) {
      var k = up(name);
      if (!k || excluded[k]) return null;
      if (!emps[k]) {
        var ex = (P[k] || {}).excused || {};
        emps[k] = { name: k, channels: {}, target: 0, actual: 0, reportDays: {}, daily: {}, divisions: {}, days: days.filter(function (d) { return !ex[d]; }), excused: days.length - days.filter(function (d) { return !ex[d]; }).length };
        order.push(k);
      }
      return emps[k];
    }
    function chRow(e, key) {
      if (!e.channels[key]) {
        var c = chByKey[key] || { key: key, name: key, division: 'OTHER' };
        e.channels[key] = { key: key, name: c.name, division: c.division, target: 0, actual: 0, assigned: false };
      }
      return e.channels[key];
    }

    (opts.employees || []).forEach(function (e) {
      if (e.active === false || up(e.role) === 'ADMIN') return;
      emp(e.name);
    });

    (opts.channels || []).forEach(function (c) {
      var names = (c.employees || []).filter(function (n) { return up(n); });
      if (!names.length) return;
      names.forEach(function (n) {
        var e = emp(n); if (!e) return;
        var row = chRow(e, c.key);
        row.assigned = true;
        e.divisions[c.division] = true;
        e.days.forEach(function (d) {
          var t = dailyTarget(c.target, d, cfg) / names.length;
          row.target += t; e.target += t;
          if (!e.daily[d]) e.daily[d] = { t: 0, a: 0 };
          e.daily[d].t += t;
        });
      });
    });

    (opts.reports || []).forEach(function (r) {
      if (!r.date || r.date < from || r.date > effTo) return;
      var e = emp(r.employee); if (!e) return;
      var q = Number(r.qty) || 0;
      e.actual += q;
      e.reportDays[r.date] = true;
      chRow(e, r.channel).actual += q;
      if (!e.daily[r.date]) e.daily[r.date] = { t: 0, a: 0 };
      e.daily[r.date].a += q;
    });

    var list = order.map(function (k) {
      var e = emps[k];
      var reported = e.days.filter(function (d) { return e.reportDays[d]; }).length;
      var discipline = e.days.length ? reported / e.days.length : null;
      var achievement = e.target > 0 ? e.actual / e.target : null;
      var a = null;
      if (att) {
        a = attendanceRecap({ attendance: opts.attendance, permissions: opts.permissions, from: from, to: to, today: today, config: cfg, names: [k] }).map[k];
      }
      var attendance = a ? a.rate : null;
      var score = null;
      if (achievement != null) {
        var w = cfg.weightOutput + cfg.weightDiscipline, s = Math.min(achievement, 1) * cfg.weightOutput + (discipline || 0) * cfg.weightDiscipline;
        if (attendance != null) { w += cfg.weightAttendance; s += attendance * cfg.weightAttendance; }
        score = Math.round(s / (w || 1) * 100);
      }
      var chans = Object.keys(e.channels).map(function (key) {
        var c = e.channels[key];
        c.target = Math.round(c.target * 100) / 100;
        c.achievement = c.target > 0 ? c.actual / c.target : null;
        return c;
      });
      return {
        name: e.name,
        divisions: Object.keys(e.divisions),
        target: Math.round(e.target * 100) / 100,
        actual: e.actual,
        achievement: achievement,
        workdays: e.days.length,
        excusedDays: e.excused,
        reportedDays: reported,
        discipline: discipline,
        attendance: attendance,
        att: a,
        score: score,
        grade: grade(score),
        channels: chans,
        daily: e.daily
      };
    }).filter(function (e) { return e.channels.length || e.actual; });

    list.sort(function (a, b) {
      var sa = a.score == null ? -1 : a.score, sb = b.score == null ? -1 : b.score;
      return sb - sa || (b.achievement || 0) - (a.achievement || 0) || a.name.localeCompare(b.name);
    });

    var scored = list.filter(function (e) { return e.score != null; });
    var withAtt = list.filter(function (e) { return e.attendance != null; });
    var tT = 0, tA = 0;
    list.forEach(function (e) { tT += e.target; tA += e.actual; });
    var summary = {
      employees: list.length,
      avgScore: scored.length ? Math.round(scored.reduce(function (s, e) { return s + e.score; }, 0) / scored.length) : null,
      target: Math.round(tT * 100) / 100,
      actual: tA,
      achievement: tT > 0 ? tA / tT : null,
      avgDiscipline: scored.length ? scored.reduce(function (s, e) { return s + (e.discipline || 0); }, 0) / scored.length : null,
      avgAttendance: withAtt.length ? withAtt.reduce(function (s, e) { return s + e.attendance; }, 0) / withAtt.length : null,
      workdays: days.length,
      days: days
    };
    return { from: from, to: to, effTo: effTo, config: cfg, list: list, summary: summary };
  }

  return {
    compute: compute, attendanceRecap: attendanceRecap, periodRange: periodRange, grade: grade, dailyTarget: dailyTarget,
    isLeader: isLeader, mustAttend: mustAttend, toMin: toMin, lateMinutes: lateMinutes, permIndex: permIndex,
    normalizeConfig: normalizeConfig, addDays: addDays, dow: dow, workdays: workdays,
    isWorkday: isWorkday, monthStart: monthStart, monthEnd: monthEnd, eachDay: eachDay
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KPI;
