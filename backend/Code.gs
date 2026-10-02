/**
 * ============================================================
 *  YT KPI TRACKER — BACKEND (Google Apps Script)
 * ============================================================
 *  Script ini dipasang di spreadsheet (Extensions → Apps Script)
 *  dan berjalan SEBAGAI PEMILIK spreadsheet. Karyawan tidak perlu
 *  akses ke spreadsheet; mereka hanya login lewat aplikasi dengan
 *  NAMA + PIN. Kolom SALARY & DATE OF SALARY tidak pernah dikirim
 *  ke akun selain ADMIN.
 *
 *  Butuh: Services → YouTube Data API v3 (identifier: YouTube)
 * ============================================================
 */

var BACKEND_VERSION = '1.0.0';

var SHEETS = {
  CHANNELS: 'CHANNEL REPORT',
  EMPLOYEES: 'EMPLOYEES',
  REPORTS: 'DAILY REPORT',
  CONFIG: 'CONFIG',
  KPI: 'KPI SUMMARY',
  YT_CHANNELS: 'YT CHANNELS',
  YT_VIDEOS: 'YT VIDEOS',
  YT_HISTORY: 'YT HISTORY',
  YT_CH_HISTORY: 'YT CHANNEL HISTORY'
};

var HEADERS = {
  EMPLOYEES: ['NAME', 'ROLE', 'PIN', 'ACTIVE', 'NOTES'],
  REPORTS: ['ID', 'TIMESTAMP', 'DATE', 'EMPLOYEE', 'CHANNEL', 'DIVISION', 'TASK', 'QTY', 'LINKS', 'NOTES', 'UPDATED BY'],
  CONFIG: ['KEY', 'VALUE', 'KETERANGAN'],
  KPI: ['NAME', 'DIVISION', 'TARGET (BULAN INI)', 'ACTUAL', 'CAPAIAN', 'DISIPLIN LAPORAN', 'SKOR KPI', 'GRADE', 'TARGET HARI INI', 'ACTUAL HARI INI', 'UPDATED'],
  YT_CHANNELS: ['SHEET CHANNEL', 'CHANNEL ID', 'TITLE', 'HANDLE', 'THUMBNAIL', 'SUBSCRIBERS', 'TOTAL VIEWS', 'VIDEOS', 'UPDATED', 'STATUS'],
  YT_VIDEOS: ['VIDEO ID', 'CHANNEL ID', 'TITLE', 'PUBLISHED', 'THUMBNAIL', 'DURATION (s)', 'VIEWS', 'LIKES', 'COMMENTS', 'UPDATED'],
  YT_HISTORY: ['DATE', 'VIDEO ID', 'CHANNEL ID', 'VIEWS'],
  YT_CH_HISTORY: ['DATE', 'CHANNEL ID', 'SUBSCRIBERS', 'TOTAL VIEWS', 'VIDEOS']
};

var DEFAULT_CONFIG = [
  ['COMPANY_NAME', 'Creator Studio', 'Nama tim yang tampil di aplikasi'],
  ['TIMEZONE', 'Asia/Jakarta', 'Zona waktu untuk tanggal laporan & KPI'],
  ['WORK_DAYS', '1,2,3,4,5', 'Hari kerja: 1=Senin, 2=Selasa, ... 6=Sabtu, 7=Minggu'],
  ['TARGET_PERIOD', 'DAILY', 'Arti kolom TARGET: DAILY (per hari) / WEEKLY (per minggu) / MONTHLY (per bulan)'],
  ['WEIGHT_OUTPUT', '80', 'Bobot capaian output dalam skor KPI (%)'],
  ['WEIGHT_DISCIPLINE', '20', 'Bobot disiplin mengisi laporan dalam skor KPI (%)'],
  ['SYNC_CURRENT_RESULT', 'TRUE', 'TRUE = kolom CURRENT RESULT di CHANNEL REPORT diisi otomatis dari laporan periode berjalan'],
  ['EMPLOYEE_SEE_ALL', 'TRUE', 'TRUE = karyawan bisa melihat KPI & laporan rekan (kecuali gaji). FALSE = hanya miliknya sendiri'],
  ['BACKDATE_DAYS', '3', 'Karyawan boleh mengisi/mengubah laporan sampai N hari ke belakang'],
  ['REPORT_DAYS_LOADED', '120', 'Berapa hari laporan terakhir yang dimuat ke aplikasi'],
  ['YT_SYNC_HOURS', '3', 'Sinkron views YouTube setiap N jam'],
  ['YT_MAX_VIDEOS', '50', 'Jumlah video terbaru per channel yang dipantau']
];

/* =========================== MENU & SETUP =========================== */

/** Jalankan SEKALI setelah menempel kode. Aman dijalankan ulang. */
function setup() {
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheet_(SHEETS.CONFIG, HEADERS.CONFIG);
  ensureConfigDefaults_();
  ensureSheet_(SHEETS.EMPLOYEES, HEADERS.EMPLOYEES, { textCols: [3] });
  ensureSheet_(SHEETS.REPORTS, HEADERS.REPORTS, { textCols: [3] });
  ensureSheet_(SHEETS.KPI, HEADERS.KPI);
  ensureSheet_(SHEETS.YT_CHANNELS, HEADERS.YT_CHANNELS);
  ensureSheet_(SHEETS.YT_VIDEOS, HEADERS.YT_VIDEOS);
  ensureSheet_(SHEETS.YT_HISTORY, HEADERS.YT_HISTORY, { textCols: [1, 2] });
  ensureSheet_(SHEETS.YT_CH_HISTORY, HEADERS.YT_CH_HISTORY, { textCols: [1] });
  secret_();
  var added = syncEmployees_();

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cronJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cronJob').timeBased().everyHours(1).create();

  var ytMsg = 'OK';
  try { syncYouTube(); } catch (err) { ytMsg = 'GAGAL: ' + err.message; }
  try { cronJob(); } catch (err) { }

  var admin = readEmployees_().filter(function (e) { return e.role === 'ADMIN'; })[0];
  var msg = 'Setup selesai.\n\n' +
    '• Karyawan baru ditambahkan ke sheet EMPLOYEES: ' + added + '\n' +
    '• Login admin: ' + (admin ? admin.name + ' / PIN ' + admin.pin : '-') + '\n' +
    '• Sinkron YouTube: ' + ytMsg + '\n\n' +
    'Langkah berikutnya: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone). ' +
    'Salin URL /exec ke file config.js aplikasi.';
  notify_(msg);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎯 KPI Tracker')
    .addItem('1) Setup / perbaiki struktur', 'setup')
    .addItem('Sinkron views YouTube sekarang', 'menuSyncYouTube')
    .addItem('Hitung ulang KPI & Current Result', 'cronJob')
    .addSeparator()
    .addItem('Lihat PIN admin', 'showAdminInfo')
    .addToUi();
}

