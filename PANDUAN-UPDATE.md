# Panduan Update KPI Tracker ke Versi 1.3.0 (Absensi)

Panduan ini untuk **Arya (admin)**. Waktu yang dibutuhkan ±15–20 menit.
Kerjakan di **PC/laptop**, sebaiknya **sore/malam setelah jam kerja** supaya tidak mengganggu karyawan.

> **Belum sempat memasang update 1.2.0?** Tidak masalah. Update 1.3.0 ini **sudah termasuk semua isi 1.2.0**
> (struktur tim, gaji & pengingat, update Katon, perbaikan login). Ikuti saja panduan ini dari awal sampai akhir. Semuanya terpasang sekaligus.

---

## Apa saja yang baru di 1.3.0?

| Fitur | Penjelasan singkat |
|---|---|
| **Presensi masuk & pulang** | Tombol di Beranda & menu **Absensi**. Jam dicatat oleh **server** (jam di HP tidak berpengaruh). |
| **Jam kerja** | Masuk **09.00 WIB**, pulang **17.00 WIB**. |
| **Terlambat** | Presensi masuk **lewat jam 09.00** → muncul popup komik **"TELAT! DENDA Rp 10.000"** 💥 |
| **Lembur** | Presensi pulang **lewat jam 17.00** → ditanya *"Kamu lembur?"*. Kalau ya: isi **lembur untuk apa** + **atas perintah siapa**. |
| **Pulang lebih awal** | Presensi pulang sebelum 17.00 → diminta alasan singkat. |
| **Pengajuan izin** | Izin terlambat, tidak masuk, **sakit (bisa lampirkan foto surat dokter, opsional)**, cuti, pulang awal. |
| **Persetujuan izin** | Arya & Zul menyetujui/menolak. Izin milik sendiri harus disetujui manager yang lain. |
| **Masuk ke KPI** | Skor KPI = Output **70%** + Disiplin laporan **10%** + **Kehadiran 20%**. |
| **Rekap bulanan** | Tepat waktu, terlambat, alpa, izin, sakit, lembur, total denda per orang. Untuk evaluasi bulanan. |
| **Siapa yang absen** | Semua karyawan + **Arya & Zul**. **Kim Euijong (Bos) tidak perlu absen.** |

**Aturan penilaian kehadiran** (bisa diubah di Admin → Pengaturan → Absensi & denda):
- Tepat waktu = **100%** · Terlambat = **50%** · Tidak hadir tanpa keterangan (alpa) = **0%**
- **Izin terlambat yang disetujui** → denda batal dan dianggap tepat waktu.
- **Izin tidak masuk / sakit / cuti yang disetujui** → hari itu **tidak dihitung** sama sekali, termasuk target output-nya. Karyawan yang sakit tidak dirugikan.
- Absensi **mulai dihitung besok** (sehari setelah update dipasang). Hari pemasangan = hari uji coba.

---

## Bagian A — Siapkan file

1. Download file **`kpi-tracker.zip`** yang aku kirim.
2. Klik kanan file zip → **Extract All…** → **Extract**.
3. Akan muncul folder `kpi-tracker`. Di dalamnya ada folder **`backend`** berisi 3 file:
   - `Code.gs` ← **dipakai**
   - `Kpi.gs` ← **dipakai**
   - `appsscript.json` ← **tidak perlu diubah**

> Cara membuka file `.gs`: klik kanan → **Open with** → **Notepad**.

---

## Bagian B — Update backend (Google Apps Script)

### B1. Ganti isi `Code.gs`
1. Buka spreadsheet kamu → menu **Extensions** → **Apps Script**.
2. Di panel kiri, klik **`Code.gs`**.
3. Klik di area kode → tekan **Ctrl+A** (pilih semua) → tekan **Delete** sampai kosong.
4. Buka `backend/Code.gs` (yang baru) dengan Notepad → **Ctrl+A** → **Ctrl+C**.
5. Kembali ke Apps Script → klik di area kode yang kosong → **Ctrl+V**.

### B2. Ganti isi `Kpi.gs`
6. Di panel kiri, klik **`Kpi.gs`**.
7. Ulangi langkah yang sama: **Ctrl+A → Delete**, lalu tempel isi `backend/Kpi.gs` yang baru.

### B3. Simpan
8. Tekan **Ctrl+S**. Pastikan tidak ada tulisan error berwarna merah.
   **Jangan** mengubah `appsscript.json` dan **jangan** menambah apa pun lewat tombol **Services +**.

