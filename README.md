# RuangSewa — Advanced Provider Dashboard

Proyek UTS Pemrograman Web Lanjut untuk topik **Website Penyewaan Barang**. Versi ini berfokus pada sisi penyedia: inventaris, pesanan masuk, konfirmasi pembayaran di luar website, serah-terima, pengembalian, blokir ketersediaan, laporan, dan jejak aktivitas.

> **Penting:** proyek ini ditujukan untuk tugas kuliah dan demo lokal. Sebelum digunakan untuk bisnis sungguhan, lakukan review keamanan, pengujian integrasi, backup, konfigurasi server produksi, dan penyesuaian kebijakan privasi.

## Fitur versi advanced

### Dashboard dan pengalaman pengguna
- Layout utama `index.html` responsif untuk desktop, tablet, dan ponsel.
- Navigasi memuat halaman konten dengan jQuery AJAX tanpa memuat ulang seluruh layout.
- Halaman login terpisah dengan session PHP, validasi input, pergantian visibilitas password, dan pembatasan sederhana percobaan login.
- Ringkasan dashboard berbasis data MySQL: inventaris, total unit, pesanan menunggu, pembayaran terkonfirmasi bulan berjalan, grafik pendapatan, dan peringatan stok menipis.
- UI profesional dengan tabel, status badge, modal, empty state, toast, preview foto, serta layout responsif.

### Inventaris
- Membaca inventaris barang dari MySQL.
- Pencarian barang dan filter status/stok menipis.
- Tambah dan edit barang, termasuk nama, kategori, deskripsi, harga sewa, total unit, status publikasi, dan foto opsional.
- Aktif/nonaktif barang tanpa menghapus riwayat transaksi.
- Validasi server untuk kategori, harga, jumlah unit, panjang input, tipe foto dan ukuran foto (maksimal 2 MB).
- Stok tidak bisa dikurangi di bawah pemakaian maksimum dari pesanan atau blokir pada jadwal mendatang.

### Alur pesanan
1. **Menunggu keputusan**: penyedia menerima atau menolak dan menyimpan alasan penolakan.
2. **Menunggu pembayaran**: pembayaran dilakukan di luar website.
3. **Pembayaran terkonfirmasi**: penyedia menandai pembayaran yang benar-benar diterima.
4. **Siap diserahkan**: barang dipersiapkan.
5. **Sedang disewa**: serah-terima dicatat bersama kondisi awal barang.
6. **Pengembalian terkonfirmasi**: penyedia mencatat kondisi akhir dan tanggal kembali.
7. **Selesai**: pesanan masuk ke riwayat.

Aksi alur hanya tersedia ketika status sebelumnya sesuai. Semua mutasi status ditulis ke tabel log aktivitas.

### Ketersediaan, laporan, dan audit
- Jadwal blokir untuk perawatan/penggunaan internal dengan validasi tanggal dan kuantitas di server.
- Perhitungan stok berdasarkan pemakaian maksimum pada hari yang saling beririsan, bukan sekadar menjumlahkan seluruh pesanan yang menyentuh rentang tanggal.
- Blokir yang sudah dimulai tidak dapat dihapus dari UI agar riwayat tetap konsisten.
- Laporan berdasarkan periode tanggal: total pesanan, selesai, ditolak, pendapatan terkonfirmasi, tren per bulan, distribusi status, dan barang teratas.
- Ekspor laporan ke CSV.
- Log aktivitas untuk login, perubahan barang, keputusan pesanan, dan perubahan blokir.
- API PHP menggunakan PDO prepared statements, session cookie HttpOnly/SameSite, dan token CSRF untuk operasi yang mengubah data.

## Teknologi

- HTML5 dan CSS3
- JavaScript dan jQuery 3.6.1
- PHP 8.x dengan PDO
- MySQL/MariaDB melalui XAMPP
- AJAX untuk navigasi dan komunikasi dengan API

### Akun demo penyedia

- Email: `penyedia@example.test`
- Kata sandi: `SewaDemo123!`
- Nama toko: `RuangSewa Studio`

Akun ini hanya untuk demo lokal. Password disimpan menggunakan hash `password_hash()` dan diverifikasi dengan `password_verify()`.

## Skenario uji yang disarankan