function showAdminInfo() {
  var admins = readEmployees_().filter(function (e) { return e.role === 'ADMIN'; });
  notify_(admins.map(function (a) { return a.name + ' → PIN ' + a.pin; }).join('\n') || 'Belum ada admin. Jalankan Setup.');
}

function menuSyncYouTube() {
  try { syncYouTube(); notify_('Sinkron YouTube selesai.'); } catch (err) { notify_('Sinkron gagal: ' + err.message); }
}

/** Dipanggil trigger setiap jam. */
function cronJob() {
  syncEmployees_();
  updateCurrentResults_();
  writeKpiSummary_();
  var cfg = config_();
  var last = Number(PropertiesService.getScriptProperties().getProperty('YT_LAST_SYNC') || 0);
  var every = Math.max(1, Number(cfg.YT_SYNC_HOURS) || 3);
  if (Date.now() - last >= every * 3600 * 1000 - 5 * 60 * 1000) {
    try { syncYouTube(); } catch (err) { console.error(err); }
  }
}

/* =========================== ENTRY POINTS =========================== */

function doGet(e) {
  return json_({ ok: true, data: { app: 'yt-kpi-tracker', backendVersion: BACKEND_VERSION, time: new Date().toISOString() } });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Request tidak valid' });
  }
  try {
    var action = String(body.action || '');
    var pub = PUBLIC_ACTIONS[action];
    if (pub) return json_({ ok: true, data: pub(body) });

    var fn = AUTH_ACTIONS[action] || ADMIN_ACTIONS[action];
    if (!fn) return json_({ ok: false, error: 'Aksi tidak dikenal: ' + action });
    var user = verifyToken_(body.token);
    if (!user) return json_({ ok: false, code: 'AUTH', error: 'Sesi berakhir, silakan login lagi.' });
    if (ADMIN_ACTIONS[action] && user.role !== 'ADMIN') return json_({ ok: false, code: 'FORBIDDEN', error: 'Hanya admin.' });
    return json_({ ok: true, data: fn(body, user) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

var PUBLIC_ACTIONS = {
  ping: function () { return { backendVersion: BACKEND_VERSION }; },
  publicInfo: function () {
    var cfg = config_();
    return {
      company: cfg.COMPANY_NAME,
      backendVersion: BACKEND_VERSION,
      employees: readEmployees_().filter(function (e) { return e.active && e.pin; }).map(function (e) { return e.name; }).sort()
    };
  },
  login: function (b) { return login_(b.name, b.pin); }
};

var AUTH_ACTIONS = {
  getData: function (b, user) { return getData_(user); },
  getYouTube: function (b, user) { return getYouTube_(); },
  getHistory: function (b, user) { return getHistory_(b.channelId, Number(b.days) || 30); },
  submitReport: function (b, user) { return submitReport_(b.report || {}, user); },
  updateReport: function (b, user) { return updateReport_(b.report || {}, user); },
  deleteReport: function (b, user) { return deleteReport_(b.id, user); },
  changePin: function (b, user) { return changePin_(user, b.oldPin, b.newPin); }
};

var ADMIN_ACTIONS = {
  updateChannel: function (b) { return updateChannel_(b.channel || {}); },
  addChannel: function (b) { return addChannel_(b.channel || {}); },
  saveEmployee: function (b) { return saveEmployee_(b.employee || {}); },
  saveConfig: function (b) { return saveConfig_(b.config || {}); },
  syncYouTube: function () { syncYouTube(); return getYouTube_(); }
};

/* =========================== HELPERS =========================== */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function notify_(msg) {
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
}

var _ss = null;
function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return _ss;
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  var target = name.toUpperCase();
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getName().trim().toUpperCase() === target) return all[i];
  if (name === SHEETS.CHANNELS) return all[0];
  return null;
}

function ensureSheet_(name, headers, opts) {
  opts = opts || {};
  var sh = sheet_(name);
  if (!sh) sh = ss_().insertSheet(name);
  var first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  if (first.join('') === '') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  (opts.textCols || []).forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
  return sh;
}

function ensureConfigDefaults_() {
  var sh = ensureSheet_(SHEETS.CONFIG, HEADERS.CONFIG);
  var existing = {};
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { existing[String(r[0]).trim()] = true; });
  var rows = DEFAULT_CONFIG.filter(function (r) { return !existing[r[0]]; });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}

var _cfg = null;
function config_() {
  if (_cfg) return _cfg;
  var cfg = {};
  DEFAULT_CONFIG.forEach(function (r) { cfg[r[0]] = r[1]; });
  var sh = sheet_(SHEETS.CONFIG);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (k) cfg[k] = String(r[1]).trim();
    });
  }
  _cfg = cfg;
  return cfg;
}

