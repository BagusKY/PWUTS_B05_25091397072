<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $context = provider_context();
    $pdo = db();
    $storeId = $context['store_id'];

    $stmt = $pdo->prepare('SELECT COUNT(*) AS total_barang, COALESCE(SUM(total_stok),0) AS total_stok, SUM(status_aktif = \'aktif\') AS barang_aktif, SUM(total_stok <= 2 AND status_aktif = \'aktif\') AS stok_menipis FROM barang WHERE id_toko = ?');
    $stmt->execute([$storeId]);
    $inventory = $stmt->fetch();

    $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND p.status_pesanan IN ('ditahan','menunggu_keputusan')");
    $stmt->execute([$storeId]);
    $pending = (int) $stmt->fetch()['total'];

    $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND p.status_pesanan IN ('menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi')");
    $stmt->execute([$storeId]);
    $active = (int) $stmt->fetch()['total'];

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(pm.nominal),0) AS total FROM pembayaran pm INNER JOIN pesanan p ON p.id_pesanan = pm.id_pesanan INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND pm.status = 'terkonfirmasi' AND pm.tgl_konfirmasi >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    $stmt->execute([$storeId]);
    $revenue = (float) $stmt->fetch()['total'];

    $stmt = $pdo->prepare("SELECT p.id_pesanan, p.kode_pesanan, p.tgl_mulai, p.tgl_selesai, p.jumlah, p.total_harga, p.status_pesanan, p.created_at, b.nama_barang, u.nama AS nama_pelanggan FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang INNER JOIN users u ON u.id_user = p.id_user WHERE b.id_toko = ? ORDER BY (p.status_pesanan IN ('ditahan','menunggu_keputusan')) DESC, p.created_at DESC LIMIT 6");
    $stmt->execute([$storeId]);
    $recent = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT b.id_barang, b.nama_barang, b.total_stok, b.harga_sewa, k.nama_kategori, (SELECT mb.path_file FROM media_barang mb WHERE mb.id_barang = b.id_barang ORDER BY mb.id_media DESC LIMIT 1) AS gambar FROM barang b LEFT JOIN kategori k ON k.id_kategori = b.id_kategori WHERE b.id_toko = ? AND b.status_aktif = \'aktif\' AND b.total_stok <= 2 ORDER BY b.total_stok ASC, b.nama_barang LIMIT 5');
    $stmt->execute([$storeId]);
    $lowStock = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT DATE_FORMAT(pm.tgl_konfirmasi, '%Y-%m') AS bulan, COALESCE(SUM(pm.nominal),0) AS total FROM pembayaran pm INNER JOIN pesanan p ON p.id_pesanan = pm.id_pesanan INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND pm.status = 'terkonfirmasi' AND pm.tgl_konfirmasi >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH) GROUP BY DATE_FORMAT(pm.tgl_konfirmasi, '%Y-%m') ORDER BY bulan");
    $stmt->execute([$storeId]);
    $revenueRows = $stmt->fetchAll();
    $revenueMap = [];
    foreach ($revenueRows as $row) $revenueMap[$row['bulan']] = (float) $row['total'];
    $monthlyRevenue = [];
    for ($i = 5; $i >= 0; $i--) {
        $month = (new DateTimeImmutable('first day of this month'))->modify("-{$i} month");
        $key = $month->format('Y-m');
        $monthlyRevenue[] = ['bulan' => $key, 'label' => $month->format('M'), 'total' => $revenueMap[$key] ?? 0];
    }

    json_response(['success' => true, 'data' => [
        'total_barang' => (int) $inventory['total_barang'],
        'total_stok' => (int) $inventory['total_stok'],
        'barang_aktif' => (int) $inventory['barang_aktif'],
        'stok_menipis' => (int) $inventory['stok_menipis'],
        'pesanan_menunggu' => $pending,
        'pesanan_aktif' => $active,
        'pendapatan_bulan_ini' => $revenue,
        'pesanan_terbaru' => $recent,
        'stok_menipis_list' => $lowStock,
        'pendapatan_bulanan' => $monthlyRevenue,
    ]]);
} catch (Throwable $error) { respond_exception($error); }