### B4. Jalankan `setup`
9. Lihat toolbar di atas kode. Di sebelah tombol **Run** dan **Debug** ada pilihan fungsi. Pastikan tertulis **`setup`**.
10. Klik **Run** ▶.

### B5. Berikan izin (akan muncul karena ada fitur baru)
11. Muncul jendela **"Authorization required"** → klik **Review permissions**.
12. Pilih akun Google kamu.
13. Kalau muncul **"Google hasn't verified this app"**: klik **Advanced** → **Go to … (unsafe)**.
    Ini normal untuk script buatan sendiri.
14. Klik **Allow**. Izin baru yang diminta:
    - **Google Drive**: untuk menyimpan **foto surat dokter** di folder **privat** milikmu, yaitu *"KPI Tracker — Lampiran Izin (privat)"*.
    - **Kirim email**: untuk **email pengingat gajian H-5** (dari update 1.2.0).

### B6. Tunggu sampai selesai
15. Proses berjalan ±30–90 detik.
    - Kalau terasa lama, buka **tab spreadsheet**. Mungkin ada popup **"Setup selesai"** → klik **OK**.
16. Lihat **Execution log** di bagian bawah. Harus ada baris seperti ini:
    ```
    Setup selesai.
    • Struktur tim: ...
    • Update data 1.2.0: ...
    • Absensi 1.3.0: absensi mulai dihitung 2026-xx-xx (hari ini = uji coba) ; bobot KPI: output 70 / laporan 10 / kehadiran 20 ; folder lampiran Drive siap
    • Login admin: ARYA / PIN ...... ; ZUL / PIN ......
    • Sinkron YouTube: OK
    ```
    ✅ **Catat PIN ARYA dan PIN ZUL** kalau belum pernah dicatat.

---

## Bagian C — Deploy versi baru (WAJIB, jangan dilewati)

Tanpa langkah ini, aplikasi **tetap memakai kode lama**.

1. Di Apps Script, klik tombol biru **Deploy** (kanan atas) → **Manage deployments**.
2. Di jendela yang muncul, klik ikon **pensil ✏️** (Edit).
3. Pada kolom **Version**, pilih **New version**.
4. Kolom **Description** isi `v1.3.0` (boleh dikosongkan).
5. Klik **Deploy** → **Done**.

**Cek apakah berhasil:** buka URL web app kamu di tab baru:
`https://script.google.com/macros/s/AKfycbxKgtjfC-o0qhlTRAEClJ6Oe3TJ10fWW0kCshijHaYTsHmyoemhjgqPd8uddLJNslEtAQ/exec`
Harus tampil teks berisi **`"backendVersion":"1.3.0"`**.
Kalau masih `1.0.0`/`1.2.0`, ulangi Bagian C dan pastikan memilih **New version**.

---

## Bagian D — Update aplikasi (GitHub)

1. Buka **https://github.com/stephjo479/kpi-tracker** (login kalau diminta).
2. Klik **Add file** → **Upload files**.
3. Buka folder `kpi-tracker` hasil extract → tekan **Ctrl+A** → **seret semua isinya** ke halaman GitHub.
   (Yang diseret **isi** foldernya: `index.html`, `css`, `js`, `icons`, `backend`, dll. Bukan folder `kpi-tracker`-nya.)
4. Tunggu semua file selesai ter-upload, lalu klik **Commit changes**.
5. Tunggu **1–2 menit**.
6. Buka **https://stephjo479.github.io/kpi-tracker/**. Di aplikasi yang sudah terpasang akan muncul banner **"Versi baru 1.3.0 tersedia → Perbarui sekarang"**. Klik.
   Atau buka **Pengaturan → Cek pembaruan**.

---

## Bagian E — Cek hasil (5 menit)

Login sebagai **ARYA** lalu cek satu per satu:

- [ ] Menu kiri ada **Absensi**. Di HP: tab bawah **Beranda · Absensi · Laporan · KPI · Admin**.
- [ ] **Beranda** menampilkan kartu presensi dengan jam berjalan dan tombol **Presensi masuk**.
- [ ] Coba **Presensi masuk**. Karena sudah lewat jam 09.00, akan muncul popup **TELAT! DENDA Rp 10.000** 😄 (hari ini uji coba, **tidak dihitung**).
- [ ] Coba **Presensi pulang**. Kalau sudah lewat 17.00, akan ditanya soal lembur.
- [ ] **Absensi → Izin**: ajukan contoh izin. Minta **Zul** menyetujuinya di **Absensi → Persetujuan**, karena izin milikmu sendiri tidak bisa kamu setujui.
- [ ] **Admin → Pengaturan → Absensi & denda**: cek jam masuk 09:00, pulang 17:00, denda 10000, dan tanggal mulai absensi (besok).
- [ ] Di spreadsheet ada sheet baru: **ATTENDANCE**, **IZIN**, **REKAP ABSENSI**.
- [ ] Di Google Drive ada folder **"KPI Tracker — Lampiran Izin (privat)"**.