function bool_(v) { return /^(true|ya|yes|1)$/i.test(String(v).trim()); }
function tz_() { return config_().TIMEZONE || Session.getScriptTimeZone() || 'Asia/Jakarta'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function dateStr_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); // dd/mm/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}
function up_(s) { return String(s || '').trim().toUpperCase(); }
function splitNames_(s) {
  return String(s || '').split(/[,&\/;\n]+|\s+dan\s+/i).map(up_).filter(function (x) { return x; });
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function colLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/* =========================== AUTH =========================== */

function secret_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function sign_(str) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(str, secret_())).replace(/=+$/, '');
}
function pinTag_(pin) { return sign_('pin:' + pin).slice(0, 12); }

function makeToken_(emp) {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ n: emp.name, t: pinTag_(emp.pin), e: Date.now() + 60 * 24 * 3600 * 1000 }), Utilities.Charset.UTF_8).replace(/=+$/, '');
  return payload + '.' + sign_(payload);
}

function verifyToken_(token) {
  if (!token || String(token).indexOf('.') < 0) return null;
  var parts = String(token).split('.');
  if (sign_(parts[0]) !== parts[1]) return null;
  var data;
  try {
    var padded = parts[0] + '==='.slice((parts[0].length + 3) % 4);
    data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(padded, Utilities.Charset.UTF_8)).getDataAsString('UTF-8'));
  } catch (e) { return null; }
  if (!data || data.e < Date.now()) return null;
  var emp = findEmployee_(data.n);
  if (!emp || !emp.active || pinTag_(emp.pin) !== data.t) return null;
  return emp;
}

function login_(name, pin) {
  name = up_(name); pin = String(pin || '').trim();
  if (!name || !pin) throw new Error('Nama dan PIN wajib diisi.');
  var cache = CacheService.getScriptCache();
  var key = 'fail_' + Utilities.base64EncodeWebSafe(name);
  var fails = Number(cache.get(key) || 0);
  if (fails >= 5) throw new Error('Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
  var emp = findEmployee_(name);
  if (!emp || !emp.active || String(emp.pin) !== pin) {
    cache.put(key, String(fails + 1), 15 * 60);
    throw new Error('Nama atau PIN salah.');
  }
  cache.remove(key);
  return { token: makeToken_(emp), user: publicUser_(emp) };
}

function publicUser_(emp) { return { name: emp.name, role: emp.role }; }

function changePin_(user, oldPin, newPin) {
  newPin = String(newPin || '').trim();
  if (String(oldPin || '').trim() !== String(user.pin)) throw new Error('PIN lama salah.');
  if (!/^\d{4,8}$/.test(newPin)) throw new Error('PIN baru harus 4–8 digit angka.');
  return withLock_(function () {
    var sh = sheet_(SHEETS.EMPLOYEES);
    sh.getRange(user.row, 3).setNumberFormat('@').setValue(newPin);
    user.pin = newPin;
    return { token: makeToken_(user) };
  });
}

/* =========================== EMPLOYEES =========================== */

function readEmployees_() {
  var sh = sheet_(SHEETS.EMPLOYEES);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().map(function (r, i) {
    return {
      row: i + 2,
      name: up_(r[0]),
      role: up_(r[1]) === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
      pin: String(r[2]).trim(),
      active: String(r[3]).trim() === '' ? true : bool_(r[3]),
      notes: String(r[4] || '')
    };
  }).filter(function (e) { return e.name; });
}

function findEmployee_(name) {
  name = up_(name);
  return readEmployees_().filter(function (e) { return e.name === name; })[0] || null;
}

function randomPin_() { return String(Math.floor(100000 + Math.random() * 900000)); }

/** Tambahkan nama baru dari kolom RELEVANT EMPLOYEES ke sheet EMPLOYEES + pastikan ada 1 admin. */
function syncEmployees_() {
  var sh = ensureSheet_(SHEETS.EMPLOYEES, HEADERS.EMPLOYEES, { textCols: [3] });
  var existing = {};
  var emps = readEmployees_();
  emps.forEach(function (e) { existing[e.name] = true; });
  var rows = [];
  if (!emps.some(function (e) { return e.role === 'ADMIN'; })) {
    rows.push(['OWNER', 'ADMIN', randomPin_(), true, 'Akun pemilik. Ganti nama/PIN sesukamu.']);
    existing.OWNER = true;
  }
  readChannels_().list.forEach(function (c) {
    c.employees.forEach(function (n) {
      if (!existing[n]) { existing[n] = true; rows.push([n, 'EMPLOYEE', randomPin_(), true, 'Ditambahkan otomatis']); }
    });
  });
  if (rows.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 3, rows.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, rows.length, 5).setValues(rows);
  }
  return rows.length;
}

function saveEmployee_(e) {
  var name = up_(e.name);
  if (!name) throw new Error('Nama wajib diisi.');
  var pin = String(e.pin || '').trim();
  if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4–8 digit angka.');
  return withLock_(function () {
    var sh = ensureSheet_(SHEETS.EMPLOYEES, HEADERS.EMPLOYEES, { textCols: [3] });
    var found = findEmployee_(name);
    var role = up_(e.role) === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
    var active = e.active !== false;
    if (found) {
      if (found.role === 'ADMIN' && (role !== 'ADMIN' || !active)) {
        var admins = readEmployees_().filter(function (x) { return x.role === 'ADMIN' && x.active; });
        if (admins.length <= 1) throw new Error('Minimal harus ada 1 admin aktif.');
      }
      sh.getRange(found.row, 2, 1, 4).setValues([[role, pin || found.pin, active, e.notes != null ? e.notes : found.notes]]);
    } else {
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 3).setNumberFormat('@');
      sh.getRange(r, 1, 1, 5).setValues([[name, role, pin || randomPin_(), active, e.notes || '']]);
    }
    return { employees: employeesForAdmin_() };
  });
}

function employeesForAdmin_() {
  return readEmployees_().map(function (e) { return { name: e.name, role: e.role, pin: e.pin, active: e.active, notes: e.notes }; });
}

