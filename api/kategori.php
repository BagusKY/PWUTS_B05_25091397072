<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
try {
    provider_context();
    $stmt = db()->query('SELECT id_kategori, nama_kategori FROM kategori ORDER BY nama_kategori');
    json_response(['success' => true, 'data' => $stmt->fetchAll()]);
} catch (Throwable $error) { respond_exception($error); }
