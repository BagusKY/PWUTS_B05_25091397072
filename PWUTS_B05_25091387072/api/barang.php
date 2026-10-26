<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function save_uploaded_image(?array $file): ?string
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        json_response(['success' => false, 'message' => 'Foto gagal diunggah. Coba pilih file lain.'], 422);
    }
    if ((int) ($file['size'] ?? 0) > 2 * 1024 * 1024) {
        json_response(['success' => false, 'message' => 'Ukuran foto maksimal 2 MB.'], 422);
    }
    $tmp = (string) ($file['tmp_name'] ?? '');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime]) || @getimagesize($tmp) === false) {
        json_response(['success' => false, 'message' => 'Format foto harus JPG, PNG, atau WebP.'], 422);
    }
    $directory = dirname(__DIR__) . '/uploads/items';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        json_response(['success' => false, 'message' => 'Folder upload belum dapat dibuat.'], 500);
    }
    $name = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($tmp, $directory . '/' . $name)) {
        json_response(['success' => false, 'message' => 'Server gagal menyimpan foto. Periksa izin folder uploads.'], 500);
    }
    return 'uploads/items/' . $name;
}

try {
    $context = provider_context();
    $pdo = db();
    $storeId = $context['store_id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT b.id_barang, b.nama_barang, b.deskripsi, b.harga_sewa, b.total_stok, b.status_aktif, b.id_kategori, b.created_at, k.nama_kategori, (SELECT mb.path_file FROM media_barang mb WHERE mb.id_barang = b.id_barang ORDER BY mb.id_media DESC LIMIT 1) AS gambar FROM barang b LEFT JOIN kategori k ON k.id_kategori = b.id_kategori WHERE b.id_toko = ? ORDER BY b.created_at DESC, b.id_barang DESC');
        $stmt->execute([$storeId]);
        json_response(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    require_method('POST');
    require_csrf();
    $action = (string) ($_POST['aksi'] ?? 'create');

    if ($action === 'toggle_status') {
        $id = filter_var($_POST['id_barang'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) json_response(['success' => false, 'message' => 'Barang tidak valid.'], 422);
        $stmt = $pdo->prepare('SELECT id_barang, status_aktif FROM barang WHERE id_barang = ? AND id_toko = ?');
        $stmt->execute([$id, $storeId]);
        $item = $stmt->fetch();
        if (!$item) json_response(['success' => false, 'message' => 'Barang tidak ditemukan pada toko ini.'], 404);
        $newStatus = $item['status_aktif'] === 'aktif' ? 'nonaktif' : 'aktif';
        if ($newStatus === 'nonaktif') {
            $check = $pdo->prepare("SELECT COUNT(*) AS total FROM pesanan WHERE id_barang = ? AND status_pesanan IN ('ditahan','menunggu_keputusan','disetujui','menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi') AND tgl_selesai >= CURDATE()");
            $check->execute([$id]);
            if ((int) $check->fetch()['total'] > 0) json_response(['success' => false, 'message' => 'Barang masih memiliki pesanan aktif. Selesaikan pesanan terlebih dahulu sebelum menonaktifkan barang.'], 409);
        }
        $pdo->prepare('UPDATE barang SET status_aktif = ? WHERE id_barang = ? AND id_toko = ?')->execute([$newStatus, $id, $storeId]);
        log_activity($pdo, $context['user_id'], $newStatus === 'aktif' ? 'AKTIFKAN_BARANG' : 'NONAKTIFKAN_BARANG', 'barang', (int) $id, 'Status barang diubah menjadi ' . $newStatus . '.');
        json_response(['success' => true, 'message' => $newStatus === 'aktif' ? 'Barang diaktifkan kembali.' : 'Barang berhasil dinonaktifkan.', 'data' => ['status_aktif' => $newStatus]]);
    }

    if (!in_array($action, ['create', 'update'], true)) json_response(['success' => false, 'message' => 'Aksi barang tidak dikenal.'], 422);
    $id = filter_var($_POST['id_barang'] ?? null, FILTER_VALIDATE_INT);
    $name = trim((string) ($_POST['nama_barang'] ?? ''));
    $categoryId = filter_var($_POST['id_kategori'] ?? null, FILTER_VALIDATE_INT);
    $priceRaw = trim((string) ($_POST['harga_sewa'] ?? ''));
    $price = is_numeric($priceRaw) ? (float) $priceRaw : 0;
    $stock = filter_var($_POST['total_stok'] ?? null, FILTER_VALIDATE_INT);
    $description = trim((string) ($_POST['deskripsi'] ?? ''));
    $status = (string) ($_POST['status_aktif'] ?? 'aktif');

    if ($name === '' || mb_strlen($name) > 150 || !$categoryId || $price <= 0 || !is_finite($price) || $stock === false || $stock === null || $stock < 0 || $description === '' || mb_strlen($description) > 3000 || !in_array($status, ['aktif', 'nonaktif'], true)) {
        json_response(['success' => false, 'message' => 'Data belum valid. Periksa nama, kategori, harga, stok, status, dan deskripsi.'], 422);
    }
    $check = $pdo->prepare('SELECT id_kategori FROM kategori WHERE id_kategori = ?');
    $check->execute([$categoryId]);
    if (!$check->fetch()) json_response(['success' => false, 'message' => 'Kategori yang dipilih tidak tersedia.'], 422);
    $check = $pdo->prepare("SELECT id_toko FROM toko WHERE id_toko = ? AND status_verifikasi = 'disetujui'");
    $check->execute([$storeId]);
    if (!$check->fetch()) json_response(['success' => false, 'message' => 'Toko belum disetujui admin.'], 403);

    $pdo->beginTransaction();
    $imagePath = save_uploaded_image($_FILES['foto'] ?? null);
    if ($action === 'create') {
        $stmt = $pdo->prepare('INSERT INTO barang (id_toko, id_kategori, nama_barang, deskripsi, harga_sewa, total_stok, status_aktif) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$storeId, $categoryId, $name, $description, $price, $stock, $status]);
        $id = (int) $pdo->lastInsertId();
        if ($imagePath !== null) $pdo->prepare("INSERT INTO media_barang (id_barang, jenis, path_file) VALUES (?, 'gambar', ?)")->execute([$id, $imagePath]);
        log_activity($pdo, $context['user_id'], 'TAMBAH_BARANG', 'barang', $id, 'Menambahkan barang: ' . $name . '.');
        $pdo->commit();
        json_response(['success' => true, 'message' => 'Barang baru berhasil ditambahkan.', 'data' => ['id_barang' => $id]], 201);
    }

    if (!$id) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'ID barang tidak valid untuk proses edit.'], 422); }
    $stmt = $pdo->prepare('SELECT id_barang, total_stok, status_aktif FROM barang WHERE id_barang = ? AND id_toko = ? FOR UPDATE');
    $stmt->execute([$id, $storeId]);
    $existing = $stmt->fetch();
    if (!$existing) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Barang tidak ditemukan pada toko ini.'], 404); }
    if ($status === 'nonaktif' && $existing['status_aktif'] === 'aktif') {
        $activeCheck = $pdo->prepare("SELECT COUNT(*) AS total FROM pesanan WHERE id_barang = ? AND status_pesanan IN ('ditahan','menunggu_keputusan','disetujui','menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi') AND tgl_selesai >= CURDATE()");
        $activeCheck->execute([$id]);
        if ((int) $activeCheck->fetch()['total'] > 0) {
            $pdo->rollBack();
            json_response(['success' => false, 'message' => 'Barang masih memiliki pesanan aktif. Selesaikan pesanan sebelum menonaktifkan barang.'], 409);
        }
    }
    if ($stock < (int) $existing['total_stok']) {
        $rangeStmt = $pdo->prepare("SELECT MIN(range_start) AS range_start, MAX(range_end) AS range_end FROM (SELECT tgl_mulai AS range_start, tgl_selesai AS range_end FROM pesanan WHERE id_barang = ? AND status_pesanan IN ('ditahan','menunggu_keputusan','disetujui','menunggu_dibayar','pembayaran_terkonfirmasi','siap_diserahkan','sedang_dipakai','menunggu_dikembalikan','pengembalian_terkonfirmasi') AND tgl_selesai >= CURDATE() UNION ALL SELECT tgl_mulai AS range_start, tgl_selesai AS range_end FROM blokir_ketersediaan WHERE id_barang = ? AND tgl_selesai >= CURDATE() UNION ALL SELECT tgl_mulai AS range_start, tgl_selesai AS range_end FROM hold_stok WHERE id_barang = ? AND status = 'aktif' AND waktu_kadaluarsa > NOW() AND tgl_selesai >= CURDATE()) AS occupancy_ranges");
        $rangeStmt->execute([$id, $id, $id]);
        $range = $rangeStmt->fetch();
        if (!empty($range['range_end'])) {
            $maxUsed = max_occupied_units($pdo, (int) $id, date('Y-m-d'), (string) $range['range_end']);
            if ($stock < $maxUsed) {
                $pdo->rollBack();
                json_response(['success' => false, 'message' => 'Stok tidak dapat dikurangi menjadi ' . $stock . ' unit karena masih ada hingga ' . $maxUsed . ' unit yang terpesan atau diblokir pada periode mendatang.'], 409);
            }
        }
    }
    $stmt = $pdo->prepare('UPDATE barang SET id_kategori = ?, nama_barang = ?, deskripsi = ?, harga_sewa = ?, total_stok = ?, status_aktif = ? WHERE id_barang = ? AND id_toko = ?');
    $stmt->execute([$categoryId, $name, $description, $price, $stock, $status, $id, $storeId]);
    if ($imagePath !== null) {
        $stmt = $pdo->prepare('SELECT id_media, path_file FROM media_barang WHERE id_barang = ? ORDER BY id_media DESC LIMIT 1');
        $stmt->execute([$id]);
        $oldMedia = $stmt->fetch();
        if ($oldMedia) $pdo->prepare("UPDATE media_barang SET path_file = ?, jenis = 'gambar' WHERE id_media = ?")->execute([$imagePath, $oldMedia['id_media']]);
        else $pdo->prepare("INSERT INTO media_barang (id_barang, jenis, path_file) VALUES (?, 'gambar', ?)")->execute([$id, $imagePath]);
    }
    log_activity($pdo, $context['user_id'], 'EDIT_BARANG', 'barang', (int) $id, 'Memperbarui data barang: ' . $name . '.');
    $pdo->commit();
    json_response(['success' => true, 'message' => 'Perubahan barang berhasil disimpan.', 'data' => ['id_barang' => (int) $id]]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    respond_exception($error);
}