/* =========================== CHANNEL REPORT =========================== */

var COLS = {
  name: ['CHANNEL NAME', 'CHANNEL', 'NAMA CHANNEL'],
  type: ['TYPE', 'TIPE', 'JENIS'],
  link: ['LINK', 'URL'],
  indicator: ['INDICATOR', 'TASK', 'INDIKATOR'],
  target: ['TARGET'],
  current: ['CURRENT RESULT', 'RESULT', 'HASIL'],
  pct: ['PRECENTAGE', 'PERCENTAGE', 'PERSENTASE', 'PROGRESSION'],
  notes: ['NOTES', 'CATATAN'],
  employees: ['RELEVANT EMPLOYEES', 'EMPLOYEES', 'EMPLOYEE', 'KARYAWAN'],
  salary: ['SALARY', 'GAJI'],
  salaryDate: ['DATE OF SALARY', 'TANGGAL GAJI', 'PAYDAY']
};

function headerMap_(values) {
  var r1 = values[0] || [], r2 = values[1] || [];
  var twoRows = r2.some(function (v) { return /^(INDICATOR|TARGET|CURRENT RESULT)$/i.test(String(v).trim()); });
  var labels = r1.map(function (v, i) {
    var a = String(twoRows ? (r2[i] || '') : '').trim();
    return (a || String(v || '').trim()).toUpperCase();
  });
  var map = { start: twoRows ? 2 : 1 };
  Object.keys(COLS).forEach(function (k) {
    for (var j = 0; j < COLS[k].length; j++) {
      var idx = labels.indexOf(COLS[k][j]);
      if (idx >= 0 && !Object.keys(map).some(function (m) { return map[m] === idx && m !== 'start'; })) { map[k] = idx; break; }
    }
  });
  if (map.name == null) map.name = 0;
  return map;
}

function divisionOf_(type) {
  var t = up_(type);
  if (/DEV/.test(t)) return 'DEV';
  if (/STAFF|INTERNAL/.test(t)) return 'STAFF';
  if (/CLIENT|KLIEN/.test(t)) return 'CLIENT';
  return 'OTHER';
}

