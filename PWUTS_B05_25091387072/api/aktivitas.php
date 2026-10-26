<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
try {
    $context = provider_context();
    $pdo = db();
    $limit = filter_var($_GET['limit'] ?? 80, FILTER_VALIDATE_INT);
    $limit = max(10, min(200, $limit ?: 80));
    $stmt = $pdo->prepare('SELECT l.id_log, l.aksi, l.tabel_terkait, l.id_terkait, l.keterangan, l.created_at, u.nama AS nama_pengguna FROM log_aktivitas l LEFT JOIN users u ON u.id_user = l.id_user WHERE l.id_user = ? ORDER BY l.created_at DESC, l.id_log DESC LIMIT ' . $limit);
    $stmt->execute([$context['user_id']]);
    json_response(['success' => true, 'data' => $stmt->fetchAll()]);
} catch (Throwable $error) { respond_exception($error); }
