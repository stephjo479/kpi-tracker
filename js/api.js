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

  function call(action, params) {
    var body = Object.assign({ action: action, token: Store.get('token') }, params || {});
    if (isDemo()) return Demo.handle(body);
    if (!url()) return Promise.reject(new Error('Server belum diatur. Isi API_URL di config.js.'));
    return fetch(url(), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    }).catch(function () {
      var e = new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
      e.offline = true;
      throw e;
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error('Respons server tidak valid. Pastikan URL Web App benar dan aksesnya "Anyone".');
      });
    }).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || 'Terjadi kesalahan.'); e.code = j.code; throw e; }
      return j.data;
    });
  }

  return { call: call, url: url, isDemo: isDemo };
})();