function readChannels_() {
  var sh = sheet_(SHEETS.CHANNELS);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return { list: [], map: headerMap_([[], []]), sheet: sh };
  var range = sh.getRange(1, 1, lastRow, lastCol);
  var values = range.getValues();
  var display = range.getDisplayValues();
  var map = headerMap_(values);
  var notesRow = {};
  // isi sel gabungan (merged) — mis. NOTES H3:H10 berlaku untuk semua baris di dalamnya
  try {
    sh.getRange(map.start + 1, 1, lastRow - map.start, lastCol).getMergedRanges().forEach(function (m) {
      var r0 = m.getRow(), c0 = m.getColumn();
      for (var r = r0; r < r0 + m.getNumRows(); r++) for (var c = c0; c < c0 + m.getNumColumns(); c++) {
        values[r - 1][c - 1] = values[r0 - 1][c0 - 1];
        display[r - 1][c - 1] = display[r0 - 1][c0 - 1];
        if (c - 1 === map.notes) notesRow[r] = r0;
      }
    });
  } catch (e) { }

  var seen = {};
  var list = [];
  for (var i = map.start; i < values.length; i++) {
    var row = values[i];
    var name = String(row[map.name] || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    var key = name;
    if (seen[key]) key = name + ' #' + (i + 1);
    seen[key] = true;
    var get = function (k) { return map[k] == null ? '' : row[map[k]]; };
    var getD = function (k) { return map[k] == null ? '' : display[i][map[k]]; };
    var link = String(get('link') || '').trim();
    list.push({
      row: i + 1,
      key: key,
      name: name,
      type: String(get('type') || '').trim(),
      division: divisionOf_(get('type')),
      link: /^https?:\/\//i.test(link) ? link : '',
      linkNote: /^https?:\/\//i.test(link) ? '' : link,
      indicator: String(get('indicator') || '').trim() || 'PRODUCTION',
      target: Number(get('target')) || 0,
      current: Number(get('current')) || 0,
      notes: String(get('notes') || '').trim(),
      notesRow: notesRow[i + 1] || i + 1,
      employees: splitNames_(get('employees')),
      salary: String(getD('salary') || '').trim(),
      salaryDate: String(getD('salaryDate') || '').trim()
    });
  }
  return { list: list, map: map, sheet: sh };
}

function channelsForUser_(list, user) {
  var admin = user.role === 'ADMIN';
  return list.map(function (c) {
    var o = {};
    Object.keys(c).forEach(function (k) { o[k] = c[k]; });
    if (!admin) { delete o.salary; delete o.salaryDate; delete o.notesRow; }
    return o;
  });
}

function updateChannel_(c) {
  return withLock_(function () {
    var data = readChannels_();
    var ch = data.list.filter(function (x) { return x.row === Number(c.row) && x.key === c.key; })[0];
    if (!ch) throw new Error('Baris channel sudah berubah di spreadsheet. Muat ulang data lalu coba lagi.');
    var sh = data.sheet, map = data.map;
    var f = c.fields || {};
    function set(k, v, row) {
      if (map[k] == null || v === undefined) return;
      var cell = sh.getRange(row || ch.row, map[k] + 1);
      if (cell.isPartOfMerge()) cell = cell.getMergedRanges()[0].getCell(1, 1);
      cell.setValue(v);
    }
    if (f.name !== undefined) set('name', String(f.name).trim());
    if (f.type !== undefined) set('type', f.type);
    if (f.link !== undefined) set('link', f.link);
    if (f.indicator !== undefined) set('indicator', f.indicator);
    if (f.target !== undefined) set('target', Number(f.target) || 0);
    if (f.notes !== undefined) set('notes', f.notes, ch.notesRow);
    if (f.employees !== undefined) set('employees', (Array.isArray(f.employees) ? f.employees : splitNames_(f.employees)).join(', '));
    if (f.salary !== undefined) set('salary', f.salary);
    if (f.salaryDate !== undefined) set('salaryDate', f.salaryDate);
    SpreadsheetApp.flush();
    syncEmployees_();
    return { ok: true };
  });
}

function addChannel_(c) {
  if (!String(c.name || '').trim()) throw new Error('Nama channel wajib diisi.');
  return withLock_(function () {
    var data = readChannels_();
    var sh = data.sheet, map = data.map;
    var lastCol = sh.getLastColumn();
    var lastDataRow = data.list.length ? data.list[data.list.length - 1].row : map.start;
    var r = lastDataRow + 1;
    if (r <= sh.getLastRow()) sh.insertRowAfter(lastDataRow);
    if (lastDataRow > map.start) sh.getRange(lastDataRow, 1, 1, lastCol).copyTo(sh.getRange(r, 1, 1, lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    var row = [];
    for (var i = 0; i < lastCol; i++) row.push('');
    function put(k, v) { if (map[k] != null) row[map[k]] = v; }
    put('name', String(c.name).trim());
    put('type', c.type || 'DEV CHANNEL');
    put('link', c.link || '');
    put('indicator', c.indicator || 'PRODUCTION');
    put('target', Number(c.target) || 0);
    put('current', 0);
    put('notes', c.notes || '');
    put('employees', (Array.isArray(c.employees) ? c.employees : splitNames_(c.employees)).join(', '));
    put('salary', c.salary || '');
    put('salaryDate', c.salaryDate || '');
    if (map.pct != null && map.current != null && map.target != null) {
      row[map.pct] = '=IFERROR(' + colLetter_(map.current + 1) + r + '/' + colLetter_(map.target + 1) + r + ',0)';
    }
    sh.getRange(r, 1, 1, lastCol).setValues([row]);
    SpreadsheetApp.flush();
    syncEmployees_();
    return { ok: true };
  });
}

/** Isi kolom CURRENT RESULT dengan total laporan pada periode target berjalan. */
function updateCurrentResults_() {
  var cfg = config_();
  if (!bool_(cfg.SYNC_CURRENT_RESULT)) return;
  var data = readChannels_();
  if (data.map.current == null || !data.list.length) return;
  var kcfg = KPI.normalizeConfig(cfg);
  var today = today_();
  var from = today;
  if (kcfg.targetPeriod === 'WEEKLY') from = KPI.periodRange('week', today).from;
  if (kcfg.targetPeriod === 'MONTHLY') from = KPI.monthStart(today);
  var sums = {};
  readReports_(from).forEach(function (r) {
    if (r.date >= from && r.date <= today) sums[r.channel] = (sums[r.channel] || 0) + (Number(r.qty) || 0);
  });
  var sh = data.sheet, col = data.map.current + 1;
  data.list.forEach(function (c) {
    var v = sums[c.key] || 0;
    if (c.current !== v) {
      var cell = sh.getRange(c.row, col);
      if (!cell.getFormula()) cell.setValue(v);
    }
  });
}

/* =========================== REPORTS =========================== */

function readReports_(sinceDate) {
  var sh = sheet_(SHEETS.REPORTS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.REPORTS.length).getValues().map(function (r, i) {
    return {
      row: i + 2,
      id: String(r[0]),
      ts: r[1] ? new Date(r[1]).toISOString() : '',
      date: dateStr_(r[2]),
      employee: up_(r[3]),
      channel: String(r[4]).replace(/\s+/g, ' ').trim(),
      division: String(r[5]),
      task: String(r[6]),
      qty: Number(r[7]) || 0,
      links: String(r[8] || ''),
      notes: String(r[9] || ''),
      updatedBy: String(r[10] || '')
    };
  }).filter(function (r) { return r.id && r.date && (!sinceDate || r.date >= sinceDate); });
}

function cleanReport_(r, user, channels) {
  var date = dateStr_(r.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid.');
  var today = today_();
  if (date > today) throw new Error('Tidak bisa melapor untuk tanggal yang akan datang.');
  var admin = user.role === 'ADMIN';
  var back = Number(config_().BACKDATE_DAYS) || 3;
  if (!admin && date < KPI.addDays(today, -back)) throw new Error('Laporan hanya bisa diisi/diubah maksimal ' + back + ' hari ke belakang. Hubungi admin.');
  var employee = admin && r.employee ? up_(r.employee) : user.name;
  var ch = channels.filter(function (c) { return c.key === r.channel; })[0];
  if (!ch) throw new Error('Channel tidak ditemukan.');
  if (!admin && ch.employees.indexOf(employee) < 0) throw new Error('Kamu tidak terdaftar di channel ini.');
  var qty = Number(r.qty);
  if (!isFinite(qty) || qty < 0 || qty > 1000) throw new Error('Jumlah tidak valid.');
  return [date, employee, ch.key, ch.division, String(r.task || ch.indicator).slice(0, 80), Math.round(qty * 100) / 100,
    String(r.links || '').slice(0, 5000), String(r.notes || '').slice(0, 2000)];
}

function submitReport_(r, user) {
  return withLock_(function () {
    var vals = cleanReport_(r, user, readChannels_().list);
    var sh = ensureSheet_(SHEETS.REPORTS, HEADERS.REPORTS);
    var id = 'R' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 3).setNumberFormat('@');
    sh.getRange(row, 1, 1, HEADERS.REPORTS.length).setValues([[id, new Date()].concat(vals).concat([user.name])]);
    SpreadsheetApp.flush();
    afterReportChange_();
    return { id: id, report: readReports_().filter(function (x) { return x.id === id; })[0] };
  });
}

function canEditReport_(existing, user) {
  if (user.role === 'ADMIN') return true;
  if (existing.employee !== user.name) throw new Error('Kamu hanya bisa mengubah laporanmu sendiri.');
  var back = Number(config_().BACKDATE_DAYS) || 3;
  if (existing.date < KPI.addDays(today_(), -back)) throw new Error('Laporan lebih dari ' + back + ' hari tidak bisa diubah. Hubungi admin.');
  return true;
}

function updateReport_(r, user) {
  return withLock_(function () {
    var existing = readReports_().filter(function (x) { return x.id === r.id; })[0];
    if (!existing) throw new Error('Laporan tidak ditemukan.');
    canEditReport_(existing, user);
    if (user.role !== 'ADMIN') r.employee = existing.employee;
    var vals = cleanReport_(r, user, readChannels_().list);
    var sh = sheet_(SHEETS.REPORTS);
    sh.getRange(existing.row, 3, 1, vals.length).setValues([vals]);
    sh.getRange(existing.row, 11).setValue(user.name);
    SpreadsheetApp.flush();
    afterReportChange_();
    return { ok: true };
  });
}

function deleteReport_(id, user) {
  return withLock_(function () {
    var existing = readReports_().filter(function (x) { return x.id === id; })[0];
    if (!existing) throw new Error('Laporan tidak ditemukan.');
    canEditReport_(existing, user);
    sheet_(SHEETS.REPORTS).deleteRow(existing.row);
    SpreadsheetApp.flush();
    afterReportChange_();
    return { ok: true };
  });
}

function afterReportChange_() {
  try { updateCurrentResults_(); } catch (e) { console.error(e); }
}

/* =========================== DATA FOR APP =========================== */

function publicConfig_(cfg) {
  return {
    COMPANY_NAME: cfg.COMPANY_NAME, TIMEZONE: cfg.TIMEZONE, WORK_DAYS: cfg.WORK_DAYS,
    TARGET_PERIOD: cfg.TARGET_PERIOD, WEIGHT_OUTPUT: cfg.WEIGHT_OUTPUT, WEIGHT_DISCIPLINE: cfg.WEIGHT_DISCIPLINE,
    EMPLOYEE_SEE_ALL: cfg.EMPLOYEE_SEE_ALL, BACKDATE_DAYS: cfg.BACKDATE_DAYS, YT_SYNC_HOURS: cfg.YT_SYNC_HOURS,
    SYNC_CURRENT_RESULT: cfg.SYNC_CURRENT_RESULT, REPORT_DAYS_LOADED: cfg.REPORT_DAYS_LOADED, YT_MAX_VIDEOS: cfg.YT_MAX_VIDEOS
  };
}

function getData_(user) {
  var cfg = config_();
  var today = today_();
  var admin = user.role === 'ADMIN';
  var seeAll = admin || bool_(cfg.EMPLOYEE_SEE_ALL);
  var channels = readChannels_().list;
  var since = KPI.addDays(today, -(Number(cfg.REPORT_DAYS_LOADED) || 120));
  var reports = readReports_(since).map(function (r) { delete r.row; return r; });
  if (!seeAll) reports = reports.filter(function (r) { return r.employee === user.name; });
  var emps = readEmployees_();
  var out = {
    user: publicUser_(user),
    today: today,
    serverTime: new Date().toISOString(),
    backendVersion: BACKEND_VERSION,
    config: publicConfig_(cfg),
    channels: channelsForUser_(channels, user),
    employees: emps.filter(function (e) { return seeAll || e.name === user.name || e.role === 'ADMIN'; })
      .map(function (e) { return { name: e.name, role: e.role, active: e.active }; }),
    reports: reports,
    ytLastSync: Number(PropertiesService.getScriptProperties().getProperty('YT_LAST_SYNC') || 0)
  };
  if (admin) {
    out.admin = { employees: employeesForAdmin_(), spreadsheetUrl: ss_().getUrl(), configRaw: cfg };
  }
  return out;
}

function saveConfig_(c) {
  return withLock_(function () {
    var sh = ensureSheet_(SHEETS.CONFIG, HEADERS.CONFIG);
    ensureConfigDefaults_();
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    Object.keys(c).forEach(function (k) {
      if (!DEFAULT_CONFIG.some(function (d) { return d[0] === k; })) return;
      for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === k) { sh.getRange(i + 2, 2).setValue(String(c[k])); return; }
    });
    _cfg = null;
    return { config: config_() };
  });
}

function writeKpiSummary_() {
  var cfg = config_();
  var today = today_();
  var channels = readChannels_().list;
  var reports = readReports_(KPI.addDays(KPI.monthStart(today), -1));
  var emps = readEmployees_();
  var base = { channels: channels, reports: reports, employees: emps, today: today, config: cfg };
  var m = KPI.compute(merge_(base, KPI.periodRange('month', today)));
  var d = KPI.compute(merge_(base, KPI.periodRange('today', today)));
  var dmap = {};
  d.list.forEach(function (e) { dmap[e.name] = e; });
  var names = { DEV: 'Channel Development', STAFF: 'Staff Channel', CLIENT: 'Client Channel', OTHER: 'Lainnya' };
  var now = new Date();
  var rows = m.list.map(function (e) {
    var t = dmap[e.name] || {};
    return [e.name, e.divisions.map(function (x) { return names[x] || x; }).join(', '), e.target, e.actual,
      e.achievement == null ? '' : e.achievement, e.discipline == null ? '' : e.discipline,
      e.score == null ? '' : e.score, e.grade.code + ' — ' + e.grade.label, t.target || 0, t.actual || 0, now];
  });
  var sh = ensureSheet_(SHEETS.KPI, HEADERS.KPI);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.KPI.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, HEADERS.KPI.length).setValues(rows);
    sh.getRange(2, 5, rows.length, 2).setNumberFormat('0%');
  }
}

