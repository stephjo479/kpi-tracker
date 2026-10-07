/*
 * VERSI APLIKASI — satu-satunya tempat untuk menaikkan versi.
 * Setiap kali kamu mengubah file aplikasi (html/css/js), naikkan APP_VERSION
 * dan tulis catatannya. Perangkat karyawan akan melihat tombol "Perbarui".
 */
var APP_VERSION = '1.6.2';
var APP_RELEASE_DATE = '2026-10-07';
var APP_RELEASE_NOTES = [
  'Keamanan: daftar nama karyawan tidak lagi tampil untuk orang luar — ketik namamu sekali di halaman login, perangkat akan mengingatnya. PIN admin & pimpinan minimal 6 digit.',
  'Perbaikan: pengaturan admin selalu gagal disimpan & cek lokasi kantor tidak aktif (jam/tanggal di sheet CONFIG berubah format). Sekarang tersimpan sebagai teks dan ada status "Cek lokasi AKTIF".',
  'Pilihan bahasa: Indonesia, English, dan 한국어 (Korea). Bisa diganti di halaman login, menu samping, atau Pengaturan.',
  'Presensi masuk memakai lokasi GPS: hanya bisa di area kantor (radius 150 m). Bekerja di luar kantor? Ajukan izin "Dinas luar / WFH".',
  'Rapor bulanan per karyawan (KPI, kehadiran, denda, proyek) — bisa dicetak / disimpan PDF.',
  'KPI hasil channel: target views & subscriber per bulan ikut dihitung di skor KPI.',
  'Email ringkasan mingguan otomatis setiap Senin pagi & backup spreadsheet otomatis setiap minggu.'
];