> Data uji coba hari ini boleh dihapus: **Absensi → Tim hari ini → Koreksi → Hapus**, atau hapus barisnya langsung di sheet **ATTENDANCE**.

---

## Bagian F — Umumkan ke tim

Contoh pesan WhatsApp, silakan tempel:

```
📢 *Update Aplikasi KPI Tracker v1.3.0 — ABSENSI*

Mulai *besok*, presensi dilakukan lewat aplikasi KPI Tracker:
🕘 *Masuk:* tekan "Presensi masuk" paling lambat *09.00 WIB*
🕔 *Pulang:* tekan "Presensi pulang" mulai *17.00 WIB*

⚠️ Presensi lewat jam 09.00 = *terlambat* dan kena *denda Rp 10.000* (jam dicatat oleh server, bukan jam HP).
⏰ Lembur? Saat presensi pulang lewat 17.00, isi lembur untuk apa & atas perintah siapa.
📝 Mau izin terlambat / tidak masuk / sakit / cuti? Isi di menu *Absensi → Izin*. Kalau sakit, bisa lampirkan foto surat dokter.
✅ Izin yang disetujui manager tidak mengurangi KPI, dan izin terlambat yang disetujui = tidak kena denda.

Kehadiran sekarang masuk ke penilaian KPI (20%).
Kalau aplikasimu belum update, klik tombol "Perbarui sekarang" atau buka Pengaturan → Cek pembaruan.

Pertanyaan? Hubungi Manager: Arya / Zul 🙏
```

---

## Bagian G — Cara pakai sehari-hari

**Karyawan:**
1. Datang → buka aplikasi → **Presensi masuk**.
2. Kerja seperti biasa, isi **Laporan harian**.
3. Pulang → **Presensi pulang**. Kalau lembur, isi keterangannya.
4. Perlu izin? **Absensi → Izin → pilih jenis → isi tanggal & alasan → Kirim**.

**Manager (Arya & Zul):**
- **Beranda** menampilkan *Kehadiran hari ini*: siapa yang tepat waktu, terlambat, izin, atau belum presensi.
- Titik merah 🔴 di menu **Absensi** berarti ada izin yang menunggu persetujuan → **Absensi → Persetujuan**.
- Ada yang lupa presensi? **Absensi → Tim hari ini → Koreksi** (atau **Input presensi manual**).
- Evaluasi bulanan: **Absensi → Rekap bulanan** (pilih bulan). Yang terlambat ≥3× atau alpa ≥2× ditandai **"Perlu evaluasi"**.
  Data yang sama juga ada di sheet **REKAP ABSENSI** (diperbarui otomatis tiap jam).

---

## Bagian H — Kalau ada masalah

| Masalah | Solusi |
|---|---|
| Setelah update, menu **Absensi** tidak muncul | Aplikasi belum diperbarui. Buka **Pengaturan → Cek pembaruan** → **Perbarui**. Atau tutup lalu buka lagi aplikasinya. |
| Menu Absensi muncul tapi tertulis *"aktif setelah backend 1.3.0 dipasang"* | Bagian C belum dilakukan. Ulangi **Deploy → Manage deployments → ✏️ → New version → Deploy**. |
| Error "Found a service identifier used more than once" | Jangan tambah layanan lewat **Services +**. Isi `appsscript.json` jangan diubah. |
| Execution log hanya "Execution started / completed" | Fungsi yang dijalankan bukan `setup`. Pilih **setup** di dropdown, lalu Run lagi. |
| "Folder Drive GAGAL" di log | Jalankan `setup` sekali lagi dan pastikan klik **Allow** pada izin Google Drive. |
| Karyawan tidak bisa login | Cek PIN di sheet **EMPLOYEES**. Setelah 5× salah, akun terkunci 15 menit. Pesan error di aplikasi menjelaskan penyebabnya. |
| Ingin ubah jam masuk/pulang, denda, atau bobot KPI | **Admin → Pengaturan → Absensi & denda** → **Simpan pengaturan**. |
| Popup denda terlalu sering untuk keterlambatan 1–2 menit | Isi **Toleransi terlambat (menit)**, misalnya `5`. |

Kalau masih bingung, kirim **screenshot** langkah yang bermasalah.