function merge_(a, b) { var o = {}; [a, b].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); }); return o; }

/* =========================== YOUTUBE =========================== */

function parseYtLink_(link) {
  var s = String(link || '').trim();
  if (!/youtu/i.test(s)) return null;
  try { s = decodeURIComponent(s); } catch (e) { }
  var m = s.match(/\/channel\/(UC[\w-]{20,})/);
  if (m) return { id: m[1] };
  m = s.match(/\/@([^\/?#\s]+)/);
  if (m) return { handle: '@' + m[1] };
  m = s.match(/\/user\/([^\/?#\s]+)/);
  if (m) return { user: m[1] };
  m = s.match(/\/c\/([^\/?#\s]+)/);
  if (m) return { handle: '@' + m[1] };
  return null;
}

function resolveChannelId_(p) {
  var res;
  if (p.handle) {
    try { res = YouTube.Channels.list('id', { forHandle: p.handle }); if (res.items && res.items.length) return res.items[0].id; } catch (e) { }
    try {
      res = YouTube.Search.list('snippet', { q: p.handle, type: 'channel', maxResults: 1 });
      if (res.items && res.items.length) return res.items[0].snippet.channelId;
    } catch (e) { }
  }
  if (p.user) {
    try { res = YouTube.Channels.list('id', { forUsername: p.user }); if (res.items && res.items.length) return res.items[0].id; } catch (e) { }
  }
  return null;
}

function isoDur_(s) {
  var m = String(s || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

function chunk_(arr, n) { var out = []; for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

function syncYouTube() {
  if (typeof YouTube === 'undefined') throw new Error('Layanan "YouTube Data API v3" belum ditambahkan di Apps Script (menu Services +).');
  var cfg = config_();
  var props = PropertiesService.getScriptProperties();
  var idCache = JSON.parse(props.getProperty('YT_ID_CACHE') || '{}');
  var channels = readChannels_().list;
  var keyToId = {}, status = {};

  channels.forEach(function (c) {
    var p = parseYtLink_(c.link);
    if (!p) { status[c.key] = 'NO_LINK'; return; }
    var cacheKey = p.id || p.handle || p.user;
    var id = p.id || idCache[cacheKey];
    if (!id) { id = resolveChannelId_(p); if (id) idCache[cacheKey] = id; }
    if (!id) { status[c.key] = 'NOT_FOUND'; return; }
    keyToId[c.key] = id;
  });
  props.setProperty('YT_ID_CACHE', JSON.stringify(idCache));

  var ids = Object.keys(keyToId).map(function (k) { return keyToId[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  var info = {};
  chunk_(ids, 50).forEach(function (batch) {
    var res = YouTube.Channels.list('snippet,statistics,contentDetails', { id: batch.join(','), maxResults: 50 });
    (res.items || []).forEach(function (it) { info[it.id] = it; });
  });

  var maxVideos = Math.min(500, Math.max(1, Number(cfg.YT_MAX_VIDEOS) || 50));
  var now = new Date();
  var videoRows = [];
  ids.forEach(function (id) {
    var ch = info[id];
    if (!ch || !ch.contentDetails || !ch.contentDetails.relatedPlaylists) return;
    var uploads = ch.contentDetails.relatedPlaylists.uploads;
    var vids = [], token = null;
    try {
      do {
        var pl = YouTube.PlaylistItems.list('contentDetails', { playlistId: uploads, maxResults: 50, pageToken: token || undefined });
        (pl.items || []).forEach(function (i) { vids.push(i.contentDetails.videoId); });
        token = pl.nextPageToken;
      } while (token && vids.length < maxVideos);
    } catch (e) { /* channel tanpa video */ }
    vids = vids.slice(0, maxVideos);
    chunk_(vids, 50).forEach(function (batch) {
      var vr = YouTube.Videos.list('snippet,statistics,contentDetails', { id: batch.join(','), maxResults: 50 });
      (vr.items || []).forEach(function (v) {
        var th = v.snippet.thumbnails || {};
        var thumb = (th.medium || th.default || {}).url || '';
        videoRows.push([v.id, id, v.snippet.title, v.snippet.publishedAt, thumb, isoDur_(v.contentDetails && v.contentDetails.duration),
          Number(v.statistics.viewCount) || 0, Number(v.statistics.likeCount) || 0, Number(v.statistics.commentCount) || 0, now]);
      });
    });
  });

  var chRows = channels.map(function (c) {
    var id = keyToId[c.key];
    var it = id && info[id];
    if (!it) return [c.key, id || '', '', '', '', '', '', '', now, status[c.key] || 'NOT_FOUND'];
    var th = it.snippet.thumbnails || {};
    return [c.key, id, it.snippet.title, it.snippet.customUrl || '', (th.medium || th.default || {}).url || '',
      Number(it.statistics.subscriberCount) || 0, Number(it.statistics.viewCount) || 0, Number(it.statistics.videoCount) || 0, now, 'OK'];
  });

  replaceSheet_(SHEETS.YT_CHANNELS, HEADERS.YT_CHANNELS, chRows);
  replaceSheet_(SHEETS.YT_VIDEOS, HEADERS.YT_VIDEOS, videoRows);

  var today = today_();
  writeDailyBlock_(SHEETS.YT_HISTORY, HEADERS.YT_HISTORY, 'HIST', videoRows.map(function (v) { return [today, v[0], v[1], v[6]]; }), today);
  var chHist = ids.filter(function (id) { return info[id]; }).map(function (id) {
    var s = info[id].statistics;
    return [today, id, Number(s.subscriberCount) || 0, Number(s.viewCount) || 0, Number(s.videoCount) || 0];
  });
  writeDailyBlock_(SHEETS.YT_CH_HISTORY, HEADERS.YT_CH_HISTORY, 'CHIST', chHist, today);
  props.setProperty('YT_LAST_SYNC', String(Date.now()));
}

function replaceSheet_(name, headers, rows) {
  var sh = ensureSheet_(name, headers, { textCols: name === SHEETS.YT_VIDEOS ? [1, 4] : [] });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/** Simpan 1 blok baris per hari. Blok hari ini selalu di paling bawah & ditimpa saat sinkron berikutnya. */
function writeDailyBlock_(name, headers, prefix, rows, today) {
  var sh = ensureSheet_(name, headers, { textCols: [1, 2] });
  var p = PropertiesService.getScriptProperties();
  var idx = JSON.parse(p.getProperty(prefix + '_INDEX') || '{}');
  var last = sh.getLastRow();
  var start = last + 1;
  if (idx[today] && idx[today][0] + idx[today][1] - 1 === last && last > 1) {
    start = idx[today][0];
    if (idx[today][1] > 0) sh.getRange(start, 1, idx[today][1], headers.length).clearContent();
  }
  if (rows.length) {
    sh.getRange(start, 1, rows.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, rows.length, headers.length).setValues(rows);
  }
  idx[today] = [start, rows.length];
  var dates = Object.keys(idx).sort();
  while (dates.length > 200) delete idx[dates.shift()];
  p.setProperty(prefix + '_INDEX', JSON.stringify(idx));
}

/** Baca baris history mulai tanggal tertentu (memakai index agar tidak membaca seluruh sheet). */
function readHistorySince_(name, prefix, fromDate, ncols) {
  var sh = sheet_(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var idx = JSON.parse(PropertiesService.getScriptProperties().getProperty(prefix + '_INDEX') || '{}');
  var dates = Object.keys(idx).sort().filter(function (d) { return d >= fromDate; });
  var startRow = 2;
  if (dates.length && idx[dates[0]][0] >= 2) {
    var check = String(sh.getRange(idx[dates[0]][0], 1).getDisplayValue());
    if (check === dates[0]) startRow = idx[dates[0]][0];
  }
  var n = sh.getLastRow() - startRow + 1;
  if (n < 1) return [];
  return sh.getRange(startRow, 1, n, ncols).getValues().filter(function (r) {
    r[0] = dateStr_(r[0]);
    return r[0] && r[0] >= fromDate;
  });
}

function getYouTube_() {
  var props = PropertiesService.getScriptProperties();
  var today = today_();
  var out = { lastSync: Number(props.getProperty('YT_LAST_SYNC') || 0), channels: {}, videos: [] };
  var shC = sheet_(SHEETS.YT_CHANNELS), shV = sheet_(SHEETS.YT_VIDEOS);
  if (!shC || shC.getLastRow() < 2) return out;

  // nilai kemarin (blok tanggal terakhir sebelum hari ini) untuk menghitung pertumbuhan
  function prevMap(name, prefix, ncols, keyCol, valCols) {
    var idx = JSON.parse(props.getProperty(prefix + '_INDEX') || '{}');
    var prev = Object.keys(idx).sort().filter(function (d) { return d < today; }).pop();
    var map = {};
    if (!prev || !idx[prev][1]) return { date: null, map: map };
    var sh = sheet_(name);
    var rows = sh.getRange(idx[prev][0], 1, idx[prev][1], ncols).getValues();
    if (dateStr_(rows[0][0]) !== prev) return { date: null, map: map };
    rows.forEach(function (r) { map[r[keyCol]] = valCols.map(function (c) { return Number(r[c]) || 0; }); });
    return { date: prev, map: map };
  }
  var pv = prevMap(SHEETS.YT_HISTORY, 'HIST', 4, 1, [3]);
  var pc = prevMap(SHEETS.YT_CH_HISTORY, 'CHIST', 5, 1, [2, 3, 4]);
  out.prevDate = pv.date || pc.date;

  shC.getRange(2, 1, shC.getLastRow() - 1, HEADERS.YT_CHANNELS.length).getValues().forEach(function (r) {
    var id = String(r[1]);
    var p = pc.map[id];
    out.channels[String(r[0])] = {
      id: id, title: String(r[2]), handle: String(r[3]), thumb: String(r[4]),
      subs: Number(r[5]) || 0, views: Number(r[6]) || 0, videos: Number(r[7]) || 0,
      updated: r[8] ? new Date(r[8]).toISOString() : '', status: String(r[9]),
      dSubs: p ? (Number(r[5]) || 0) - p[0] : null, dViews: p ? (Number(r[6]) || 0) - p[1] : null
    };
  });
  if (shV && shV.getLastRow() > 1) {
    out.videos = shV.getRange(2, 1, shV.getLastRow() - 1, HEADERS.YT_VIDEOS.length).getValues().map(function (r) {
      var prev = pv.map[r[0]];
      var pub = r[3];
      if (Object.prototype.toString.call(pub) === '[object Date]') pub = pub.toISOString();
      return { id: String(r[0]), ch: String(r[1]), t: String(r[2]), p: String(pub), th: String(r[4]), d: Number(r[5]) || 0,
        v: Number(r[6]) || 0, l: Number(r[7]) || 0, c: Number(r[8]) || 0, dv: prev ? (Number(r[6]) || 0) - prev[0] : null };
    }).filter(function (v) { return v.id; });
  }
  return out;
}

function getHistory_(channelId, days) {
  days = Math.min(120, Math.max(2, days || 30));
  var from = KPI.addDays(today_(), -days + 1);
  var ch = readHistorySince_(SHEETS.YT_CH_HISTORY, 'CHIST', from, 5)
    .filter(function (r) { return r[1] === channelId; })
    .map(function (r) { return { d: r[0], subs: Number(r[2]) || 0, views: Number(r[3]) || 0, videos: Number(r[4]) || 0 }; });
  var vids = {};
  readHistorySince_(SHEETS.YT_HISTORY, 'HIST', from, 4).forEach(function (r) {
    if (r[2] !== channelId) return;
    (vids[r[1]] = vids[r[1]] || []).push([r[0], Number(r[3]) || 0]);
  });
  return { channelId: channelId, channel: ch, videos: vids };
}
