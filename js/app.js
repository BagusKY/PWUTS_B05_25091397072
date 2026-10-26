(function ($) {
  'use strict';

  const routes = {
    'pages/dashboard.html': 'Ringkasan',
    'pages/kelola-stok.html': 'Inventaris Barang',
    'pages/pesanan.html': 'Pesanan Masuk',
    'pages/form-tambah-barang.html': 'Tambah Barang',
    'pages/form-blokir.html': 'Kalender & Blokir',
    'pages/laporan.html': 'Laporan',
    'pages/aktivitas.html': 'Log Aktivitas'
  };
  const state = { csrf: '', user: null, page: '', items: [], categories: [], orders: [], blocks: [], report: null, activity: [] };
  const statusMap = {
    ditahan: ['Ditahan sementara', 'badge-warning'],
    menunggu_keputusan: ['Menunggu keputusan', 'badge-warning'],
    disetujui: ['Disetujui', 'badge-info'],
    ditolak: ['Ditolak', 'badge-danger'],
    menunggu_dibayar: ['Menunggu pembayaran', 'badge-warning'],
    pembayaran_terkonfirmasi: ['Pembayaran terkonfirmasi', 'badge-info'],
    siap_diserahkan: ['Siap diserahkan', 'badge-violet'],
    sedang_dipakai: ['Sedang disewa', 'badge-info'],
    menunggu_dikembalikan: ['Menunggu pengembalian', 'badge-warning'],
    pengembalian_terkonfirmasi: ['Pengembalian dikonfirmasi', 'badge-success'],
    selesai: ['Selesai', 'badge-success'],
    hold_kedaluwarsa: ['Hold kedaluwarsa', 'badge-neutral']
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function money(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function number(value) { return new Intl.NumberFormat('id-ID').format(Number(value) || 0); }
  function localISODate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateShort(value) {
    if (!value) return '—';
    const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  function dateTime(value) {
    if (!value) return '—';
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }
  function initials(name) {
    return String(name || 'Penyedia').trim().split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join('').toUpperCase();
  }
  function statusBadge(status) {
    const info = statusMap[status] || [String(status || 'Tidak diketahui').replace(/_/g, ' '), 'badge-neutral'];
    return '<span class="badge ' + info[1] + '">' + escapeHtml(info[0]) + '</span>';
  }
  function api(url, method, data, options) {
    options = options || {};
    const config = { url: url, method: method || 'GET', dataType: 'json', cache: false };
    if (data !== undefined && data !== null) config.data = data;
    if (options.formData) { config.processData = false; config.contentType = false; }
    if (String(config.method).toUpperCase() !== 'GET' && state.csrf) config.headers = { 'X-CSRF-Token': state.csrf };
    return $.ajax(config).fail(function (xhr) {
      if (xhr && xhr.status === 401 && !options.noRedirect) window.location.replace('login.html');
    });
  }
  function showToast(message, type) {
    const $toast = $('<div class="toast ' + (type || '') + '"><span class="toast-icon">' + (type === 'error' ? '!' : '✓') + '</span><span></span></div>');
    $toast.find('span').last().text(message || 'Selesai.');
    $('#toastRegion').append($toast);
    window.setTimeout(function () { $toast.fadeOut(180, function () { $(this).remove(); }); }, 3600);
  }
  function errorMessage(xhr, fallback) {
    return xhr && xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : (fallback || 'Permintaan tidak dapat diproses. Coba kembali.');
  }
  function routeFromHash() {
    const route = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    return routes[route] ? route : 'pages/dashboard.html';
  }
  function navigate(route) {
    if (!routes[route]) return;
    if (window.location.hash === '#' + route) loadPage(route);
    else window.location.hash = route;
  }
  function loadPage(route) {
    if (!routes[route]) route = 'pages/dashboard.html';
    state.page = route;
    $('#pageTitle').text(routes[route]);
    $('.nav-link').each(function () { $(this).toggleClass('active', $(this).attr('data-page') === route); });
    $('#sidebar').removeClass('sidebar-open');
    $('#mobileOverlay').removeClass('active');
    $('#mainContent').html('<div class="loading-state"><span class="spinner"></span><p>Memuat ' + escapeHtml(routes[route].toLowerCase()) + '…</p></div>');
    $('#mainContent').load(route, function (_response, status) {
      if (status !== 'success') {
        $('#mainContent').html('<section class="panel" style="padding:24px"><h2>Halaman tidak dapat dimuat</h2><p class="muted-copy">Pastikan folder project dijalankan melalui Apache XAMPP dan file halaman tersedia.</p><button class="btn btn-primary" data-route="pages/dashboard.html">Kembali ke dashboard</button></section>');
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      initPage(route);
    });
  }
  function loadCategories() {
    return api('api/kategori.php').done(function (response) {
      if (response.success) state.categories = response.data || [];
    });
  }
  function categoryOptions(selectedId, includePlaceholder) {
    let html = includePlaceholder ? '<option value="">Pilih kategori</option>' : '';
    html += state.categories.map(function (category) {
      return '<option value="' + escapeHtml(category.id_kategori) + '" ' + (String(category.id_kategori) === String(selectedId || '') ? 'selected' : '') + '>' + escapeHtml(category.nama_kategori) + '</option>';
    }).join('');
    return html;
  }
  function itemThumb(item, className) {
    const fallback = '<span>▤</span>';
    const image = item && item.gambar ? '<img class="product-image" src="' + escapeHtml(item.gambar) + '" alt="' + escapeHtml(item.nama_barang || 'Foto barang') + '" loading="lazy">' : fallback;
    return '<div class="product-thumb ' + (className || '') + '">' + image + '</div>';
  }

  function initPage(route) {
    if (route === 'pages/dashboard.html') initDashboard();
    if (route === 'pages/kelola-stok.html') initInventory();
    if (route === 'pages/pesanan.html') initOrders();
    if (route === 'pages/form-tambah-barang.html') initAddItem();
    if (route === 'pages/form-blokir.html') initBlocks();
    if (route === 'pages/laporan.html') initReports();
    if (route === 'pages/aktivitas.html') initActivity();
  }

  // DASHBOARD
  function initDashboard() {
    $('#dashboardDate').text(new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()));
    api('api/dashboard.php').done(function (response) {
      if (!response.success) { showToast(response.message || 'Data dashboard tidak dapat dimuat.', 'error'); return; }
      const data = response.data;
      $('#metricItems').text(number(data.total_barang));
      $('#metricUnits').text(number(data.total_stok));
      $('#metricActiveItems').text(number(data.barang_aktif) + ' aktif');
      $('#metricPending').text(number(data.pesanan_menunggu));
      $('#pendingBadge').text(number(data.pesanan_menunggu)).toggle(data.pesanan_menunggu > 0);
      $('#metricRevenue').text(money(data.pendapatan_bulan_ini));
      $('#lowStockCount').text(number(data.stok_menipis));
      renderRevenueChart('#revenueChart', data.pendapatan_bulanan || [], true);
      const chartTotal = (data.pendapatan_bulanan || []).reduce(function (sum, item) { return sum + Number(item.total || 0); }, 0);
      $('#revenueTotal').text(money(chartTotal));
      $('#recentOrders').html(renderRecentOrders(data.pesanan_terbaru || []));
      $('#lowStockList').html(renderLowStock(data.stok_menipis_list || []));
    }).fail(function (xhr) { $('#recentOrders').html('<tr><td colspan="5"><div class="empty-inline">' + escapeHtml(errorMessage(xhr, 'Data belum dapat dimuat.')) + '</div></td></tr>'); });
  }
  function renderRevenueChart(selector, rows, compact) {
    const $target = $(selector);
    if (!rows.length) { $target.html('<div class="empty-inline">Belum ada data pendapatan pada periode ini.</div>'); return; }
    const max = Math.max(1, ...rows.map(function (row) { return Number(row.total) || 0; }));
    $target.html(rows.map(function (row, index) {
      const value = Number(row.total) || 0;
      const height = Math.max(value > 0 ? 8 : 3, value / max * 100);
      return '<div class="' + (compact ? 'revenue-bar-column' : 'report-bar-col') + '" title="' + escapeHtml(row.label || row.bulan) + ': ' + escapeHtml(money(value)) + '">' + (compact ? '' : '<div class="report-bar-val">' + (value > 0 ? escapeHtml(money(value)) : '—') + '</div>') + '<div class="' + (compact ? 'revenue-bar-track' : 'report-bar-track') + '"><div class="' + (compact ? 'revenue-bar' : 'report-bar') + (index === rows.length - 1 ? ' revenue-bar-current' : '') + '" style="height:' + height.toFixed(1) + '%"></div></div><span class="' + (compact ? 'revenue-bar-label' : '') + '">' + escapeHtml(row.label || (row.bulan || '').slice(5)) + '</span></div>';
    }).join(''));
  }
  function renderRecentOrders(rows) {
    if (!rows.length) return '<tr><td colspan="5"><div class="empty-inline">Belum ada pesanan yang masuk.</div></td></tr>';
    return rows.map(function (order) {
      return '<tr><td><div class="order-code"><strong>' + escapeHtml(order.kode_pesanan) + '</strong><small>' + escapeHtml(order.nama_pelanggan) + '</small></div></td><td>' + escapeHtml(order.nama_barang) + '</td><td><div class="date-range"><strong>' + escapeHtml(dateShort(order.tgl_mulai)) + '</strong><small>s/d ' + escapeHtml(dateShort(order.tgl_selesai)) + '</small></div></td><td><strong>' + escapeHtml(money(order.total_harga)) + '</strong></td><td>' + statusBadge(order.status_pesanan) + '</td></tr>';
    }).join('');
  }
  function renderLowStock(rows) {
    if (!rows.length) return '<div class="empty-inline">Semua barang aktif memiliki stok lebih dari 2 unit.</div>';
    return rows.map(function (item) {
      return '<div class="stock-alert-item">' + itemThumb(item) + '<div><strong>' + escapeHtml(item.nama_barang) + '</strong><small>' + escapeHtml(item.nama_kategori || 'Tanpa kategori') + '</small></div><span class="stock-qty">' + number(item.total_stok) + ' unit</span></div>';
    }).join('');
  }

  // INVENTORY
  function initInventory() {
    $.when(loadCategories(), api('api/barang.php')).done(function (categoriesResult, itemResult) {
      const response = Array.isArray(itemResult) ? itemResult[0] : itemResult;
      if (!response || !response.success) { showToast('Inventaris gagal dimuat.', 'error'); return; }
      state.items = response.data || [];
      $('#inventoryTotal').text(number(state.items.length));
      $('#inventoryActive').text(number(state.items.filter(function (x) { return x.status_aktif === 'aktif'; }).length));
      $('#inventoryLow').text(number(state.items.filter(function (x) { return x.status_aktif === 'aktif' && Number(x.total_stok) <= 2; }).length));
      $('#inventoryUnits').text(number(state.items.reduce(function (total, item) { return total + Number(item.total_stok || 0); }, 0)));
      $('#editKategori').html(categoryOptions('', true));
      renderInventory();
    }).fail(function (xhr) { $('#inventoryRows').html('<tr><td colspan="6"><div class="empty-inline">' + escapeHtml(errorMessage(xhr)) + '</div></td></tr>'); });
    $('#inventorySearch, #inventoryFilter').off('input.inventory change.inventory').on('input.inventory change.inventory', renderInventory);
  }
  function renderInventory() {
    const query = String($('#inventorySearch').val() || '').trim().toLowerCase();
    const filter = String($('#inventoryFilter').val() || 'semua');
    const rows = state.items.filter(function (item) {
      const matches = (String(item.nama_barang) + ' ' + String(item.nama_kategori || '') + ' ' + String(item.deskripsi || '')).toLowerCase().includes(query);
      const statusMatches = filter === 'semua' || (filter === 'menipis' ? item.status_aktif === 'aktif' && Number(item.total_stok) <= 2 : item.status_aktif === filter);
      return matches && statusMatches;
    });
    $('#inventoryResultCount').text(number(rows.length) + ' barang ditampilkan dari ' + number(state.items.length));
    if (!rows.length) { $('#inventoryRows').html('<tr><td colspan="6"><div class="empty-inline">Tidak ada barang yang cocok dengan pencarian atau filter.</div></td></tr>'); return; }
    $('#inventoryRows').html(rows.map(function (item) {
      const stock = Number(item.total_stok) || 0;
      const progress = Math.max(0, Math.min(100, stock / Math.max(1, Number(item.total_stok) >= 10 ? Number(item.total_stok) : 10) * 100));
      const stockClass = stock === 0 ? 'empty' : (stock <= 2 ? 'low' : '');
      return '<tr><td><div class="product-cell">' + itemThumb(item) + '<div class="product-copy"><strong>' + escapeHtml(item.nama_barang) + '</strong><small>SKU RS-' + String(item.id_barang).padStart(4, '0') + '</small></div></div></td><td>' + escapeHtml(item.nama_kategori || 'Tanpa kategori') + '</td><td><strong>' + escapeHtml(money(item.harga_sewa)) + '</strong><small class="cell-subtext"> / hari</small></td><td><div class="stock-value"><strong class="stock-number ' + stockClass + '">' + number(stock) + '</strong><span class="stock-progress"><span class="' + stockClass + '" style="width:' + progress + '%"></span></span></div></td><td>' + (item.status_aktif === 'aktif' ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-neutral">Nonaktif</span>') + (stock <= 2 && item.status_aktif === 'aktif' ? '<div class="cell-subtext warning-copy">Stok menipis</div>' : '') + '</td><td><div class="table-actions"><button class="icon-action" type="button" data-edit-item="' + item.id_barang + '" title="Edit barang" aria-label="Edit barang">✎</button><button class="icon-action ' + (item.status_aktif === 'aktif' ? 'danger' : '') + '" type="button" data-toggle-item="' + item.id_barang + '" title="' + (item.status_aktif === 'aktif' ? 'Nonaktifkan barang' : 'Aktifkan barang') + '" aria-label="Ubah status barang">' + (item.status_aktif === 'aktif' ? '⊘' : '✓') + '</button></div></td></tr>';
    }).join(''));
  }
  $(document).on('click', '[data-edit-item]', function () {
    const item = state.items.find(function (x) { return String(x.id_barang) === String($(this).attr('data-edit-item')); }.bind(this));
    if (!item) return;
    $('#editItemId').val(item.id_barang); $('#editNama').val(item.nama_barang); $('#editKategori').html(categoryOptions(item.id_kategori, true));
    $('#editHarga').val(Number(item.harga_sewa)); $('#editStok').val(Number(item.total_stok)); $('#editStatus').val(item.status_aktif); $('#editDeskripsi').val(item.deskripsi); $('#editFoto').val('');
    const dialog = document.getElementById('editItemDialog'); if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  });
  $(document).on('click', '[data-toggle-item]', function () {
    const id = $(this).attr('data-toggle-item');
    const item = state.items.find(function (x) { return String(x.id_barang) === String(id); });
    if (!item) return;
    const message = item.status_aktif === 'aktif' ? 'Nonaktifkan ' + item.nama_barang + '? Barang dengan pesanan aktif tidak dapat dinonaktifkan.' : 'Aktifkan kembali ' + item.nama_barang + '?';
    if (!window.confirm(message)) return;
    api('api/barang.php', 'POST', { aksi: 'toggle_status', id_barang: id }).done(function (response) {
      if (response.success) { showToast(response.message, 'success'); initInventory(); } else showToast(response.message || 'Status barang gagal diubah.', 'error');
    }).fail(function (xhr) { showToast(errorMessage(xhr), 'error'); });
  });
  $(document).on('submit', '#editItemForm', function (event) {
    event.preventDefault();
    const form = this;
    if (!form.reportValidity()) return;
    const file = $('#editFoto')[0].files[0];
    if (file && !validateImage(file)) { showToast('Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.', 'error'); return; }
    const data = new FormData(form); data.set('aksi', 'update');
    const $button = $('#saveEditButton').prop('disabled', true).text('Menyimpan…');
    api('api/barang.php', 'POST', data, { formData: true }).done(function (response) {
      if (!response.success) { showToast(response.message || 'Perubahan gagal disimpan.', 'error'); return; }
      document.getElementById('editItemDialog').close(); showToast(response.message, 'success'); initInventory();
    }).fail(function (xhr) { showToast(errorMessage(xhr), 'error'); }).always(function () { $button.prop('disabled', false).html('Simpan perubahan <span>→</span>'); });
  });

  // ADD ITEM
  function initAddItem() {
    loadCategories().done(function () { $('#itemCategory').html(categoryOptions('', true)); });
    const today = localISODate(new Date());
    $('#itemName').on('input', function () { $('#previewName').text(this.value.trim() || 'Nama barang akan tampil di sini'); });
    $('#itemPrice').on('input', function () { $('#previewPrice').text(money(this.value)); });
    $('#itemStock').on('input', function () { $('#previewStock').text(number(this.value) + ' unit'); });
    $('#itemStatus').on('change', function () { $('#previewStatus').text(this.value === 'aktif' ? 'Aktif' : 'Nonaktif').toggleClass('badge-success', this.value === 'aktif').toggleClass('badge-neutral', this.value !== 'aktif'); });
    $('#itemCategory').on('change', function () { $('#previewCategory').text($(this).find('option:selected').text() || 'Kategori barang'); });
    $('#itemDescription').on('input', function () { $('#previewDescription').text(this.value.trim() || 'Deskripsi singkat akan muncul di bagian ini setelah kamu mengisi form.'); $('#descriptionCount').text(this.value.length + '/3000'); });
    $('#itemPhoto').on('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;
      if (!validateImage(file)) { this.value = ''; showToast('Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.', 'error'); return; }
      const reader = new FileReader(); reader.onload = function (e) { $('#previewImage').attr('src', e.target.result); $('#uploadPreview').prop('hidden', false); $('#productPreviewArt').html('<img src="' + e.target.result + '" alt="Pratinjau foto barang">'); };
      reader.readAsDataURL(file);
    });
    $('#removePreview').on('click', function () { $('#itemPhoto').val(''); $('#uploadPreview').prop('hidden', true); $('#productPreviewArt').html('<div class="product-placeholder-icon">▤</div><span>Pratinjau produk</span>'); });
    $('#addItemForm').on('submit', function (event) {
      event.preventDefault();
      const form = this;
      $('#addItemError').prop('hidden', true).text('');
      if (!form.reportValidity()) return;
      const file = $('#itemPhoto')[0].files[0];
      if (file && !validateImage(file)) { showFormError('#addItemError', 'Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.'); return; }
      if (Number($('#itemPrice').val()) <= 0 || Number($('#itemStock').val()) < 0) { showFormError('#addItemError', 'Harga harus lebih dari nol dan stok tidak boleh negatif.'); return; }
      const data = new FormData(form); data.set('aksi', 'create');
      const $button = $('#addItemSubmit').prop('disabled', true).html('<span class="spinner spinner-button"></span> Menyimpan…');
      api('api/barang.php', 'POST', data, { formData: true }).done(function (response) {
        if (!response.success) { showFormError('#addItemError', response.message || 'Barang gagal disimpan.'); return; }
        showToast(response.message, 'success');
        form.reset(); $('#descriptionCount').text('0/3000'); $('#previewName').text('Nama barang akan tampil di sini'); $('#previewPrice').text('Rp0'); $('#previewStock').text('0 unit'); $('#previewCategory').text('Kategori barang'); $('#previewDescription').text('Deskripsi singkat akan muncul di bagian ini setelah kamu mengisi form.'); $('#previewStatus').text('Aktif').removeClass('badge-neutral').addClass('badge-success'); $('#uploadPreview').prop('hidden', true); $('#productPreviewArt').html('<div class="product-placeholder-icon">▤</div><span>Pratinjau produk</span>');
        navigate('pages/kelola-stok.html');
      }).fail(function (xhr) { showFormError('#addItemError', errorMessage(xhr, 'Barang gagal disimpan.')); }).always(function () { $button.prop('disabled', false).html('Simpan barang <span>→</span>'); });
    });
  }
  function validateImage(file) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 2 * 1024 * 1024;
  }
  function showFormError(selector, message) { $(selector).text(message).prop('hidden', false); }

  // BLOCKED AVAILABILITY
  function initBlocks() {
    const today = localISODate(new Date());
    $('#blockStart, #blockEnd').attr('min', today);
    $.when(api('api/barang.php'), api('api/blokir.php')).done(function (itemResult, blockResult) {
      const itemsResponse = Array.isArray(itemResult) ? itemResult[0] : itemResult;
      const blocksResponse = Array.isArray(blockResult) ? blockResult[0] : blockResult;
      state.items = itemsResponse && itemsResponse.success ? itemsResponse.data || [] : [];
      state.blocks = blocksResponse && blocksResponse.success ? blocksResponse.data || [] : [];
      const active = state.items.filter(function (item) { return item.status_aktif === 'aktif'; });
      $('#blockItem').html('<option value="">Pilih barang</option>' + active.map(function (item) { return '<option value="' + item.id_barang + '">' + escapeHtml(item.nama_barang) + ' · ' + number(item.total_stok) + ' unit</option>'; }).join(''));
      updateBlockStockHint(); renderBlocks();
    }).fail(function (xhr) { $('#blockRows').html('<tr><td colspan="6"><div class="empty-inline">' + escapeHtml(errorMessage(xhr)) + '</div></td></tr>'); });
    $('#blockItem').on('change', updateBlockStockHint);
    $('#blockStart').on('change', function () { if ($('#blockEnd').val() && $('#blockEnd').val() < this.value) $('#blockEnd').val(this.value); $('#blockEnd').attr('min', this.value || today); });
    $('#blockSearch').on('input', renderBlocks);
    $('#blockForm').on('submit', function (event) {
      event.preventDefault();
      const form = this; $('#blockError').prop('hidden', true).text('');
      if (!form.reportValidity()) return;
      if ($('#blockEnd').val() < $('#blockStart').val()) { showFormError('#blockError', 'Tanggal selesai harus sama dengan atau setelah tanggal mulai.'); return; }
      const $button = $('#blockSubmit').prop('disabled', true).html('<span class="spinner spinner-button"></span> Memeriksa…');
      api('api/blokir.php', 'POST', $(form).serialize() + '&aksi=create').done(function (response) {
        if (!response.success) { showFormError('#blockError', response.message || 'Jadwal tidak dapat disimpan.'); return; }
        showToast(response.message, 'success'); form.reset(); $('#blockQuantity').val('1'); $('#blockEnd').attr('min', today); initBlocks();
      }).fail(function (xhr) { showFormError('#blockError', errorMessage(xhr, 'Jadwal tidak dapat disimpan.')); }).always(function () { $button.prop('disabled', false).html('Simpan jadwal <span>→</span>'); });
    });
  }
  function updateBlockStockHint() {
    const item = state.items.find(function (x) { return String(x.id_barang) === String($('#blockItem').val()); });
    $('#blockStockHint').text(item ? 'Total unit yang dimiliki: ' + number(item.total_stok) + '. Ketersediaan periode akan dicek kembali di server.' : 'Pilih barang aktif untuk melihat total unit.');
  }
  function renderBlocks() {
    const query = String($('#blockSearch').val() || '').trim().toLowerCase();
    const rows = state.blocks.filter(function (block) { return (String(block.nama_barang) + ' ' + String(block.alasan)).toLowerCase().includes(query); });
    $('#blockCount').text(number(state.blocks.length)); $('#blockResultCount').text(number(rows.length) + ' jadwal ditampilkan');
    const upcoming = rows.filter(function (b) { return b.tgl_selesai >= localISODate(new Date()); }).slice(0, 3);
    $('#blockSummary').html(upcoming.length ? upcoming.map(function (b) {
      const parts = dateShort(b.tgl_mulai).split(' ');
      return '<div class="block-summary-item"><div class="block-date-icon"><span>' + escapeHtml(parts[1] || '') + '</span><strong>' + escapeHtml((parts[0] || '').replace(/[^0-9]/g, '')) + '</strong></div><div><strong>' + escapeHtml(b.nama_barang) + '</strong><small>' + escapeHtml(dateShort(b.tgl_mulai)) + ' – ' + escapeHtml(dateShort(b.tgl_selesai)) + ' · ' + number(b.jumlah) + ' unit</small></div><span class="availability-status">Terjadwal</span></div>';
    }).join('') : '<div class="empty-inline">Belum ada jadwal mendatang.</div>');
    if (!rows.length) { $('#blockRows').html('<tr><td colspan="6"><div class="empty-inline">Belum ada jadwal blokir yang cocok.</div></td></tr>'); return; }
    $('#blockRows').html(rows.map(function (b) {
      const past = b.tgl_mulai < localISODate(new Date());
      return '<tr><td><div class="product-copy"><strong>' + escapeHtml(b.nama_barang) + '</strong><small>BL-' + String(b.id_blokir).padStart(4, '0') + '</small></div></td><td><div class="date-range"><strong>' + escapeHtml(dateShort(b.tgl_mulai)) + '</strong><small>s/d ' + escapeHtml(dateShort(b.tgl_selesai)) + '</small></div></td><td><strong>' + number(b.jumlah) + ' unit</strong></td><td><span class="cell-wrap-text">' + escapeHtml(b.alasan) + '</span></td><td><span class="availability-status ' + (past ? 'expired' : '') + '"><i class="block-status-dot ' + (past ? 'past' : 'active') + '"></i>' + (past ? 'Sudah dimulai' : 'Terjadwal') + '</span></td><td>' + (past ? '<span class="muted-copy">Terkunci</span>' : '<button type="button" class="table-action-btn danger" data-delete-block="' + b.id_blokir + '">Hapus jadwal</button>') + '</td></tr>';
    }).join(''));
  }
  $(document).on('click', '[data-delete-block]', function () {
    const id = $(this).attr('data-delete-block');
    if (!window.confirm('Hapus jadwal blokir ini? Ketersediaan akan dihitung ulang setelah dihapus.')) return;
    api('api/blokir.php', 'POST', { aksi: 'delete', id_blokir: id }).done(function (response) {
      if (response.success) { showToast(response.message, 'success'); initBlocks(); } else showToast(response.message || 'Jadwal gagal dihapus.', 'error');
    }).fail(function (xhr) { showToast(errorMessage(xhr), 'error'); });
  });

  // ORDERS AND WORKFLOW
  function initOrders() {
    api('api/pesanan.php').done(function (response) {
      if (!response.success) { showToast(response.message || 'Pesanan gagal dimuat.', 'error'); return; }
      state.orders = response.data || [];
      updateOrderCounts(); renderOrders();
    }).fail(function (xhr) { $('#orderRows').html('<tr><td colspan="7"><div class="empty-inline">' + escapeHtml(errorMessage(xhr)) + '</div></td></tr>'); });
    $('#orderSearch, #orderStatusFilter').off('input.orders change.orders').on('input.orders change.orders', renderOrders);
  }
  function updateOrderCounts() {
    const orders = state.orders;
    $('#ordersPending').text(number(orders.filter(function (o) { return ['ditahan', 'menunggu_keputusan'].includes(o.status_pesanan); }).length));
    $('#ordersPayment').text(number(orders.filter(function (o) { return ['disetujui', 'menunggu_dibayar'].includes(o.status_pesanan); }).length));
    $('#ordersRunning').text(number(orders.filter(function (o) { return ['pembayaran_terkonfirmasi', 'siap_diserahkan', 'sedang_dipakai', 'menunggu_dikembalikan', 'pengembalian_terkonfirmasi'].includes(o.status_pesanan); }).length));
    $('#ordersFinished').text(number(orders.filter(function (o) { return o.status_pesanan === 'selesai'; }).length));
    $('#pendingBadge').text(orders.filter(function (o) { return ['ditahan', 'menunggu_keputusan'].includes(o.status_pesanan); }).length).toggle(orders.some(function (o) { return ['ditahan', 'menunggu_keputusan'].includes(o.status_pesanan); }));
  }
  function orderActionFor(order) {
    const status = order.status_pesanan;
    if (['ditahan', 'menunggu_keputusan'].includes(status)) return { aksi: 'accept', label: 'Terima', danger: false };
    if (['disetujui', 'menunggu_dibayar'].includes(status)) return { aksi: 'confirm_payment', label: 'Konfirmasi bayar', danger: false };
    if (status === 'pembayaran_terkonfirmasi') return { aksi: 'prepare', label: 'Siapkan barang', danger: false };
    if (status === 'siap_diserahkan') return { aksi: 'handover', label: 'Serah-terima', danger: false };
    if (['sedang_dipakai', 'menunggu_dikembalikan'].includes(status)) return { aksi: 'confirm_return', label: 'Konfirmasi kembali', danger: false };
    if (status === 'pengembalian_terkonfirmasi') return { aksi: 'finish', label: 'Selesaikan', danger: false };
    return null;
  }
  function renderOrders() {
    const query = String($('#orderSearch').val() || '').trim().toLowerCase();
    const filter = String($('#orderStatusFilter').val() || 'semua');
    const rows = state.orders.filter(function (order) {
      const text = [order.kode_pesanan, order.nama_pelanggan, order.nama_barang, order.email_pelanggan].join(' ').toLowerCase();
      const isPending = filter === 'pending' && ['ditahan', 'menunggu_keputusan'].includes(order.status_pesanan);
      const matchesStatus = filter === 'semua' || isPending || order.status_pesanan === filter;
      return text.includes(query) && matchesStatus;
    });
    $('#orderResultCount').text(number(rows.length) + ' pesanan ditampilkan dari ' + number(state.orders.length));
    if (!rows.length) { $('#orderRows').html('<tr><td colspan="7"><div class="empty-inline">Tidak ada pesanan dengan filter tersebut.</div></td></tr>'); return; }
    $('#orderRows').html(rows.map(function (order) {
      const action = orderActionFor(order);
      const actionButton = action ? '<button type="button" class="table-action-btn" data-order-action="' + action.aksi + '" data-order-id="' + order.id_pesanan + '">' + escapeHtml(action.label) + '</button>' : '';
      const rejectButton = ['ditahan', 'menunggu_keputusan'].includes(order.status_pesanan) ? '<button type="button" class="icon-action danger" title="Tolak pesanan" aria-label="Tolak pesanan" data-order-action="reject" data-order-id="' + order.id_pesanan + '">×</button>' : '';
      return '<tr><td><div class="order-code"><strong>' + escapeHtml(order.kode_pesanan) + '</strong><small>' + escapeHtml(dateTime(order.created_at)) + '</small></div></td><td><div class="person-cell"><span class="person-avatar">' + escapeHtml(initials(order.nama_pelanggan)) + '</span><div class="person-copy"><strong>' + escapeHtml(order.nama_pelanggan) + '</strong><small>' + escapeHtml(order.hp_pelanggan || order.email_pelanggan || 'Pelanggan') + '</small></div></div></td><td><div class="product-copy"><strong>' + escapeHtml(order.nama_barang) + '</strong><small>' + number(order.jumlah) + ' unit</small></div></td><td><div class="date-range"><strong>' + escapeHtml(dateShort(order.tgl_mulai)) + '</strong><small>s/d ' + escapeHtml(dateShort(order.tgl_selesai)) + '</small></div></td><td><strong>' + escapeHtml(money(order.total_harga)) + '</strong></td><td>' + statusBadge(order.status_pesanan) + '</td><td><div class="order-status-actions"><button class="icon-action" type="button" data-order-detail="' + order.id_pesanan + '" title="Lihat detail" aria-label="Lihat detail">⌕</button>' + actionButton + rejectButton + '</div></td></tr>';
    }).join(''));
  }
  $(document).on('click', '[data-order-action]', function () {
    const order = state.orders.find(function (x) { return String(x.id_pesanan) === String($(this).attr('data-order-id')); }.bind(this));
    if (!order) return;
    openOrderAction(order, $(this).attr('data-order-action'));
  });
  function openOrderAction(order, action) {
    const titleMap = { accept: 'Terima pesanan', reject: 'Tolak pesanan', confirm_payment: 'Konfirmasi pembayaran', prepare: 'Siapkan barang', handover: 'Catat serah-terima', confirm_return: 'Konfirmasi pengembalian', finish: 'Selesaikan pesanan' };
    const descMap = { accept: 'Pesanan akan masuk ke tahap menunggu pembayaran.', reject: 'Berikan alasan yang jelas agar keputusan terdokumentasi.', confirm_payment: 'Pastikan pembayaran di luar website sudah benar-benar diterima.', prepare: 'Tandai barang sudah siap untuk diserahkan kepada pelanggan.', handover: 'Catat kondisi barang pada saat diserahkan.', confirm_return: 'Periksa kondisi barang saat dikembalikan pelanggan.', finish: 'Pesanan akan dipindahkan ke riwayat selesai.' };
    $('#orderActionTitle').text(titleMap[action] || 'Proses pesanan');
    $('#orderDialogTitle').text(titleMap[action] || 'Proses pesanan');
    $('#orderDialogDescription').text(descMap[action] || 'Konfirmasi tindakan untuk pesanan ini.');
    $('#orderActionId').val(order.id_pesanan); $('#orderActionType').val(action); $('#orderActionNotes').val(''); $('#paymentMethod').val('Dikonfirmasi penyedia');
    $('#orderActionContext').html('<strong>' + escapeHtml(order.kode_pesanan + ' · ' + order.nama_barang) + '</strong><span>' + escapeHtml(order.nama_pelanggan + ' · ' + dateShort(order.tgl_mulai) + ' – ' + dateShort(order.tgl_selesai) + ' · ' + money(order.total_harga)) + '</span>');
    const fields = {
      reject: ['Alasan penolakan', 'alasan_penolakan', 'Tuliskan alasan yang akan tercatat pada pesanan.'],
      handover: ['Catatan kondisi awal barang', 'catatan_kondisi', 'Contoh: kamera, baterai, tas, dan aksesori telah diperiksa.'],
      confirm_return: ['Kondisi barang saat pengembalian', 'kondisi_barang', 'Catat kondisi akhir, kelengkapan, atau kerusakan yang terlihat.']
    };
    const field = fields[action];
    $('#orderActionFieldGroup').prop('hidden', !field);
    if (field) { $('#orderActionFieldLabel').html(escapeHtml(field[0]) + ' <span>*</span>'); $('#orderActionNotes').attr('placeholder', field[2]); }
    $('#paymentMethodGroup').prop('hidden', action !== 'confirm_payment');
    $('#confirmOrderAction').text(action === 'reject' ? 'Tolak pesanan' : action === 'finish' ? 'Selesaikan pesanan' : 'Konfirmasi tindakan →');
    if (action === 'reject') $('#confirmOrderAction').removeClass('btn-primary').addClass('btn-danger'); else $('#confirmOrderAction').removeClass('btn-danger').addClass('btn-primary');
    const dialog = document.getElementById('orderActionDialog'); if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }
  $(document).on('submit', '#orderActionForm', function (event) {
    event.preventDefault();
    const action = $('#orderActionType').val();
    const data = { id_pesanan: $('#orderActionId').val(), aksi: action };
    if (['reject', 'handover', 'confirm_return'].includes(action)) {
      const notes = String($('#orderActionNotes').val() || '').trim();
      if (!notes) { showToast('Catatan wajib diisi untuk tindakan ini.', 'error'); $('#orderActionNotes').trigger('focus'); return; }
      if (action === 'reject') data.alasan_penolakan = notes;
      if (action === 'handover') data.catatan_kondisi = notes;
      if (action === 'confirm_return') data.kondisi_barang = notes;
    }
    if (action === 'confirm_payment') data.metode_pembayaran = $('#paymentMethod').val();
    const $button = $('#confirmOrderAction').prop('disabled', true).text('Memproses…');
    api('api/pesanan.php', 'POST', data).done(function (response) {
      if (!response.success) { showToast(response.message || 'Tindakan gagal.', 'error'); return; }
      document.getElementById('orderActionDialog').close(); showToast(response.message, 'success'); initOrders();
    }).fail(function (xhr) { showToast(errorMessage(xhr), 'error'); }).always(function () { $button.prop('disabled', false); });
  });
  $(document).on('click', '[data-order-detail]', function () {
    const order = state.orders.find(function (x) { return String(x.id_pesanan) === String($(this).attr('data-order-detail')); }.bind(this));
    if (!order) return;
    const details = [
      ['Kode pesanan', order.kode_pesanan], ['Status', statusMap[order.status_pesanan] ? statusMap[order.status_pesanan][0] : order.status_pesanan],
      ['Pelanggan', order.nama_pelanggan], ['Kontak', order.hp_pelanggan || order.email_pelanggan || '—'],
      ['Barang', order.nama_barang], ['Jumlah unit', number(order.jumlah) + ' unit'],
      ['Tanggal mulai', dateShort(order.tgl_mulai)], ['Tanggal selesai', dateShort(order.tgl_selesai)],
      ['Total sewa', money(order.total_harga)], ['Pembayaran', (order.status_pembayaran || 'belum tercatat') + (order.metode_pembayaran ? ' · ' + order.metode_pembayaran : '')],
      ['Dibuat pada', dateTime(order.created_at)], ['Tanggal serah terima', dateTime(order.tgl_serah)],
      ['Kondisi saat diserahkan', order.catatan_kondisi || 'Belum ada catatan'], ['Tanggal pengembalian', dateTime(order.tgl_kembali)],
      ['Kondisi saat kembali', order.kondisi_barang || 'Belum ada catatan']
    ];
    if (order.alasan_penolakan) details.push(['Alasan penolakan', order.alasan_penolakan]);
    $('#orderDetailContent').html(details.map(function (pair) { return '<div class="detail-cell' + (String(pair[0]).includes('Kondisi') || pair[0] === 'Alasan penolakan' ? ' wide' : '') + '"><small>' + escapeHtml(pair[0]) + '</small><strong>' + escapeHtml(pair[1]) + '</strong></div>'; }).join(''));
    const dialog = document.getElementById('orderDetailDialog'); if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  });

  // REPORTS
  function initReports() {
    const today = localISODate(new Date());
    const from = new Date(); from.setDate(1); from.setMonth(from.getMonth() - 5);
    $('#reportFrom').val(localISODate(from)); $('#reportTo').val(today);
    loadReport();
    $('#reportFilter').on('submit', function (event) { event.preventDefault(); if ($('#reportFrom').val() > $('#reportTo').val()) { showToast('Tanggal awal tidak boleh melewati tanggal akhir.', 'error'); return; } loadReport(); });
    $('#exportReport').on('click', exportReportCsv);
  }
  function loadReport() {
    const from = $('#reportFrom').val(); const to = $('#reportTo').val();
    api('api/laporan.php?dari=' + encodeURIComponent(from) + '&sampai=' + encodeURIComponent(to)).done(function (response) {
      if (!response.success) { showToast(response.message || 'Laporan gagal dimuat.', 'error'); return; }
      state.report = response.data; const data = response.data; const summary = data.ringkasan;
      $('#reportOrders').text(number(summary.total_pesanan)); $('#reportFinished').text(number(summary.selesai)); $('#reportRevenue').text(money(summary.pendapatan)); $('#reportRejected').text(number(summary.ditolak));
      const monthly = (data.pendapatan_bulanan || []).map(function (row) { return { bulan: row.bulan, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(row.bulan + '-01T00:00:00')), total: Number(row.total) }; });
      renderRevenueChart('#reportRevenueChart', monthly, false);
      renderStatusBreakdown(data.distribusi_status || []);
      renderTopItems(data.barang_teratas || []);
    }).fail(function (xhr) { showToast(errorMessage(xhr, 'Laporan gagal dimuat.'), 'error'); });
  }
  function renderStatusBreakdown(rows) {
    if (!rows.length) { $('#reportStatusList').html('<div class="empty-inline">Belum ada pesanan pada periode terpilih.</div>'); return; }
    const max = Math.max(1, ...rows.map(function (r) { return Number(r.total) || 0; }));
    $('#reportStatusList').html(rows.map(function (row) {
      const label = statusMap[row.status_pesanan] ? statusMap[row.status_pesanan][0] : row.status_pesanan.replace(/_/g, ' ');
      return '<div class="status-breakdown-item"><div class="status-breakdown-line"><span>' + escapeHtml(label) + '</span><strong>' + number(row.total) + '</strong></div><div class="status-track"><span style="width:' + Math.max(3, Number(row.total) / max * 100) + '%"></span></div></div>';
    }).join(''));
  }
  function renderTopItems(rows) {
    if (!rows.length) { $('#topItemsRows').html('<tr><td colspan="4"><div class="empty-inline">Belum ada data barang pada periode terpilih.</div></td></tr>'); return; }
    $('#topItemsRows').html(rows.map(function (row, index) { return '<tr><td><span class="person-avatar">' + (index + 1) + '</span></td><td><strong>' + escapeHtml(row.nama_barang) + '</strong></td><td>' + number(row.jumlah_pesanan) + '</td><td><strong>' + escapeHtml(money(row.pendapatan)) + '</strong></td></tr>'; }).join(''));
  }
  function exportReportCsv() {
    if (!state.report) { showToast('Muat laporan terlebih dahulu sebelum ekspor.', 'error'); return; }
    const lines = [['Laporan RuangSewa'], ['Periode', state.report.dari, state.report.sampai], [], ['Ringkasan', 'Nilai'], ['Total pesanan', state.report.ringkasan.total_pesanan], ['Pesanan selesai', state.report.ringkasan.selesai], ['Pesanan ditolak', state.report.ringkasan.ditolak], ['Pendapatan', state.report.ringkasan.pendapatan], [], ['Barang', 'Jumlah pesanan', 'Pendapatan']];
    (state.report.barang_teratas || []).forEach(function (row) { lines.push([row.nama_barang, row.jumlah_pesanan, row.pendapatan]); });
    const csv = '\ufeff' + lines.map(function (line) { return line.map(function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'laporan-ruangsewa-' + state.report.dari + '-sampai-' + state.report.sampai + '.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  // ACTIVITY LOG
  function initActivity() {
    api('api/aktivitas.php').done(function (response) {
      if (!response.success) { showToast(response.message || 'Log aktivitas gagal dimuat.', 'error'); return; }
      state.activity = response.data || []; renderActivity();
    }).fail(function (xhr) { $('#activityRows').html('<tr><td colspan="4"><div class="empty-inline">' + escapeHtml(errorMessage(xhr)) + '</div></td></tr>'); });
    $('#activitySearch').on('input', renderActivity); $('#refreshActivity').on('click', function () { initActivity(); showToast('Log aktivitas diperbarui.', 'success'); });
  }
  function renderActivity() {
    const query = String($('#activitySearch').val() || '').trim().toLowerCase();
    const rows = state.activity.filter(function (row) { return [row.aksi, row.tabel_terkait, row.keterangan, row.nama_pengguna].join(' ').toLowerCase().includes(query); });
    $('#activityCount').text(number(rows.length) + ' aktivitas ditampilkan');
    if (!rows.length) { $('#activityRows').html('<tr><td colspan="4"><div class="empty-inline">Belum ada aktivitas yang cocok.</div></td></tr>'); return; }
    $('#activityRows').html(rows.map(function (row) {
      return '<tr><td><div class="activity-time"><strong>' + escapeHtml(dateTime(row.created_at)) + '</strong><small>Log #' + escapeHtml(row.id_log) + '</small></div></td><td><span class="activity-action">' + escapeHtml(row.aksi.replace(/_/g, ' ')) + '</span></td><td><span class="activity-object">' + escapeHtml(row.tabel_terkait || 'sistem') + (row.id_terkait ? ' · #' + escapeHtml(row.id_terkait) : '') + '</span></td><td class="activity-description">' + escapeHtml(row.keterangan || '—') + '</td></tr>';
    }).join(''));
  }

  $(document).on('error', 'img.product-image', function () { $(this).closest('.product-thumb').html('<span>▤</span>'); });

  // GLOBAL NAVIGATION AND SESSION
  $(document).on('click', 'a[data-page]', function (event) {
    const route = $(this).attr('data-page');
    if (!routes[route]) return;
    event.preventDefault(); navigate(route);
  });
  $(document).on('click', '[data-route]', function (event) { event.preventDefault(); navigate($(this).attr('data-route')); });
  $(document).on('click', '[data-close-dialog]', function () { const dialog = document.getElementById($(this).attr('data-close-dialog')); if (dialog && dialog.open) dialog.close(); });
  $('#mobileMenu').on('click', function () { $('#sidebar').toggleClass('sidebar-open'); $('#mobileOverlay').toggleClass('active'); });
  $('#mobileOverlay').on('click', function () { $('#sidebar').removeClass('sidebar-open'); $(this).removeClass('active'); });
  $('#logoutButton').on('click', function () {
    if (!window.confirm('Keluar dari dashboard penyedia?')) return;
    api('api/auth.php', 'POST', { aksi: 'logout' }, { noRedirect: true }).always(function () { window.location.replace('login.html'); });
  });
  window.addEventListener('hashchange', function () { loadPage(routeFromHash()); });

  api('api/auth.php', 'GET', null, { noRedirect: true }).done(function (response) {
    if (!response.authenticated) { window.location.replace('login.html'); return; }
    state.csrf = response.csrf_token || ''; state.user = response.data;
    $('#authCheck').prop('hidden', true); $('#appShell').prop('hidden', false);
    const badge = initials(state.user.nama); $('#sidebarAvatar, #topAvatar').text(badge);
    $('#providerNameSidebar, #providerNameTop').text(state.user.nama); $('#providerEmailTop').text(state.user.email); $('#storeNameSidebar').text(state.user.nama_toko);
    loadPage(routeFromHash());
    // Seed the pending count while user can navigate from any route.
    api('api/dashboard.php').done(function (r) { if (r.success) $('#pendingBadge').text(number(r.data.pesanan_menunggu)).toggle(Number(r.data.pesanan_menunggu) > 0); });
  }).fail(function () { window.location.replace('login.html'); });
})(jQuery);
