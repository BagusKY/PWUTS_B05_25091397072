<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $context = provider_context();
    $pdo = db();
    $storeId = $context['store_id'];
    $from = trim((string) ($_GET['dari'] ?? (new DateTimeImmutable('first day of -5 months'))->format('Y-m-d')));
    $to = trim((string) ($_GET['sampai'] ?? date('Y-m-d')));
    if (!valid_date($from) || !valid_date($to) || $from > $to) {
        json_response(['success' => false, 'message' => 'Rentang tanggal laporan tidak valid.'], 422);
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) AS total_pesanan, SUM(p.status_pesanan = 'selesai') AS selesai, SUM(p.status_pesanan = 'ditolak') AS ditolak, SUM(p.status_pesanan IN ('ditahan','menunggu_keputusan')) AS menunggu FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND DATE(p.created_at) BETWEEN ? AND ?");
    $stmt->execute([$storeId, $from, $to]);
    $summary = $stmt->fetch();

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(pm.nominal),0) AS pendapatan FROM pembayaran pm INNER JOIN pesanan p ON p.id_pesanan = pm.id_pesanan INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND pm.status = 'terkonfirmasi' AND DATE(pm.tgl_konfirmasi) BETWEEN ? AND ?");
    $stmt->execute([$storeId, $from, $to]);
    $summary['pendapatan'] = (float) $stmt->fetch()['pendapatan'];

    $stmt = $pdo->prepare("SELECT DATE_FORMAT(pm.tgl_konfirmasi, '%Y-%m') AS bulan, COALESCE(SUM(pm.nominal),0) AS total FROM pembayaran pm INNER JOIN pesanan p ON p.id_pesanan = pm.id_pesanan INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND pm.status = 'terkonfirmasi' AND DATE(pm.tgl_konfirmasi) BETWEEN ? AND ? GROUP BY DATE_FORMAT(pm.tgl_konfirmasi, '%Y-%m') ORDER BY bulan");
    $stmt->execute([$storeId, $from, $to]);
    $monthly = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT b.id_barang, b.nama_barang, COUNT(p.id_pesanan) AS jumlah_pesanan, COALESCE(SUM(pm.nominal),0) AS pendapatan FROM barang b LEFT JOIN pesanan p ON p.id_barang = b.id_barang AND DATE(p.created_at) BETWEEN ? AND ? LEFT JOIN pembayaran pm ON pm.id_pesanan = p.id_pesanan AND pm.status = \'terkonfirmasi\' AND DATE(pm.tgl_konfirmasi) BETWEEN ? AND ? WHERE b.id_toko = ? GROUP BY b.id_barang, b.nama_barang ORDER BY jumlah_pesanan DESC, pendapatan DESC, b.nama_barang LIMIT 8');
    $stmt->execute([$from, $to, $from, $to, $storeId]);
    $topItems = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT p.status_pesanan, COUNT(*) AS total FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang WHERE b.id_toko = ? AND DATE(p.created_at) BETWEEN ? AND ? GROUP BY p.status_pesanan ORDER BY total DESC');
    $stmt->execute([$storeId, $from, $to]);
    $statuses = $stmt->fetchAll();

    json_response(['success' => true, 'data' => [
        'dari' => $from,
        'sampai' => $to,
        'ringkasan' => [
            'total_pesanan' => (int) ($summary['total_pesanan'] ?? 0),
            'selesai' => (int) ($summary['selesai'] ?? 0),
            'ditolak' => (int) ($summary['ditolak'] ?? 0),
            'menunggu' => (int) ($summary['menunggu'] ?? 0),
            'pendapatan' => (float) ($summary['pendapatan'] ?? 0),
        ],
        'pendapatan_bulanan' => $monthly,
        'barang_teratas' => $topItems,
        'distribusi_status' => $statuses,
    ]]);
} catch (Throwable $error) { respond_exception($error); }
