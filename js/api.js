/* Koneksi ke backend Google Apps Script (atau backend demo). */
var Store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } },
  getJSON: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  setJSON: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

var API = (function () {
  function url() { return Store.get('apiUrl') || (window.APP_CONFIG || {}).API_URL || ''; }
  function isDemo() { return Store.get('demo') === '1'; }

  /** Aksi baca: aman diulang otomatis bila koneksi putus / server sibuk. */
  var READ = { getData: 1, getYouTube: 1, getHistory: 1, publicInfo: 1, ping: 1, login: 1, getAudit: 1, getAttendanceDetail: 1, getAttendancePhoto: 1, getAttachment: 1 };
  /** Aksi yang memang lama di server (sinkron YouTube, backup, kirim email). */
  var SLOW = { syncYouTube: 1, backupNow: 1, sendWeeklyTest: 1, sendReminderTest: 1, purgeTrialData: 1 };
  function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function err(msg, extra) { var e = new Error(msg); Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; }); return e; }

  function once(action, body) {
    var read = !!READ[action];
    var ms = SLOW[action] ? 330000 : read ? 30000 : 60000;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, ms);
    var req = fetch(url(), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    });
    // browser lama tanpa AbortController: tetap dibatasi waktu
    if (!ctrl) req = Promise.race([req, wait(ms).then(function () { timedOut = true; throw new Error('timeout'); })]);
    return req.catch(function () {
      if (timedOut) throw err(read ? 'Server terlalu lama merespons. Periksa koneksi lalu coba lagi.'
        : 'Server terlalu lama merespons. Data mungkin sudah tersimpan — muat ulang halaman dan periksa dulu sebelum mengirim ulang.', { timeout: true });
      throw err('Tidak bisa terhubung ke server. Periksa koneksi internet.', { offline: true });
    }).then(function (res) {
      return res.json().catch(function () {
        throw err('Respons server tidak valid. Pastikan URL Web App benar dan aksesnya "Anyone".', { badResponse: true });
      });
    }).then(function (j) {
      if (!j.ok) throw err(j.error || 'Terjadi kesalahan.', { code: j.code, retry: !!j.retry });
      return j.data;
    }).then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function call(action, params) {
    var body = Object.assign({ action: action, token: Store.get('token') }, params || {});
    if (isDemo()) return Demo.handle(body);
    if (!url()) return Promise.reject(new Error('Server belum diatur. Isi API_URL di config.js.'));
    var read = !!READ[action];
    if (!read && isOffline()) return Promise.reject(err('Kamu sedang offline. Sambungkan internet lalu kirim lagi — isianmu tidak hilang.', { offline: true }));
    var attempt = 0;
    function run() {
      return once(action, body).catch(function (e) {
        // Ulang otomatis: aksi baca bila koneksi putus / lama / server sibuk; aksi tulis HANYA bila server sibuk antre (belum ada yang ditulis).
        var again = attempt < 2 && ((read && (e.offline || e.timeout || e.code === 'BUSY')) || (!read && e.code === 'BUSY' && e.retry));
        if (!again || (e.offline && isOffline())) throw e;
        attempt++;
        return wait(1500 * attempt + Math.random() * 1000).then(run);
      });
    }
    return run();
  }

  return { call: call, url: url, isDemo: isDemo };
})();
