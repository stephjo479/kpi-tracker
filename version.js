/*
 * VERSI APLIKASI — satu-satunya tempat untuk menaikkan versi.
 * Setiap kali kamu mengubah file aplikasi (html/css/js), naikkan APP_VERSION
 * dan tulis catatannya. Perangkat karyawan akan melihat tombol "Perbarui".
 */
var APP_VERSION = '1.10.0';
var APP_RELEASE_DATE = '2026-10-20';
var APP_RELEASE_NOTES = [
  'Pekerjaan baru OLTI (All-TTS Movie, bahasa Korea, 1–2 menit): Ardi, Aldis, Jati, Fahad & Tarissa fokus OLTI mulai 20 Oktober dengan target 3 video/hari. Lapor seperti biasa — pilih "OLTI — All-TTS Movie (Korea)", isi jumlah video selesai & tempel link Google Drive (folder namamu di Drive Zul).',
  'Riwayat penugasan: menambah, melepas, mengalihkan, atau mengubah target seseorang di channel kini berlaku mulai hari itu. KPI hari-hari sebelumnya tetap memakai penugasan lama (channel lama ditandai "s/d tanggal").',
  'Perbaikan: data sebelum tanggal go-live (12 Oktober 2026) adalah masa uji coba — sekarang tidak lagi ditampilkan atau dihitung di mana pun (riwayat & total laporan, absensi, proyek, pantauan, rapor). Hari-hari itu ditandai "Uji coba".',
  'Laporan harian lebih detail: selain jumlah video selesai, catat juga video yang di-generate (untuk hari ini / besok) dan video yang masih diedit beserta progresnya. Hanya video selesai yang dinilai; sisanya menjadi bukti kerja di detail KPI & rapor.',
  'Long-form AI drama (Gista) sekarang dinilai harian dari jumlah video selesai — bisa lebih dari 1 per hari — tanpa proyek per video. Long-form Kemal tetap memakai proyek.',
  'Daftar pekerjaan per karyawan (Admin → Karyawan → Pekerjaan): tambah / lepas tugas di channel dan beri tugas khusus di luar channel (mis. riset) dengan progres % + deadline atau target jumlah per hari. Tugas khusus ikut dihitung di KPI.',
  'Satu channel bisa dipegang beberapa orang dengan pekerjaan berbeda (mis. Ava = Shorts, Agista = AI Drama long-form). Siapa mengerjakan apa terlihat di daftar Channel, halaman channel, dan Struktur Tim.',
  'Halaman channel kini menampilkan "Tim & pembagian tugas" (target & capaian tiap orang) dan "Proyek video channel ini" (progres, deadline, riwayat progres) — termasuk long-form Kemal.',
  'Lebih tahan gangguan: isian laporan & presensi pulang tersimpan otomatis bila aplikasi tertutup atau sinyal putus, ada penanda offline, kirim ulang otomatis saat server sibuk, dan layar tidak lagi putih bila terjadi kesalahan.'
];
