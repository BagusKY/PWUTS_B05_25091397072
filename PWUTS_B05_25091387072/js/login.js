(function ($) {
  'use strict';
  const $form = $('#loginForm');
  const $button = $form.find('[type="submit"]');
  const $message = $('#loginMessage');

  $.getJSON('api/auth.php').done(function (response) {
    if (response && response.authenticated) window.location.replace('index.html');
  });

  $('#togglePassword').on('click', function () {
    const $password = $('#password');
    const reveal = $password.attr('type') === 'password';
    $password.attr('type', reveal ? 'text' : 'password');
    $(this).text(reveal ? 'Sembunyikan' : 'Tampilkan');
  });

  $('#fillDemo').on('click', function () {
    $('#email').val('penyedia@example.test');
    $('#password').val('SewaDemo123!').trigger('focus');
    $message.prop('hidden', true).text('');
  });

  $form.on('submit', function (event) {
    event.preventDefault();
    $message.prop('hidden', true).text('');
    $('[data-error-for]').text('');
    const email = String($('#email').val() || '').trim();
    const password = String($('#password').val() || '');
    let valid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('[data-error-for="email"]').text('Masukkan alamat email yang valid.');
      valid = false;
    }
    if (!password) {
      $('[data-error-for="password"]').text('Kata sandi wajib diisi.');
      valid = false;
    }
    if (!valid) return;

    $button.prop('disabled', true).html('<span class="spinner spinner-button"></span> Memverifikasi…');
    $.ajax({
      url: 'api/auth.php',
      method: 'POST',
      dataType: 'json',
      data: { aksi: 'login', email: email, password: password }
    }).done(function (response) {
      if (response && response.success) {
        $button.html('Login berhasil…');
        window.location.replace('index.html');
      } else {
        $message.text((response && response.message) || 'Login gagal. Coba kembali.').prop('hidden', false);
        $button.prop('disabled', false).html('<span>Masuk ke dashboard</span><span class="btn-arrow">→</span>');
      }
    }).fail(function (xhr) {
      const response = xhr.responseJSON || {};
      $message.text(response.message || 'Server tidak dapat dihubungi. Pastikan Apache dan MySQL aktif.').prop('hidden', false);
      $button.prop('disabled', false).html('<span>Masuk ke dashboard</span><span class="btn-arrow">→</span>');
    });
  });
})(jQuery);
