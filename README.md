# KPI Tracker — Channel, Laporan Harian & Views YouTube

Aplikasi web (bisa di-install di HP/laptop) yang terhubung langsung ke Google Spreadsheet kamu.

| Bagian | Isi |
|---|---|
| **Beranda** | Skor KPI, output hari ini, views & subscriber, video yang naik 24 jam. Admin: siapa yang belum lapor, KPI per divisi, jadwal gajian |
| **Laporan** | Karyawan isi laporan harian (channel, jumlah, link, catatan). Bisa edit/hapus sampai N hari ke belakang |
| **KPI** | Peringkat karyawan real-time per periode (hari ini, minggu ini, bulan ini, bulan lalu, 30 hari, kustom) & per divisi |
| **Channel** | Semua channel dari sheet: views, subscriber, pertumbuhan 24 jam, grafik 30 hari, daftar video + tren per video |
| **Admin** | Kelola karyawan & PIN, edit channel/target, **gaji (hanya admin)**, pengaturan KPI |
| **Pengaturan** | Tema Terang/Gelap/Sistem, ganti PIN, cek & pasang pembaruan |

```
kpi-tracker/
├── index.html, css/, js/, icons/   ← aplikasi (di-hosting di GitHub Pages)
├── version.js                       ← NOMOR VERSI aplikasi (naikkan setiap update)
├── config.js                        ← URL server (API_URL)
├── sw.js, manifest.webmanifest      ← supaya bisa di-install & di-update
└── backend/                         ← kode Google Apps Script (ditempel ke spreadsheet)
    ├── Code.gs
    ├── Kpi.gs   (salinan persis js/kpi.js)
    └── appsscript.json
```

---

## ⚠️ Lakukan ini dulu: keamanan gaji

Spreadsheet kamu saat ini bisa dibuka oleh **siapa pun yang punya link**, padahal berisi kolom **SALARY**.
Aplikasi ini tidak butuh spreadsheet dibagikan ke karyawan, karena server berjalan atas nama akunmu.

1. Buka spreadsheet → **Share** → bagian *General access* → ubah ke **Restricted**.
2. Jangan bagikan spreadsheet ke karyawan. Mereka cukup memakai aplikasi.

Server hanya mengirim kolom SALARY & DATE OF SALARY ke akun dengan peran **ADMIN**.

---

## 1. Pasang backend di spreadsheet (±10 menit, sekali saja)

1. Buka spreadsheet → menu **Extensions → Apps Script**.
2. Di editor:
   - Hapus isi `Code.gs`, lalu tempel isi file **`backend/Code.gs`**.
   - Klik **+ → Script**, beri nama `Kpi`, lalu tempel isi **`backend/Kpi.gs`**.
   - **Project Settings** (ikon gerigi) → centang **Show "appsscript.json"** → kembali ke Editor, buka `appsscript.json`, ganti isinya dengan **`backend/appsscript.json`**.
   - Simpan (Ctrl+S). Di panel kiri bagian **Services** sekarang otomatis muncul **YouTube**, karena layanan ini sudah diaktifkan oleh `appsscript.json`.
     **Jangan** tambahkan lagi lewat tombol **+**. Kalau ditambah lagi, akan muncul error *"Found a service identifier used more than once: YouTube"*.
3. Simpan (Ctrl+S). Pilih fungsi **`setup`** di toolbar, lalu klik **Run**. Izinkan akses saat diminta (*Advanced → Go to … (unsafe)* itu normal untuk script milikmu sendiri).
4. Setup akan:
   - membuat sheet baru: `EMPLOYEES`, `DAILY REPORT`, `CONFIG`, `KPI SUMMARY`, `YT CHANNELS`, `YT VIDEOS`, `YT HISTORY`, `YT CHANNEL HISTORY`;
   - membuat akun **OWNER (ADMIN)** + akun untuk setiap nama di kolom *RELEVANT EMPLOYEES* dengan **PIN acak 6 digit** (lihat di sheet `EMPLOYEES`);
   - memasang trigger tiap jam (hitung KPI + sinkron views YouTube);
   - sinkron YouTube pertama kali.
5. **Deploy → New deployment** → tipe **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

> Setelah ini ada menu **🎯 KPI Tracker** di spreadsheet (Setup, Sinkron YouTube sekarang, Hitung ulang KPI, Lihat PIN admin).

## 2. Online-kan aplikasinya (GitHub Pages, gratis)

1. Buka `config.js`, isi `API_URL: 'https://script.google.com/macros/s/…/exec'`.
2. Buat akun/login di github.com → **New repository** (misal `kpi-tracker`, *Public*).
3. **Add file → Upload files** → seret **semua isi** folder `kpi-tracker` (termasuk `.nojekyll`) → **Commit**.
4. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / **(root)** → **Save**.
5. Tunggu ±1 menit. Alamat aplikasimu: `https://<username>.github.io/kpi-tracker/`.

> Kode aplikasi di repo publik tidak berisi data apa pun; semua data tetap di spreadsheet & butuh login PIN.

## 3. Bagikan ke karyawan

