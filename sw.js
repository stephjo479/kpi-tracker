/* Service worker: simpan aplikasi di perangkat (bisa dibuka offline) dan
 * kelola update. Versi diambil dari version.js — jangan diubah di sini. */
importScripts('version.js');
var CACHE = 'kpi-tracker-' + APP_VERSION;
var SHELL = [
  './', 'index.html', 'version.js', 'config.js', 'manifest.webmanifest',
  'css/style.css', 'js/kpi.js', 'js/charts.js', 'js/api.js', 'js/demo.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(u, { cache: 'reload' }).then(function (r) { if (r.ok) return c.put(u, r); });
    }));
  }));
  // tidak langsung aktif: menunggu karyawan menekan "Perbarui"
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('kpi-tracker-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) {
    // font & gambar thumbnail: cache seadanya
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE + '-ext').then(function (c) {
        return c.match(req).then(function (hit) {
          return hit || fetch(req).then(function (r) { c.put(req, r.clone()); return r; });
        });
      }));
    }
    return;
  }
  if (url.searchParams.has('nocache')) return; // cek update
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req).catch(function () { return caches.match('index.html'); });
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
