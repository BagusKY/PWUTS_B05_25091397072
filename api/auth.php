<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method === 'GET') {
        if (empty($_SESSION['user_id']) || empty($_SESSION['store_id']) || ($_SESSION['role'] ?? '') !== 'penyedia') {
            json_response(['success' => true, 'authenticated' => false]);
        }
        json_response([
            'success' => true,
            'authenticated' => true,
            'csrf_token' => (string) ($_SESSION['csrf_token'] ?? ''),
            'data' => [
                'id_user' => (int) $_SESSION['user_id'],
                'id_toko' => (int) $_SESSION['store_id'],
                'nama' => (string) $_SESSION['user_name'],
                'email' => (string) $_SESSION['user_email'],
                'nama_toko' => (string) $_SESSION['store_name'],
            ],
        ]);
    }

    require_method('POST');
    $action = (string) ($_POST['aksi'] ?? 'login');
    if ($action === 'logout') {
        provider_context();
        require_csrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
        }
        session_destroy();
        json_response(['success' => true, 'message' => 'Kamu berhasil keluar.']);
    }

    if (!empty($_SESSION['login_locked_until']) && (int) $_SESSION['login_locked_until'] > time()) {
        json_response(['success' => false, 'message' => 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit kemudian.'], 429);
    }

    $email = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        json_response(['success' => false, 'message' => 'Masukkan email dan kata sandi yang valid.'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare("SELECT u.id_user, u.nama, u.email, u.password, u.role, t.id_toko, t.nama_toko, t.status_verifikasi FROM users u INNER JOIN toko t ON t.id_user = u.id_user WHERE u.email = ? AND u.role = 'penyedia' LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, (string) $user['password'])) {
        $_SESSION['login_failures'] = (int) ($_SESSION['login_failures'] ?? 0) + 1;
        if ($_SESSION['login_failures'] >= 6) {
            $_SESSION['login_locked_until'] = time() + 300;
            $_SESSION['login_failures'] = 0;
        }
        usleep(250000);
        json_response(['success' => false, 'message' => 'Email atau kata sandi tidak cocok.'], 401);
    }
    if ($user['status_verifikasi'] !== 'disetujui') {
        json_response(['success' => false, 'message' => 'Toko belum disetujui admin sehingga dashboard penyedia belum dapat diakses.'], 403);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id_user'];
    $_SESSION['store_id'] = (int) $user['id_toko'];
    $_SESSION['role'] = 'penyedia';
    $_SESSION['user_name'] = (string) $user['nama'];
    $_SESSION['user_email'] = (string) $user['email'];
    $_SESSION['store_name'] = (string) $user['nama_toko'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['login_failures'] = 0;
    unset($_SESSION['login_locked_until']);
    log_activity($pdo, (int) $user['id_user'], 'LOGIN', 'users', (int) $user['id_user'], 'Penyedia masuk ke dashboard.');

    json_response(['success' => true, 'message' => 'Login berhasil.', 'redirect' => 'index.html']);
} catch (Throwable $error) {
    respond_exception($error);
}
