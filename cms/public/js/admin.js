console.log('admin.js carregado');

// ── MARKDOWN PREVIEW (client-side only, não bloqueia submit) ──
function mdPreview(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<)(.+)$/gm, function(m) { return m.startsWith('<') ? m : '<p>' + m + '</p>'; });
}

function updatePreview() {
  var ta = document.getElementById('e-content');
  var prev = document.getElementById('e-preview');
  if (ta && prev) prev.innerHTML = mdPreview(ta.value);
}

// ── SLUG AUTO ──
function slugifyStr(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function autoSlug(val) {
  var slugEl = document.getElementById('e-slug');
  var previewEl = document.getElementById('slug-preview');
  if (slugEl && !slugEl.dataset.manual) {
    slugEl.value = slugifyStr(val);
  }
  if (previewEl) previewEl.textContent = '/' + (slugEl ? slugEl.value : slugifyStr(val));
}

// ── INSERIR MARKDOWN ──
function insertMd(syntax) {
  var ta = document.getElementById('e-content');
  if (!ta) return;
  var start = ta.selectionStart;
  var end = ta.selectionEnd;
  var selected = ta.value.slice(start, end);
  var replacement = selected ? syntax.replace('texto', selected) : syntax;
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  ta.focus();
  updatePreview();
}

// ── THEME TOGGLE ──
function initTheme() {
  var btn  = document.getElementById('theme-toggle');
  var icon = document.getElementById('theme-icon');
  if (!btn) return;

  function getEffective() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateIcon() {
    if (!icon) return;
    icon.className = getEffective() === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  }

  btn.addEventListener('click', function() {
    var next = getEffective() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.style.colorScheme = next;
    updateIcon();
  });

  updateIcon();
}

// ── SIDEBAR COLLAPSE ──
function initSidebarToggle() {
  var sidebar = document.getElementById('sidebar');
  var mainContent = document.getElementById('mainContent');
  var toggleBtn = document.getElementById('sidebarToggle');
  var toggleIcon = document.getElementById('sidebarToggleIcon');
  if (!sidebar || !toggleBtn) return;

  function setCollapsed(collapsed) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
      toggleIcon.className = 'bi bi-layout-sidebar';
      toggleBtn.title = 'Expandir sidebar';
    } else {
      sidebar.classList.remove('collapsed');
      if (mainContent) mainContent.classList.remove('sidebar-collapsed');
      toggleIcon.className = 'bi bi-layout-sidebar-reverse';
      toggleBtn.title = 'Minimizar sidebar';
    }
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  }

  // Restaurar estado guardado
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    setCollapsed(true);
  }

  toggleBtn.addEventListener('click', function() {
    setCollapsed(!sidebar.classList.contains('collapsed'));
  });
}

// ── AVISO ALTERAÇÕES NÃO GUARDADAS ──
function initUnsavedChanges() {
  var isDirty = false;
  var pendingUrl = null;

  var modal   = document.getElementById('unsaved-modal');
  var btnLeave = document.getElementById('unsaved-leave');
  var btnStay  = document.getElementById('unsaved-stay');

  if (!modal) return;

  function showModal() { modal.classList.add('active'); }
  function hideModal() { modal.classList.remove('active'); }

  // Marca sujo quando qualquer campo de formulário com data-unsaved muda
  document.querySelectorAll('form[data-unsaved]').forEach(function(form) {
    form.addEventListener('input',  function() { isDirty = true; });
    form.addEventListener('change', function() { isDirty = true; });
    // Limpa ao submeter (guardar/publicar)
    form.addEventListener('submit', function() { isDirty = false; });
  });

  // Aviso do browser para refresh/fechar aba/back
  window.addEventListener('beforeunload', function(e) {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // Interceta cliques em links de navegação interna
  document.addEventListener('click', function(e) {
    if (!isDirty) return;
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;
    if (link.target === '_blank') return;

    e.preventDefault();
    pendingUrl = href;
    showModal();
  });

  if (btnLeave) {
    btnLeave.addEventListener('click', function() {
      isDirty = false;
      hideModal();
      if (pendingUrl) window.location.href = pendingUrl;
    });
  }

  if (btnStay) {
    btnStay.addEventListener('click', function() {
      hideModal();
      pendingUrl = null;
    });
  }

  // Fechar modal ao clicar fora do diálogo
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      hideModal();
      pendingUrl = null;
    }
  });
}

// ── INICIALIZAÇÃO ──
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  initSidebarToggle();
  initUnsavedChanges();
  // Slug manual
  var slugEl = document.getElementById('e-slug');
  if (slugEl) {
    slugEl.addEventListener('input', function() {
      slugEl.dataset.manual = 'true';
      var previewEl = document.getElementById('slug-preview');
      if (previewEl) previewEl.textContent = '/' + slugEl.value;
    });
  }

  // Preview inicial
  updatePreview();

  // Mostrar flash message como toast se existir
  var flash = document.getElementById('flash-data');
  if (flash) {
    var msg = flash.dataset.msg;
    var type = flash.dataset.type || 'success';
    if (msg) showToast(msg, type);
  }
});

function showToast(msg, type) {
  var el = document.getElementById('toast');
  if (!el) return;
  document.getElementById('toast-icon').textContent = type === 'success' ? '✓' : '✕';
  document.getElementById('toast-msg').textContent = msg;
  el.className = 'show ' + type;
  setTimeout(function() { el.className = ''; }, 3000);
}
