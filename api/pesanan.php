<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $context = provider_context();
    $pdo = db();
    $storeId = $context['store_id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $sql = "SELECT p.id_pesanan, p.kode_pesanan, p.id_barang, p.id_user, p.tgl_mulai, p.tgl_selesai, p.jumlah, p.total_harga, p.status_pesanan, p.alasan_penolakan, p.created_at, b.nama_barang, b.harga_sewa, u.nama AS nama_pelanggan, u.email AS email_pelanggan, u.no_hp AS hp_pelanggan, pm.metode AS metode_pembayaran, pm.status AS status_pembayaran, pm.tgl_konfirmasi AS tgl_pembayaran, st.tgl_serah, st.catatan_kondisi, pg.tgl_kembali, pg.kondisi_barang, pg.status AS status_pengembalian FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang INNER JOIN users u ON u.id_user = p.id_user LEFT JOIN pembayaran pm ON pm.id_pesanan = p.id_pesanan LEFT JOIN serah_terima st ON st.id_pesanan = p.id_pesanan LEFT JOIN pengembalian pg ON pg.id_pesanan = p.id_pesanan WHERE b.id_toko = ? ORDER BY (p.status_pesanan IN ('ditahan','menunggu_keputusan')) DESC, p.created_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$storeId]);
        json_response(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    require_method('POST');
    require_csrf();
    $orderId = filter_var($_POST['id_pesanan'] ?? null, FILTER_VALIDATE_INT);
    $action = (string) ($_POST['aksi'] ?? '');
    if (!$orderId) json_response(['success' => false, 'message' => 'ID pesanan tidak valid.'], 422);

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT p.*, b.id_toko, b.total_stok, b.nama_barang FROM pesanan p INNER JOIN barang b ON b.id_barang = p.id_barang WHERE p.id_pesanan = ? AND b.id_toko = ? FOR UPDATE');
    $stmt->execute([$orderId, $storeId]);
    $order = $stmt->fetch();
    if (!$order) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Pesanan tidak ditemukan pada toko ini.'], 404); }

    $currentStatus = (string) $order['status_pesanan'];
    $newStatus = $currentStatus;
    $message = '';
    $now = date('Y-m-d H:i:s');

    switch ($action) {
        case 'accept':
            if (!in_array($currentStatus, ['ditahan', 'menunggu_keputusan'], true)) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Pesanan ini sudah diproses sebelumnya.'], 409); }
            $occupied = max_occupied_units($pdo, (int) $order['id_barang'], $order['tgl_mulai'], $order['tgl_selesai']);
            if ($occupied > (int) $order['total_stok']) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Stok tidak mencukupi untuk menerima pesanan pada rentang tanggal tersebut. Periksa jadwal pesanan dan blokir stok.'], 409); }
            $newStatus = 'menunggu_dibayar';
            $pdo->prepare("INSERT INTO pembayaran (id_pesanan, metode, nominal, status) VALUES (?, 'Pembayaran di luar website', ?, 'menunggu') ON DUPLICATE KEY UPDATE nominal = VALUES(nominal), status = 'menunggu'")->execute([$orderId, $order['total_harga']]);
            $message = 'Pesanan diterima. Status sekarang menunggu konfirmasi pembayaran.';
            break;
        case 'reject':
            if (!in_array($currentStatus, ['ditahan', 'menunggu_keputusan'], true)) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Hanya pesanan yang belum diproses yang bisa ditolak.'], 409); }
            $reason = trim((string) ($_POST['alasan_penolakan'] ?? ''));
            if ($reason === '' || mb_strlen($reason) > 1000) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Alasan penolakan wajib diisi (maksimal 1.000 karakter).'], 422); }
            $newStatus = 'ditolak';
            $pdo->prepare('UPDATE pesanan SET alasan_penolakan = ? WHERE id_pesanan = ?')->execute([$reason, $orderId]);
            $message = 'Pesanan ditolak dan alasan tersimpan.';
            break;
        case 'confirm_payment':
            if (!in_array($currentStatus, ['disetujui', 'menunggu_dibayar'], true)) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Konfirmasi pembayaran hanya tersedia untuk pesanan yang menunggu pembayaran.'], 409); }
            $methodName = trim((string) ($_POST['metode_pembayaran'] ?? 'Dikonfirmasi penyedia'));
            if ($methodName === '') $methodName = 'Dikonfirmasi penyedia';
            $pdo->prepare("INSERT INTO pembayaran (id_pesanan, metode, nominal, status, tgl_konfirmasi) VALUES (?, ?, ?, 'terkonfirmasi', ?) ON DUPLICATE KEY UPDATE metode = VALUES(metode), nominal = VALUES(nominal), status = 'terkonfirmasi', tgl_konfirmasi = VALUES(tgl_konfirmasi)")->execute([$orderId, mb_substr($methodName, 0, 60), $order['total_harga'], $now]);
            $newStatus = 'pembayaran_terkonfirmasi';
            $message = 'Pembayaran ditandai terkonfirmasi.';
            break;
        case 'prepare':
            if ($currentStatus !== 'pembayaran_terkonfirmasi') { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Barang hanya dapat disiapkan setelah pembayaran dikonfirmasi.'], 409); }
            $newStatus = 'siap_diserahkan';
            $message = 'Pesanan ditandai siap diserahkan.';
            break;
        case 'handover':
            if ($currentStatus !== 'siap_diserahkan') { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Serah terima hanya tersedia jika pesanan sudah siap diserahkan.'], 409); }
            $condition = trim((string) ($_POST['catatan_kondisi'] ?? ''));
            if ($condition === '' || mb_strlen($condition) > 2000) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Catatan kondisi awal barang wajib diisi (maksimal 2.000 karakter).'], 422); }
            $pdo->prepare('INSERT INTO serah_terima (id_pesanan, tgl_serah, catatan_kondisi) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tgl_serah = VALUES(tgl_serah), catatan_kondisi = VALUES(catatan_kondisi)')->execute([$orderId, $now, $condition]);
            $newStatus = 'sedang_dipakai';
            $message = 'Serah terima tercatat. Barang berstatus sedang disewa.';
            break;
        case 'confirm_return':
            if (!in_array($currentStatus, ['sedang_dipakai', 'menunggu_dikembalikan'], true)) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Pesanan ini belum berada pada tahap pengembalian.'], 409); }
            $condition = trim((string) ($_POST['kondisi_barang'] ?? ''));
            if ($condition === '' || mb_strlen($condition) > 2000) { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Catatan kondisi saat pengembalian wajib diisi (maksimal 2.000 karakter).'], 422); }
            $pdo->prepare("INSERT INTO pengembalian (id_pesanan, tgl_kembali, kondisi_barang, status, tgl_konfirmasi) VALUES (?, ?, ?, 'terkonfirmasi', ?) ON DUPLICATE KEY UPDATE tgl_kembali = VALUES(tgl_kembali), kondisi_barang = VALUES(kondisi_barang), status = 'terkonfirmasi', tgl_konfirmasi = VALUES(tgl_konfirmasi)")->execute([$orderId, $now, $condition, $now]);
            $newStatus = 'pengembalian_terkonfirmasi';
            $message = 'Pengembalian dicatat dan kondisi barang tersimpan.';
            break;
        case 'finish':
            if ($currentStatus !== 'pengembalian_terkonfirmasi') { $pdo->rollBack(); json_response(['success' => false, 'message' => 'Pesanan hanya dapat diselesaikan setelah pengembalian dikonfirmasi.'], 409); }
            $newStatus = 'selesai';
            $message = 'Siklus penyewaan berhasil diselesaikan.';
            break;
        default:
            $pdo->rollBack();
            json_response(['success' => false, 'message' => 'Aksi pesanan tidak dikenal.'], 422);
    }

    $pdo->prepare('UPDATE pesanan SET status_pesanan = ? WHERE id_pesanan = ?')->execute([$newStatus, $orderId]);
    log_activity($pdo, $context['user_id'], strtoupper($action), 'pesanan', (int) $orderId, 'Pesanan ' . $order['kode_pesanan'] . ' berubah dari ' . $currentStatus . ' menjadi ' . $newStatus . '.');
    $pdo->commit();
    json_response(['success' => true, 'message' => $message, 'data' => ['status_pesanan' => $newStatus]]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    respond_exception($error);
}
