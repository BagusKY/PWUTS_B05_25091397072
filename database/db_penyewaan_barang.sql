-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 26, 2026 at 04:37 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `db_penyewaan_barang`
--

-- --------------------------------------------------------

--
-- Table structure for table `barang`
--

CREATE TABLE `barang` (
  `id_barang` int(11) NOT NULL,
  `id_toko` int(11) NOT NULL,
  `id_kategori` int(11) NOT NULL,
  `nama_barang` varchar(150) NOT NULL,
  `deskripsi` text NOT NULL,
  `harga_sewa` decimal(12,2) NOT NULL,
  `total_stok` int(11) NOT NULL DEFAULT 1,
  `status_aktif` enum('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `barang`
--

INSERT INTO `barang` (`id_barang`, `id_toko`, `id_kategori`, `nama_barang`, `deskripsi`, `harga_sewa`, `total_stok`, `status_aktif`, `created_at`) VALUES
(1, 1, 1, 'Kamera DSLR Canon', 'Kamera DSLR untuk fotografi acara dan kegiatan kampus. Paket termasuk baterai dan tas.', 125000.00, 5, 'aktif', '2026-10-21 09:51:44'),
(2, 1, 2, 'Proyektor Epson', 'Proyektor untuk presentasi kelas, rapat, dan acara kecil.', 90000.00, 3, 'aktif', '2026-10-22 09:51:44'),
(3, 1, 3, 'Speaker Portable', 'Speaker portable untuk kebutuhan audio acara sederhana.', 65000.00, 8, 'aktif', '2026-10-23 09:51:44'),
(4, 1, 4, 'Kursi Lipat', 'Kursi lipat untuk kegiatan organisasi dan acara luar ruangan.', 15000.00, 0, 'nonaktif', '2026-10-24 09:51:44'),
(5, 1, 5, 'Tenda Camping 4 Orang', 'Tenda camping kapasitas empat orang dalam kondisi baik.', 80000.00, 4, 'aktif', '2026-10-26 09:51:44');

-- --------------------------------------------------------

--
-- Table structure for table `blokir_ketersediaan`
--

CREATE TABLE `blokir_ketersediaan` (
  `id_blokir` int(11) NOT NULL,
  `id_barang` int(11) NOT NULL,
  `tgl_mulai` date NOT NULL,
  `tgl_selesai` date NOT NULL,
  `jumlah` int(11) NOT NULL,
  `alasan` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `blokir_ketersediaan`
--

INSERT INTO `blokir_ketersediaan` (`id_blokir`, `id_barang`, `tgl_mulai`, `tgl_selesai`, `jumlah`, `alasan`, `created_at`) VALUES
(1, 1, '2026-11-07', '2026-11-08', 1, 'Perawatan barang', '2026-10-26 09:51:44');

-- --------------------------------------------------------

--
-- Table structure for table `hold_stok`
--

CREATE TABLE `hold_stok` (
  `id_hold` int(11) NOT NULL,
  `id_barang` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `tgl_mulai` date NOT NULL,
  `tgl_selesai` date NOT NULL,
  `jumlah` int(11) NOT NULL,
  `waktu_kadaluarsa` datetime NOT NULL,
  `status` enum('aktif','dilepas','kedaluwarsa','dikonversi') NOT NULL DEFAULT 'aktif',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kategori`
--

CREATE TABLE `kategori` (
  `id_kategori` int(11) NOT NULL,
  `nama_kategori` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `kategori`
--

INSERT INTO `kategori` (`id_kategori`, `nama_kategori`) VALUES
(3, 'Audio'),
(5, 'Camping & Outdoor'),
(2, 'Elektronik'),
(4, 'Furnitur'),
(1, 'Kamera & Fotografi');

-- --------------------------------------------------------

--
-- Table structure for table `log_aktivitas`
--

CREATE TABLE `log_aktivitas` (
  `id_log` int(11) NOT NULL,
  `id_user` int(11) DEFAULT NULL,
  `aksi` varchar(100) NOT NULL,
  `tabel_terkait` varchar(100) DEFAULT NULL,
  `id_terkait` int(11) DEFAULT NULL,
  `keterangan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `log_aktivitas`
--

INSERT INTO `log_aktivitas` (`id_log`, `id_user`, `aksi`, `tabel_terkait`, `id_terkait`, `keterangan`, `created_at`) VALUES
(1, 2, 'LOGIN', 'users', 2, 'Penyedia masuk ke dashboard.', '2026-10-26 10:31:53'),
(2, 2, 'LOGIN', 'users', 2, 'Penyedia masuk ke dashboard.', '2026-10-26 10:35:23');

-- --------------------------------------------------------

--
-- Table structure for table `media_barang`
--

CREATE TABLE `media_barang` (
  `id_media` int(11) NOT NULL,
  `id_barang` int(11) NOT NULL,
  `jenis` enum('gambar','video') NOT NULL DEFAULT 'gambar',
  `path_file` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pembayaran`
--

CREATE TABLE `pembayaran` (
  `id_pembayaran` int(11) NOT NULL,
  `id_pesanan` int(11) NOT NULL,
  `metode` varchar(60) DEFAULT NULL,
  `nominal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('menunggu','terkonfirmasi','ditolak') NOT NULL DEFAULT 'menunggu',
  `tgl_konfirmasi` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pembayaran`
--

INSERT INTO `pembayaran` (`id_pembayaran`, `id_pesanan`, `metode`, `nominal`, `status`, `tgl_konfirmasi`) VALUES
(1, 1, 'Transfer di luar website', 0.00, 'menunggu', NULL),
(2, 2, 'Transfer di luar website', 0.00, 'menunggu', NULL),
(3, 3, 'Tunai', 195000.00, 'terkonfirmasi', '2026-10-25 09:51:44'),
(4, 4, 'Transfer di luar website', 160000.00, 'terkonfirmasi', '2026-10-26 07:51:44');

-- --------------------------------------------------------

--
-- Table structure for table `pengembalian`
--

CREATE TABLE `pengembalian` (
  `id_pengembalian` int(11) NOT NULL,
  `id_pesanan` int(11) NOT NULL,
  `tgl_kembali` datetime DEFAULT NULL,
  `kondisi_barang` text DEFAULT NULL,
  `status` enum('menunggu','terkonfirmasi','bermasalah') NOT NULL DEFAULT 'menunggu',
  `tgl_konfirmasi` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pesanan`
--

CREATE TABLE `pesanan` (
  `id_pesanan` int(11) NOT NULL,
  `kode_pesanan` varchar(40) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_barang` int(11) NOT NULL,
  `id_hold` int(11) DEFAULT NULL,
  `tgl_mulai` date NOT NULL,
  `tgl_selesai` date NOT NULL,
  `jumlah` int(11) NOT NULL,
  `total_harga` decimal(12,2) NOT NULL,
  `status_pesanan` enum('ditahan','menunggu_keputusan','disetujui','ditolak','menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi','selesai','hold_kedaluwarsa') NOT NULL DEFAULT 'menunggu_keputusan',
  `alasan_penolakan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pesanan`
--

INSERT INTO `pesanan` (`id_pesanan`, `kode_pesanan`, `id_user`, `id_barang`, `id_hold`, `tgl_mulai`, `tgl_selesai`, `jumlah`, `total_harga`, `status_pesanan`, `alasan_penolakan`, `created_at`) VALUES
(1, 'RS-2026-001', 1, 1, NULL, '2026-10-29', '2026-10-30', 1, 250000.00, 'menunggu_keputusan', NULL, '2026-10-26 07:51:44'),
(2, 'RS-2026-002', 4, 2, NULL, '2026-10-31', '2026-11-01', 1, 180000.00, 'menunggu_keputusan', NULL, '2026-10-26 04:51:44'),
(3, 'RS-2026-003', 1, 3, NULL, '2026-10-25', '2026-10-27', 2, 195000.00, 'sedang_dipakai', NULL, '2026-10-25 09:51:44'),
(4, 'RS-2026-004', 4, 5, NULL, '2026-11-03', '2026-11-04', 1, 160000.00, 'disetujui', NULL, '2026-10-26 05:51:44');

-- --------------------------------------------------------

--
-- Table structure for table `serah_terima`
--

CREATE TABLE `serah_terima` (
  `id_serah_terima` int(11) NOT NULL,
  `id_pesanan` int(11) NOT NULL,
  `tgl_serah` datetime DEFAULT NULL,
  `catatan_kondisi` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `serah_terima`
--

INSERT INTO `serah_terima` (`id_serah_terima`, `id_pesanan`, `tgl_serah`, `catatan_kondisi`) VALUES
(1, 3, '2026-10-25 09:51:44', 'Barang diserahkan dalam kondisi baik.'),
(2, 4, NULL, 'Menunggu jadwal penyerahan.');

-- --------------------------------------------------------

--
-- Table structure for table `toko`
--

CREATE TABLE `toko` (
  `id_toko` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_admin` int(11) DEFAULT NULL,
  `nama_toko` varchar(150) NOT NULL,
  `alamat` text DEFAULT NULL,
  `kota` varchar(100) DEFAULT NULL,
  `bukti_identitas` varchar(255) DEFAULT NULL,
  `status_verifikasi` enum('menunggu','disetujui','perlu_perbaikan','ditolak') NOT NULL DEFAULT 'menunggu',
  `catatan_admin` text DEFAULT NULL,
  `tgl_verifikasi` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `toko`
--

INSERT INTO `toko` (`id_toko`, `id_user`, `id_admin`, `nama_toko`, `alamat`, `kota`, `bukti_identitas`, `status_verifikasi`, `catatan_admin`, `tgl_verifikasi`) VALUES
(1, 2, 3, 'Toko Demo', 'Surabaya', 'Surabaya', NULL, 'disetujui', 'Data demo untuk kebutuhan pengembangan UTS.', '2026-10-26 09:51:44');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id_user` int(11) NOT NULL,
  `nama` varchar(120) NOT NULL,
  `email` varchar(160) NOT NULL,
  `password` varchar(255) NOT NULL,
  `no_hp` varchar(30) DEFAULT NULL,
  `role` enum('pelanggan','penyedia','admin') NOT NULL DEFAULT 'pelanggan',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id_user`, `nama`, `email`, `password`, `no_hp`, `role`, `created_at`) VALUES
(1, 'Nadia Pratama', 'nadia.pelanggan@example.test', '$2y$10$demo_hash_not_for_login', '081234567801', 'pelanggan', '2026-10-26 09:51:44'),
(2, 'Pemilik Toko', 'penyedia@example.test', '$2y$12$KCBevb8OoasSIxH5b7vx5O4mQmOD68YLY6KlJsMffNQEhVj8zcfq6', '081234567802', 'penyedia', '2026-10-26 09:51:44'),
(3, 'Admin Demo', 'admin@example.test', '$2y$10$demo_hash_not_for_login', '081234567803', 'admin', '2026-10-26 09:51:44'),
(4, 'Raka Saputra', 'raka.pelanggan@example.test', '$2y$10$demo_hash_not_for_login', '081234567804', 'pelanggan', '2026-10-26 09:51:44');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `barang`
--
ALTER TABLE `barang`
  ADD PRIMARY KEY (`id_barang`),
  ADD KEY `idx_barang_toko` (`id_toko`),
  ADD KEY `idx_barang_kategori` (`id_kategori`);

--
-- Indexes for table `blokir_ketersediaan`
--
ALTER TABLE `blokir_ketersediaan`
  ADD PRIMARY KEY (`id_blokir`),
  ADD KEY `idx_blokir_periode` (`id_barang`,`tgl_mulai`,`tgl_selesai`);

--
-- Indexes for table `hold_stok`
--
ALTER TABLE `hold_stok`
  ADD PRIMARY KEY (`id_hold`),
  ADD KEY `fk_hold_user` (`id_user`),
  ADD KEY `idx_hold_periode` (`id_barang`,`tgl_mulai`,`tgl_selesai`,`status`);

--
-- Indexes for table `kategori`
--
ALTER TABLE `kategori`
  ADD PRIMARY KEY (`id_kategori`),
  ADD UNIQUE KEY `nama_kategori` (`nama_kategori`);

--
-- Indexes for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  ADD PRIMARY KEY (`id_log`),
  ADD KEY `fk_log_user` (`id_user`);

--
-- Indexes for table `media_barang`
--
ALTER TABLE `media_barang`
  ADD PRIMARY KEY (`id_media`),
  ADD KEY `fk_media_barang` (`id_barang`);

--
-- Indexes for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD PRIMARY KEY (`id_pembayaran`),
  ADD UNIQUE KEY `uq_pembayaran_pesanan` (`id_pesanan`);

--
-- Indexes for table `pengembalian`
--
ALTER TABLE `pengembalian`
  ADD PRIMARY KEY (`id_pengembalian`),
  ADD UNIQUE KEY `uq_pengembalian_pesanan` (`id_pesanan`);

--
-- Indexes for table `pesanan`
--
ALTER TABLE `pesanan`
  ADD PRIMARY KEY (`id_pesanan`),
  ADD UNIQUE KEY `kode_pesanan` (`kode_pesanan`),
  ADD KEY `fk_pesanan_user` (`id_user`),
  ADD KEY `fk_pesanan_hold` (`id_hold`),
  ADD KEY `idx_pesanan_barang_periode` (`id_barang`,`tgl_mulai`,`tgl_selesai`,`status_pesanan`);

--
-- Indexes for table `serah_terima`
--
ALTER TABLE `serah_terima`
  ADD PRIMARY KEY (`id_serah_terima`),
  ADD UNIQUE KEY `uq_serah_pesanan` (`id_pesanan`);

--
-- Indexes for table `toko`
--
ALTER TABLE `toko`
  ADD PRIMARY KEY (`id_toko`),
  ADD KEY `fk_toko_user` (`id_user`),
  ADD KEY `fk_toko_admin` (`id_admin`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_user`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `barang`
--
ALTER TABLE `barang`
  MODIFY `id_barang` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `blokir_ketersediaan`
--
ALTER TABLE `blokir_ketersediaan`
  MODIFY `id_blokir` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `hold_stok`
--
ALTER TABLE `hold_stok`
  MODIFY `id_hold` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kategori`
--
ALTER TABLE `kategori`
  MODIFY `id_kategori` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  MODIFY `id_log` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `media_barang`
--
ALTER TABLE `media_barang`
  MODIFY `id_media` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id_pembayaran` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `pengembalian`
--
ALTER TABLE `pengembalian`
  MODIFY `id_pengembalian` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pesanan`
--
ALTER TABLE `pesanan`
  MODIFY `id_pesanan` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `serah_terima`
--
ALTER TABLE `serah_terima`
  MODIFY `id_serah_terima` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `toko`
--
ALTER TABLE `toko`
  MODIFY `id_toko` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id_user` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `barang`
--
ALTER TABLE `barang`
  ADD CONSTRAINT `fk_barang_kategori` FOREIGN KEY (`id_kategori`) REFERENCES `kategori` (`id_kategori`),
  ADD CONSTRAINT `fk_barang_toko` FOREIGN KEY (`id_toko`) REFERENCES `toko` (`id_toko`);

--
-- Constraints for table `blokir_ketersediaan`
--
ALTER TABLE `blokir_ketersediaan`
  ADD CONSTRAINT `fk_blokir_barang` FOREIGN KEY (`id_barang`) REFERENCES `barang` (`id_barang`);

--
-- Constraints for table `hold_stok`
--
ALTER TABLE `hold_stok`
  ADD CONSTRAINT `fk_hold_barang` FOREIGN KEY (`id_barang`) REFERENCES `barang` (`id_barang`),
  ADD CONSTRAINT `fk_hold_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`);

--
-- Constraints for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  ADD CONSTRAINT `fk_log_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON DELETE SET NULL;

--
-- Constraints for table `media_barang`
--
ALTER TABLE `media_barang`
  ADD CONSTRAINT `fk_media_barang` FOREIGN KEY (`id_barang`) REFERENCES `barang` (`id_barang`) ON DELETE CASCADE;

--
-- Constraints for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD CONSTRAINT `fk_pembayaran_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan` (`id_pesanan`);

--
-- Constraints for table `pengembalian`
--
ALTER TABLE `pengembalian`
  ADD CONSTRAINT `fk_pengembalian_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan` (`id_pesanan`);

--
-- Constraints for table `pesanan`
--
ALTER TABLE `pesanan`
  ADD CONSTRAINT `fk_pesanan_barang` FOREIGN KEY (`id_barang`) REFERENCES `barang` (`id_barang`),
  ADD CONSTRAINT `fk_pesanan_hold` FOREIGN KEY (`id_hold`) REFERENCES `hold_stok` (`id_hold`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pesanan_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`);

--
-- Constraints for table `serah_terima`
--
ALTER TABLE `serah_terima`
  ADD CONSTRAINT `fk_serah_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan` (`id_pesanan`);

--
-- Constraints for table `toko`
--
ALTER TABLE `toko`
  ADD CONSTRAINT `fk_toko_admin` FOREIGN KEY (`id_admin`) REFERENCES `users` (`id_user`),
  ADD CONSTRAINT `fk_toko_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
