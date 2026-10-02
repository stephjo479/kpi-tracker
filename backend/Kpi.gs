/*
 * KPI ENGINE (shared)
 * ------------------------------------------------------------------
 * File ini dipakai di DUA tempat dengan isi yang SAMA PERSIS:
 *   - Aplikasi web  : js/kpi.js
 *   - Apps Script   : backend/Kpi.gs
 * Kalau mengubah rumus KPI, ubah di sini lalu salin juga ke Kpi.gs.
 *
 * Rumus:
 *   Target periode   = Σ (target harian channel × hari kerja yang sudah lewat)
 *   Capaian output   = total jumlah di laporan ÷ target periode
 *   Disiplin laporan = hari kerja yang ada laporannya ÷ hari kerja yang sudah lewat
 *   Skor KPI         = (min(capaian,100%) × bobot output + disiplin × bobot disiplin) ÷ total bobot
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

  function normalizeConfig(c) {
    c = c || {};
    var wd = c.workDays || c.WORK_DAYS || '1,2,3,4,5';
    if (typeof wd === 'string') wd = wd.split(/[,\s]+/).map(Number).filter(function (x) { return x >= 1 && x <= 7; });
    var wo = Number(c.weightOutput != null ? c.weightOutput : (c.WEIGHT_OUTPUT != null ? c.WEIGHT_OUTPUT : 80));
    var wdisc = Number(c.weightDiscipline != null ? c.weightDiscipline : (c.WEIGHT_DISCIPLINE != null ? c.WEIGHT_DISCIPLINE : 20));
    return {
      workDays: wd.length ? wd : [1, 2, 3, 4, 5],
      targetPeriod: String(c.targetPeriod || c.TARGET_PERIOD || 'DAILY').toUpperCase(),
      weightOutput: isFinite(wo) ? wo : 80,
      weightDiscipline: isFinite(wdisc) ? wdisc : 20
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

  function up(s) { return String(s || '').trim().toUpperCase(); }

  /**
   * opts = { channels, reports, employees, from, to, today, config }
   *  channels : [{ key, name, division, target, employees:[NAMA] }]
   *  reports  : [{ date:'yyyy-mm-dd', employee, channel(key), qty }]
   */
  function compute(opts) {
    var cfg = normalizeConfig(opts.config);
    var from = opts.from, to = opts.to, today = opts.today || to;
    var effTo = to > today ? today : to;
    var days = [];
    if (from <= effTo) eachDay(from, effTo, function (d) { if (isWorkday(d, cfg)) days.push(d); });

    var emps = {}, order = [];
    var chByKey = {};
    (opts.channels || []).forEach(function (c) { chByKey[c.key] = c; });

    function emp(name) {
      var k = up(name);
      if (!k) return null;
      if (!emps[k]) { emps[k] = { name: k, channels: {}, target: 0, actual: 0, reportDays: {}, daily: {}, divisions: {} }; order.push(k); }
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
        days.forEach(function (d) {
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

    var wSum = cfg.weightOutput + cfg.weightDiscipline || 1;
    var list = order.map(function (k) {
      var e = emps[k];
      var reported = days.filter(function (d) { return e.reportDays[d]; }).length;
      var discipline = days.length ? reported / days.length : null;
      var achievement = e.target > 0 ? e.actual / e.target : null;
      var score = null;
      if (achievement != null) {
        score = Math.round(((Math.min(achievement, 1) * cfg.weightOutput) + ((discipline || 0) * cfg.weightDiscipline)) / wSum * 100);
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
        workdays: days.length,
        reportedDays: reported,
        discipline: discipline,
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
    var tT = 0, tA = 0;
    list.forEach(function (e) { tT += e.target; tA += e.actual; });
    var summary = {
      employees: list.length,
      avgScore: scored.length ? Math.round(scored.reduce(function (s, e) { return s + e.score; }, 0) / scored.length) : null,
      target: Math.round(tT * 100) / 100,
      actual: tA,
      achievement: tT > 0 ? tA / tT : null,
      avgDiscipline: scored.length ? scored.reduce(function (s, e) { return s + (e.discipline || 0); }, 0) / scored.length : null,
      workdays: days.length,
      days: days
    };
    return { from: from, to: to, effTo: effTo, config: cfg, list: list, summary: summary };
  }

  return {
    compute: compute, periodRange: periodRange, grade: grade, dailyTarget: dailyTarget,
    normalizeConfig: normalizeConfig, addDays: addDays, dow: dow, workdays: workdays,
    isWorkday: isWorkday, monthStart: monthStart, monthEnd: monthEnd, eachDay: eachDay
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KPI;