- Kirim link aplikasi + PIN masing-masing (dari sheet `EMPLOYEES`).
- **Install di HP:** Android/Chrome → menu ⋮ → **Install app**. iPhone/Safari → **Share → Add to Home Screen**.
- **PC / laptop (Windows/Mac):** buka link di **Chrome** atau **Edge** → klik tombol **"Pasang di PC"** di aplikasi (atau ikon *Install* di kolom alamat).
  Aplikasi muncul di Start Menu, bisa di-pin ke taskbar, terbuka di jendela sendiri, dan menerima update yang sama seperti di HP.
  Klik kanan ikon di taskbar untuk pintasan cepat: *Isi laporan*, *KPI*, *Channel*.
- Karyawan bisa mengganti PIN sendiri di menu **Akun**.

---

## Cara memperbarui aplikasi (bug fix / fitur baru)

### Tampilan / fitur aplikasi (file html, css, js)
1. Ubah file yang perlu.
2. Buka **`version.js`** → naikkan `APP_VERSION` (misal `1.0.0` → `1.1.0`), tulis catatan di `APP_RELEASE_NOTES`.
3. Upload/commit ke GitHub.
4. Di perangkat karyawan otomatis muncul banner **"Versi baru 1.1.0 tersedia — Perbarui sekarang"** (dicek tiap 30 menit, atau lewat **Akun → Cek pembaruan**). Satu ketukan, aplikasi langsung terpasang versi baru.

> Kalau lupa menaikkan versi, perangkat karyawan **tidak** akan menerima update.

### Backend (Code.gs)
1. Edit di Apps Script → Simpan.
2. **Deploy → Manage deployments** → ikon pensil → *Version*: **New version** → **Deploy**.
   URL tetap sama, jadi aplikasi tidak perlu diubah.
3. Kalau mengubah rumus KPI: ubah `js/kpi.js` **dan** salin isinya ke `Kpi.gs`.

---

## Cara KPI dihitung

- **Target periode** = TARGET channel × hari kerja yang sudah berjalan. Kalau satu channel dipegang 2 orang, target dibagi rata.
- **Capaian output** = total *Jumlah* di laporan ÷ target periode.
- **Disiplin laporan** = hari kerja yang ada laporannya ÷ hari kerja yang sudah berjalan.
- **Skor KPI** = capaian (maks. 100%) × 80% + disiplin × 20%.
- **Status**: ≥90 Sangat baik · ≥75 Baik · ≥60 Cukup · <60 Perlu perhatian.

Semuanya bisa diubah di **Admin → Pengaturan** (atau sheet `CONFIG`). Nilai awalnya:

| Pengaturan | Awal | Catatan |
|---|---|---|
| `TARGET_PERIOD` | `DAILY` | Kolom TARGET dianggap **per hari**. Ganti ke `WEEKLY`/`MONTHLY` kalau maksudnya lain |
| `WORK_DAYS` | `1,2,3,4,5` | Senin–Jumat. Tambah `6` kalau Sabtu masuk kerja |
| `SYNC_CURRENT_RESULT` | `TRUE` | Kolom **CURRENT RESULT** diisi otomatis dari laporan hari ini, sehingga kolom PRECENTAGE ikut real-time. Angka manual yang lama akan tertimpa |
| `EMPLOYEE_SEE_ALL` | `TRUE` | Karyawan bisa melihat KPI & laporan rekan (gaji tetap tersembunyi) |
| `BACKDATE_DAYS` | `3` | Batas isi/ubah laporan mundur bagi karyawan |
| `YT_SYNC_HOURS` | `3` | Sinkron views tiap 3 jam |

## Pelacakan views YouTube

- Memakai **YouTube Data API** resmi (data publik, tidak perlu YouTube Studio / login channel).
- Link yang didukung: `youtube.com/channel/UC…`, `youtube.com/@handle` (termasuk handle Korea/Jepang), `/user/…`.
- Channel tanpa link (misal channel klien Pixeling) tetap dihitung KPI-nya, hanya tanpa data views.
- Snapshot harian disimpan di `YT HISTORY`, jadi grafik pertumbuhan muncul **mulai hari ke-2** setelah setup.
- Kolom **"Upload YT"** di detail KPI menghitung video yang benar-benar terbit di YouTube. Ini bisa dipakai untuk mencocokkan dengan laporan karyawan.

## Mengedit lewat spreadsheet langsung

Semua tetap bisa diedit di spreadsheet. Aplikasi membaca ulang data setiap 60 detik.
- Tambah channel / ganti target / ganti karyawan → edit `CHANNEL REPORT` seperti biasa (nama baru otomatis dibuatkan akun dalam ≤1 jam, atau jalankan menu *Setup*).
- Ganti PIN / nonaktifkan karyawan / jadikan admin → sheet `EMPLOYEES`.
- Koreksi laporan → sheet `DAILY REPORT`.
- Jangan ganti nama kolom header di baris 1–2 `CHANNEL REPORT`; urutan kolom boleh berubah.
- Laporan terhubung ke **nama channel** (kolom CHANNEL NAME). Kalau nama channel diganti di sheet, laporan lama dengan nama lama tidak ikut pindah.

## Coba tanpa server (mode demo)

Buka aplikasi tanpa `API_URL` → **Coba mode demo**. Datanya fiktif dan tersimpan di browser saja.
Login demo: `OWNER / 1234` (admin), `RINA / 1111` (karyawan).