1. Login dan logout; buka `index.html` tanpa login dan pastikan aplikasi mengarahkan ke login.
2. Tambahkan barang dengan data valid, lalu periksa apakah barang muncul di **Inventaris Barang**.
3. Coba kirim form dengan harga kosong/negatif, stok negatif, kategori tidak dipilih, atau foto di atas 2 MB. Server seharusnya menolak isian yang tidak valid.
4. Edit harga dan stok; coba menurunkan stok di bawah unit yang masih terpesan/diblokir dan pastikan perubahan ditolak.
5. Di **Pesanan Masuk**, uji status dari menerima/menolak, konfirmasi pembayaran, siap diserahkan, serah-terima, konfirmasi pengembalian, hingga selesai. Beberapa contoh pesanan awal telah tersedia.
6. Tambahkan blokir ketersediaan yang tidak berbenturan dan yang melebihi stok tersedia. Server seharusnya menolak jumlah yang melebihi kapasitas.
7. Buka laporan, ubah rentang tanggal, lalu ekspor CSV.
8. Buka **Log Aktivitas** dan pastikan tindakan penting tercatat.
9. Periksa layout pada ukuran desktop dan ponsel.

## Struktur proyek

```text
PWUTS_KODEKELOMPOK_25091397072/
├── index.html
├── login.html
├── README.md
├── .gitignore
├── assets/
│   ├── favicon.svg
│   ├── product-camera.svg
│   ├── product-projector.svg
│   ├── product-speaker.svg
│   ├── product-tent.svg
│   └── product-tripod.svg
├── css/style.css
├── js/
│   ├── app.js
│   ├── login.js
│   └── jquery-3.6.1.min.js
├── pages/
│   ├── dashboard.html
│   ├── kelola-stok.html
│   ├── pesanan.html
│   ├── form-tambah-barang.html
│   ├── form-blokir.html
│   ├── laporan.html
│   └── aktivitas.html
├── api/
│   ├── db.php
│   ├── auth.php
│   ├── dashboard.php
│   ├── kategori.php
│   ├── barang.php
│   ├── pesanan.php
│   ├── blokir.php
│   ├── laporan.php
│   └── aktivitas.php
├── database/
│   ├── penyewaan_barang.sql
│   └── upgrade_existing_database.sql
└── uploads/items/
    ├── .gitkeep
    └── .htaccess
```

## Rute navigasi dan API

- `index.html`: layout utama, navigasi AJAX, topbar, dan sidebar.
- `login.html`: layar masuk penyedia.
- `pages/*.html`: partial halaman yang dimuat dalam layout melalui AJAX.
- `api/auth.php`: status sesi, login, dan logout.
- `api/dashboard.php`: ringkasan data dashboard.
- `api/barang.php`: daftar, tambah, edit, dan ubah status barang.
- `api/pesanan.php`: daftar pesanan dan transisi status operasional.
- `api/blokir.php`: daftar, tambah, dan penghapusan jadwal blokir mendatang.
- `api/laporan.php`: statistik dan data laporan berdasarkan periode.
- `api/aktivitas.php`: riwayat tindakan penyedia.

## Catatan basis data dan keamanan

- **Pilih file SQL sesuai kondisi:** `penyewaan_barang.sql` bersifat destruktif untuk tabel proyek yang bernama sama; gunakan hanya untuk instalasi baru atau bila data boleh di-reset. Jika database versi dasar sudah berisi data yang ingin dipertahankan, gunakan `upgrade_existing_database.sql` satu kali, bukan file instalasi baru.
- Penyedia hanya dapat mengakses data barang/pesanan yang terkait dengan `id_toko` dari sesi login, bukan ID toko yang dikirim pengguna.
- Semua endpoint perubahan data memerlukan sesi penyedia dan token CSRF.
- Upload dibatasi ke JPG/PNG/WebP dan 2 MB. Folder upload juga memiliki aturan Apache untuk menolak eksekusi file PHP.
- Pembayaran pada proposal kelompok dilakukan di luar website. Aplikasi ini hanya menyimpan catatan konfirmasi yang dilakukan penyedia; tidak memproses pembayaran elektronik.
- Ini tetap prototipe akademik. HTTPS, kebijakan backup, pengaturan cookie `Secure` produksi, audit keamanan, recovery password, serta pengujian concurrency end-to-end harus diterapkan sebelum penggunaan nyata.
- Sintaks PHP dan JavaScript diperiksa. Penyimpanan MySQL dan browser perlu diuji pada XAMPP milik pengguna karena lingkungan pembuatan tidak menjalankan server MySQL aplikasi.
