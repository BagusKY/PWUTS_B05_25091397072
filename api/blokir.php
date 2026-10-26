<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $context = provider_context();
    $pdo = db();
    $storeId = $context['store_id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT k.id_blokir, k.id_barang, k.tgl_mulai, k.tgl_selesai, k.jumlah, k.alasan, k.created_at, b.nama_barang FROM blokir_ketersediaan k INNER JOIN barang b ON b.id_barang = k.id_barang WHERE b.id_toko = ? ORDER BY k.tgl_mulai DESC, k.id_blokir DESC');
        $stmt->execute([$storeId]);
        json_response(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    require_method('POST');
    require_csrf();
    $action = (string) ($_POST['aksi'] ?? 'create');
    if ($action === 'delete') {
        $blockId = filter_var($_POST['id_blokir'] ?? null, FILTER_VALIDATE_INT);
        if (!$blockId) json_response(['success' => false, 'message' => 'ID blokir tidak valid.'], 422);
        $stmt = $pdo->prepare('SELECT k.id_blokir, k.tgl_mulai FROM blokir_ketersediaan k INNER JOIN barang b ON b.id_barang = k.id_barang WHERE k.id_blokir = ? AND b.id_toko = ?');
        $stmt->execute([$blockId, $storeId]);
        $block = $stmt->fetch();
        if (!$block) json_response(['success' => false, 'message' => 'Data blokir tidak ditemukan.'], 404);
        if ($block['tgl_mulai'] < date('Y-m-d')) json_response(['success' => false, 'message' => 'Blokir yang sudah dimulai tidak dapat dihapus agar riwayat ketersediaan tetap konsisten.'], 409);
        $pdo->prepare('DELETE FROM blokir_ketersediaan WHERE id_blokir = ?')->execute([$blockId]);
        log_activity($pdo, $context['user_id'], 'HAPUS_BLOKIR', 'blokir_ketersediaan', (int) $blockId, 'Menghapus jadwal blokir ketersediaan.');
        json_response(['success' => true, 'message' => 'Jadwal blokir berhasil dihapus.']);
    }
    if ($action !== 'create') json_response(['success' => false, 'message' => 'Aksi blokir tidak dikenal.'], 422);

    $itemId = filter_var($_POST['id_barang'] ?? null, FILTER_VALIDATE_INT);
    $start = trim((string) ($_POST['tgl_mulai'] ?? ''));
    $end = trim((string) ($_POST['tgl_selesai'] ?? ''));
    $quantity = filter_var($_POST['jumlah'] ?? null, FILTER_VALIDATE_INT);
    $reason = trim((string) ($_POST['alasan'] ?? ''));
    if (!$itemId || !valid_date($start) || !valid_date($end) || $start < date('Y-m-d') || $end < $start || $quantity === false || $quantity === null || $quantity < 1 || $reason === '' || mb_strlen($reason) > 255) {
        json_response(['success' => false, 'message' => 'Data blokir tidak valid. Periksa barang, tanggal, jumlah unit, dan alasan.'], 422);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("SELECT id_barang, total_stok, nama_barang FROM barang WHERE id_barang = ? AND id_toko = ? AND status_aktif = 'aktif' FOR UPDATE");
    $stmt->execute([$itemId, $storeId]);
    $item = $stmt->fetch();
    if (!$item) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Barang tidak ditemukan, nonaktif, atau bukan milik toko ini.'], 404); }
    $occupied = max_occupied_units($pdo, (int) $itemId, $start, $end);
    $available = (int) $item['total_stok'] - $occupied;
    if ($quantity > $available) {
        $pdo->rollBack();
        json_response(['success' => false, 'message' => 'Ketersediaan minimum pada rentang tanggal itu ' . max(0, $available) . ' unit. Jumlah blokir melebihi stok yang tersedia.'], 409);
    }
    $stmt = $pdo->prepare('INSERT INTO blokir_ketersediaan (id_barang, tgl_mulai, tgl_selesai, jumlah, alasan) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$itemId, $start, $end, $quantity, $reason]);
    $blockId = (int) $pdo->lastInsertId();
    log_activity($pdo, $context['user_id'], 'BUAT_BLOKIR', 'blokir_ketersediaan', $blockId, 'Memblokir ' . $quantity . ' unit ' . $item['nama_barang'] . ' untuk ' . $start . ' sampai ' . $end . '.');
    $pdo->commit();
    json_response(['success' => true, 'message' => 'Blokir ketersediaan berhasil disimpan.', 'data' => ['id_blokir' => $blockId]], 201);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    respond_exception($error);
}
