<?php
declare(strict_types=1);

// Konfigurasi database lokal. Ubah jika kredensial MySQL XAMPP berbeda.
$DB_HOST = 'localhost';
$DB_NAME = 'db_penyewaan_barang';
$DB_USER = 'root';
$DB_PASS = '';
date_default_timezone_set('Asia/Jakarta');

if (session_status() !== PHP_SESSION_ACTIVE) {
    $isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store, private');

function db(): PDO
{
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // Samakan waktu MySQL dengan WIB untuk pencatatan operasional.
    $pdo->exec("SET time_zone = '+07:00'");
    return $pdo;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($method)) {
        json_response(['success' => false, 'message' => 'Metode HTTP tidak diizinkan.'], 405);
    }
}

function provider_context(): array
{
    if (empty($_SESSION['user_id']) || empty($_SESSION['store_id']) || ($_SESSION['role'] ?? '') !== 'penyedia') {
        json_response(['success' => false, 'message' => 'Sesi penyedia berakhir. Silakan masuk kembali.'], 401);
    }
    return [
        'user_id' => (int) $_SESSION['user_id'],
        'store_id' => (int) $_SESSION['store_id'],
        'name' => (string) ($_SESSION['user_name'] ?? 'Penyedia'),
        'email' => (string) ($_SESSION['user_email'] ?? ''),
        'store_name' => (string) ($_SESSION['store_name'] ?? 'Toko'),
    ];
}

function require_csrf(): void
{
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    $received = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '');
    if ($expected === '' || $received === '' || !hash_equals($expected, $received)) {
        json_response(['success' => false, 'message' => 'Token keamanan tidak valid. Muat ulang halaman lalu coba kembali.'], 419);
    }
}

function valid_date(string $date): bool
{
    $parsed = DateTime::createFromFormat('!Y-m-d', $date);
    return $parsed instanceof DateTime && $parsed->format('Y-m-d') === $date;
}

/**
 * Menghitung pemakaian stok maksimum pada hari mana pun dalam rentang tanggal.
 * Interval tanggal bersifat inklusif. Ini lebih tepat daripada menjumlahkan semua
 * pesanan yang bersinggungan, karena dua pesanan yang tidak berlangsung bersamaan
 * tidak seharusnya mengurangi stok pada saat yang sama.
 */
function max_occupied_units(PDO $pdo, int $itemId, string $start, string $end, ?int $excludeBlockId = null, ?int $excludeOrderId = null): int
{
    $events = [];
    $addInterval = static function (string $intervalStart, string $intervalEnd, int $quantity) use (&$events, $start, $end): void {
        if ($quantity <= 0) return;
        $s = max($intervalStart, $start);
        $e = min($intervalEnd, $end);
        if ($s > $e) return;
        $events[$s] = ($events[$s] ?? 0) + $quantity;
        $after = (new DateTimeImmutable($e))->modify('+1 day')->format('Y-m-d');
        $events[$after] = ($events[$after] ?? 0) - $quantity;
    };

    $activeStatuses = "'ditahan','menunggu_keputusan','disetujui','menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi'";
    $sql = "SELECT id_pesanan, tgl_mulai, tgl_selesai, jumlah FROM pesanan WHERE id_barang = ? AND status_pesanan IN ({$activeStatuses}) AND tgl_mulai <= ? AND tgl_selesai >= ?";
    $params = [$itemId, $end, $start];
    if ($excludeOrderId !== null) { $sql .= ' AND id_pesanan <> ?'; $params[] = $excludeOrderId; }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) $addInterval($row['tgl_mulai'], $row['tgl_selesai'], (int) $row['jumlah']);

    $sql = "SELECT h.tgl_mulai, h.tgl_selesai, h.jumlah FROM hold_stok h WHERE h.id_barang = ? AND h.status = 'aktif' AND h.waktu_kadaluarsa > NOW() AND h.tgl_mulai <= ? AND h.tgl_selesai >= ? AND NOT EXISTS (SELECT 1 FROM pesanan p WHERE p.id_hold = h.id_hold AND p.status_pesanan IN ({$activeStatuses}))";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$itemId, $end, $start]);
    foreach ($stmt->fetchAll() as $row) $addInterval($row['tgl_mulai'], $row['tgl_selesai'], (int) $row['jumlah']);

    $sql = 'SELECT id_blokir, tgl_mulai, tgl_selesai, jumlah FROM blokir_ketersediaan WHERE id_barang = ? AND tgl_mulai <= ? AND tgl_selesai >= ?';
    $params = [$itemId, $end, $start];
    if ($excludeBlockId !== null) { $sql .= ' AND id_blokir <> ?'; $params[] = $excludeBlockId; }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) $addInterval($row['tgl_mulai'], $row['tgl_selesai'], (int) $row['jumlah']);

    if (!$events) return 0;
    ksort($events, SORT_STRING);
    $occupied = 0;
    $maximum = 0;
    foreach ($events as $delta) {
        $occupied += $delta;
        $maximum = max($maximum, $occupied);
    }
    return max(0, $maximum);
}

function log_activity(PDO $pdo, ?int $userId, string $action, ?string $tableName = null, ?int $recordId = null, ?string $description = null): void
{
    $stmt = $pdo->prepare('INSERT INTO log_aktivitas (id_user, aksi, tabel_terkait, id_terkait, keterangan) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $action, $tableName, $recordId, $description]);
}

function respond_exception(Throwable $error): void
{
    error_log((string) $error);
    json_response(['success' => false, 'message' => 'Terjadi kendala pada server atau database. Periksa koneksi MySQL dan struktur database.'], 500);
}
